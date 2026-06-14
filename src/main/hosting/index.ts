/**
 * Provider registry. GitHub ships now; GitLab and Bitbucket adapters slot in
 * here against the same HostingProvider interface (phases 2 and 3).
 */

import type { HostingProviderId } from '@shared/types'
import type { HostingProvider } from './types'
import { github } from './github'

const PROVIDERS: Partial<Record<HostingProviderId, HostingProvider>> = {
  github
}

/** The provider adapter for an id, or throw if it isn't implemented yet. */
export function getProvider(id: HostingProviderId): HostingProvider {
  const p = PROVIDERS[id]
  if (!p) throw new Error(`Provider "${id}" is not available yet.`)
  return p
}

/** Provider ids that have an adapter wired up. */
export function availableProviders(): HostingProviderId[] {
  return Object.keys(PROVIDERS) as HostingProviderId[]
}
