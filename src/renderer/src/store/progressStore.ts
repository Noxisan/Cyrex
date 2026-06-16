/**
 * Holds the current git network-operation progress (clone/fetch/pull/push) for
 * the global top progress bar. Fed by the main-process `git:progress` stream
 * (subscribed once in App). Only one network op runs at a time, so a single
 * current-progress slot is enough.
 */

import { create } from 'zustand'
import type { GitProgress } from '@shared/types'

interface ProgressState {
  progress: GitProgress | null
  setProgress: (p: GitProgress) => void
  clear: () => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useProgressStore = create<ProgressState>((set) => ({
  progress: null,
  setProgress: (p) => {
    if (timer) clearTimeout(timer)
    set({ progress: p })
    // Clear briefly after the final `done`; otherwise auto-clear as a safety net
    // if the stream stops without one (e.g. the op errored mid-flight).
    timer = setTimeout(() => set({ progress: null }), p.phase === 'done' ? 600 : 5000)
  },
  clear: () => {
    if (timer) clearTimeout(timer)
    set({ progress: null })
  }
}))
