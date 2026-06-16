import { useProgressStore } from '../store/progressStore'

/**
 * A thin progress line pinned to the top of the window, shown while any network
 * git operation (clone/fetch/pull/push) is in flight. Width tracks the current
 * phase's percentage; indeterminate phases (enumerating/counting) pulse. Sits
 * above modals and is click-through.
 */
export function GitProgressBar(): React.JSX.Element | null {
  const progress = useProgressStore((s) => s.progress)
  if (!progress) return null

  const indeterminate = progress.percent == null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]">
      <div
        className={`h-full bg-accent shadow-[0_0_6px_var(--color-accent)] transition-[width] duration-150 ${
          indeterminate ? 'animate-pulse' : ''
        }`}
        style={{ width: indeterminate ? '35%' : `${progress.percent}%` }}
      />
    </div>
  )
}
