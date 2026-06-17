/**
 * Bitbucket Cloud provider adapter.
 *
 * Two login paths:
 *  - Browser login (preferred): OAuth 2.0 authorization-code flow over a loopback
 *    redirect. We spin up a short-lived localhost server, open Bitbucket's consent
 *    page, catch the redirect, and exchange the code for a bearer access token.
 *    Needs an OAuth consumer (client id + secret injected at build time).
 *  - Token paste (fallback): an Atlassian API token pasted as `email:api_token`
 *    (app passwords are deprecated — they stop working 2026-06-09).
 *
 * The stored secret is therefore either a bare bearer token (OAuth) or
 * `email:api_token` (paste); `isPasteSecret` tells them apart so REST auth and git
 * auth pick the right scheme. The secret never reaches the renderer or logs.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import type {
  CreatePullRequestInput,
  CreateRepoInput,
  HostingAccount,
  PullRequest,
  RemoteRepo
} from '@shared/types'
import { getOAuthApp } from '../credentials'
import type { DeviceCode, DevicePoll, HostingProvider, RepoCoords } from './types'

const API = 'https://api.bitbucket.org/2.0'
const AUTHORIZE_URL = 'https://bitbucket.org/site/oauth2/authorize'
const TOKEN_URL = 'https://bitbucket.org/site/oauth2/access_token'

// Fixed loopback redirect — the OAuth consumer's callback URL must be set to this.
const REDIRECT_PORT = 47600
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`
const LOGIN_TTL_MS = 300_000

// The OAuth consumer can come from a user-entered, keychain-stored app (preferred —
// no rebuild) or a build-time define. Runtime store wins so users can set it in-app.
function clientId(): string {
  const stored = getOAuthApp('bitbucket')?.clientId
  if (stored) return stored
  return typeof __BITBUCKET_CLIENT_ID__ === 'string' ? __BITBUCKET_CLIENT_ID__ : ''
}
function clientSecret(): string {
  const stored = getOAuthApp('bitbucket')?.clientSecret
  if (stored) return stored
  return typeof __BITBUCKET_CLIENT_SECRET__ === 'string' ? __BITBUCKET_CLIENT_SECRET__ : ''
}

/**
 * The paste path stores `email:api_token` (HTTP Basic); the OAuth path stores a
 * bare bearer access token. An email before the first colon marks the paste path.
 */
function isPasteSecret(secret: string): boolean {
  const colon = secret.indexOf(':')
  const at = secret.indexOf('@')
  return colon > 0 && at >= 0 && at < colon
}

/** Authorization header for a stored secret: Basic for paste, Bearer for OAuth. */
function authHeader(secret: string): string {
  return isPasteSecret(secret)
    ? `Basic ${Buffer.from(secret).toString('base64')}`
    : `Bearer ${secret}`
}

/** Git HTTPS credentials for a stored secret (used by the engine via service). */
export function gitAuth(secret: string): { username: string; password: string } {
  // Bitbucket requires a fixed git username per token type; the real secret is the password.
  if (isPasteSecret(secret)) {
    return { username: 'x-bitbucket-api-token-auth', password: secret.slice(secret.indexOf(':') + 1) }
  }
  return { username: 'x-token-auth', password: secret }
}

/**
 * fetch with an abort timeout. Without it a stalled host (e.g. api.bitbucket.org
 * behind a proxy/firewall that differs from bitbucket.org) would hang the login
 * poll forever — the renderer would sit on "Waiting…" with no error.
 */
async function fetchWithTimeout(url: string, init: RequestInit, ms = 20_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error(
        `Bitbucket did not respond within ${ms / 1000}s. Check your connection (and any proxy/firewall) and try again.`,
        { cause: e }
      )
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** Authenticated Bitbucket REST call returning parsed JSON, throwing on failure. */
async function api<T>(secret: string, path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API}${path}`
  const res = await fetchWithTimeout(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: authHeader(secret),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  })
  if (!res.ok) {
    // Surface Bitbucket's own message — it distinguishes "not supported for this
    // endpoint" (wrong token type), missing scopes, and bad credentials, which we
    // otherwise can't tell apart from the status code alone.
    const text = await res.text().catch(() => '')
    let detail: string
    try {
      detail = (JSON.parse(text) as { error?: { message?: string } })?.error?.message ?? ''
    } catch {
      detail = text.slice(0, 200)
    }
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      if (isPasteSecret(secret)) {
        throw new Error(
          `Bitbucket rejected the API token (${res.status}${detail ? `: ${detail}` : ''}). ` +
            'Use an Atlassian API token (id.atlassian.com) created with scopes ' +
            'read:user:bitbucket, read:workspace:bitbucket, read:repository:bitbucket, write:repository:bitbucket, ' +
            'and connect as email:api_token (your Atlassian account email, not your Bitbucket username).'
        )
      }
      // Not the `email:api_token` shape — most often a bare token pasted without
      // the email prefix (Atlassian API tokens don't authenticate as a bearer),
      // or an expired browser-login token. Guide both cases.
      throw new Error(
        `Bitbucket rejected the credentials (${res.status}${detail ? `: ${detail}` : ''}). ` +
          'If you pasted a token, paste it as email:api_token (your Atlassian account email ' +
          'and an API token from id.atlassian.com with read:user:bitbucket + read:workspace:bitbucket + ' +
          'read:repository:bitbucket scopes). If you used browser login, reconnect your Bitbucket account.'
      )
    }
    throw new Error(`Bitbucket API error ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return (await res.json()) as T
}

// ── OAuth browser login (authorization code over loopback) ──────────────────

interface LoginSession {
  server: Server
  result: DevicePoll | null
  expiresAt: number
}

const logins = new Map<string, LoginSession>()

const responsePage = (message: string): string =>
  `<!doctype html><meta charset="utf-8"><title>Cyrex</title>` +
  `<body style="font-family:system-ui,sans-serif;background:#0f0f10;color:#e5e5e5;` +
  `display:grid;place-items:center;height:100vh;margin:0">` +
  `<div style="text-align:center"><h2 style="color:#F7374F;margin:0 0 .5rem">Cyrex</h2>` +
  `<p>${message}</p><p style="opacity:.55;font-size:.9rem">You can close this tab.</p></div>`

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException): void => {
      reject(
        err.code === 'EADDRINUSE'
          ? new Error(`Bitbucket login port ${port} is in use. Close what's using it and retry.`)
          : err
      )
    }
    server.once('error', onError)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError)
      resolve()
    })
  })
}

/** Exchange an authorization code for a bearer access token (confidential client). */
async function exchangeCode(code: string): Promise<string> {
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI
    }).toString()
  })
  const d = (await res.json().catch(() => null)) as {
    access_token?: string
    error_description?: string
  } | null
  if (!res.ok || !d?.access_token) {
    throw new Error(d?.error_description ?? `Bitbucket token exchange failed (HTTP ${res.status}).`)
  }
  return d.access_token
}

/** Handle the browser redirect: validate state, swap code for a token, reply. */
async function onCallback(
  state: string,
  session: LoginSession,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  const reqUrl = new URL(req.url ?? '/', REDIRECT_URI)
  if (reqUrl.pathname !== '/callback') {
    res.writeHead(404).end(responsePage('Not found.'))
    return
  }
  const code = reqUrl.searchParams.get('code')
  const returnedState = reqUrl.searchParams.get('state')
  const error = reqUrl.searchParams.get('error')
  if (error === 'access_denied') {
    session.result = { status: 'denied' }
    res.end(responsePage('Login was cancelled.'))
  } else if (!code || returnedState !== state) {
    session.result = { status: 'denied' }
    res.end(responsePage('Login failed. Return to Cyrex and try again.'))
  } else {
    try {
      session.result = { status: 'authorized', token: await exchangeCode(code) }
      res.end(responsePage('Signed in to Bitbucket.'))
    } catch (e) {
      // Never include the token; the exchange error carries only OAuth metadata.
      console.error('Bitbucket OAuth exchange failed:', (e as Error).message)
      session.result = { status: 'denied' }
      res.end(responsePage('Could not complete sign-in. Return to Cyrex and try again.'))
    }
  }
  session.server.close()
}

interface BbRepo {
  uuid: string
  name: string
  full_name: string
  is_private: boolean
  description: string | null
  mainbranch: { name: string } | null
  updated_on: string | null
  links?: { html?: { href?: string } }
}

function toRemoteRepo(r: BbRepo): RemoteRepo {
  const owner = r.full_name.split('/')[0]
  return {
    id: r.uuid,
    name: r.name,
    fullName: r.full_name,
    owner,
    private: r.is_private,
    description: r.description,
    // Build a clean URL rather than trusting links.clone (which may embed a user).
    cloneUrl: `https://bitbucket.org/${r.full_name}.git`,
    // Fall back to a derived URL so a missing/odd links payload never breaks the list.
    htmlUrl: r.links?.html?.href ?? `https://bitbucket.org/${r.full_name}`,
    defaultBranch: r.mainbranch?.name ?? null,
    updatedAt: r.updated_on
  }
}

export const bitbucket: HostingProvider = {
  id: 'bitbucket',

  // Browser login is available only when an OAuth consumer is configured.
  supportsDeviceFlow() {
    return clientId().length > 0 && clientSecret().length > 0
  },

  // Bitbucket's consumer can be entered in-app (id + secret), unlocking browser login.
  oauthConfigurable() {
    return true
  },

  async startDeviceLogin(): Promise<DeviceCode> {
    if (!this.supportsDeviceFlow()) throw new Error('Bitbucket browser login is not configured.')
    const state = randomUUID()
    const server = createServer()
    const session: LoginSession = { server, result: null, expiresAt: Date.now() + LOGIN_TTL_MS }
    server.on('request', (req, res) => void onCallback(state, session, req, res))
    await listen(server, REDIRECT_PORT)
    logins.set(state, session)
    const url =
      `${AUTHORIZE_URL}?client_id=${encodeURIComponent(clientId())}` +
      `&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    // No user code: this is a redirect flow, so the UI just waits while we open `url`.
    return { deviceCode: state, userCode: '', verificationUri: url, intervalSec: 1, expiresInSec: 300 }
  },

  pollDeviceLogin(deviceCode: string): Promise<DevicePoll> {
    const session = logins.get(deviceCode)
    if (!session) return Promise.resolve({ status: 'expired' })
    if (session.result) {
      logins.delete(deviceCode)
      return Promise.resolve(session.result)
    }
    if (Date.now() > session.expiresAt) {
      session.server.close()
      logins.delete(deviceCode)
      return Promise.resolve({ status: 'expired' })
    }
    return Promise.resolve({ status: 'pending' })
  },

  async validateToken(secret: string): Promise<HostingAccount> {
    const u = await api<{
      username?: string
      nickname?: string
      account_id?: string
      display_name: string | null
      links: { avatar?: { href: string } }
    }>(secret, '/user')
    // Atlassian is phasing out `username`; fall back so the account is still
    // usable (and never becomes `bitbucket:undefined`).
    const login = u.username ?? u.nickname ?? u.account_id ?? 'bitbucket'
    return {
      id: `bitbucket:${login}`,
      provider: 'bitbucket',
      login,
      name: u.display_name,
      avatarUrl: u.links.avatar?.href ?? null
    }
  },

  async listRepos(secret: string): Promise<RemoteRepo[]> {
    // Bitbucket CHANGE-2770 removed the cross-workspace listing endpoints
    // (GET /repositories, /user/permissions/workspaces, and /workspaces all
    // return 410 Gone). The supported replacement (CHANGE-3022) is
    // GET /user/workspaces; we then list repos per workspace via
    // /repositories/{workspace}. Requires the "Workspace membership: Read" scope.
    const slugs = new Set<string>()
    let wnext: string | null = '/user/workspaces?pagelen=100'
    for (let page = 0; page < 10 && wnext; page++) {
      // Tolerate either a workspace object ({slug}) or a membership ({workspace:{slug}}).
      const body: {
        values: { slug?: string; workspace?: { slug?: string } }[]
        next?: string
      } = await api<{
        values: { slug?: string; workspace?: { slug?: string } }[]
        next?: string
      }>(secret, wnext)
      for (const w of body.values) {
        const slug = w.slug ?? w.workspace?.slug
        if (slug) slugs.add(slug)
      }
      wnext = body.next ?? null
    }

    const out: RemoteRepo[] = []
    for (const slug of slugs) {
      let next: string | null = `/repositories/${encodeURIComponent(slug)}?pagelen=100`
      // Follow paginated `next` links, capped so a huge workspace can't spin forever.
      for (let page = 0; page < 20 && next; page++) {
        const body: { values: BbRepo[]; next?: string } = await api<{
          values: BbRepo[]
          next?: string
        }>(secret, next)
        out.push(...body.values.map(toRemoteRepo))
        next = body.next ?? null
      }
    }
    // Most-recently-updated first.
    out.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    return out
  },

  async createRepo(secret: string, input: CreateRepoInput): Promise<RemoteRepo> {
    // Personal repos live under the user's workspace (slug == username).
    const me = await api<{ username: string }>(secret, '/user')
    const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const r = await api<BbRepo>(secret, `/repositories/${me.username}/${slug}`, {
      method: 'POST',
      body: JSON.stringify({
        scm: 'git',
        is_private: input.private,
        description: input.description ?? ''
      })
    })
    return toRemoteRepo(r)
  },

  async listPullRequests(secret: string, repo: RepoCoords): Promise<PullRequest[]> {
    const slug = `${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`
    const body = await api<{ values: BbPull[] }>(
      secret,
      `/repositories/${slug}/pullrequests?state=OPEN&pagelen=50&sort=-updated_on`
    )
    return body.values.map(toPullRequest)
  },

  async createPullRequest(
    secret: string,
    repo: RepoCoords,
    input: CreatePullRequestInput
  ): Promise<PullRequest> {
    const slug = `${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`
    const pr = await api<BbPull>(secret, `/repositories/${slug}/pullrequests`, {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        description: input.body ?? '',
        source: { branch: { name: input.sourceBranch } },
        destination: { branch: { name: input.targetBranch } }
      })
    })
    return toPullRequest(pr)
  }
}

interface BbPull {
  id: number
  title: string
  state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED'
  author: { nickname?: string; display_name?: string } | null
  source: { branch: { name: string } }
  destination: { branch: { name: string } }
  created_on: string | null
  updated_on: string | null
  links?: { html?: { href?: string } }
}

function toPullRequest(p: BbPull): PullRequest {
  return {
    id: String(p.id),
    number: p.id,
    title: p.title,
    state: p.state === 'OPEN' ? 'open' : p.state === 'MERGED' ? 'merged' : 'closed',
    author: p.author?.nickname ?? p.author?.display_name ?? null,
    sourceBranch: p.source.branch.name,
    targetBranch: p.destination.branch.name,
    // Bitbucket Cloud has no draft PR concept.
    isDraft: false,
    htmlUrl: p.links?.html?.href ?? `https://bitbucket.org/${p.id}`,
    createdAt: p.created_on,
    updatedAt: p.updated_on
  }
}
