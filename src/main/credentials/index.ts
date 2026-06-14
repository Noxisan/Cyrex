/**
 * Token vault for hosting accounts (CLAUDE.md §4).
 *
 * Access tokens are encrypted with the OS keychain via Electron `safeStorage`
 * (DPAPI on Windows, libsecret/kwallet on Linux, Keychain on macOS) and the
 * ciphertext is persisted to `userData/accounts.json`. Tokens live ONLY in the
 * main process: they are never returned to the renderer, never logged, and the
 * on-disk file holds ciphertext only — `listAccounts()` strips it.
 *
 * If the platform can't encrypt (e.g. a Linux session with no keyring), we
 * REFUSE to persist rather than write a plaintext token.
 */

import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HostingAccount } from '@shared/types'

interface StoredAccount extends HostingAccount {
  /** Base64 of the safeStorage-encrypted access token. */
  token: string
}

interface VaultFile {
  accounts: StoredAccount[]
}

function vaultPath(): string {
  return join(app.getPath('userData'), 'accounts.json')
}

/** True when the OS keychain can encrypt — a precondition for saving tokens. */
export function isAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

function readVault(): VaultFile {
  try {
    const p = vaultPath()
    if (!existsSync(p)) return { accounts: [] }
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as VaultFile
    return { accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [] }
  } catch {
    return { accounts: [] }
  }
}

function writeVault(vault: VaultFile): void {
  writeFileSync(vaultPath(), JSON.stringify(vault, null, 2), { mode: 0o600 })
}

/** Strip the token, leaving only renderer-safe metadata. */
function toMeta(a: StoredAccount): HostingAccount {
  const { token: _token, ...meta } = a
  return meta
}

/** Encrypt + persist an account's token, upserting by id. */
export function saveAccount(account: HostingAccount, token: string): void {
  if (!isAvailable()) {
    throw new Error(
      'Secure storage is unavailable on this system, so the token cannot be saved safely.'
    )
  }
  const cipher = safeStorage.encryptString(token).toString('base64')
  const vault = readVault()
  const next = vault.accounts.filter((a) => a.id !== account.id)
  next.unshift({ ...account, token: cipher })
  writeVault({ accounts: next })
}

/** Decrypt and return an account's token, or null if unknown / undecryptable. */
export function getToken(id: string): string | null {
  const acc = readVault().accounts.find((a) => a.id === id)
  if (!acc) return null
  try {
    return safeStorage.decryptString(Buffer.from(acc.token, 'base64'))
  } catch {
    return null
  }
}

/** All connected accounts as metadata (never includes tokens). */
export function listAccounts(): HostingAccount[] {
  return readVault().accounts.map(toMeta)
}

/** Forget an account and its token. */
export function deleteAccount(id: string): void {
  const vault = readVault()
  writeVault({ accounts: vault.accounts.filter((a) => a.id !== id) })
}
