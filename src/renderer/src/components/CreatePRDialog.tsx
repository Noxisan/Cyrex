import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GitPullRequestArrow } from 'lucide-react'
import { useRepoStore } from '../store/repoStore'
import { useBranches, useStatus } from '../hooks/useRepo'
import { useCreatePullRequest } from '../hooks/useHosting'

/** Branch a new PR most likely targets: main/master if present, else any other. */
function guessTarget(localNames: string[], source: string): string {
  for (const candidate of ['main', 'master', 'develop']) {
    if (localNames.includes(candidate) && candidate !== source) return candidate
  }
  return localNames.find((n) => n !== source) ?? source
}

/**
 * Open a pull/merge request from a local branch. Source defaults to the current
 * branch, target to the repo's likely default. The provider is resolved in the
 * main process from the repo's remote, so this form is provider-agnostic.
 */
export function CreatePRDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const open = useRepoStore((s) => s.createPROpen)
  const close = useRepoStore((s) => s.closeCreatePR)
  const activePath = useRepoStore((s) => s.activePath)
  const status = useStatus(activePath)
  const { data: branches } = useBranches(activePath)
  const createPR = useCreatePullRequest(activePath ?? '')

  const localNames = useMemo(
    () => (branches ?? []).filter((b) => b.kind === 'local').map((b) => b.name),
    [branches]
  )

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [draft, setDraft] = useState(false)

  // Seed the form when the dialog opens (current branch → source, guess target).
  useEffect(() => {
    if (!open) return
    const current = status.data?.branch ?? localNames[0] ?? ''
    setTitle('')
    setBody('')
    setDraft(false)
    setSource(current)
    setTarget(guessTarget(localNames, current))
  }, [open, status.data?.branch, localNames])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !activePath) return null

  const sameBranch = source === target
  const canSubmit = !!title.trim() && !!source && !!target && !sameBranch && !createPR.isPending

  function submit(): void {
    if (!canSubmit) return
    createPR.mutate(
      {
        title: title.trim(),
        body: body.trim() || undefined,
        sourceBranch: source,
        targetBranch: target,
        draft
      },
      { onSuccess: () => close() }
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onMouseDown={close}
    >
      <div
        className="w-[460px] rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <GitPullRequestArrow size={15} strokeWidth={1.75} className="text-fg-muted" />
          <h2 className="text-sm font-semibold text-fg">{t('pr.createTitle')}</h2>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-fg-muted">{t('pr.source')}</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent"
            >
              {localNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <span className="mt-5 text-fg-subtle">→</span>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-fg-muted">{t('pr.target')}</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent"
            >
              {localNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mb-1 block text-xs text-fg-muted">{t('pr.titleField')}</label>
        <input
          autoFocus
          value={title}
          placeholder={t('pr.titlePlaceholder')}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-3 w-full rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
        />

        <label className="mb-1 block text-xs text-fg-muted">{t('pr.description')}</label>
        <textarea
          value={body}
          placeholder={t('pr.descriptionPlaceholder')}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="mb-3 w-full resize-none rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
        />

        <label className="mb-1 flex items-center gap-2 text-xs text-fg-muted">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          {t('pr.draft')}
        </label>

        {sameBranch && (
          <p className="mt-2 text-[11px] text-danger">{t('pr.sameBranch')}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-[var(--radius-card)] px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-40"
          >
            {createPR.isPending ? t('pr.creating') : t('pr.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
