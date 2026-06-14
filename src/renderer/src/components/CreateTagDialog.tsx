import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateTag } from '../hooks/useRepo'
import { useRepoStore } from '../store/repoStore'

/**
 * Create a tag at a target ref (HEAD or a specific commit sha). A non-empty
 * message produces an annotated tag; otherwise it is lightweight. Opened from
 * the sidebar Tags section (at HEAD) or a commit's context menu in the graph.
 */
export function CreateTagDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const target = useRepoStore((s) => s.createTagTarget)
  const activePath = useRepoStore((s) => s.activePath)
  const close = useRepoStore((s) => s.closeCreateTag)
  const createTag = useCreateTag(activePath ?? '')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  // Reset fields whenever the dialog (re)opens for a target.
  useEffect(() => {
    if (target) {
      setName('')
      setMessage('')
    }
  }, [target])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  if (!target || !activePath) return null

  const targetLabel = target === 'HEAD' ? 'HEAD' : target.slice(0, 7)

  function submit(): void {
    if (!name.trim()) return
    createTag.mutate(
      { name: name.trim(), ref: target ?? undefined, message: message.trim() || undefined },
      { onSuccess: () => close() }
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={close}
    >
      <div
        className="w-[400px] rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-semibold text-fg">{t('tag.createTitle')}</h2>
        <p className="mb-3 text-xs text-fg-muted">
          {t('tag.at')} <span className="font-mono text-fg">{targetLabel}</span>
        </p>

        <label className="mb-1 block text-xs text-fg-muted">{t('tag.name')}</label>
        <input
          autoFocus
          value={name}
          placeholder={t('tag.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          className="mb-3 w-full rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent"
        />

        <label className="mb-1 block text-xs text-fg-muted">{t('tag.message')}</label>
        <textarea
          value={message}
          placeholder={t('tag.messagePlaceholder')}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="mb-4 w-full resize-none rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
        />

        <div className="flex justify-end gap-2">
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
            disabled={!name.trim() || createTag.isPending}
            className="rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-40"
          >
            {t('common.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
