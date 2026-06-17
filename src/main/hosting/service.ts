/**
 * Hosting orchestration (main process). Ties provider adapters to the token
 * vault and manages OAuth device-login sessions. This is the only place that
 * holds a raw token in memory transiently; nothing here returns a token to the
 * caller — only account/repo metadata and login status.
 */

import { randomUUID } from 'node:crypto'
import { shell } from 'electron'
import type {
  CreatePullRequestInput,
  CreateRepoInput,
  DeviceLoginStart,
  DeviceLoginStatus,
  GitProgress,
  HostingAccount,
  HostingProviderId,
  PullRequest,
  PullRequestList,
  RemoteRepo,
  RepoRef
} from '@shared/types'
import * as credentials from '../credentials'
import * as engine from '../git/engine'
import { gitAuth as bitbucketGitAuth } from './bitbucket'
import type { RepoCoords } from './types'
import { availableProviders, getProvider } from './index'

interface LoginSession {
  provider: HostingProviderId
  deviceCode: string
  expiresAt: number
}

const sessions = new Map<string, LoginSession>()

export interface ProviderInfo {
  id: HostingProviderId
  /** Browser login available right now (an OAuth app is configured). */
  deviceFlow: boolean
  /** The user can supply an OAuth app in-app to unlock browser login. */
  oauthConfigurable: boolean
}

/** Wired providers, whether each can log in via the browser, and how to enable it. */
export function providers(): ProviderInfo[] {
  return availableProviders().map((id) => {
    const p = getProvider(id)
    return { id, deviceFlow: p.supportsDeviceFlow(), oauthConfigurable: p.oauthConfigurable() }
  })
}

/** Store a user-entered OAuth app (client id/secret) so browser login can be used. */
export function setOAuthApp(
  providerId: HostingProviderId,
  clientId: string,
  clientSecret: string
): void {
  if (!getProvider(providerId).oauthConfigurable()) {
    throw new Error('This provider does not support setting up an OAuth app in the app.')
  }
  credentials.saveOAuthApp(providerId, clientId.trim(), clientSecret.trim())
}

/** Forget a provider's stored OAuth app. */
export function clearOAuthApp(providerId: HostingProviderId): void {
  credentials.clearOAuthApp(providerId)
}

export function listAccounts(): HostingAccount[] {
  return credentials.listAccounts()
}

export function disconnect(id: string): void {
  credentials.deleteAccount(id)
}

/** Start device-flow login: shows a code and opens the provider's verify page. */
export async function startLogin(providerId: HostingProviderId): Promise<DeviceLoginStart> {
  const provider = getProvider(providerId)
  if (!provider.supportsDeviceFlow()) {
    throw new Error('This provider is not set up for browser login; use a token instead.')
  }
  const code = await provider.startDeviceLogin()
  const handle = randomUUID()
  sessions.set(handle, {
    provider: providerId,
    deviceCode: code.deviceCode,
    expiresAt: Date.now() + code.expiresInSec * 1000
  })
  void shell.openExternal(code.verificationUri)
  return {
    handle,
    userCode: code.userCode,
    verificationUri: code.verificationUri,
    intervalSec: code.intervalSec
  }
}

/** Poll a device-login once. On success the account is saved and returned. */
export async function pollLogin(handle: string): Promise<DeviceLoginStatus> {
  const session = sessions.get(handle)
  if (!session) return { status: 'expired' }
  if (Date.now() > session.expiresAt) {
    sessions.delete(handle)
    return { status: 'expired' }
  }
  const provider = getProvider(session.provider)
  const poll = await provider.pollDeviceLogin(session.deviceCode)
  if (poll.status === 'authorized') {
    sessions.delete(handle)
    const account = await provider.validateToken(poll.token)
    credentials.saveAccount(account, poll.token)
    return { status: 'authorized', account }
  }
  if (poll.status === 'expired' || poll.status === 'denied') sessions.delete(handle)
  return poll
}

/** Token-paste path: validate, save, and return the account. */
export async function connectToken(
  providerId: HostingProviderId,
  token: string
): Promise<HostingAccount> {
  const account = await getProvider(providerId).validateToken(token)
  credentials.saveAccount(account, token)
  return account
}

function tokenFor(accountId: string): string {
  const token = credentials.getToken(accountId)
  if (!token) throw new Error('That account is no longer connected. Reconnect it and try again.')
  return token
}

function providerOf(accountId: string): HostingProviderId {
  return accountId.split(':')[0] as HostingProviderId
}

export function listRepos(accountId: string): Promise<RemoteRepo[]> {
  return getProvider(providerOf(accountId)).listRepos(tokenFor(accountId))
}

export function createRepo(accountId: string, input: CreateRepoInput): Promise<RemoteRepo> {
  return getProvider(providerOf(accountId)).createRepo(tokenFor(accountId), input)
}

/**
 * Map a provider's stored secret to git HTTPS credentials. GitHub uses a fixed
 * `x-access-token` user, GitLab `oauth2`. Bitbucket's git username depends on the
 * token type (OAuth bearer vs pasted API token), so its adapter derives it.
 */
function cloneAuth(accountId: string, secret: string): engine.CloneAuth {
  const provider = providerOf(accountId)
  if (provider === 'bitbucket') return bitbucketGitAuth(secret)
  if (provider === 'gitlab') return { username: 'oauth2', password: secret }
  return { username: 'x-access-token', password: secret }
}

const HOST_PROVIDER: Record<string, HostingProviderId> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'bitbucket.org': 'bitbucket'
}

/** Hostname of an https URL, or null (ssh remotes use the agent, not a token). */
function urlHost(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? u.hostname : null
  } catch {
    return null
  }
}

/**
 * HTTPS credentials for a repo's network ops (fetch/pull/push), resolved from a
 * connected account whose provider matches the repo's remote host. Returns
 * undefined for ssh remotes, unknown hosts, or when no matching account is
 * connected — then git falls back to its own credential helper / ssh-agent.
 *
 * This is why a token-cloned HTTPS repo can push without a system credential
 * helper: the token is re-injected inline from the keychain for each call.
 */
export async function authForRepo(repoPath: string): Promise<engine.CloneAuth | undefined> {
  const url = await engine.remoteUrl(repoPath)
  if (!url) return undefined
  const host = urlHost(url)
  const provider = host ? HOST_PROVIDER[host] : undefined
  if (!provider) return undefined
  const account = credentials.listAccounts().find((a) => a.provider === provider)
  if (!account) return undefined
  const secret = credentials.getToken(account.id)
  return secret ? cloneAuth(account.id, secret) : undefined
}

/**
 * Parse owner/name/full-path and host from a remote URL, handling both HTTPS
 * (`https://host/owner/repo.git`) and SSH (`git@host:owner/repo.git`,
 * `ssh://git@host/owner/repo.git`) forms. Returns null if it isn't a usable
 * `owner/…/repo` URL.
 */
function parseRemote(url: string): { host: string; coords: RepoCoords } | null {
  let host: string
  let path: string
  const scp = /^[^/@]+@([^:]+):(.+)$/.exec(url) // git@host:owner/repo.git
  if (scp) {
    host = scp[1]
    path = scp[2]
  } else {
    try {
      const u = new URL(url)
      host = u.hostname
      path = u.pathname
    } catch {
      return null
    }
  }
  const clean = path
    .replace(/^\/+/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
  if (!clean.includes('/')) return null
  const segs = clean.split('/')
  return { host, coords: { owner: segs[0], name: segs[segs.length - 1], fullPath: clean } }
}

type ResolvedRepo =
  | { ok: true; provider: HostingProviderId; accountId: string; coords: RepoCoords }
  | { ok: false; list: PullRequestList }

/** Map a repo's remote to its provider, coordinates, and a connected account. */
async function resolveHostedRepo(repoPath: string): Promise<ResolvedRepo> {
  const url = await engine.remoteUrl(repoPath)
  if (!url) return { ok: false, list: { status: 'unsupported', reason: 'no-remote' } }
  const parsed = parseRemote(url)
  const provider = parsed ? HOST_PROVIDER[parsed.host] : undefined
  if (!parsed || !provider) {
    return { ok: false, list: { status: 'unsupported', reason: 'unknown-host' } }
  }
  const account = credentials.listAccounts().find((a) => a.provider === provider)
  if (!account) return { ok: false, list: { status: 'noAccount', provider } }
  return { ok: true, provider, accountId: account.id, coords: parsed.coords }
}

/** Open pull/merge requests for the repo, or a benign reason it can't list them. */
export async function listPullRequests(repoPath: string): Promise<PullRequestList> {
  const r = await resolveHostedRepo(repoPath)
  if (!r.ok) return r.list
  const items = await getProvider(r.provider).listPullRequests(tokenFor(r.accountId), r.coords)
  return { status: 'ok', provider: r.provider, repo: r.coords.fullPath, items }
}

/** Create a pull/merge request from the repo's connected account. */
export async function createPullRequest(
  repoPath: string,
  input: CreatePullRequestInput
): Promise<PullRequest> {
  const r = await resolveHostedRepo(repoPath)
  if (!r.ok) {
    throw new Error(
      r.list.status === 'noAccount'
        ? 'Connect the matching hosting account before opening a pull request.'
        : "This repository's remote is not a supported hosting provider."
    )
  }
  return getProvider(r.provider).createPullRequest(tokenFor(r.accountId), r.coords, input)
}

/** Clone a repo, resolving the account's token in-process (never via IPC). */
export function cloneRepo(
  cloneUrl: string,
  parentDir: string,
  name: string,
  accountId?: string,
  onProgress?: (p: GitProgress) => void
): Promise<RepoRef> {
  const secret = accountId ? credentials.getToken(accountId) : null
  const auth = accountId && secret ? cloneAuth(accountId, secret) : undefined
  return engine.cloneRepo(cloneUrl, parentDir, name, auth, onProgress)
}
