/**
 * Theme templates: selectable full color schemes (Settings → Appearance). Each
 * template overrides the base surface tokens + the accent as a set of CSS
 * variables, layered over the dark/light defaults in styles/index.css. Diff,
 * danger, conflict, lane and syntax tokens are intentionally NOT themed so they
 * stay readable and semantically stable (CLAUDE.md §7).
 *
 * Palettes are drawn from popular Color Hunt schemes
 * (https://colorhunt.co/palettes/popular); `swatch` is the source palette shown
 * in the picker. `Classic` carries no overrides — it uses the built-in dark/
 * light themes and the separate accent picker.
 */

export interface Template {
  id: string
  label: string
  /** Source palette (4 colors) shown as the preview swatch. */
  swatch: [string, string, string, string]
  /** Dark base → keeps diff/syntax on the dark tint set; false uses the light set. */
  dark: boolean
  /** CSS variable overrides; empty for `classic`. */
  vars: Record<string, string>
}

/** The CSS variables a template manages (cleared when switching to Classic). */
export const TEMPLATE_VARS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-2',
  '--color-border',
  '--color-fg',
  '--color-fg-muted',
  '--color-fg-subtle',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-fg'
] as const

export type TemplateVar = (typeof TEMPLATE_VARS)[number]
type Vars = Record<TemplateVar, string>

const make = (v: Vars): Record<string, string> => v

/** The user-editable Custom template. */
export const CUSTOM_ID = 'custom'

/** Starting point for the Custom template (the built-in dark scheme). */
export const DEFAULT_CUSTOM_DARK = true
export const DEFAULT_CUSTOM_VARS: Vars = {
  '--color-bg': '#0e0f12',
  '--color-surface': '#16181d',
  '--color-surface-2': '#1c1f26',
  '--color-border': '#2a2e37',
  '--color-fg': '#e7e9ee',
  '--color-fg-muted': '#9aa0ab',
  '--color-fg-subtle': '#6b7280',
  '--color-accent': '#f7374f',
  '--color-accent-hover': '#ff4d63',
  '--color-accent-fg': '#ffffff'
}

/** The Custom template's editable fields, in display order. */
export const CUSTOM_FIELDS: { var: TemplateVar; labelKey: string }[] = [
  { var: '--color-bg', labelKey: 'settings.custom.bg' },
  { var: '--color-surface', labelKey: 'settings.custom.surface' },
  { var: '--color-surface-2', labelKey: 'settings.custom.surface2' },
  { var: '--color-border', labelKey: 'settings.custom.border' },
  { var: '--color-fg', labelKey: 'settings.custom.fg' },
  { var: '--color-fg-muted', labelKey: 'settings.custom.fgMuted' },
  { var: '--color-fg-subtle', labelKey: 'settings.custom.fgSubtle' },
  { var: '--color-accent', labelKey: 'settings.custom.accent' },
  { var: '--color-accent-hover', labelKey: 'settings.custom.accentHover' },
  { var: '--color-accent-fg', labelKey: 'settings.custom.accentFg' }
]

export const TEMPLATES: Template[] = [
  {
    id: 'classic',
    label: 'Classic',
    swatch: ['#16181d', '#2a2e37', '#f7374f', '#e7e9ee'],
    dark: true,
    vars: {}
  },
  {
    id: 'teal-night',
    label: 'Teal Night',
    swatch: ['#222831', '#393e46', '#00adb5', '#eeeeee'],
    dark: true,
    vars: make({
      '--color-bg': '#1b2026',
      '--color-surface': '#222831',
      '--color-surface-2': '#2e353f',
      '--color-border': '#3a424e',
      '--color-fg': '#eeeeee',
      '--color-fg-muted': '#a3acb8',
      '--color-fg-subtle': '#6f7884',
      '--color-accent': '#00adb5',
      '--color-accent-hover': '#1ec7cf',
      '--color-accent-fg': '#04282b'
    })
  },
  {
    id: 'midnight-ember',
    label: 'Midnight Ember',
    swatch: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'],
    dark: true,
    vars: make({
      '--color-bg': '#15151f',
      '--color-surface': '#1a1a2e',
      '--color-surface-2': '#23254a',
      '--color-border': '#2f3360',
      '--color-fg': '#e8e9f5',
      '--color-fg-muted': '#9ba2c4',
      '--color-fg-subtle': '#6c719b',
      '--color-accent': '#e94560',
      '--color-accent-hover': '#f25b74',
      '--color-accent-fg': '#ffffff'
    })
  },
  {
    id: 'amber-slate',
    label: 'Amber Slate',
    swatch: ['#222831', '#393e46', '#ffd369', '#eeeeee'],
    dark: true,
    vars: make({
      '--color-bg': '#1b2026',
      '--color-surface': '#222831',
      '--color-surface-2': '#2e353f',
      '--color-border': '#3a424e',
      '--color-fg': '#eeeeee',
      '--color-fg-muted': '#a3acb8',
      '--color-fg-subtle': '#6f7884',
      '--color-accent': '#ffd369',
      '--color-accent-hover': '#ffdd84',
      '--color-accent-fg': '#2a2410'
    })
  },
  {
    id: 'neon',
    label: 'Neon',
    swatch: ['#0d0d0d', '#08d9d6', '#ff2e63', '#eaeaea'],
    dark: true,
    vars: make({
      '--color-bg': '#0d0d0d',
      '--color-surface': '#161616',
      '--color-surface-2': '#1f1f1f',
      '--color-border': '#2c2c2c',
      '--color-fg': '#eaeaea',
      '--color-fg-muted': '#9a9a9a',
      '--color-fg-subtle': '#6a6a6a',
      '--color-accent': '#ff2e63',
      '--color-accent-hover': '#ff4f7c',
      '--color-accent-fg': '#ffffff'
    })
  },
  {
    id: 'sandstone',
    label: 'Sandstone',
    swatch: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261'],
    dark: false,
    vars: make({
      '--color-bg': '#f6f4ee',
      '--color-surface': '#ffffff',
      '--color-surface-2': '#ece7da',
      '--color-border': '#d9d2c2',
      '--color-fg': '#264653',
      '--color-fg-muted': '#5a6b6f',
      '--color-fg-subtle': '#8a9698',
      '--color-accent': '#2a9d8f',
      '--color-accent-hover': '#248b7e',
      '--color-accent-fg': '#ffffff'
    })
  },
  {
    id: CUSTOM_ID,
    label: 'Custom',
    // Live colors come from the store; this is just the picker placeholder.
    swatch: ['#16181d', '#2a2e37', '#f7374f', '#e7e9ee'],
    dark: DEFAULT_CUSTOM_DARK,
    vars: make({ ...DEFAULT_CUSTOM_VARS })
  }
]

/**
 * Whether a template id carries explicit overrides (i.e. not Classic). The
 * Custom template always counts — its colors are user-supplied at runtime.
 */
export function isNamedTemplate(id: string): boolean {
  if (id === CUSTOM_ID) return true
  const tpl = TEMPLATES.find((t) => t.id === id)
  return !!tpl && Object.keys(tpl.vars).length > 0
}
