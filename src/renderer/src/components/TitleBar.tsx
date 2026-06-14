import { ChevronRight } from 'lucide-react'
import { useRepoStore } from '../store/repoStore'
import markUrl from '../../../../build/icon_only.png'

/**
 * Custom frameless titlebar (the window is created with `frame: false`). The
 * whole bar is a drag region so the window can be moved; there are deliberately
 * no system minimize/maximize/close buttons. It shows the square mark, the
 * CYREX wordmark, and a breadcrumb to the currently open repository.
 */
export function TitleBar(): React.JSX.Element {
  const repos = useRepoStore((s) => s.repos)
  const activePath = useRepoStore((s) => s.activePath)
  const openName = repos.find((r) => r.path === activePath)?.name ?? null

  return (
    <header className="drag-region flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 select-none">
      <img src={markUrl} alt="" className="size-5 shrink-0" />
      <span className="text-base font-semibold tracking-wide">CYREX</span>
      {openName && (
        <>
          <ChevronRight size={16} className="shrink-0 text-fg-subtle" />
          <span className="min-w-0 truncate text-sm text-fg-muted">{openName}</span>
        </>
      )}
    </header>
  )
}
