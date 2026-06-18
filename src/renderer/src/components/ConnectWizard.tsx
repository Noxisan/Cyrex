import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, KeyRound, MonitorSmartphone } from 'lucide-react'
import type { HostingProviderId } from '@shared/types'
import {
  useClearOAuthApp,
  useConnectToken,
  useProviders,
  useSetOAuthApp
} from '../hooks/useHosting'
import { ProviderIcon } from './BrandIcon'

// Loopback callback the Bitbucket OAuth consumer must be registered with (matches
// REDIRECT_PORT in the main-process bitbucket adapter).
const BITBUCKET_CALLBACK = 'http://localhost:47600/callback'

// A valid URL to drop into the required Homepage/Redirect/callback fields of a
// GitHub or GitLab OAuth app. Device flow never uses it, so any valid URL works;
// the project URL is tidy.
const OAUTH_PLACEHOLDER_URL = 'https://github.com/Noxisan/Cyrex'

// i18n key for the client-id field placeholder, per provider's own terminology.
const CLIENT_ID_PLACEHOLDER_KEY: Record<HostingProviderId, string> = {
  github: 'hosting.oauthClientIdPlaceholder',
  gitlab: 'hosting.glClientIdPlaceholder',
  bitbucket: 'hosting.oauthKeyPlaceholder'
}

const PROVIDER_LABEL: Record<HostingProviderId, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket'
}

// Browser login uses different OAuth flows: device flow (GitHub/GitLab) needs
// only a public client id, while an authorization-code consumer (Bitbucket)
// also needs a client secret. This drives whether the setup step asks for one.
const NEEDS_OAUTH_SECRET: Record<HostingProviderId, boolean> = {
  github: false,
  gitlab: false,
  bitbucket: true
}

/**
 * Guided account-connect wizard. Pick a provider, then log in via the browser or
 * paste a personal access token. Browser login uses OAuth: GitHub/GitLab via device
 * flow, Bitbucket via an authorization-code consumer. When a provider needs an OAuth
 * app that isn't configured yet (Bitbucket), a one-time setup step collects the
 * consumer key/secret (stored in the keychain) before login. The renderer only ever
 * sees the device user code and the resulting account metadata — never tokens.
 */
export function ConnectWizard({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: providers } = useProviders()
  const connectToken = useConnectToken()
  const setOAuthApp = useSetOAuthApp()
  const clearOAuthApp = useClearOAuthApp()

  const [provider, setProvider] = useState<HostingProviderId | null>(null)
  const [mode, setMode] = useState<'choose' | 'device' | 'token' | 'oauthSetup'>('choose')
  const [token, setToken] = useState('')
  const [oauthId, setOauthId] = useState('')
  const [oauthSecret, setOauthSecret] = useState('')
  const [device, setDevice] = useState<{
    userCode: string
    verificationUri: string
  } | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const cancelled = useRef(false)

  // Reset on mount and set on unmount. The reset matters under React StrictMode,
  // whose mount→unmount→mount cycle would otherwise leave `cancelled` stuck true
  // (from the first cleanup) and silently kill the device-login poll loop.
  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  const deviceFlow = (id: HostingProviderId): boolean =>
    providers?.find((p) => p.id === id)?.deviceFlow ?? false

  const oauthConfigurable = (id: HostingProviderId): boolean =>
    providers?.find((p) => p.id === id)?.oauthConfigurable ?? false

  // Browser login is offered when it's ready now, or when the user can set up an
  // OAuth app to unlock it (then we route through the one-time setup step first).
  const canBrowserLogin = (id: HostingProviderId): boolean =>
    deviceFlow(id) || oauthConfigurable(id)

  function onBrowserLogin(id: HostingProviderId): void {
    if (deviceFlow(id)) void startDevice(id)
    else {
      setProvider(id)
      setMode('oauthSetup')
    }
  }

  function saveOAuthApp(): void {
    if (!provider || !oauthId.trim()) return
    if (NEEDS_OAUTH_SECRET[provider] && !oauthSecret.trim()) return
    setOAuthApp.mutate(
      { provider, clientId: oauthId.trim(), clientSecret: oauthSecret.trim() },
      {
        onSuccess: () => {
          setOauthSecret('')
          void startDevice(provider)
        }
      }
    )
  }

  async function startDevice(id: HostingProviderId): Promise<void> {
    setProvider(id)
    setMode('device')
    setStatus(t('hosting.starting'))
    const res = await window.cyrex.hosting.startLogin(id)
    if (!res.ok) {
      setStatus(res.error)
      return
    }
    setDevice({ userCode: res.data.userCode, verificationUri: res.data.verificationUri })
    setStatus(t('hosting.waiting'))
    let interval = res.data.intervalSec * 1000
    const poll = async (): Promise<void> => {
      if (cancelled.current) return
      const p = await window.cyrex.hosting.pollLogin(res.data.handle)
      if (cancelled.current) return
      if (!p.ok) {
        setStatus(p.error)
        return
      }
      if (p.data.status === 'authorized') {
        void qc.invalidateQueries({ queryKey: ['hostingAccounts'] })
        onClose()
        return
      }
      if (p.data.status === 'expired') return setStatus(t('hosting.expired'))
      if (p.data.status === 'denied') return setStatus(t('hosting.denied'))
      if (p.data.status === 'slowDown') interval += 2000
      setTimeout(poll, interval)
    }
    setTimeout(poll, interval)
  }

  function submitToken(): void {
    if (!provider || !token.trim()) return
    connectToken.mutate(
      { provider, token: token.trim() },
      { onSuccess: () => onClose() }
    )
  }

  // Provider picker
  if (mode === 'choose') {
    return (
      <div>
        <h3 className="mb-3 text-sm font-semibold text-fg">{t('hosting.connectTitle')}</h3>
        <div className="flex flex-col gap-1.5">
          {(providers ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id)}
              className={`flex items-center gap-2.5 rounded-[var(--radius-card)] border px-3 py-2 text-start text-xs ${
                provider === p.id
                  ? 'border-accent bg-surface-2 text-fg'
                  : 'border-border text-fg-muted hover:bg-surface-2'
              }`}
            >
              <ProviderIcon id={p.id} size={16} />
              <span className="font-medium">{PROVIDER_LABEL[p.id]}</span>
            </button>
          ))}
        </div>

        {provider && (
          <div className="mt-4 flex flex-col gap-1.5">
            {canBrowserLogin(provider) && (
              <button
                type="button"
                onClick={() => onBrowserLogin(provider)}
                className="flex items-center gap-2 rounded-[var(--radius-card)] bg-accent px-3 py-2 text-xs font-medium text-accent-fg hover:bg-accent-hover"
              >
                <MonitorSmartphone size={15} strokeWidth={1.75} />
                {t('hosting.loginBrowser')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode('token')}
              className="flex items-center gap-2 rounded-[var(--radius-card)] border border-border px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <KeyRound size={15} strokeWidth={1.75} />
              {t(canBrowserLogin(provider) ? 'hosting.useToken' : 'hosting.useTokenOnly')}
            </button>
            {/* Re-enter the OAuth consumer (e.g. to switch to a new app). Only
                meaningful once one is already stored — otherwise "Log in with
                browser" already routes through setup. */}
            {oauthConfigurable(provider) && deviceFlow(provider) && (
              <button
                type="button"
                onClick={() => {
                  setProvider(provider)
                  setMode('oauthSetup')
                }}
                className="mt-0.5 self-start text-[11px] text-fg-subtle underline-offset-2 hover:text-fg hover:underline"
              >
                {t('hosting.changeOAuthApp')}
              </button>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-card)] px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    )
  }

  // Device-flow waiting panel
  if (mode === 'device') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setMode('choose')}
          className="mb-3 flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={13} /> {t('common.cancel')}
        </button>
        <h3 className="mb-1 text-sm font-semibold text-fg">{t('hosting.loginBrowser')}</h3>
        <p className="mb-3 text-xs text-fg-muted">
          {device?.userCode ? t('hosting.deviceHint') : t('hosting.approveHint')}
        </p>
        {device?.userCode && (
          <>
            <div className="mb-3 rounded-[var(--radius-card)] border border-border bg-bg px-3 py-3 text-center">
              <div className="font-mono text-xl tracking-[0.3em] text-fg">{device.userCode}</div>
            </div>
            <p className="break-all text-[11px] text-fg-subtle">{device.verificationUri}</p>
          </>
        )}
        {status && <p className="mt-3 text-xs text-fg-muted">{status}</p>}
      </div>
    )
  }

  // One-time OAuth-app setup panel (e.g. Bitbucket consumer key/secret).
  if (mode === 'oauthSetup') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setMode('choose')}
          className="mb-3 flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={13} /> {t('common.cancel')}
        </button>
        <h3 className="mb-1 text-sm font-semibold text-fg">
          {t('hosting.oauthSetupTitle', { provider: provider ? PROVIDER_LABEL[provider] : '' })}
        </h3>
        <p className="mb-3 text-xs text-fg-muted">
          {t(
            provider === 'bitbucket'
              ? 'hosting.oauthSetupHint'
              : provider === 'gitlab'
                ? 'hosting.glOauthSetupHint'
                : 'hosting.ghOauthSetupHint'
          )}
        </p>
        <ol className="mb-3 list-decimal space-y-1 ps-4 text-[11px] text-fg-subtle">
          {provider === 'bitbucket' ? (
            <>
              <li>{t('hosting.oauthStep1')}</li>
              <li>
                {t('hosting.oauthStep2')}{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 text-fg-muted">
                  {BITBUCKET_CALLBACK}
                </code>
              </li>
              <li>{t('hosting.oauthStep3')}</li>
            </>
          ) : provider === 'gitlab' ? (
            <>
              <li>{t('hosting.glOauthStep1')}</li>
              <li>
                {t('hosting.glOauthStep2')}{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 text-fg-muted">
                  {OAUTH_PLACEHOLDER_URL}
                </code>
              </li>
              <li>{t('hosting.glOauthStep3')}</li>
              <li>{t('hosting.glOauthStep4')}</li>
            </>
          ) : (
            <>
              <li>{t('hosting.ghOauthStep1')}</li>
              <li>
                {t('hosting.ghOauthStep2')}{' '}
                <code className="rounded bg-surface-2 px-1 py-0.5 text-fg-muted">
                  {OAUTH_PLACEHOLDER_URL}
                </code>
              </li>
              <li>{t('hosting.ghOauthStep3')}</li>
              <li>{t('hosting.ghOauthStep4')}</li>
            </>
          )}
        </ol>
        <input
          autoFocus
          type="text"
          value={oauthId}
          placeholder={provider ? t(CLIENT_ID_PLACEHOLDER_KEY[provider]) : ''}
          onChange={(e) => setOauthId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && provider && !NEEDS_OAUTH_SECRET[provider]) saveOAuthApp()
          }}
          className="mb-2 w-full rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent"
        />
        {provider && NEEDS_OAUTH_SECRET[provider] && (
          <input
            type="password"
            value={oauthSecret}
            placeholder={t('hosting.oauthSecretPlaceholder')}
            onChange={(e) => setOauthSecret(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveOAuthApp()
            }}
            className="mb-2 w-full rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent"
          />
        )}
        <div className="flex items-center justify-between gap-2">
          {/* Forget an already-stored consumer (e.g. before switching apps). */}
          {provider && deviceFlow(provider) ? (
            <button
              type="button"
              onClick={() => {
                if (!provider) return
                clearOAuthApp.mutate(provider, { onSuccess: () => setMode('choose') })
              }}
              disabled={clearOAuthApp.isPending}
              className="text-[11px] text-fg-subtle underline-offset-2 hover:text-danger hover:underline disabled:opacity-40"
            >
              {t('hosting.removeOAuthApp')}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="rounded-[var(--radius-card)] px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={saveOAuthApp}
              disabled={
                !oauthId.trim() ||
                (provider != null && NEEDS_OAUTH_SECRET[provider] && !oauthSecret.trim()) ||
                setOAuthApp.isPending
              }
              className="rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-40"
            >
              {t('hosting.oauthSaveLogin')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Token paste panel
  return (
    <div>
      <button
        type="button"
        onClick={() => setMode('choose')}
        className="mb-3 flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft size={13} /> {t('common.cancel')}
      </button>
      <h3 className="mb-1 text-sm font-semibold text-fg">
        {t('hosting.tokenTitle', { provider: provider ? PROVIDER_LABEL[provider] : '' })}
      </h3>
      <p className="mb-3 text-xs text-fg-muted">
        {provider
          ? t(`hosting.tokenHint_${provider}`, { defaultValue: t('hosting.tokenHint') })
          : t('hosting.tokenHint')}
      </p>
      <input
        autoFocus
        type="password"
        value={token}
        placeholder={
          provider === 'bitbucket' ? 'email:api_token' : t('hosting.tokenPlaceholder')
        }
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submitToken()
        }}
        className="mb-3 w-full rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent"
      />
      {connectToken.isError && (
        <p className="mb-3 text-xs leading-relaxed text-danger">
          {(connectToken.error as Error).message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setMode('choose')}
          className="rounded-[var(--radius-card)] px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={submitToken}
          disabled={!token.trim() || connectToken.isPending}
          className="rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-40"
        >
          {t('hosting.connect')}
        </button>
      </div>
    </div>
  )
}
