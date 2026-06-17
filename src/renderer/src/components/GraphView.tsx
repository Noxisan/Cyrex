import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Cloud, GitBranch, Tag } from 'lucide-react'
import { computeLayout } from '@shared/graph'
import type { Commit } from '@shared/types'
import { useBranches, useCherryPick, useInfiniteLog, useRevert, useSearch } from '../hooks/useRepo'
import { useRepoStore } from '../store/repoStore'
import { ContextMenu } from './ContextMenu'
import type { MenuState } from './ContextMenu'

const ROW_H = 30
const LANE_W = 16
const LANE_PAD = 12
const REFS_W = 290
const DOT_OUTER = 5
const DOT_INNER = 3.2

const LANE_VARS = [
  '--color-lane-0',
  '--color-lane-1',
  '--color-lane-2',
  '--color-lane-3',
  '--color-lane-4',
  '--color-lane-5'
]
const laneColor = (lane: number): string => `var(${LANE_VARS[lane % LANE_VARS.length]})`

// --- ref pills (left column) ------------------------------------------------

type RefKind = 'head' | 'local' | 'remote' | 'tag'
interface RefInfo {
  kind: RefKind
  label: string
  /** True for the checked-out branch / detached HEAD. */
  current: boolean
}

function classifyRef(raw: string, remotePrefixes: Set<string>): RefInfo {
  if (raw === 'HEAD') return { kind: 'head', label: 'HEAD', current: true }
  if (raw.startsWith('HEAD -> ')) return { kind: 'local', label: raw.slice(8), current: true }
  if (raw.startsWith('tag: ')) return { kind: 'tag', label: raw.slice(5), current: false }
  const prefix = raw.split('/')[0]
  if (raw.includes('/') && remotePrefixes.has(prefix)) {
    return { kind: 'remote', label: raw, current: false }
  }
  return { kind: 'local', label: raw, current: false }
}

function refsForCommit(commit: Commit, remotePrefixes: Set<string>): RefInfo[] {
  return commit.refs
    .map((r) => classifyRef(r, remotePrefixes))
    // Drop the symbolic "origin/HEAD" pointer — it just mirrors the default branch.
    .filter((r) => !(r.kind === 'remote' && r.label.endsWith('/HEAD')))
    // Keep the current branch rightmost (nearest the graph) so it survives clipping.
    .sort((a, b) => Number(a.current) - Number(b.current))
}

function RefPill({ info, lane }: { info: RefInfo; lane: number }): React.JSX.Element {
  const color = laneColor(lane)
  const Icon = info.kind === 'tag' ? Tag : info.kind === 'remote' ? Cloud : GitBranch
  return (
    <span
      title={info.label}
      className="flex min-w-0 max-w-[120px] items-center gap-1 rounded-[var(--radius-card)] border px-1.5 py-[1px] text-[10.5px] font-medium leading-none"
      style={{
        color,
        borderColor: color,
        backgroundColor: `color-mix(in srgb, ${color} ${info.current ? 22 : 14}%, transparent)`
      }}
    >
      {info.current && <Check size={10} strokeWidth={2.5} className="shrink-0" />}
      <Icon size={10} strokeWidth={2} className="shrink-0" />
      <span className="truncate">{info.label}</span>
    </span>
  )
}

// --- relative time ----------------------------------------------------------

function formatRel(rtf: Intl.RelativeTimeFormat, iso: string): string {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  const a = Math.abs(sec)
  if (a < 60) return rtf.format(-sec, 'second')
  const min = Math.round(sec / 60)
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute')
  const hr = Math.round(min / 60)
  if (Math.abs(hr) < 24) return rtf.format(-hr, 'hour')
  const day = Math.round(hr / 24)
  if (Math.abs(day) < 30) return rtf.format(-day, 'day')
  const mon = Math.round(day / 30)
  if (Math.abs(mon) < 12) return rtf.format(-mon, 'month')
  return rtf.format(-Math.round(day / 365), 'year')
}

// --- search results row (flat list, no graph) -------------------------------

function SearchRow({
  commit,
  selected,
  topBorder,
  onSelect,
  onContextMenu
}: {
  commit: Commit
  selected: boolean
  topBorder: boolean
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      style={{ height: ROW_H }}
      className={`flex w-full items-center gap-2 px-3 text-start text-xs hover:bg-surface-2 ${
        selected ? 'bg-surface-2' : ''
      } ${topBorder ? 'border-t border-border/30' : ''}`}
    >
      <span className="truncate text-fg">{commit.summary}</span>
      <span className="ms-auto shrink-0 truncate text-fg-subtle">{commit.author.name}</span>
      <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{commit.shortSha}</span>
    </button>
  )
}

// --- main view --------------------------------------------------------------

export function GraphView({ repoPath }: { repoPath: string }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const {
    data: logData,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  } = useInfiniteLog(repoPath)
  const commits = useMemo(() => logData?.pages.flat(), [logData])
  const { data: branches } = useBranches(repoPath)
  const selectedSha = useRepoStore((s) => s.selectedSha)
  const selectCommit = useRepoStore((s) => s.selectCommit)
  const cherryPick = useCherryPick(repoPath)
  const revert = useRevert(repoPath)
  const openRebase = useRepoStore((s) => s.openRebase)
  const openCreateTag = useRepoStore((s) => s.openCreateTag)
  const searchQuery = useRepoStore((s) => s.searchQuery)
  const searchActive = searchQuery.trim().length > 0
  const search = useSearch(repoPath, searchQuery)
  const [menu, setMenu] = useState<MenuState | null>(null)

  // Virtualization: only the rows (and graph elements) inside the scroll viewport
  // are rendered, so a long history stays light no matter how many pages load.
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Track the viewport height (initial + on resize: window, sidebar, panels) and
  // sync scrollTop from the real element on (re)mount — e.g. returning from search
  // mounts a fresh container at the top, so stale state must not be trusted.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewportH(el.clientHeight)
    setScrollTop(el.scrollTop)
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [commits, searchActive])

  // Reset the scroll position when switching repositories so the window starts
  // at the top rather than at a stale offset from the previous (longer) history.
  useEffect(() => {
    setScrollTop(0)
    scrollRef.current?.scrollTo(0, 0)
  }, [repoPath])

  // Infinite history: when the bottom sentinel scrolls into view, pull the next
  // page. rootMargin prefetches before the user actually hits the end.
  useEffect(() => {
    const root = scrollRef.current
    const target = sentinelRef.current
    if (!root || !target || !hasNextPage) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage()
      },
      { root, rootMargin: '400px' }
    )
    io.observe(target)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, commits])

  const dateFormat = useRepoStore((s) => s.dateFormat)
  const rtf = useMemo(
    () => new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto', style: 'short' }),
    [i18n.language]
  )
  const dtf = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }),
    [i18n.language]
  )
  const formatDate = (iso: string): string =>
    dateFormat === 'absolute' ? dtf.format(new Date(iso)) : formatRel(rtf, iso)

  // Remote names (e.g. "origin") so a ref like "origin/main" reads as remote
  // rather than a local branch that merely contains a slash ("feature/x").
  const remotePrefixes = useMemo(() => {
    const set = new Set<string>()
    for (const b of branches ?? []) if (b.kind === 'remote') set.add(b.name.split('/')[0])
    return set
  }, [branches])

  const layout = useMemo(() => (commits ? computeLayout(commits) : null), [commits])
  const headSha = useMemo(
    () => commits?.find((c) => c.refs.some((r) => r === 'HEAD' || r.startsWith('HEAD ->')))?.sha,
    [commits]
  )

  const commitMenu = (e: React.MouseEvent, commit: Commit): void => {
    e.preventDefault()
    const items = [
      { label: t('commit.cherryPick'), onClick: () => cherryPick.mutate(commit.sha) },
      { label: t('commit.revert'), onClick: () => revert.mutate(commit.sha) },
      { label: t('commit.createTag'), onClick: () => openCreateTag(commit.sha) }
    ]
    // Rebase needs a parent to use as the base; root commits have none.
    if (commit.parents.length > 0) {
      items.push({
        label: t('commit.rebaseFromHere'),
        onClick: () => openRebase(commit.parents[0])
      })
    }
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  // --- search results mode ---
  if (searchActive) {
    const results = search.data
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-4 text-xs font-medium uppercase tracking-wide text-fg-muted">
          {t('search.results')}
          {results && <span className="text-fg-subtle">{results.length}</span>}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {search.isLoading && <Centered text={t('graph.loading')} />}
          {search.error && <Centered text={(search.error as Error).message} tone="danger" />}
          {results && results.length === 0 && !search.isLoading && (
            <Centered text={t('search.noResults', { query: searchQuery })} />
          )}
          {results?.map((c, i) => (
            <SearchRow
              key={c.sha}
              commit={c}
              selected={selectedSha === c.sha}
              topBorder={i > 0}
              onSelect={() => selectCommit(c.sha)}
              onContextMenu={(e) => commitMenu(e, c)}
            />
          ))}
        </div>
        <ContextMenu state={menu} onClose={() => setMenu(null)} />
      </div>
    )
  }

  // --- graph mode ---
  if (isLoading) return <Centered text={t('graph.loading')} />
  if (error) return <Centered text={(error as Error).message} tone="danger" />
  if (!commits || commits.length === 0 || !layout) return <Centered text={t('graph.empty')} />

  const graphWidth = LANE_PAD * 2 + layout.laneCount * LANE_W
  const totalHeight = commits.length * ROW_H
  const x = (lane: number): number => LANE_PAD + lane * LANE_W + LANE_W / 2
  const y = (row: number): number => row * ROW_H + ROW_H / 2
  const laneOf = new Map(layout.nodes.map((n) => [n.sha, n.lane]))

  // The window of rows to actually render. Overscan a few rows past the viewport
  // so scrolling never reveals a blank edge; a fallback height keeps the first
  // paint (before the viewport is measured) from rendering an empty window.
  const OVERSCAN = 10
  const vh = viewportH || 800
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const lastRow = Math.min(commits.length, Math.ceil((scrollTop + vh) / ROW_H) + OVERSCAN)
  const visibleCommits = commits.slice(firstRow, lastRow)
  // Graph elements that intersect the window. Edges run from a child (smaller
  // row) to an older parent (larger row), so an edge is visible when its span
  // overlaps [firstRow, lastRow].
  const visibleEdges = layout.edges.filter((e) => e.fromRow <= lastRow && e.toRow >= firstRow)
  const visibleNodes = layout.nodes.filter((n) => n.row >= firstRow && n.row < lastRow)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-4 text-xs font-medium uppercase tracking-wide text-fg-muted">
        {t('graph.title')}
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-auto">
        <div
          className="relative"
          style={{ height: totalHeight, minWidth: REFS_W + graphWidth + 320 }}
        >
          {/* Spacer occupying the rows above the window so the rendered slice
              sits at its true vertical position. */}
          <div aria-hidden style={{ height: firstRow * ROW_H }} />
          {/* Only the visible window of rows is rendered; their hover/selection
              backgrounds sit beneath the graph overlay drawn crisply on top. */}
          {visibleCommits.map((c) => {
            const refs = refsForCommit(c, remotePrefixes)
            const selected = selectedSha === c.sha
            return (
              <button
                key={c.sha}
                type="button"
                onClick={() => selectCommit(c.sha)}
                onContextMenu={(e) => commitMenu(e, c)}
                style={{ height: ROW_H }}
                className={`flex w-full items-center text-start hover:bg-surface-2 ${
                  selected ? 'bg-surface-2' : ''
                }`}
              >
                <div
                  className="flex shrink-0 items-center justify-end gap-1 overflow-hidden pe-2 ps-3"
                  style={{ width: REFS_W }}
                >
                  {refs.map((info) => (
                    <RefPill key={info.kind + info.label} info={info} lane={laneOf.get(c.sha) ?? 0} />
                  ))}
                </div>
                {/* Spacer the graph overlay draws over. */}
                <div className="shrink-0" style={{ width: graphWidth }} />
                <div className="flex min-w-0 flex-1 items-center gap-2 pe-4 ps-1 text-xs">
                  <span className="truncate text-fg">{c.summary}</span>
                  <span className="ms-auto shrink-0 truncate text-fg-subtle">{c.author.name}</span>
                  <span className="shrink-0 text-fg-subtle">{formatDate(c.author.date)}</span>
                  <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{c.shortSha}</span>
                </div>
              </button>
            )
          })}

          {/* Graph overlay: thin lane lines + circular nodes, drawn over the
              row spacer. pointer-events:none so clicks fall through to rows. */}
          <svg
            className="pointer-events-none absolute top-0"
            style={{ left: REFS_W }}
            width={graphWidth}
            height={totalHeight}
          >
            {visibleEdges.map((e) => {
              const x1 = x(e.fromLane)
              const y1 = y(e.fromRow)
              const x2 = x(e.toLane)
              const y2 = y(e.toRow)
              const midY = (y1 + y2) / 2
              const d =
                x1 === x2
                  ? `M ${x1} ${y1} L ${x2} ${y2}`
                  : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
              return (
                <path
                  key={`${e.fromRow}-${e.toRow}-${e.fromLane}-${e.toLane}`}
                  d={d}
                  fill="none"
                  stroke={laneColor(e.toLane)}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              )
            })}
            {visibleNodes.map((n) => {
              const cx = x(n.lane)
              const cy = y(n.row)
              const isHead = n.sha === headSha
              const isSelected = n.sha === selectedSha
              return (
                <g key={n.sha}>
                  {(isHead || isSelected) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={DOT_OUTER + 2}
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth={isSelected ? 2 : 1.5}
                      opacity={isSelected ? 1 : 0.85}
                    />
                  )}
                  <circle cx={cx} cy={cy} r={DOT_OUTER} fill="var(--color-bg)" />
                  <circle cx={cx} cy={cy} r={DOT_INNER} fill={laneColor(n.lane)} />
                </g>
              )
            })}
          </svg>
        </div>
        {(hasNextPage || isFetchingNextPage) && (
          <div
            ref={sentinelRef}
            className="flex h-9 items-center justify-center text-[11px] text-fg-subtle"
          >
            {isFetchingNextPage ? t('graph.loadingMore') : ''}
          </div>
        )}
      </div>
      <ContextMenu state={menu} onClose={() => setMenu(null)} />
    </div>
  )
}

function Centered({ text, tone }: { text: string; tone?: 'danger' }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-xs">
      <span className={tone === 'danger' ? 'text-danger' : 'text-fg-subtle'}>{text}</span>
    </div>
  )
}
