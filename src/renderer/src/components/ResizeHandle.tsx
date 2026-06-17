/**
 * A thin vertical divider that resizes an adjacent panel. On mouse-down it
 * tracks the pointer globally (so the drag continues even if the cursor leaves
 * the 1px handle) and reports each move; `onResizeEnd` fires on release (e.g. to
 * persist the new size).
 */
export function ResizeHandle({
  onResize,
  onResizeEnd
}: {
  onResize: (e: MouseEvent) => void
  onResizeEnd?: () => void
}): React.JSX.Element {
  const start = (e: React.MouseEvent): void => {
    e.preventDefault()
    const move = (ev: MouseEvent): void => onResize(ev)
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      onResizeEnd?.()
    }
    document.body.style.cursor = 'col-resize'
    // Suppress text selection while dragging.
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={start}
      title="Drag to resize"
      className="w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-accent/60"
    />
  )
}
