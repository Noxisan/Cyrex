/**
 * User keyboard-shortcut bindings (command id → combo). Persisted to
 * localStorage; missing/invalid entries fall back to the defaults. Setting a
 * combo that another command already uses unbinds that other command, so a
 * combo is never ambiguous.
 */

import { create } from 'zustand'
import { DEFAULT_BINDINGS, SHORTCUT_COMMANDS } from '../lib/shortcuts'

const KEY = 'cyrex.shortcuts'

function load(): Record<string, string> {
  const out: Record<string, string> = { ...DEFAULT_BINDINGS }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, string>
      for (const c of SHORTCUT_COMMANDS) {
        if (typeof saved[c.id] === 'string') out[c.id] = saved[c.id]
      }
    }
  } catch {
    /* fall back to defaults */
  }
  return out
}

function persist(bindings: Record<string, string>): void {
  localStorage.setItem(KEY, JSON.stringify(bindings))
}

interface ShortcutsState {
  bindings: Record<string, string>
  /** Set a command's combo ('' clears it); steals it from any other command. */
  setBinding: (id: string, combo: string) => void
  resetBinding: (id: string) => void
  resetAll: () => void
}

export const useShortcutsStore = create<ShortcutsState>((set) => ({
  bindings: load(),
  setBinding: (id, combo) =>
    set((s) => {
      const next = { ...s.bindings }
      if (combo) {
        for (const k of Object.keys(next)) if (next[k] === combo) next[k] = ''
      }
      next[id] = combo
      persist(next)
      return { bindings: next }
    }),
  resetBinding: (id) =>
    set((s) => {
      const next = { ...s.bindings, [id]: DEFAULT_BINDINGS[id] }
      persist(next)
      return { bindings: next }
    }),
  resetAll: () => {
    persist(DEFAULT_BINDINGS)
    return set({ bindings: { ...DEFAULT_BINDINGS } })
  }
}))
