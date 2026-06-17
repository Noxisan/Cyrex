/**
 * App update check. Queries the public GitHub Releases API for the latest
 * published Cyrex release and compares it to the running version.
 *
 * It sends no repository data — only a GET to a public endpoint — and is run
 * solely on the user's action (the Check for Updates button) or behind the
 * visible "check on startup" setting, consistent with CLAUDE.md §3's rule that
 * network operations are never silent.
 */

import { app } from 'electron'
import type { UpdateInfo } from '@shared/types'

const RELEASES_API = 'https://api.github.com/repos/Noxisan/Cyrex/releases/latest'

/** Parse "v1.2.3" / "1.2.3-beta" into a comparable [major, minor, patch]. */
function parseVersion(v: string): [number, number, number] {
  const core = v.replace(/^v/, '').split('-')[0]
  const parts = core.split('.').map((n) => parseInt(n, 10))
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

/** True when `a` is a strictly newer semantic version than `b`. */
function isNewer(a: string, b: string): boolean {
  const x = parseVersion(a)
  const y = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i]
  }
  return false
}

export function getAppVersion(): string {
  return app.getVersion()
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const current = app.getVersion()
  const miss = (extra: Partial<UpdateInfo> = {}): UpdateInfo => ({
    current,
    latest: null,
    updateAvailable: false,
    url: null,
    ...extra
  })
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Cyrex' },
      signal: AbortSignal.timeout(10_000)
    })
    // 404 = no published release yet; treat as "up to date", not an error.
    if (res.status === 404) return miss()
    if (!res.ok) return miss({ error: `GitHub responded ${res.status}` })

    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = (data.tag_name ?? '').replace(/^v/, '')
    if (!latest) return miss()
    return {
      current,
      latest,
      updateAvailable: isNewer(latest, current),
      url: data.html_url ?? null
    }
  } catch (e) {
    const name = (e as Error).name
    const error = name === 'TimeoutError' ? 'The update check timed out.' : (e as Error).message
    return miss({ error })
  }
}
