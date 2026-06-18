/**
 * Customizable keyboard shortcuts. Each command maps to a store action and a
 * default key combo; the user can rebind them in Settings. Combos are normalized
 * strings like `mod+k` / `mod+shift+l` where `mod` is ⌘ on macOS and Ctrl
 * elsewhere, so a binding is portable across platforms.
 */

import { isMac } from './platform'

export interface ShortcutCommand {
  id: string
  /** i18n key for the command's display label. */
  labelKey: string
  /** Default combo, e.g. `mod+k`. */
  defaultCombo: string
  /** Requires an open repository to do anything. */
  needsRepo: boolean
}

export const SHORTCUT_COMMANDS: ShortcutCommand[] = [
  { id: 'palette', labelKey: 'palette.open', defaultCombo: 'mod+k', needsRepo: false },
  { id: 'settings', labelKey: 'actions.settings', defaultCombo: 'mod+,', needsRepo: false },
  { id: 'openRepo', labelKey: 'actions.openRepository', defaultCombo: 'mod+o', needsRepo: false },
  { id: 'history', labelKey: 'settings.shortcut.goHistory', defaultCombo: 'mod+1', needsRepo: true },
  { id: 'changes', labelKey: 'settings.shortcut.goChanges', defaultCombo: 'mod+2', needsRepo: true },
  { id: 'terminal', labelKey: 'palette.toggleTerminal', defaultCombo: 'mod+j', needsRepo: true },
  { id: 'theme', labelKey: 'palette.toggleTheme', defaultCombo: 'mod+shift+l', needsRepo: false },
  { id: 'undo', labelKey: 'palette.openUndo', defaultCombo: 'mod+shift+u', needsRepo: true },
  {
    id: 'pullRequests',
    labelKey: 'actions.pullRequests',
    defaultCombo: 'mod+shift+p',
    needsRepo: true
  },
  { id: 'fetch', labelKey: 'actions.fetch', defaultCombo: 'mod+shift+f', needsRepo: true },
  { id: 'pull', labelKey: 'actions.pull', defaultCombo: 'mod+shift+arrowdown', needsRepo: true },
  { id: 'push', labelKey: 'actions.push', defaultCombo: 'mod+shift+arrowup', needsRepo: true },
  { id: 'stash', labelKey: 'actions.stash', defaultCombo: 'mod+shift+s', needsRepo: true }
]

export const DEFAULT_BINDINGS: Record<string, string> = Object.fromEntries(
  SHORTCUT_COMMANDS.map((c) => [c.id, c.defaultCombo])
)

/**
 * Normalize a keydown into a combo string, or null for a modifier-only press.
 * Ctrl and Meta both collapse to `mod` so the same binding works on every OS.
 */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('mod')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase())
  return parts.join('+')
}

/** True when a combo has no modifier (risky to fire while typing in a field). */
export function isBareCombo(combo: string): boolean {
  return !/(^|\+)(mod|alt)(\+|$)/.test(combo)
}

const KEY_LABEL: Record<string, string> = {
  mod: isMac ? '⌘' : 'Ctrl',
  shift: isMac ? '⇧' : 'Shift',
  alt: isMac ? '⌥' : 'Alt',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  enter: '↵',
  escape: 'Esc',
  ' ': 'Space'
}

/** Combo parts for display, e.g. `mod+shift+l` → ['Ctrl','Shift','L']. */
export function comboKeys(combo: string): string[] {
  return combo.split('+').map((p) => KEY_LABEL[p] ?? (p.length === 1 ? p.toUpperCase() : p))
}
