import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowDown, ArrowUp, GitBranchPlus, X } from 'lucide-react'
import type { Commit, RebaseAction, RebaseResult } from '@shared/types'
import { useRepoStore } from '../store/repoStore'
import { useInteractiveRebase, useRebaseCommits } from '../hooks/useRepo'
import { useToastStore } from '../store/toastStore'

const ACTIONS: RebaseAction[] = ['pick', 'reword', 'edit', 'squash', 'fixup', 'drop']

interface PlanItem {
  sha: string
  shortSha: string
  summary: string
  body: string
  action: RebaseAction
  message: string
}

function fromCommit(c: Commit): PlanItem {
  return {
    sha: c.sha,
    shortSha: c.shortSha,
    summary: c.summary,
    body: c.body,
    action: 'pick',
    message: c.body ? `${c.summary}\n\n${c.body}` : c.summary
  }
}

function actionTone(action: RebaseAction): string {
  switch (action) {
    case 'drop':
      return 'text-danger'
    case 'squash':
    case 'fixup':
      return 'text-conflict'
    case 'reword':
    case 'edit':
      return 'text-accent'
    default:
      return 'text-fg-muted'
  }
}

function Row({
  item,
  index,
  total,
  onAction,
  onMove,
  onMessage
}: {
  item: PlanItem
  index: number
  total: number
  onAction: (a: RebaseAction) => void
  onMove: (dir: -1 | 1) => void
  onMessage: (m: string) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const folds = item.action === 'squash' || item.action === 'fixup'
  return (
    <div
      className={`border-t border-border/40 px-3 py-1.5 ${item.action === 'drop' ? 'opacity-45' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="text-fg-subtle hover:text-fg disabled:opacity-20"
            aria-label={t('rebase.moveUp')}
          >
            <ArrowUp size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="text-fg-subtle hover:text-fg disabled:opacity-20"
            aria-label={t('rebase.moveDown')}
          >
            <ArrowDown size={12} strokeWidth={2} />
          </button>
        </div>

        <select
          value={item.action}
          onChange={(e) => onAction(e.target.value as RebaseAction)}
          className={`shrink-0 rounded-[var(--radius-card)] border border-border bg-surface-2 px-1.5 py-1 text-[11px] font-medium ${actionTone(
            item.action
          )}`}
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a} className="text-fg">
              {t(`rebase.action.${a}`)}
            </option>
          ))}
        </select>

        <span className={`shrink-0 ${folds ? 'ps-3' : ''}`} aria-hidden>
          {folds && <span className="text-conflict">↳</span>}
        </span>

        <span
          className={`min-w-0 flex-1 truncate text-xs ${
            item.action === 'drop' ? 'text-fg-subtle line-through' : 'text-fg'
          }`}
          title={item.summary}
        >
          {item.summary}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{item.shortSha}</span>
      </div>

      {item.action === 'reword' && (
        <textarea
          value={item.message}
          onChange={(e) => onMessage(e.target.value)}
          rows={2}
          spellCheck={false}
          className="mt-1.5 w-full resize-y rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1 font-mono text-[12px] text-fg outline-none focus:border-accent"
        />
      )}
    </div>
  )
}

export function RebaseDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const activePath = useRepoStore((s) => s.activePath)
  const base = useRepoStore((s) => s.rebaseBase)
  const closeRebase = useRepoStore((s) => s.closeRebase)
  const pushToast = useToastStore((s) => s.push)
  const { data, isLoading, error } = useRebaseCommits(activePath, base)
  const rebase = useInteractiveRebase(activePath ?? '')
  const [plan, setPlan] = useState<PlanItem[]>([])

  // Seed the editable plan whenever a fresh commit list loads.
  useEffect(() => {
    if (data) setPlan(data.map(fromCommit))
  }, [data])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeRebase()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeRebase])

  if (!base || !activePath) return null

  const update = (i: number, patch: Partial<PlanItem>): void =>
    setPlan((p) => p.map((it, j) => (j === i ? { ...it, ...patch } : it)))

  const move = (i: number, dir: -1 | 1): void =>
    setPlan((p) => {
      const j = i + dir
      if (j < 0 || j >= p.length) return p
      const next = [...p]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  // The first kept commit can't squash/fixup — there is nothing above to fold into.
  const firstKept = plan.find((it) => it.action !== 'drop')
  const invalidSquash = !!firstKept && (firstKept.action === 'squash' || firstKept.action === 'fixup')
  const allDropped = plan.length > 0 && plan.every((it) => it.action === 'drop')

  const start = (): void => {
    rebase.mutate(
      {
        base,
        items: plan.map((it) => ({
          sha: it.sha,
          action: it.action,
          message: it.action === 'reword' ? it.message : undefined
        }))
      },
      {
        onSuccess: (data) => {
          const res = data as RebaseResult
          closeRebase()
          pushToast(
            res.stopped ? t('rebase.paused') : t('rebase.done'),
            res.stopped ? 'info' : 'success'
          )
        }
      }
    )
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-8"
      onMouseDown={closeRebase}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <GitBranchPlus size={15} strokeWidth={1.75} className="text-accent" />
          <span className="text-sm font-semibold text-fg">{t('rebase.title')}</span>
          {data && (
            <span className="text-xs text-fg-subtle">
              {t('rebase.subtitle', { count: data.length, base: base.slice(0, 7) })}
            </span>
          )}
          <button
            type="button"
            onClick={closeRebase}
            className="ms-auto text-fg-subtle hover:text-fg"
            aria-label={t('common.cancel')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading && <p className="p-4 text-xs text-fg-subtle">{t('graph.loading')}</p>}
          {error && <p className="p-4 text-xs text-danger">{(error as Error).message}</p>}
          {data && data.length === 0 && (
            <p className="p-4 text-xs text-fg-subtle">{t('rebase.empty')}</p>
          )}
          {plan.map((item, i) => (
            <Row
              key={item.sha}
              item={item}
              index={i}
              total={plan.length}
              onAction={(a) => update(i, { action: a })}
              onMove={(dir) => move(i, dir)}
              onMessage={(m) => update(i, { message: m })}
            />
          ))}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-2.5">
          <div className="mb-2 flex items-start gap-2 text-[11px] text-fg-muted">
            <AlertTriangle size={13} strokeWidth={1.75} className="mt-px shrink-0 text-conflict" />
            <span>{t('rebase.warning')}</span>
          </div>
          {invalidSquash && (
            <p className="mb-2 text-[11px] text-danger">{t('rebase.invalidSquash')}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeRebase}
              className="rounded-[var(--radius-card)] px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={start}
              disabled={
                rebase.isPending || plan.length === 0 || invalidSquash || isLoading
              }
              className="rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {allDropped ? t('rebase.startDropAll') : t('rebase.start')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
