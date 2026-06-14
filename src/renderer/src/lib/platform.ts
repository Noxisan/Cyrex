/** Platform helpers for presenting OS-correct keyboard-shortcut hints. */

export const isMac = navigator.userAgent.includes('Mac')

/** The modifier-key label to show in shortcut hints (⌘ on macOS, else Ctrl). */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'
