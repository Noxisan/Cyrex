/**
 * Global keyboard-shortcut dispatcher. Matches keydowns against the user's
 * bindings and runs the corresponding store action. Mounted once in App. The
 * Settings rebinding UI captures keys in the capture phase, so it pre-empts this
 * (bubble-phase) listener while recording.
 */

import { useEffect } from 'react'
import { useRepoStore } from '../store/repoStore'
import { useShortcutsStore } from '../store/shortcutsStore'
import { SHORTCUT_COMMANDS, comboFromEvent, isBareCombo } from '../lib/shortcuts'

const NEEDS_REPO = new Set(SHORTCUT_COMMANDS.filter((c) => c.needsRepo).map((c) => c.id))

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
  }
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
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
      runCommand(id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
