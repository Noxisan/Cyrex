import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CloudOff,
  DownloadCloud,
  FolderGit2,
  FolderOpen,
  FolderPlus,
  Link2,
  Lock,
  Plus,
  Search
} from 'lucide-react'
import { useRepoStore } from '../store/repoStore'
import { useProgressStore } from '../store/progressStore'
import { useAccounts, useCloneRepo, useDisconnect, useRemoteRepos } from '../hooks/useHosting'
import { useToastStore } from '../store/toastStore'
import { ConnectWizard } from './ConnectWizard'
import { ProviderIcon } from './BrandIcon'

type Mode = 'open' | 'clone' | 'create'

/** Last path segment of a clone URL, minus a trailing `.git` — a sensible folder name. */
function nameFromUrl(url: string): string {
  const clean = url.trim().replace(/\.git$/i, '').replace(/[/]+$/, '')
  if (!clean) return ''
  return clean.split(/[/:]/).pop() ?? ''
}

/** A "Choose folder…" control showing the selected path. */
function FolderField({
  label,
  value,
  placeholder,
  onPick
}: {
  label: string
  value: string | null
  placeholder: string
  onPick: () => void
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-fg-muted">{label}</label>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg px-2.5 py-1.5 text-start text-xs hover:border-accent"
      >
        <FolderOpen size={14} className="shrink-0 text-fg-subtle" />
        <span className={`truncate ${value ? 'text-fg' : 'text-fg-subtle'}`}>
          {value ?? placeholder}
        </span>
      </button>
    </div>
  )
}

const inputClass =
  'w-full rounded-[var(--radius-card)] border border-border bg-bg px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent'

/**
 * The unified repository wizard. A left rail switches between three intents —
 * Open a local repo, Clone from a remote (account repos or a pasted URL), or
 * Create a brand-new local repository (git init). Replaces the old two-pane
 * open/clone modal and adds local creation, which had no path before.
 */
export function OpenRepoDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const open = useRepoStore((s) => s.openRepoOpen)
  const close = useRepoStore((s) => s.closeRepoModal)
  const repos = useRepoStore((s) => s.repos)
  const activePath = useRepoStore((s) => s.activePath)
  const addRepo = useRepoStore((s) => s.addRepo)
  const setActive = useRepoStore((s) => s.setActive)
  const openCreateRepo = useRepoStore((s) => s.openCreateRepo)
  const pushToast = useToastStore((s) => s.push)

  const { data: accounts } = useAccounts()
  const disconnect = useDisconnect()
  const clone = useCloneRepo()

  const [mode, setMode] = useState<Mode>('open')
  const [connecting, setConnecting] = useState(false)

  // Open
  const [recentQuery, setRecentQuery] = useState('')

  // Clone
  const [cloneSource, setCloneSource] = useState<'account' | 'url'>('account')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [repoQuery, setRepoQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [cloneParent, setCloneParent] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')

  // Create
  const [createParent, setCreateParent] = useState<string | null>(null)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  const gitProgress = useProgressStore((s) => s.progress)
  const cloneProgress = gitProgress?.op === 'clone' ? gitProgress : null

  const activeAccount = accountId ?? accounts?.[0]?.id ?? null
  const {
    data: remoteRepos,
    isLoading,
    error: reposError,
    refetch: refetchRepos
  } = useRemoteRepos(open && mode === 'clone' && cloneSource === 'account' ? activeAccount : null)

  const filteredRepos = useMemo(() => {
    const q = repoQuery.trim().toLowerCase()
    return (remoteRepos ?? []).filter((r) => !q || r.fullName.toLowerCase().includes(q))
  }, [remoteRepos, repoQuery])

  const filteredRecent = useMemo(() => {
    const q = recentQuery.trim().toLowerCase()
    return repos.filter((r) => !q || r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q))
  }, [repos, recentQuery])

  if (!open) return null

  const hasAccounts = (accounts?.length ?? 0) > 0
  const chosen = (remoteRepos ?? []).find((r) => r.id === selected) ?? null

  async function pickInto(setter: (p: string) => void): Promise<void> {
    const dir = await window.cyrex.pickDirectory()
    if (dir.ok && dir.data) setter(dir.data)
  }

  async function openFolder(): Promise<void> {
    const res = await window.cyrex.openRepoDialog()
    if (res.ok && res.data) {
      addRepo(res.data)
      close()
    }
  }

  function doClone(): void {
    const cloneUrl = cloneSource === 'url' ? url.trim() : chosen?.cloneUrl
    const acct = cloneSource === 'url' ? undefined : activeAccount ?? undefined
    if (!cloneUrl || !cloneParent || !cloneName.trim()) return
    clone.mutate(
      { cloneUrl, parentDir: cloneParent, name: cloneName.trim(), accountId: acct },
      {
        onSuccess: (ref) => {
          addRepo(ref)
          pushToast(t('hosting.cloned', { name: ref.name }), 'success')
          close()
        }
      }
    )
  }

  async function createLocal(): Promise<void> {
    if (!createParent || !createName.trim() || creating) return
    setCreating(true)
    const res = await window.cyrex.initRepo(createParent, createName.trim())
    setCreating(false)
    if (res.ok && res.data) {
      addRepo(res.data)
      setActive(res.data.path)
      pushToast(t('openRepo.create.done', { name: res.data.name }), 'success')
      close()
    } else if (!res.ok) {
      pushToast(res.error, 'error')
    }
  }

  const cloneReady =
    !!cloneParent &&
    !!cloneName.trim() &&
    (cloneSource === 'url' ? !!url.trim() : !!chosen) &&
    !clone.isPending

  const NAV: { id: Mode; label: string; icon: typeof FolderOpen }[] = [
    { id: 'open', label: t('openRepo.modeOpen'), icon: FolderOpen },
    { id: 'clone', label: t('openRepo.modeClone'), icon: DownloadCloud },
    { id: 'create', label: t('openRepo.modeCreate'), icon: FolderPlus }
  ]

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50"
      onMouseDown={close}
    >
      <div
        className="flex h-[560px] w-[820px] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Left rail: intent switcher */}
        <div className="flex w-[180px] shrink-0 flex-col gap-1 border-e border-border bg-bg/40 p-3">
          <div className="mb-2 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-fg">
            <FolderGit2 size={16} className="text-accent" />
            {t('openRepo.title')}
          </div>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id)
                setConnecting(false)
              }}
              className={`flex items-center gap-2.5 rounded-[var(--radius-card)] px-2.5 py-2 text-start text-xs font-medium transition-colors ${
                mode === id
                  ? 'bg-accent/15 text-accent'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        {/* Content pane */}
        <div className="flex min-w-0 flex-1 flex-col p-5">
          {/* ---- OPEN ---- */}
          {mode === 'open' && (
            <>
              <h2 className="text-sm font-semibold text-fg">{t('openRepo.open.heading')}</h2>
              <p className="mb-3 mt-0.5 text-xs text-fg-muted">{t('openRepo.open.subtitle')}</p>
              <button
                type="button"
                onClick={openFolder}
                className="mb-4 flex items-center justify-center gap-2 rounded-[var(--radius-card)] bg-accent px-3 py-2 text-xs font-medium text-accent-fg hover:bg-accent-hover"
              >
                <FolderOpen size={15} strokeWidth={1.75} />
                {t('openRepo.openFolder')}
              </button>
              <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 focus-within:border-accent">
                <Search size={14} className="text-fg-subtle" />
                <input
                  value={recentQuery}
                  onChange={(e) => setRecentQuery(e.target.value)}
                  placeholder={t('openRepo.open.searchRecent')}
                  className="w-full bg-transparent text-xs text-fg outline-none placeholder:text-fg-subtle"
                />
              </div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                {t('openRepo.recent')}
              </div>
              <div className="-mx-1 min-h-0 flex-1 overflow-auto">
                {filteredRecent.length === 0 ? (
                  <p className="px-1 py-3 text-xs text-fg-subtle">{t('openRepo.open.noRecent')}</p>
                ) : (
                  filteredRecent.map((r) => (
                    <button
                      key={r.path}
                      type="button"
                      onClick={() => {
                        setActive(r.path)
                        close()
                      }}
                      title={r.path}
                      className={`flex w-full flex-col items-start rounded-[var(--radius-card)] px-2 py-1.5 text-start hover:bg-surface-2 ${
                        r.path === activePath ? 'text-accent' : 'text-fg'
                      }`}
                    >
                      <span className="truncate text-xs font-medium">{r.name}</span>
                      <span className="w-full truncate text-[10px] text-fg-subtle">{r.path}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* ---- CLONE ---- */}
          {mode === 'clone' &&
            (connecting ? (
              <ConnectWizard onClose={() => setConnecting(false)} />
            ) : (
              <>
                <h2 className="mb-3 text-sm font-semibold text-fg">{t('openRepo.clone.heading')}</h2>

                {/* Source toggle */}
                <div className="mb-3 inline-flex self-start rounded-[var(--radius-card)] border border-border p-0.5 text-xs">
                  {(['account', 'url'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCloneSource(s)}
                      className={`rounded-[4px] px-2.5 py-1 font-medium ${
                        cloneSource === s ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg'
                      }`}
                    >
                      {s === 'account' ? t('openRepo.clone.fromAccount') : t('openRepo.clone.fromUrl')}
                    </button>
                  ))}
                </div>

                {cloneSource === 'account' ? (
                  !hasAccounts ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                      <p className="max-w-xs text-xs text-fg-muted">
                        {t('openRepo.clone.connectPrompt')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setConnecting(true)}
                        className="flex items-center gap-1.5 rounded-[var(--radius-card)] bg-accent px-3 py-2 text-xs font-medium text-accent-fg hover:bg-accent-hover"
                      >
                        <Plus size={14} /> {t('hosting.connectAccount')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 flex items-center gap-2">
                        <ProviderIcon
                          id={accounts?.find((a) => a.id === activeAccount)?.provider ?? 'github'}
                          size={15}
                          className="shrink-0 text-fg-muted"
                        />
                        <select
                          value={activeAccount ?? ''}
                          onChange={(e) => {
                            setAccountId(e.target.value)
                            setSelected(null)
                          }}
                          className="rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none"
                        >
                          {accounts?.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.login} ({a.provider})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setConnecting(true)}
                          title={t('hosting.connectAccount')}
                          className="rounded-[var(--radius-card)] p-1.5 text-fg-muted hover:bg-surface-2 hover:text-accent"
                        >
                          <Plus size={14} />
                        </button>
                        {activeAccount && (
                          <button
                            type="button"
                            onClick={() => disconnect.mutate(activeAccount)}
                            title={t('hosting.disconnect')}
                            className="rounded-[var(--radius-card)] p-1.5 text-fg-muted hover:bg-surface-2 hover:text-danger"
                          >
                            <CloudOff size={14} />
                          </button>
                        )}
                        <div className="flex flex-1 items-center gap-1.5 rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 focus-within:border-accent">
                          <Search size={14} className="text-fg-subtle" />
                          <input
                            value={repoQuery}
                            onChange={(e) => setRepoQuery(e.target.value)}
                            placeholder={t('hosting.searchRepos')}
                            className="w-full bg-transparent text-xs text-fg outline-none placeholder:text-fg-subtle"
                          />
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-card)] border border-border">
                        {isLoading && (
                          <p className="px-3 py-6 text-center text-xs text-fg-subtle">
                            {t('hosting.loading')}
                          </p>
                        )}
                        {!isLoading && reposError && (
                          <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                            <p className="text-xs font-medium text-danger">
                              {t('hosting.reposError')}
                            </p>
                            <p className="max-w-md text-[11px] leading-relaxed text-fg-muted">
                              {(reposError as Error).message}
                            </p>
                            <button
                              type="button"
                              onClick={() => void refetchRepos()}
                              className="mt-1 rounded-[var(--radius-card)] border border-border px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg"
                            >
                              {t('hosting.retry')}
                            </button>
                          </div>
                        )}
                        {!isLoading && !reposError && filteredRepos.length === 0 && (
                          <p className="px-3 py-6 text-center text-xs text-fg-subtle">
                            {t('hosting.noRepos')}
                          </p>
                        )}
                        {filteredRepos.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setSelected(r.id)
                              setCloneName(r.name)
                            }}
                            className={`flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-start last:border-0 ${
                              selected === r.id ? 'bg-surface-2' : 'hover:bg-surface-2'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-medium text-fg">
                                  {r.fullName}
                                </span>
                                {r.private && <Lock size={11} className="shrink-0 text-fg-subtle" />}
                              </div>
                              {r.description && (
                                <div className="truncate text-[11px] text-fg-muted">
                                  {r.description}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )
                ) : (
                  <div className="mb-1">
                    <label className="mb-1 block text-[11px] font-medium text-fg-muted">
                      {t('openRepo.clone.urlLabel')}
                    </label>
                    <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg px-2.5 py-1.5 focus-within:border-accent">
                      <Link2 size={14} className="shrink-0 text-fg-subtle" />
                      <input
                        autoFocus
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value)
                          setCloneName(nameFromUrl(e.target.value))
                        }}
                        placeholder={t('openRepo.clone.urlPlaceholder')}
                        className="w-full bg-transparent text-xs text-fg outline-none placeholder:text-fg-subtle"
                      />
                    </div>
                  </div>
                )}

                {/* Destination + clone action (hidden while the connect prompt shows) */}
                {(cloneSource === 'url' || hasAccounts) && (
                  <div className="mt-3 flex items-end gap-2">
                    <div className="flex-1">
                      <FolderField
                        label={t('openRepo.clone.destination')}
                        value={cloneParent}
                        placeholder={t('openRepo.chooseFolder')}
                        onPick={() => void pickInto(setCloneParent)}
                      />
                    </div>
                    <div className="w-40">
                      <label className="mb-1 block text-[11px] font-medium text-fg-muted">
                        {t('openRepo.clone.folderName')}
                      </label>
                      <input
                        value={cloneName}
                        onChange={(e) => setCloneName(e.target.value)}
                        placeholder="repo"
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </div>
                )}

                {(cloneSource === 'url' || hasAccounts) && (
                  <div className="mt-3 flex items-center gap-3">
                    {clone.isPending && (
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex justify-between text-[10px] text-fg-subtle">
                          <span>
                            {cloneProgress
                              ? t(`hosting.clonePhase.${cloneProgress.phase}`)
                              : t('hosting.cloning')}
                          </span>
                          {cloneProgress?.percent != null && <span>{cloneProgress.percent}%</span>}
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent transition-[width] duration-150"
                            style={{ width: `${cloneProgress?.percent ?? 8}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={doClone}
                      disabled={!cloneReady}
                      className="ms-auto shrink-0 rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-40"
                    >
                      {clone.isPending ? t('hosting.cloning') : t('hosting.clone')}
                    </button>
                  </div>
                )}
              </>
            ))}

          {/* ---- CREATE ---- */}
          {mode === 'create' && (
            <>
              <h2 className="text-sm font-semibold text-fg">{t('openRepo.create.heading')}</h2>
              <p className="mb-4 mt-0.5 text-xs text-fg-muted">{t('openRepo.create.subtitle')}</p>

              <label className="mb-1 block text-[11px] font-medium text-fg-muted">
                {t('openRepo.create.name')}
              </label>
              <input
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t('openRepo.create.namePlaceholder')}
                className={`${inputClass} mb-3 font-mono`}
              />

              <div className="mb-3">
                <FolderField
                  label={t('openRepo.create.location')}
                  value={createParent}
                  placeholder={t('openRepo.chooseFolder')}
                  onPick={() => void pickInto(setCreateParent)}
                />
              </div>

              {createParent && createName.trim() && (
                <p className="mb-4 truncate font-mono text-[11px] text-fg-subtle">
                  {t('openRepo.create.willCreate', { path: `${createParent}/${createName.trim()}` })}
                </p>
              )}

              <button
                type="button"
                onClick={createLocal}
                disabled={!createParent || !createName.trim() || creating}
                className="flex items-center justify-center gap-2 self-start rounded-[var(--radius-card)] bg-accent px-3 py-2 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-40"
              >
                <FolderPlus size={15} strokeWidth={1.75} />
                {creating ? t('openRepo.create.creating') : t('openRepo.create.submit')}
              </button>

              <div className="mt-auto border-t border-border/60 pt-3 text-xs text-fg-muted">
                {t('openRepo.create.hostHint')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    close()
                    openCreateRepo()
                  }}
                  className="text-accent hover:underline"
                >
                  {t('openRepo.create.hostLink')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
