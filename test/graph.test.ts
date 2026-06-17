import { describe, expect, it } from 'vitest'
import { computeLayout } from '@shared/graph'
import type { Commit } from '@shared/types'

/** Minimal Commit fixture — only sha/parents matter to the layout algorithm. */
function c(sha: string, parents: string[] = []): Commit {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    parents,
    summary: sha,
    body: '',
    author: { name: 'T', email: 't@e', date: '2020-01-01T00:00:00Z' },
    committer: { name: 'T', email: 't@e', date: '2020-01-01T00:00:00Z' },
    refs: []
  }
}

describe('computeLayout', () => {
  it('places a linear history in a single lane', () => {
    // newest -> oldest: C -> B -> A
    const layout = computeLayout([c('C', ['B']), c('B', ['A']), c('A')])
    expect(layout.laneCount).toBe(1)
    expect(layout.nodes.map((n) => n.lane)).toEqual([0, 0, 0])
    expect(layout.nodes.map((n) => n.row)).toEqual([0, 1, 2])
    // Two edges, each straight (same lane) connecting consecutive rows.
    expect(layout.edges).toHaveLength(2)
    expect(layout.edges.every((e) => e.fromLane === 0 && e.toLane === 0)).toBe(true)
  })

  it('gives a merge commit two parent edges across two lanes', () => {
    //   M (parents P1, P2)
    //   ├─ P1 ─┐
    //   P2 ────┘ base
    const layout = computeLayout([
      c('M', ['P1', 'P2']),
      c('P1', ['BASE']),
      c('P2', ['BASE']),
      c('BASE')
    ])
    expect(layout.laneCount).toBe(2)
    const m = layout.nodes.find((n) => n.sha === 'M')!
    const edgesFromM = layout.edges.filter((e) => e.fromRow === m.row)
    expect(edgesFromM).toHaveLength(2)
    // The merge reconverges: BASE occupies a single lane both parents point to.
    const base = layout.nodes.find((n) => n.sha === 'BASE')!
    const intoBase = layout.edges.filter((e) => e.toRow === base.row)
    expect(intoBase).toHaveLength(2)
    expect(new Set(intoBase.map((e) => e.toLane)).size).toBe(1)
  })

  it('reuses lanes after a branch merges back (no per-branch leak)', () => {
    // A feature branch that merges back must not keep growing the lane count.
    const layout = computeLayout([
      c('M', ['MAIN1', 'FEAT']),
      c('FEAT', ['MAIN2']),
      c('MAIN1', ['MAIN2']),
      c('MAIN2', ['ROOT']),
      c('ROOT')
    ])
    expect(layout.laneCount).toBeLessThanOrEqual(2)
  })

  it('ignores parents outside the loaded window (pagination boundary)', () => {
    // The oldest loaded commit references a parent that has not been paged in yet:
    // it must produce no edge and must not throw.
    const layout = computeLayout([c('B', ['A']), c('A', ['NOT_LOADED'])])
    expect(layout.nodes).toHaveLength(2)
    // Only the B->A edge exists; A->NOT_LOADED is dropped.
    expect(layout.edges).toHaveLength(1)
    expect(layout.edges[0]).toMatchObject({ fromRow: 0, toRow: 1 })
  })

  it('handles an empty history', () => {
    const layout = computeLayout([])
    expect(layout.nodes).toEqual([])
    expect(layout.edges).toEqual([])
    expect(layout.laneCount).toBe(1)
  })
})
