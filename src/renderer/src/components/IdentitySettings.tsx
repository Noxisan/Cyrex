import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRepoStore } from '../store/repoStore'
import { useToastStore } from '../store/toastStore'
import {
  useClearRepoIdentity,
  useIdentity,
  useSetGlobalIdentity,
  useSetRepoIdentity
} from '../hooks/useRepo'

function Field({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string
  value: string
  placeholder: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <label className="mb-2 flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-fg-muted">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1 text-xs text-fg outline-none focus:border-accent"
      />
    </label>
  )
}

/**
 * Settings → Git: view and configure the author identity recorded on commits —
 * the global identity, and a per-repository override for the open repo.
 */
export function IdentitySettings(): React.JSX.Element {
  const { t } = useTranslation()
  const activePath = useRepoStore((s) => s.activePath)
  const repoName = useRepoStore((s) => s.repos.find((r) => r.path === s.activePath)?.name ?? '')
  const pushToast = useToastStore((s) => s.push)

  const { data, isLoading } = useIdentity(activePath)
  const setGlobal = useSetGlobalIdentity()
  const setRepo = useSetRepoIdentity(activePath ?? '')
  const clearRepo = useClearRepoIdentity(activePath ?? '')

  const [gName, setGName] = useState('')
  const [gEmail, setGEmail] = useState('')
  const [rName, setRName] = useState('')
  const [rEmail, setREmail] = useState('')

  // Keep the inputs in sync with the actual config (and after a save refetch).
  // The repo inputs prefill with the local override, or the inherited effective
  // identity so editing starts from what commits currently use.
  useEffect(() => {
    if (!data) return
    setGName(data.global.name)
    setGEmail(data.global.email)
    setRName(data.local.name || data.effective.name)
    setREmail(data.local.email || data.effective.email)
  }, [data])

  if (isLoading || !data) {
    return <p className="text-xs text-fg-subtle">{t('common.loading', { defaultValue: '…' })}</p>
  }

  const hasLocal = !!(data.local.name || data.local.email)
  const globalDirty =
    gName.trim() !== data.global.name || gEmail.trim() !== data.global.email
  const repoDirty =
    rName.trim() !== (data.local.name || data.effective.name) ||
    rEmail.trim() !== (data.local.email || data.effective.email)

  const saveGlobal = (): void => {
    if (!gName.trim() || !gEmail.trim()) return
    setGlobal.mutate(
      { name: gName.trim(), email: gEmail.trim() },
      { onSuccess: () => pushToast(t('identity.saved'), 'success') }
    )
  }
  const saveRepo = (): void => {
    if (!activePath || !rName.trim() || !rEmail.trim()) return
    setRepo.mutate(
      { name: rName.trim(), email: rEmail.trim() },
      { onSuccess: () => pushToast(t('identity.saved'), 'success') }
    )
  }
  const useGlobal = (): void => {
    if (!activePath) return
    clearRepo.mutate(undefined, { onSuccess: () => pushToast(t('identity.usingGlobal'), 'success') })
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-fg">{t('identity.title')}</h3>
      <p className="mb-4 text-[11px] leading-relaxed text-fg-subtle">{t('identity.hint')}</p>

      {/* Global identity */}
      <p className="mb-2 text-xs font-medium text-fg">{t('identity.global')}</p>
      <Field label={t('identity.name')} value={gName} placeholder="Jane Doe" onChange={setGName} />
      <Field
        label={t('identity.email')}
        value={gEmail}
        placeholder="jane@example.com"
        onChange={setGEmail}
      />
      <div className="mb-4 mt-1 flex justify-end">
        <button
          type="button"
          onClick={saveGlobal}
          disabled={!globalDirty || !gName.trim() || !gEmail.trim() || setGlobal.isPending}
          className="rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-40"
        >
          {t('identity.save')}
        </button>
      </div>

      {/* Per-repository override */}
      {activePath && (
        <>
          <div className="border-t border-border" />
          <p className="mb-1 mt-4 text-xs font-medium text-fg">
            {t('identity.repo', { name: repoName })}
          </p>
          <p className="mb-2 text-[11px] leading-relaxed text-fg-subtle">
            {hasLocal ? t('identity.overrides') : t('identity.inherits')}{' '}
            {data.effective.name || data.effective.email ? (
              <span className="text-fg-muted">
                {t('identity.commitsUse')} {data.effective.name}
                {data.effective.email ? ` <${data.effective.email}>` : ''}
              </span>
            ) : (
              <span className="text-conflict">{t('identity.none')}</span>
            )}
          </p>
          <Field label={t('identity.name')} value={rName} placeholder="Jane Doe" onChange={setRName} />
          <Field
            label={t('identity.email')}
            value={rEmail}
            placeholder="jane@example.com"
            onChange={setREmail}
          />
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={useGlobal}
              disabled={!hasLocal || clearRepo.isPending}
              className="rounded-[var(--radius-card)] border border-border px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40"
            >
              {t('identity.useGlobal')}
            </button>
            <button
              type="button"
              onClick={saveRepo}
              disabled={!repoDirty || !rName.trim() || !rEmail.trim() || setRepo.isPending}
              className="rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-40"
            >
              {t('identity.saveOverride')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
