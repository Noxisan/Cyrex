/**
 * GitLab provider adapter (gitlab.com). Uses the global `fetch` — no SDK.
 * OAuth 2.0 device flow needs only a public application id (injected as
 * __GITLAB_CLIENT_ID__, from CYREX_GITLAB_CLIENT_ID); there is no secret to ship.
 * A Bearer header authenticates both OAuth tokens and pasted personal access
 * tokens, so the token-paste path works before any OAuth app exists.
 */

import type {
  CreatePullRequestInput,
  CreateRepoInput,
  HostingAccount,
  PullRequest,
  RemoteRepo
} from '@shared/types'
import type { DeviceCode, DevicePoll, HostingProvider, RepoCoords } from './types'

const BASE = 'https://gitlab.com'
const API = `${BASE}/api/v4`
const DEVICE_CODE_URL = `${BASE}/oauth/authorize_device`
const TOKEN_URL = `${BASE}/oauth/token`
// `api` is needed to create projects and read private ones.
const SCOPES = 'api'

function clientId(): string {
  return typeof __GITLAB_CLIENT_ID__ === 'string' ? __GITLAB_CLIENT_ID__ : ''
}

/** Authenticated GitLab REST call returning parsed JSON, throwing on failure. */
async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('GitLab rejected the token (invalid or expired).')
    const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null
    const msg = body?.message || body?.error
    throw new Error(`GitLab API error ${res.status}${msg ? `: ${msg}` : ''}`)
  }
  return (await res.json()) as T
}

interface GlProject {
  id: number
  name: string
  path_with_namespace: string
  namespace: { path: string; full_path: string }
  visibility: 'private' | 'internal' | 'public'
  description: string | null
  http_url_to_repo: string
  web_url: string
  default_branch: string | null
  last_activity_at: string | null
}

function toRemoteRepo(p: GlProject): RemoteRepo {
  return {
    id: String(p.id),
    name: p.name,
    fullName: p.path_with_namespace,
    owner: p.namespace.path,
    private: p.visibility !== 'public',
    description: p.description,
    cloneUrl: p.http_url_to_repo,
    htmlUrl: p.web_url,
    defaultBranch: p.default_branch,
    updatedAt: p.last_activity_at
  }
}

export const gitlab: HostingProvider = {
  id: 'gitlab',

  supportsDeviceFlow() {
    return clientId().length > 0
  },

  // GitLab login uses a build-time application id, not an in-app entry.
  oauthConfigurable() {
    return false
  },

  async startDeviceLogin(): Promise<DeviceCode> {
    const id = clientId()
    if (!id) throw new Error('GitLab device login is not configured.')
    const res = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: id, scope: SCOPES })
    })
    if (!res.ok) throw new Error(`Could not start GitLab login (HTTP ${res.status}).`)
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
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
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
    const u = await api<{ username: string; name: string | null; avatar_url: string | null }>(
      token,
      '/user'
    )
    return {
      id: `gitlab:${u.username}`,
      provider: 'gitlab',
      login: u.username,
      name: u.name,
      avatarUrl: u.avatar_url
    }
  },

  async listRepos(token: string): Promise<RemoteRepo[]> {
    const out: RemoteRepo[] = []
    for (let page = 1; page <= 10; page++) {
      const batch = await api<GlProject[]>(
        token,
        `/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc&page=${page}`
      )
      out.push(...batch.map(toRemoteRepo))
      if (batch.length < 100) break
    }
    return out
  },

  async createRepo(token: string, input: CreateRepoInput): Promise<RemoteRepo> {
    const p = await api<GlProject>(token, '/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        visibility: input.private ? 'private' : 'public'
      })
    })
    return toRemoteRepo(p)
  },

  async listPullRequests(token: string, repo: RepoCoords): Promise<PullRequest[]> {
    const id = encodeURIComponent(repo.fullPath)
    const mrs = await api<GlMergeRequest[]>(
      token,
      `/projects/${id}/merge_requests?state=opened&per_page=50&order_by=updated_at&sort=desc`
    )
    return mrs.map(toPullRequest)
  },

  async createPullRequest(
    token: string,
    repo: RepoCoords,
    input: CreatePullRequestInput
  ): Promise<PullRequest> {
    const id = encodeURIComponent(repo.fullPath)
    // GitLab marks a draft MR by a "Draft:" title prefix; there is no separate flag.
    const title = input.draft ? `Draft: ${input.title}` : input.title
    const mr = await api<GlMergeRequest>(token, `/projects/${id}/merge_requests`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: input.body ?? '',
        source_branch: input.sourceBranch,
        target_branch: input.targetBranch
      })
    })
    return toPullRequest(mr)
  }
}

interface GlMergeRequest {
  id: number
  iid: number
  title: string
  state: 'opened' | 'closed' | 'merged' | 'locked'
  draft: boolean
  web_url: string
  created_at: string | null
  updated_at: string | null
  author: { username: string } | null
  source_branch: string
  target_branch: string
}

function toPullRequest(m: GlMergeRequest): PullRequest {
  return {
    id: String(m.id),
    number: m.iid,
    title: m.title,
    state: m.state === 'opened' ? 'open' : m.state === 'merged' ? 'merged' : 'closed',
    author: m.author?.username ?? null,
    sourceBranch: m.source_branch,
    targetBranch: m.target_branch,
    isDraft: m.draft,
    htmlUrl: m.web_url,
    createdAt: m.created_at,
    updatedAt: m.updated_at
  }
}
