/**
 * GitHub provider adapter. Uses the global `fetch` (Node 20 / Electron) — no
 * extra dependency, no SDK. Device flow needs only a public client id (injected
 * as __GITHUB_CLIENT_ID__); there is no client secret to ship.
 */

import type {
  CreatePullRequestInput,
  CreateRepoInput,
  HostingAccount,
  PullRequest,
  PullRequestDetail,
  RemoteRepo
} from '@shared/types'
import { getOAuthApp } from '../credentials'
import { parseUnifiedDiff } from '../git/diff'
import type { DeviceCode, DevicePoll, HostingProvider, RepoCoords } from './types'

const API = 'https://api.github.com'
const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const SCOPES = 'repo read:user'
const UA = 'Cyrex'

// The OAuth App client id can come from a user-entered, keychain-stored app
// (preferred — no rebuild) or a build-time define. The runtime store wins so a
// user can enable browser login in-app. Device flow needs only this public id;
// there is no client secret to handle.
function clientId(): string {
  const stored = getOAuthApp('github')?.clientId
  if (stored) return stored
  return typeof __GITHUB_CLIENT_ID__ === 'string' ? __GITHUB_CLIENT_ID__ : ''
}

/** Authenticated GitHub REST call returning parsed JSON, throwing on failure. */
async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': UA,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('GitHub rejected the token (invalid or expired).')
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(`GitHub API error ${res.status}${body?.message ? `: ${body.message}` : ''}`)
  }
  return (await res.json()) as T
}

interface GhRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  private: boolean
  description: string | null
  clone_url: string
  html_url: string
  default_branch: string | null
  updated_at: string | null
}

function toRemoteRepo(r: GhRepo): RemoteRepo {
  return {
    id: String(r.id),
    name: r.name,
    fullName: r.full_name,
    owner: r.owner.login,
    private: r.private,
    description: r.description,
    cloneUrl: r.clone_url,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch,
    updatedAt: r.updated_at
  }
}

export const github: HostingProvider = {
  id: 'github',

  supportsDeviceFlow() {
    return clientId().length > 0
  },

  // A GitHub OAuth App's client id can be entered in-app to unlock device-flow
  // browser login without a rebuild (no client secret needed for device flow).
  oauthConfigurable() {
    return true
  },

  async startDeviceLogin(): Promise<DeviceCode> {
    const id = clientId()
    if (!id) throw new Error('GitHub device login is not configured.')
    const res = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ client_id: id, scope: SCOPES })
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string
        error_description?: string
      } | null
      const reason = body?.error_description || body?.error || `HTTP ${res.status}`
      throw new Error(`Could not start GitHub login: ${reason}`)
    }
    const d = (await res.json()) as {
      device_code: string
      user_code: string
      verification_uri: string
      interval: number
      expires_in: number
    }
    return {
      deviceCode: d.device_code,
      userCode: d.user_code,
      verificationUri: d.verification_uri,
      intervalSec: d.interval,
      expiresInSec: d.expires_in
    }
  },

  async pollDeviceLogin(deviceCode: string): Promise<DevicePoll> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({
        client_id: clientId(),
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    })
    const d = (await res.json()) as { access_token?: string; error?: string }
    if (d.access_token) return { status: 'authorized', token: d.access_token }
    switch (d.error) {
      case 'authorization_pending':
        return { status: 'pending' }
      case 'slow_down':
        return { status: 'slowDown' }
      case 'expired_token':
        return { status: 'expired' }
      case 'access_denied':
        return { status: 'denied' }
      default:
        return { status: 'pending' }
    }
  },

  async validateToken(token: string): Promise<HostingAccount> {
    const u = await api<{ login: string; name: string | null; avatar_url: string | null }>(
      token,
      '/user'
    )
    return {
      id: `github:${u.login}`,
      provider: 'github',
      login: u.login,
      name: u.name,
      avatarUrl: u.avatar_url
    }
  },

  async listRepos(token: string): Promise<RemoteRepo[]> {
    const out: RemoteRepo[] = []
    // Paginate, capped so a huge account can't spin forever.
    for (let page = 1; page <= 10; page++) {
      const batch = await api<GhRepo[]>(
        token,
        `/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member&page=${page}`
      )
      out.push(...batch.map(toRemoteRepo))
      if (batch.length < 100) break
    }
    return out
  },

  async createRepo(token: string, input: CreateRepoInput): Promise<RemoteRepo> {
    const r = await api<GhRepo>(token, '/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        private: input.private
      })
    })
    return toRemoteRepo(r)
  },

  async listPullRequests(token: string, repo: RepoCoords): Promise<PullRequest[]> {
    const prs = await api<GhPull[]>(
      token,
      `/repos/${repo.owner}/${repo.name}/pulls?state=open&per_page=50&sort=updated&direction=desc`
    )
    return prs.map(toPullRequest)
  },

  async getPullRequest(
    token: string,
    repo: RepoCoords,
    number: number
  ): Promise<PullRequestDetail> {
    const pr = await api<GhPull>(token, `/repos/${repo.owner}/${repo.name}/pulls/${number}`)
    // The same endpoint returns a raw unified diff under the diff media type.
    const res = await fetch(`${API}/repos/${repo.owner}/${repo.name}/pulls/${number}`, {
      headers: {
        Accept: 'application/vnd.github.diff',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': UA,
        Authorization: `Bearer ${token}`
      }
    })
    const diff = res.ok ? await res.text() : ''
    return { pr: toPullRequest(pr), body: pr.body ?? '', files: parseUnifiedDiff(diff) }
  },

  async createPullRequest(
    token: string,
    repo: RepoCoords,
    input: CreatePullRequestInput
  ): Promise<PullRequest> {
    const pr = await api<GhPull>(token, `/repos/${repo.owner}/${repo.name}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        body: input.body ?? '',
        head: input.sourceBranch,
        base: input.targetBranch,
        draft: input.draft ?? false
      })
    })
    return toPullRequest(pr)
  }
}

interface GhPull {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  draft: boolean
  merged_at: string | null
  html_url: string
  created_at: string | null
  updated_at: string | null
  user: { login: string } | null
  head: { ref: string }
  base: { ref: string }
}

function toPullRequest(p: GhPull): PullRequest {
  return {
    id: String(p.id),
    number: p.number,
    title: p.title,
    state: p.merged_at ? 'merged' : p.state === 'closed' ? 'closed' : 'open',
    author: p.user?.login ?? null,
    sourceBranch: p.head.ref,
    targetBranch: p.base.ref,
    isDraft: p.draft,
    htmlUrl: p.html_url,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  }
}
