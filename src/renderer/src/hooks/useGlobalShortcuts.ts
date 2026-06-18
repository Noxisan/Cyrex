/**
 * Global keyboard-shortcut dispatcher. Matches keydowns against the user's
 * bindings and runs the corresponding store action. Mounted once in App. The
 * Settings rebinding UI captures keys in the capture phase, so it pre-empts this
 * (bubble-phase) listener while recording.
 */

import { useEffect, useRef } from 'react'
import { useRepoStore } from '../store/repoStore'
import { useShortcutsStore } from '../store/shortcutsStore'
import { useFetch, usePull, usePush, useStashSave } from './useRepo'
import { SHORTCUT_COMMANDS, comboFromEvent, isBareCombo } from '../lib/shortcuts'

const NEEDS_REPO = new Set(SHORTCUT_COMMANDS.filter((c) => c.needsRepo).map((c) => c.id))
// Commands that run an engine mutation (which lives in a hook) rather than a
// plain store action, so they're dispatched through a ref of live mutations.
const MUTATION_COMMANDS = new Set(['fetch', 'pull', 'push', 'stash'])

function runCommand(id: string): void {
  const s = useRepoStore.getState()
  switch (id) {
    case 'palette':
      s.togglePalette()
      break
    case 'settings':
      if (s.settingsOpen) s.closeSettings()
      else s.openSettings()
      break
    case 'openRepo':
      s.openRepoModal()
      break
    case 'history':
      s.setViewMode('history')
      break
    case 'changes':
      s.setViewMode('changes')
      break
    case 'terminal':
      s.toggleTerminal()
      break
    case 'theme':
      s.toggleTheme()
      break
    case 'undo':
      s.openReflog()
      break
    case 'pullRequests':
      s.openPRPanel()
      break
  }
}

export function useGlobalShortcuts(): void {
  const activePath = useRepoStore((s) => s.activePath)
  const fetch = useFetch(activePath ?? '')
  const pull = usePull(activePath ?? '')
  const push = usePush(activePath ?? '')
  const stashSave = useStashSave(activePath ?? '')
  // The keydown listener is registered once; keep the latest mutation handlers in
  // a ref so it always invokes the ones bound to the current repo.
  const mut = useRef({ fetch, pull, push, stashSave })
  mut.current = { fetch, pull, push, stashSave }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Interface zoom (Ctrl/Cmd +/-/0) — fixed, not rebindable. Handled before
      // the binding match so it always wins and pre-empts the browser's own zoom.
      if (e.ctrlKey || e.metaKey) {
        const s = useRepoStore.getState()
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          s.setFontScale(s.fontScale + 0.1)
          return
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault()
          s.setFontScale(s.fontScale - 0.1)
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          s.setFontScale(1)
          return
        }
      }

      const combo = comboFromEvent(e)
      if (!combo) return
      const { bindings } = useShortcutsStore.getState()
      const id = Object.keys(bindings).find((k) => bindings[k] && bindings[k] === combo)
      if (!id) return
      // A bare (no-modifier) combo must not fire while typing in a field.
      if (isBareCombo(combo)) {
        const el = document.activeElement as HTMLElement | null
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
          return
        }
      }
      if (NEEDS_REPO.has(id) && !useRepoStore.getState().activePath) return
      e.preventDefault()
      if (MUTATION_COMMANDS.has(id)) {
        const m = mut.current
        if (id === 'fetch') m.fetch.mutate(undefined)
        else if (id === 'pull') m.pull.mutate(undefined)
        else if (id === 'push') m.push.mutate(false)
        else if (id === 'stash') m.stashSave.mutate(undefined)
        return
      }
      runCommand(id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
