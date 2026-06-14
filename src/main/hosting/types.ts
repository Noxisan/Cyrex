/**
 * Hosting-provider abstraction (main process only).
 *
 * Each provider adapter speaks its own REST API and OAuth flow but presents this
 * uniform interface, so the IPC layer and UI stay provider-agnostic. Adapters
 * deal in raw tokens (passed in by the caller, loaded from the credentials
 * vault) and never persist or log them.
 */

import type {
  CreateRepoInput,
  HostingAccount,
  HostingProviderId,
  RemoteRepo
} from '@shared/types'

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
  /** Whether OAuth device flow is configured/available for this provider. */
  supportsDeviceFlow(): boolean
  startDeviceLogin(): Promise<DeviceCode>
  pollDeviceLogin(deviceCode: string): Promise<DevicePoll>
  /** Validate a token (paste path and post-login) and return the account. */
  validateToken(token: string): Promise<HostingAccount>
  listRepos(token: string): Promise<RemoteRepo[]>
  createRepo(token: string, input: CreateRepoInput): Promise<RemoteRepo>
}
