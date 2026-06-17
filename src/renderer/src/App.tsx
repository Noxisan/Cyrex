import { useCallback, useEffect, useRef, useState } from 'react'
import { useRepoStore } from './store/repoStore'
import { useProgressStore } from './store/progressStore'
import { TitleBar } from './components/TitleBar'
import { GitProgressBar } from './components/GitProgressBar'
import { ResizeHandle } from './components/ResizeHandle'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { ViewTabs } from './components/ViewTabs'
import { GraphView } from './components/GraphView'
import { CommitDetail } from './components/CommitDetail'
import { ChangesView } from './components/ChangesView'
import { StatusBar } from './components/StatusBar'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Toasts } from './components/Toasts'
import { OperationBanner } from './components/OperationBanner'
import { FileInspector } from './components/FileInspector'
import { ReflogPanel } from './components/ReflogPanel'
import { RebaseDialog } from './components/RebaseDialog'
import { TerminalPanel } from './components/TerminalPanel'
import { CommandPalette } from './components/CommandPalette'
import { OpenRepoDialog } from './components/OpenRepoDialog'
import { CreateRepoDialog } from './components/CreateRepoDialog'
import { CreateTagDialog } from './components/CreateTagDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { GitignoreDialog } from './components/GitignoreDialog'

// Width bounds for the resizable commit-detail panel (history view).
const MIN_DETAIL = 300
const DETAIL_KEY = 'cyrex.detailWidth'
const loadDetailWidth = (): number => {
  const v = Number(localStorage.getItem(DETAIL_KEY))
  return v >= MIN_DETAIL ? v : 420
}

export function App(): React.JSX.Element {
  const activePath = useRepoStore((s) => s.activePath)
  const viewMode = useRepoStore((s) => s.viewMode)
  const setProgress = useProgressStore((s) => s.setProgress)

  // Feed the global progress bar from the main-process git progress stream.
  useEffect(() => window.cyrex.onGitProgress(setProgress), [setProgress])

  // Resizable commit-detail panel: drag its left edge to widen/narrow it.
  const splitRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(loadDetailWidth())
  const [detailWidth, setDetailWidth] = useState(widthRef.current)
  const resizeDetail = useCallback((e: MouseEvent) => {
    const rect = splitRef.current?.getBoundingClientRect()
    if (!rect) return
    // Keep at least ~360px for the graph on the left.
    const max = Math.max(MIN_DETAIL, rect.width - 360)
    const w = Math.min(max, Math.max(MIN_DETAIL, rect.right - e.clientX))
    widthRef.current = w
    setDetailWidth(w)
  }, [])
  const persistDetail = useCallback(() => {
    localStorage.setItem(DETAIL_KEY, String(Math.round(widthRef.current)))
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-bg text-fg">
      <GitProgressBar />
      <TitleBar />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {activePath ? (
          <main className="flex min-w-0 flex-1 flex-col">
            <ViewTabs />
            <OperationBanner repoPath={activePath} />
            {viewMode === 'history' ? (
              <div ref={splitRef} className="flex min-h-0 flex-1">
                <section className="min-w-0 flex-1">
                  <GraphView repoPath={activePath} />
                </section>
                <ResizeHandle onResize={resizeDetail} onResizeEnd={persistDetail} />
                <aside className="shrink-0" style={{ width: detailWidth }}>
                  <CommitDetail repoPath={activePath} />
                </aside>
              </div>
            ) : (
              <ChangesView repoPath={activePath} />
            )}
            <TerminalPanel />
          </main>
        ) : (
          <WelcomeScreen />
        )}
      </div>
      <StatusBar />
      <FileInspector />
      <ReflogPanel />
      <RebaseDialog />
      <CommandPalette />
      <OpenRepoDialog />
      <CreateRepoDialog />
      <CreateTagDialog />
      <SettingsDialog />
      <GitignoreDialog />
      <Toasts />
    </div>
  )
}
