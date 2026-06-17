import { useEffect, useState } from 'react'
import { ChevronRight, Minus, Square, Copy, X, Settings } from 'lucide-react'
import { useRepoStore } from '../store/repoStore'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'
import markUrl from '../../../../build/icon.png'

/**
 * Custom frameless titlebar (the window is created with `frame: false`). The bar
 * itself is a drag region; the controls opt out via `.no-drag`. It shows the app
 * mark, the CYREX wordmark, a breadcrumb to the open repository, and the
 * window's minimize / maximize-restore / close buttons.
 */
export function TitleBar(): React.JSX.Element {
  const repos = useRepoStore((s) => s.repos)
  const activePath = useRepoStore((s) => s.activePath)
  const openSettings = useRepoStore((s) => s.openSettings)
  const openName = repos.find((r) => r.path === activePath)?.name ?? null
  const [maximized, setMaximized] = useState(false)

  // Reflect the real window state so the button shows maximize vs. restore.
  useEffect(() => {
    void window.cyrex.windowControls.isMaximized().then(setMaximized)
    return window.cyrex.windowControls.onMaximizeChange(setMaximized)
  }, [])

  return (
    <header className="drag-region flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface ps-3 select-none">
      <img src={markUrl} alt="" className="size-6 shrink-0 rounded-[5px]" />
      <span className="text-base font-semibold tracking-wide">CYREX</span>
      {openName && (
        <>
          <ChevronRight size={16} className="shrink-0 text-fg-subtle" />
          <span className="min-w-0 truncate text-sm text-fg-muted">{openName}</span>
        </>
      )}

      {/* App controls (icon-only): language, theme, settings — left of the
          window minimize/maximize/close buttons. */}
      <div className="no-drag ms-auto flex items-center gap-0.5 pe-1">
        <LanguageSwitcher />
        <ThemeToggle />
        <button
          type="button"
          onClick={openSettings}
          title="Settings"
          aria-label="Settings"
          className="rounded-[var(--radius-card)] p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Settings size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="no-drag flex h-full items-stretch">
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => void window.cyrex.windowControls.minimize()}
          className="flex w-11 items-center justify-center text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() =>
            void window.cyrex.windowControls.maximizeToggle().then(setMaximized)
          }
          className="flex w-11 items-center justify-center text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => void window.cyrex.windowControls.close()}
          className="flex w-11 items-center justify-center text-fg-muted hover:bg-danger hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  )
}
