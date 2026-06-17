import { describe, expect, it } from 'vitest'
import { scrubSecrets } from '../src/main/git/cli'

describe('scrubSecrets', () => {
  it('masks the password in an https remote with embedded credentials', () => {
    const out = scrubSecrets('fatal: unable to access https://user:ghp_secrettoken@github.com/o/r.git')
    expect(out).toContain('https://user:***@github.com/o/r.git')
    expect(out).not.toContain('ghp_secrettoken')
  })

  it('masks Authorization headers', () => {
    expect(scrubSecrets('authorization: Bearer abc.def.ghi')).toBe('authorization: ***')
  })

  it('masks GitHub token shapes anywhere in the text', () => {
    const out = scrubSecrets('remote: token ghp_0123456789ABCDEFGHIJ0123456789abcdef rejected')
    expect(out).not.toMatch(/ghp_[A-Za-z0-9]/)
    expect(out).toContain('***')
  })

  it('leaves text without secrets unchanged', () => {
    const msg = 'error: pathspec "main" did not match any file(s) known to git'
    expect(scrubSecrets(msg)).toBe(msg)
  })

  it('masks credentials even when the host has a port', () => {
    const out = scrubSecrets('https://x-access-token:supersecret@gitlab.com:443/group/repo.git')
    expect(out).not.toContain('supersecret')
    expect(out).toContain(':***@gitlab.com:443/group/repo.git')
  })
})
