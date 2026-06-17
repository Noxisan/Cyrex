import { useTranslation } from 'react-i18next'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Archive,
  Command,
  FolderOpen,
  RefreshCw,
  TerminalSquare,
  Undo2
} from 'lucide-react'
import { useState } from 'react'
import { useRepoStore } from '../store/repoStore'
import { isMac } from '../lib/platform'
import { useFetch, usePull, usePush, useStashSave } from '../hooks/useRepo'
import { PromptDialog } from './PromptDialog'
import type { PromptState } from './PromptDialog'
import { SearchInput } from './SearchInput'
import { ContextMenu } from './ContextMenu'
import type { MenuState } from './ContextMenu'
import { ConfirmDialog } from './ConfirmDialog'
import type { ConfirmState } from './ConfirmDialog'

function ToolButton({
  label,
  icon: Icon,
  onClick,
  onContextMenu,
  disabled,
  loading
}: {
  label: string
  icon: typeof RefreshCw
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  disabled?: boolean
  loading?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={disabled || loading}
      title={label}
      aria-label={label}
      className="flex items-center gap-1.5 rounded-[var(--radius-card)] px-2.5 py-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon size={16} strokeWidth={1.75} className={loading ? 'animate-spin' : undefined} />
      <span className="hidden text-xs lg:inline">{label}</span>
    </button>
  )
}

export function TopBar(): React.JSX.Element {
  const { t } = useTranslation()
  const activePath = useRepoStore((s) => s.activePath)
  const openReflog = useRepoStore((s) => s.openReflog)
  const toggleTerminal = useRepoStore((s) => s.toggleTerminal)
  const togglePalette = useRepoStore((s) => s.togglePalette)
  const openRepoModal = useRepoStore((s) => s.openRepoModal)
  const stashSave = useStashSave(activePath ?? '')
  const fetch = useFetch(activePath ?? '')
  const pull = usePull(activePath ?? '')
  const push = usePush(activePath ?? '')
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  function pushMenu(e: React.MouseEvent): void {
    e.preventDefault()
    if (!activePath) return
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: t('remote.forcePush'),
          danger: true,
          onClick: () =>
            setConfirm({
              title: t('remote.forcePush'),
              message: t('remote.forcePushMessage'),
              confirmLabel: t('remote.forcePush'),
              danger: true,
              onConfirm: () => push.mutate(true)
            })
        }
      ]
    })
  }

  function stash(): void {
    setPrompt({
      title: t('stash.saveTitle'),
      placeholder: t('stash.messagePlaceholder'),
      confirmLabel: t('actions.stash'),
      requireValue: false,
      onSubmit: (message) => stashSave.mutate(message || undefined)
    })
  }

  const hasRepo = !!activePath

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      {/* Left: repository actions. */}
      <div className="flex flex-1 items-center gap-1">
        <ToolButton
          label={t('actions.fetch')}
          icon={RefreshCw}
          onClick={() => fetch.mutate(undefined)}
          disabled={!hasRepo}
          loading={fetch.isPending}
        />
        <ToolButton
          label={t('actions.pull')}
          icon={ArrowDownToLine}
          onClick={() => pull.mutate(undefined)}
          disabled={!hasRepo}
          loading={pull.isPending}
        />
        <ToolButton
          label={t('actions.push')}
          icon={ArrowUpFromLine}
          onClick={() => push.mutate(false)}
          onContextMenu={pushMenu}
          disabled={!hasRepo}
          loading={push.isPending}
        />
        <ToolButton label={t('actions.stash')} icon={Archive} onClick={stash} disabled={!hasRepo} />
        <ToolButton label={t('actions.undo')} icon={Undo2} onClick={openReflog} disabled={!hasRepo} />
        <ToolButton
          label={t('actions.terminal')}
          icon={TerminalSquare}
          onClick={toggleTerminal}
          disabled={!hasRepo}
        />
      </div>

      {/* Center: commit search. */}
      {hasRepo && <SearchInput />}

      {/* Right: command palette, then Open Repository. */}
      <div className="flex flex-1 items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={togglePalette}
          title={t('palette.open')}
          aria-label={t('palette.open')}
          className="flex items-center gap-1.5 rounded-[var(--radius-card)] px-2 py-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Command size={16} strokeWidth={1.75} />
          <kbd className="hidden rounded border border-border px-1 text-[10px] text-fg-subtle xl:inline">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>
        <button
          type="button"
          onClick={openRepoModal}
          className="flex items-center gap-1.5 rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-hover"
        >
          <FolderOpen size={16} strokeWidth={1.75} />
          {t('actions.openRepository')}
        </button>
      </div>

      <PromptDialog state={prompt} onClose={() => setPrompt(null)} />
      <ContextMenu state={menu} onClose={() => setMenu(null)} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </header>
  )
}
