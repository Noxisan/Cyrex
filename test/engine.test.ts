import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import * as engine from '../src/main/git/engine'

/**
 * Integration tests for the engine's porcelain parsers. Each test runs against a
 * fresh throwaway repo created with the real `git` binary — no mocks — so the
 * parsing of `status`, `log`, `branch`, `tag`, and `stash` output is exercised
 * exactly as it runs in the app.
 */

const tmpRepos: string[] = []

/** Create an isolated repo with a deterministic default branch and identity. */
async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cyrex-engine-'))
  tmpRepos.push(dir)
  const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
  }
  git('init', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test User')
  git('config', 'commit.gpgsign', 'false')
  return dir
}

/** Stage a file and commit it through the engine (exercises stage + commit). */
async function commitFile(dir: string, name: string, content: string, message: string): Promise<void> {
  await writeFile(join(dir, name), content)
  await engine.stage(dir, name)
  await engine.commit(dir, message)
}

afterAll(async () => {
  await Promise.all(tmpRepos.map((d) => rm(d, { recursive: true, force: true })))
})

describe('engine.initRepo', () => {
  it('creates a new repo on main and refuses to clobber an existing folder', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'cyrex-init-'))
    tmpRepos.push(parent)

    const ref = await engine.initRepo(parent, 'fresh')
    expect(ref.name).toBe('fresh')
    expect(ref.path).toBe(join(parent, 'fresh'))

    const status = await engine.status(ref.path)
    expect(status.branch).toBe('main')
    expect(status.clean).toBe(true)

    // A second init at the same path must not overwrite the folder.
    await expect(engine.initRepo(parent, 'fresh')).rejects.toBeDefined()
  })
})

describe('engine.openRepo / status', () => {
  it('opens a repo and reports a clean tree after a commit', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'README.md', '# hello\n', 'initial commit')

    const ref = await engine.openRepo(dir)
    expect(ref.path).toBe(dir)
    expect(ref.name).toBe(dir.split('/').pop())

    const status = await engine.status(dir)
    expect(status.branch).toBe('main')
    expect(status.clean).toBe(true)
    expect(status.staged).toHaveLength(0)
    expect(status.unstaged).toHaveLength(0)
    expect(status.untracked).toHaveLength(0)
  })

  it('classifies untracked, staged, and unstaged changes', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'a.txt', 'one\n', 'first')

    // New file: untracked.
    await writeFile(join(dir, 'b.txt'), 'new\n')
    let status = await engine.status(dir)
    expect(status.untracked.map((f) => f.path)).toContain('b.txt')
    expect(status.clean).toBe(false)

    // Stage it: moves from untracked to staged.
    await engine.stage(dir, 'b.txt')
    status = await engine.status(dir)
    expect(status.staged.map((f) => f.path)).toContain('b.txt')
    expect(status.untracked).toHaveLength(0)

    // Modify a tracked, committed file: unstaged.
    await writeFile(join(dir, 'a.txt'), 'one\ntwo\n')
    status = await engine.status(dir)
    expect(status.unstaged.map((f) => f.path)).toContain('a.txt')
  })
})

describe('engine.log', () => {
  it('parses commits newest-first with parents and summaries', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'f.txt', '1\n', 'first commit')
    await commitFile(dir, 'f.txt', '2\n', 'second commit')
    await commitFile(dir, 'f.txt', '3\n', 'third commit')

    const commits = await engine.log(dir)
    expect(commits).toHaveLength(3)
    expect(commits.map((c) => c.summary)).toEqual([
      'third commit',
      'second commit',
      'first commit'
    ])
    // Newest points at the middle commit; the root has no parents.
    expect(commits[0].parents).toEqual([commits[1].sha])
    expect(commits[2].parents).toEqual([])
    expect(commits[0].author.name).toBe('Test User')
    expect(commits[0].shortSha).toBe(commits[0].sha.slice(0, commits[0].shortSha.length))
  })

  it('honors the limit and skip pagination options', async () => {
    const dir = await makeRepo()
    for (let i = 1; i <= 5; i++) await commitFile(dir, 'f.txt', `${i}\n`, `commit ${i}`)

    const firstPage = await engine.log(dir, { limit: 2 })
    expect(firstPage.map((c) => c.summary)).toEqual(['commit 5', 'commit 4'])

    const secondPage = await engine.log(dir, { limit: 2, skip: 2 })
    expect(secondPage.map((c) => c.summary)).toEqual(['commit 3', 'commit 2'])
  })
})

describe('engine.branches', () => {
  it('tracks the current branch and reflects create/checkout', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'f.txt', '1\n', 'init')

    let branches = await engine.branches(dir)
    const main = branches.find((b) => b.name === 'main')
    expect(main).toBeDefined()
    expect(main?.current).toBe(true)
    expect(main?.kind).toBe('local')

    await engine.createBranch(dir, 'feature', { checkout: false })
    branches = await engine.branches(dir)
    expect(branches.find((b) => b.name === 'feature')?.current).toBe(false)
    expect(branches.find((b) => b.name === 'main')?.current).toBe(true)

    await engine.checkout(dir, 'feature')
    branches = await engine.branches(dir)
    expect(branches.find((b) => b.name === 'feature')?.current).toBe(true)
    expect(branches.find((b) => b.name === 'main')?.current).toBe(false)
  })
})

describe('engine.tags', () => {
  it('creates and lists lightweight and annotated tags', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'f.txt', '1\n', 'init')

    await engine.createTag(dir, 'v1-light')
    await engine.createTag(dir, 'v1-annotated', undefined, 'release one')

    const tags = await engine.tags(dir)
    const names = tags.map((t) => t.name)
    expect(names).toContain('v1-light')
    expect(names).toContain('v1-annotated')
    expect(tags.find((t) => t.name === 'v1-light')?.annotated).toBe(false)
    expect(tags.find((t) => t.name === 'v1-annotated')?.annotated).toBe(true)
  })
})

describe('engine.stash', () => {
  it('saves working changes to the stash and lists them', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'f.txt', 'base\n', 'init')

    await writeFile(join(dir, 'f.txt'), 'base\nwip\n')
    await engine.stashSave(dir, 'work in progress')

    // Stashing restored a clean tree.
    expect((await engine.status(dir)).clean).toBe(true)

    const stashes = await engine.stashList(dir)
    expect(stashes).toHaveLength(1)
    expect(stashes[0].index).toBe(0)
    expect(stashes[0].message).toContain('work in progress')
  })
})

describe('engine.commitDiff / workingDiff', () => {
  it('parses a commit diff into files, hunks, and line counts', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'x.txt', 'a\nb\nc\n', 'first')
    await commitFile(dir, 'x.txt', 'a\nB\nc\nd\n', 'second')

    const headSha = (await engine.log(dir))[0].sha
    const diff = await engine.commitDiff(dir, headSha)
    expect(diff.files).toHaveLength(1)
    const file = diff.files[0]
    expect(file.path).toBe('x.txt')
    expect(file.binary).toBe(false)
    expect(file.additions).toBeGreaterThanOrEqual(1)
    expect(file.hunks.length).toBeGreaterThanOrEqual(1)
    // The appended line "d" shows up as an added line in some hunk.
    const allLines = file.hunks.flatMap((h) => h.lines)
    expect(allLines.some((l) => l.kind === 'add' && l.content === 'd')).toBe(true)
  })

  it('parses an unstaged working-tree diff', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'n.txt', '1\n2\n3\n', 'init')
    await writeFile(join(dir, 'n.txt'), '1\n2\n3\n4\n')

    const diff = await engine.workingDiff(dir, { file: 'n.txt', staged: false, untracked: false })
    expect(diff.files).toHaveLength(1)
    expect(diff.files[0].path).toBe('n.txt')
    expect(diff.files[0].additions).toBeGreaterThanOrEqual(1)
    const added = diff.files[0].hunks.flatMap((h) => h.lines).filter((l) => l.kind === 'add')
    expect(added.some((l) => l.content === '4')).toBe(true)
  })
})

describe('engine.reflog', () => {
  it('parses reflog entries with selectors and action verbs', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'f.txt', '1\n', 'first')
    await commitFile(dir, 'f.txt', '2\n', 'second')

    const entries = await engine.reflog(dir)
    expect(entries.length).toBeGreaterThanOrEqual(2)
    expect(entries[0].selector).toBe('HEAD@{0}')
    expect(entries[0].index).toBe(0)
    // The most recent reflog action is the second commit.
    expect(entries[0].action.toLowerCase()).toContain('commit')
    expect(entries[0].sha).toMatch(/^[0-9a-f]{40}$/)
  })
})

describe('engine.status (merge conflict)', () => {
  it('detects conflicted files and an in-progress merge operation', async () => {
    const dir = await makeRepo()
    await commitFile(dir, 'c.txt', 'line1\nline2\n', 'base')

    // Diverging change on a branch...
    await engine.createBranch(dir, 'other', { checkout: true })
    await commitFile(dir, 'c.txt', 'line1\nOTHER\n', 'other change')

    // ...conflicting change on main.
    await engine.checkout(dir, 'main')
    await commitFile(dir, 'c.txt', 'line1\nMAIN\n', 'main change')

    // Merging the branch conflicts; the engine surfaces it (does not auto-resolve).
    await expect(engine.merge(dir, 'other')).rejects.toBeDefined()

    const status = await engine.status(dir)
    expect(status.clean).toBe(false)
    expect(status.operation).toBe('merge')
    expect(status.conflicted.map((f) => f.path)).toContain('c.txt')
  })
})
