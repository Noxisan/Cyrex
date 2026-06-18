import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff } from '../src/main/git/diff'

/**
 * The PR review view feeds provider diffs through parseUnifiedDiff: GitHub and
 * Bitbucket return raw git diffs, while GitLab's per-file hunks are rebuilt into
 * git-style diffs. These cover both shapes, including added/deleted files.
 */
describe('parseUnifiedDiff (PR diffs)', () => {
  it('parses a raw modified-file diff (GitHub/Bitbucket shape)', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      'index 1111111..2222222 100644',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,3 +1,3 @@',
      ' const a = 1',
      '-const b = 2',
      '+const b = 3',
      ' const c = 4'
    ].join('\n')
    const files = parseUnifiedDiff(diff)
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('src/app.ts')
    expect(files[0].status).toBe('modified')
    expect(files[0].additions).toBe(1)
    expect(files[0].deletions).toBe(1)
    expect(files[0].hunks).toHaveLength(1)
  })

  // Mirrors the gitlab adapter's changeToDiff() reconstruction.
  function rebuild(c: {
    old_path: string
    new_path: string
    new_file?: boolean
    deleted_file?: boolean
    diff: string
  }): string {
    let head = `diff --git a/${c.old_path} b/${c.new_path}\n`
    if (c.new_file) head += 'new file mode 100644\n'
    else if (c.deleted_file) head += 'deleted file mode 100644\n'
    head += `--- ${c.new_file ? '/dev/null' : `a/${c.old_path}`}\n`
    head += `+++ ${c.deleted_file ? '/dev/null' : `b/${c.new_path}`}\n`
    return head + c.diff + (c.diff.endsWith('\n') ? '' : '\n')
  }

  it('parses GitLab-reconstructed added and deleted files', () => {
    const added = rebuild({
      old_path: 'new.txt',
      new_path: 'new.txt',
      new_file: true,
      diff: '@@ -0,0 +1,2 @@\n+hello\n+world'
    })
    const deleted = rebuild({
      old_path: 'gone.txt',
      new_path: 'gone.txt',
      deleted_file: true,
      diff: '@@ -1,1 +0,0 @@\n-bye'
    })
    const files = parseUnifiedDiff(added + deleted)
    expect(files).toHaveLength(2)

    const a = files.find((f) => f.path === 'new.txt')!
    expect(a.status).toBe('added')
    expect(a.additions).toBe(2)

    const d = files.find((f) => f.path === 'gone.txt')!
    expect(d.status).toBe('deleted')
    expect(d.deletions).toBe(1)
  })
})
