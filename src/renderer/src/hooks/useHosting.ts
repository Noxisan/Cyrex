/**
 * React Query hooks over the hosting bridge (window.cyrex.hosting + clone). Like
 * useRepo.ts these unwrap the EngineResult envelope so failures surface as real
 * error states. Tokens never appear here — only account/repo metadata.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreatePullRequestInput,
  CreateRepoInput,
  EngineResult,
  HostingProviderId
} from '@shared/types'
import { useToastStore } from '../store/toastStore'

function unwrap<T>(res: EngineResult<T>): T {
  if (!res.ok) throw new Error(res.error)
  return res.data
}

export function useProviders() {
  return useQuery({
    queryKey: ['hostingProviders'],
    queryFn: async () => unwrap(await window.cyrex.hosting.providers())
  })
}

export function useAccounts() {
  return useQuery({
    queryKey: ['hostingAccounts'],
    queryFn: async () => unwrap(await window.cyrex.hosting.listAccounts())
  })
}

export function useRemoteRepos(accountId: string | null) {
  return useQuery({
    queryKey: ['remoteRepos', accountId],
    enabled: !!accountId,
    staleTime: 60_000,
    queryFn: async () => unwrap(await window.cyrex.hosting.listRepos(accountId!))
  })
}

/** Shared mutation wrapper: surfaces errors as toasts, invalidates a key set. */
function useHostingMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<EngineResult<TData>>,
  invalidate: string[] = []
) {
  const qc = useQueryClient()
  const pushToast = useToastStore((s) => s.push)
  return useMutation({
    mutationFn: async (vars: TVars) => unwrap(await fn(vars)),
    onSuccess: () => {
      for (const key of invalidate) void qc.invalidateQueries({ queryKey: [key] })
    },
    onError: (err) => pushToast((err as Error).message, 'error')
  })
}

export function useConnectToken() {
  return useHostingMutation(
    (v: { provider: HostingProviderId; token: string }) =>
      window.cyrex.hosting.connectToken(v.provider, v.token),
    ['hostingAccounts']
  )
}

export function useSetOAuthApp() {
  return useHostingMutation(
    (v: { provider: HostingProviderId; clientId: string; clientSecret: string }) =>
      window.cyrex.hosting.setOAuthApp(v.provider, v.clientId, v.clientSecret),
    ['hostingProviders']
  )
}

export function useClearOAuthApp() {
  return useHostingMutation(
    (provider: HostingProviderId) => window.cyrex.hosting.clearOAuthApp(provider),
    ['hostingProviders']
  )
}

export function useDisconnect() {
  return useHostingMutation((id: string) => window.cyrex.hosting.disconnect(id), ['hostingAccounts'])
}

export function useCreateRepo() {
  return useHostingMutation(
    (v: { accountId: string; input: CreateRepoInput }) =>
      window.cyrex.hosting.createRepo(v.accountId, v.input),
    ['remoteRepos']
  )
}

export function useCloneRepo() {
  return useHostingMutation(
    (v: { cloneUrl: string; parentDir: string; name: string; accountId?: string }) =>
      window.cyrex.cloneRepo(v.cloneUrl, v.parentDir, v.name, v.accountId)
  )
}

/** Open pull/merge requests for the active repo (or a benign no-account state). */
export function usePullRequests(path: string | null, enabled = true) {
  return useQuery({
    queryKey: ['pullRequests', path],
    enabled: !!path && enabled,
    staleTime: 30_000,
    queryFn: async () => unwrap(await window.cyrex.hosting.pullRequests(path!))
  })
}

export function useCreatePullRequest(path: string) {
  return useHostingMutation(
    (input: CreatePullRequestInput) => window.cyrex.hosting.createPullRequest(path, input),
    ['pullRequests']
  )
}
