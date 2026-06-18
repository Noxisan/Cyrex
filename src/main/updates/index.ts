/**
 * App update check. Queries the public GitHub Releases API for the latest
 * published Cyrex release and compares it to the running version.
 *
 * It sends no repository data — only a GET to a public endpoint — and is run
 * solely on the user's action (the Check for Updates button) or behind the
 * visible "check on startup" setting, consistent with CLAUDE.md §3's rule that
 * network operations are never silent.
 */

import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import { AppChannels } from '@shared/ipc'
import type { UpdateEvent, UpdateInfo } from '@shared/types'

const { autoUpdater } = electronUpdater
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

// ── In-app download + install (electron-updater) ─────────────────────────────
// The GitHub-API check above runs everywhere. Downloading and installing only
// works where electron-updater can replace the binary: a packaged NSIS build
// (Windows) or AppImage (Linux). macOS requires a signed app (we ship unsigned),
// and a .deb is owned by the system package manager — those fall back to the
// "view release" link in the UI.

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

/** Whether this build can download and install updates itself. */
export function canAutoUpdate(): boolean {
  if (!app.isPackaged) return false
  if (process.platform === 'win32') return true
  if (process.platform === 'linux') return !!process.env.APPIMAGE
  return false
}

function broadcast(event: UpdateEvent): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(AppChannels.UpdateEvent, event)
  }
}

let wired = false
function wireEvents(): void {
  if (wired) return
  wired = true
  autoUpdater.on('download-progress', (p) =>
    broadcast({ type: 'progress', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    broadcast({ type: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (err) => broadcast({ type: 'error', message: err.message }))
}

/** Check, then download the available update; resolves when the download finishes. */
export async function downloadUpdate(): Promise<void> {
  if (!canAutoUpdate()) throw new Error('In-app updates are not available for this build.')
  wireEvents()
  const result = await autoUpdater.checkForUpdates()
  if (!result?.updateInfo) throw new Error('No update is available to download.')
  await autoUpdater.downloadUpdate()
}

/** Quit the app and install a previously downloaded update. */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
