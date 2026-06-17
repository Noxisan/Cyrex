/**
 * Hosting-provider abstraction (main process only).
 *
 * Each provider adapter speaks its own REST API and OAuth flow but presents this
 * uniform interface, so the IPC layer and UI stay provider-agnostic. Adapters
 * deal in raw tokens (passed in by the caller, loaded from the credentials
 * vault) and never persist or log them.
 */

import type {
  CreatePullRequestInput,
  CreateRepoInput,
  HostingAccount,
  HostingProviderId,
  PullRequest,
  RemoteRepo
} from '@shared/types'

/**
 * A repo's coordinates on its host, parsed from the remote URL. GitHub/Bitbucket
 * key off `owner` + `name`; GitLab addresses a project by its URL-encoded
 * `fullPath` (which may include nested groups).
 */
export interface RepoCoords {
  owner: string
  name: string
  /** Full namespace path without a trailing `.git`, e.g. "group/sub/repo". */
  fullPath: string
}

/** Result of starting an OAuth device-flow login. */
export interface DeviceCode {
  deviceCode: string
  userCode: string
  verificationUri: string
  intervalSec: number
  expiresInSec: number
}

/** One poll of the device-flow token endpoint. */
export type DevicePoll =
  | { status: 'pending' }
  | { status: 'slowDown' }
  | { status: 'authorized'; token: string }
  | { status: 'expired' }
  | { status: 'denied' }

export interface HostingProvider {
  id: HostingProviderId
  /** Whether browser login is configured/available right now. */
  supportsDeviceFlow(): boolean
  /** Whether the user can supply an OAuth app (client id/secret) in-app to enable login. */
  oauthConfigurable(): boolean
  startDeviceLogin(): Promise<DeviceCode>
  pollDeviceLogin(deviceCode: string): Promise<DevicePoll>
  /** Validate a token (paste path and post-login) and return the account. */
  validateToken(token: string): Promise<HostingAccount>
  listRepos(token: string): Promise<RemoteRepo[]>
  createRepo(token: string, input: CreateRepoInput): Promise<RemoteRepo>
  /** Open pull/merge requests for a repo, newest first. */
  listPullRequests(token: string, repo: RepoCoords): Promise<PullRequest[]>
  createPullRequest(
    token: string,
    repo: RepoCoords,
    input: CreatePullRequestInput
  ): Promise<PullRequest>
}
