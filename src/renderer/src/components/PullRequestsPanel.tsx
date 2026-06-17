import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ExternalLink,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Plus,
  RefreshCw,
  X
} from 'lucide-react'
import type { PullRequest, PullRequestState } from '@shared/types'
import { useRepoStore } from '../store/repoStore'
import { usePullRequests } from '../hooks/useHosting'

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const STATE_STYLE: Record<PullRequestState, string> = {
  open: 'bg-diff-add/15 text-diff-add',
  merged: 'bg-lane-2/15 text-lane-2',
  closed: 'bg-danger/15 text-danger'
}
const STATE_ICON = {
  open: GitPullRequest,
  merged: GitMerge,
  closed: GitPullRequestClosed
} as const

function Row({ pr }: { pr: PullRequest }): React.JSX.Element {
  const { t } = useTranslation()
  const Icon = STATE_ICON[pr.state]
  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-surface-2">
      <Icon size={15} strokeWidth={1.75} className={`shrink-0 ${STATE_STYLE[pr.state].split(' ')[1]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-fg" title={pr.title}>
            {pr.title}
          </span>
          {pr.isDraft && (
            <span className="shrink-0 rounded-[var(--radius-card)] bg-surface-2 px-1.5 py-0.5 text-[10px] text-fg-muted">
              {t('pr.draftBadge')}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle">
          <span className="font-mono">#{pr.number}</span>
          <span className="font-mono text-fg-muted">
            {pr.sourceBranch} → {pr.targetBranch}
          </span>
          {pr.author && <span>· {pr.author}</span>}
          {pr.updatedAt && <span>· {fmtDate(pr.updatedAt)}</span>}
        </div>
      </div>
      <a
        href={pr.htmlUrl}
        target="_blank"
        rel="noreferrer"
        title={t('pr.openInBrowser')}
        className="shrink-0 rounded-[var(--radius-card)] p-1 text-fg-subtle opacity-0 transition-opacity hover:bg-surface hover:text-fg group-hover:opacity-100"
      >
        <ExternalLink size={14} strokeWidth={1.75} />
      </a>
    </div>
  )
}

/**
 * Pull / merge requests for the active repo. The provider is resolved in the
 * main process from the repo's remote; a remote that isn't a connected host
 * shows a guiding message rather than an error.
 */
export function PullRequestsPanel(): React.JSX.Element | null {
  const { t } = useTranslation()
  const activePath = useRepoStore((s) => s.activePath)
  const open = useRepoStore((s) => s.prPanelOpen)
  const close = useRepoStore((s) => s.closePRPanel)
  const openCreatePR = useRepoStore((s) => s.openCreatePR)
  const openRepoModal = useRepoStore((s) => s.openRepoModal)
  const { data, isLoading, error, refetch, isFetching } = usePullRequests(activePath, open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !activePath) return null

  const canCreate = data?.status === 'ok'

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-8"
      onMouseDown={close}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <GitPullRequest size={15} strokeWidth={1.75} className="text-fg-muted" />
          <span className="text-sm font-semibold text-fg">{t('pr.title')}</span>
          {data?.status === 'ok' && (
            <span className="font-mono text-xs text-fg-subtle">{data.repo}</span>
          )}
          <button
            type="button"
            onClick={() => void refetch()}
            title={t('common.refresh')}
            className="ms-auto rounded-[var(--radius-card)] p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
          >
            <RefreshCw size={14} strokeWidth={1.75} className={isFetching ? 'animate-spin' : undefined} />
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={openCreatePR}
              className="flex items-center gap-1.5 rounded-[var(--radius-card)] bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-hover"
            >
              <Plus size={14} strokeWidth={2} />
              {t('pr.new')}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="text-fg-subtle hover:text-fg"
            aria-label={t('common.cancel')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading && <p className="p-4 text-xs text-fg-subtle">{t('pr.loading')}</p>}
          {error && <p className="p-4 text-xs text-danger">{(error as Error).message}</p>}

          {data?.status === 'unsupported' && (
            <p className="p-4 text-xs text-fg-subtle">{t('pr.unsupported')}</p>
          )}

          {data?.status === 'noAccount' && (
            <div className="p-4 text-xs text-fg-subtle">
              <p className="mb-2">{t('pr.noAccount', { provider: data.provider })}</p>
              <button
                type="button"
                onClick={openRepoModal}
                className="rounded-[var(--radius-card)] border border-border px-2.5 py-1 text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                {t('pr.connectAccount')}
              </button>
            </div>
          )}

          {data?.status === 'ok' && data.items.length === 0 && (
            <p className="p-4 text-xs text-fg-subtle">{t('pr.empty')}</p>
          )}

          {data?.status === 'ok' && (
            <div className="divide-y divide-border/40">
              {data.items.map((pr) => (
                <Row key={pr.id} pr={pr} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
