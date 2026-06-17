/**
 * UI state store. Holds only non-sensitive view state (open repos, selection,
 * theme). NO credentials or secrets are ever placed here or persisted
 * (CLAUDE.md §4). Repo lists / themes use localStorage; tokens never do.
 */

import { create } from 'zustand'
import type { RepoRef } from '@shared/types'
import {
  TEMPLATES,
  TEMPLATE_VARS,
  isNamedTemplate,
  CUSTOM_ID,
  DEFAULT_CUSTOM_VARS,
  DEFAULT_CUSTOM_DARK
} from '../lib/templates'

/** The resolved, applied theme (what `data-theme` is set to). */
export type Theme = 'dark' | 'light'
/** The user's theme preference; `system` follows the OS. */
export type ThemeMode = 'dark' | 'light' | 'system'
export type ViewMode = 'history' | 'changes'
/** Diff rendering layout: unified (inline) or side-by-side (split). */
export type DiffMode = 'inline' | 'split'
/** How commit timestamps read in the graph. */
export type DateFormat = 'relative' | 'absolute'

/**
 * An accent palette. Only the brand/interactive accent is themed here — danger,
 * diff and conflict colors stay fixed so meaning never blurs (CLAUDE.md §7).
 */
export interface AccentPalette {
  id: string
  label: string
  accent: string
  hover: string
}

/** Curated accent choices (crimson is the Cyrex default and stays first). */
export const ACCENTS: AccentPalette[] = [
  { id: 'crimson', label: 'Crimson', accent: '#f7374f', hover: '#ff4d63' },
  { id: 'ember', label: 'Ember', accent: '#ff5722', hover: '#ff7043' },
  { id: 'amber', label: 'Amber', accent: '#f5a524', hover: '#ffb84d' },
  { id: 'emerald', label: 'Emerald', accent: '#2ecc71', hover: '#46d784' },
  { id: 'teal', label: 'Teal', accent: '#16c5b4', hover: '#2ad8c6' },
  { id: 'azure', label: 'Azure', accent: '#3b82f6', hover: '#5a97ff' },
  { id: 'violet', label: 'Violet', accent: '#8b5cf6', hover: '#a07bff' },
  { id: 'magenta', label: 'Magenta', accent: '#e0529c', hover: '#ec6fb0' }
]

/**
 * A repo in the sidebar list. Extends the engine's RepoRef with renderer-only
 * presentation state (favorite, custom dot color). These never reach the engine;
 * the color is a CSS variable string so it follows the active theme.
 */
export interface RepoEntry extends RepoRef {
  favorite?: boolean
  color?: string
}

/** A working-tree file the user has selected to diff in the Changes view. */
export interface SelectedFile {
  file: string
  staged: boolean
  untracked: boolean
}

interface RepoState {
  repos: RepoEntry[]
  activePath: string | null
  selectedSha: string | null
  viewMode: ViewMode
  selectedFile: SelectedFile | null
  /** File path open in the history/blame inspector overlay, if any. */
  inspectorFile: string | null
  inspectorTab: 'history' | 'blame'
  /** Active commit-search query; when non-empty the graph shows results. */
  searchQuery: string
  /** Whether the reflog (undo / recovery) overlay is open. */
  reflogOpen: boolean
  /** Base commit sha for the interactive-rebase planner; null when closed. */
  rebaseBase: string | null
  /** Whether the embedded terminal pane is shown. */
  terminalOpen: boolean
  /** Whether the command palette (Cmd/Ctrl+K) overlay is open. */
  paletteOpen: boolean
  /** The unified Open Repository modal (local repos left, remote accounts right). */
  openRepoOpen: boolean
  createRepoOpen: boolean
  /** Target ref (HEAD or a sha) for the Create Tag dialog; null when closed. */
  createTagTarget: string | null
  /** The Settings dialog. */
  settingsOpen: boolean
  /** Which Settings section is shown (general/appearance/diff/git/shortcuts). */
  settingsSection: string
  /** The visual .gitignore editor dialog. */
  gitignoreOpen: boolean
  /** The Pull Requests panel (hosting integration). */
  prPanelOpen: boolean
  /** The Create Pull Request dialog. */
  createPROpen: boolean
  /** Resolved theme currently applied to the document. */
  theme: Theme
  /** The user's theme preference (system follows the OS). */
  themeMode: ThemeMode
  /** Selected accent palette id (see ACCENTS). */
  accent: string
  /** Selected theme template id (see TEMPLATES); 'classic' uses theme+accent. */
  template: string
  /** The user's Custom template colors (CSS var → hex) and its dark/light base. */
  customColors: Record<string, string>
  customDark: boolean
  /** Which view a repository opens into. */
  defaultView: ViewMode
  /** Renderer zoom factor (interface / text scale), 1 = 100%. */
  fontScale: number
  /** Default diff layout, also toggled live from the diff panel. */
  diffMode: DiffMode
  /** Wrap long diff lines instead of scrolling horizontally. */
  diffWrap: boolean
  /** Tab width (in spaces) for rendered diff lines. */
  diffTabWidth: number
  /** Minutes between automatic background fetches; 0 disables auto-fetch. */
  autoFetchMinutes: number
  /** Reopen the repository that was active when the app last closed. */
  restoreLastRepo: boolean
  /** Commit timestamp style in the graph. */
  dateFormat: DateFormat

  addRepo: (repo: RepoRef) => void
  removeRepo: (path: string) => void
  toggleFavorite: (path: string) => void
  setRepoColor: (path: string, color?: string) => void
  setActive: (path: string | null) => void
  selectCommit: (sha: string | null) => void
  setViewMode: (mode: ViewMode) => void
  selectFile: (file: SelectedFile | null) => void
  openInspector: (file: string, tab?: 'history' | 'blame') => void
  closeInspector: () => void
  setSearchQuery: (query: string) => void
  openReflog: () => void
  closeReflog: () => void
  openRebase: (base: string) => void
  closeRebase: () => void
  toggleTerminal: () => void
  togglePalette: () => void
  closePalette: () => void
  openRepoModal: () => void
  closeRepoModal: () => void
  openCreateRepo: () => void
  closeCreateRepo: () => void
  openCreateTag: (ref: string) => void
  closeCreateTag: () => void
  openSettings: (section?: string) => void
  setSettingsSection: (section: string) => void
  closeSettings: () => void
  openGitignore: () => void
  closeGitignore: () => void
  openPRPanel: () => void
  closePRPanel: () => void
  openCreatePR: () => void
  closeCreatePR: () => void
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
  setAccent: (id: string) => void
  setTemplate: (id: string) => void
  setCustomColor: (name: string, value: string) => void
  setCustomDark: (dark: boolean) => void
  setDefaultView: (view: ViewMode) => void
  setFontScale: (scale: number) => void
  setDiffMode: (mode: DiffMode) => void
  setDiffWrap: (wrap: boolean) => void
  setDiffTabWidth: (width: number) => void
  setAutoFetchMinutes: (minutes: number) => void
  setRestoreLastRepo: (restore: boolean) => void
  setDateFormat: (format: DateFormat) => void
}

const REPOS_KEY = 'cyrex.repos'
const THEME_KEY = 'cyrex.theme'
const THEME_MODE_KEY = 'cyrex.themeMode'
const ACCENT_KEY = 'cyrex.accent'
const TEMPLATE_KEY = 'cyrex.template'
const CUSTOM_KEY = 'cyrex.customTemplate'
const DEFAULT_VIEW_KEY = 'cyrex.defaultView'
const FONT_SCALE_KEY = 'cyrex.fontScale'
const DIFF_MODE_KEY = 'cyrex.diffMode'
const DIFF_WRAP_KEY = 'cyrex.diffWrap'
const DIFF_TAB_KEY = 'cyrex.diffTabWidth'
const AUTO_FETCH_KEY = 'cyrex.autoFetchMinutes'
const RESTORE_KEY = 'cyrex.restoreLastRepo'
const LAST_REPO_KEY = 'cyrex.lastRepo'
const DATE_FORMAT_KEY = 'cyrex.dateFormat'

/** Auto-fetch interval choices (minutes); 0 = off. */
export const AUTO_FETCH_OPTIONS = [0, 5, 10, 15]

/** Interface zoom bounds (1 = 100%); steps of 0.1 in the Settings control. */
export const MIN_FONT_SCALE = 0.8
export const MAX_FONT_SCALE = 1.6
/** Allowed diff tab widths (Settings + per-render tab-size). */
export const DIFF_TAB_WIDTHS = [2, 4, 8]

function initialTemplate(): string {
  const id = localStorage.getItem(TEMPLATE_KEY)
  return id && TEMPLATES.some((t) => t.id === id) ? id : 'classic'
}

function loadRepos(): RepoEntry[] {
  try {
    const raw = localStorage.getItem(REPOS_KEY)
    return raw ? (JSON.parse(raw) as RepoEntry[]) : []
  } catch {
    return []
  }
}

function saveRepos(repos: RepoEntry[]): void {
  localStorage.setItem(REPOS_KEY, JSON.stringify(repos))
}

function systemPrefersLight(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false
}

/** Resolve a preference to the concrete theme to apply. */
function resolveTheme(mode: ThemeMode): Theme {
  if (mode === 'system') return systemPrefersLight() ? 'light' : 'dark'
  return mode
}

function initialThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  // Migrate a legacy explicit dark/light choice; otherwise follow the OS.
  const legacy = localStorage.getItem(THEME_KEY)
  if (legacy === 'light' || legacy === 'dark') return legacy
  return 'system'
}

function initialAccent(): AccentPalette {
  const id = localStorage.getItem(ACCENT_KEY)
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]
}

function initialDefaultView(): ViewMode {
  return localStorage.getItem(DEFAULT_VIEW_KEY) === 'changes' ? 'changes' : 'history'
}

const clampScale = (n: number): number =>
  Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, Math.round(n * 100) / 100))

function initialFontScale(): number {
  const n = Number(localStorage.getItem(FONT_SCALE_KEY))
  return Number.isFinite(n) && n > 0 ? clampScale(n) : 1
}

/** Apply the interface zoom factor to the renderer (scales the whole UI). */
export function applyFontScale(scale: number): void {
  window.cyrex.windowControls.setZoom(scale)
}

function initialDiffMode(): DiffMode {
  return localStorage.getItem(DIFF_MODE_KEY) === 'split' ? 'split' : 'inline'
}
function initialDiffWrap(): boolean {
  return localStorage.getItem(DIFF_WRAP_KEY) === '1'
}
function initialDiffTabWidth(): number {
  const n = Number(localStorage.getItem(DIFF_TAB_KEY))
  return DIFF_TAB_WIDTHS.includes(n) ? n : 4
}
function initialAutoFetch(): number {
  const n = Number(localStorage.getItem(AUTO_FETCH_KEY))
  return AUTO_FETCH_OPTIONS.includes(n) ? n : 0
}
// Restore is on by default — unset is treated as enabled.
function initialRestore(): boolean {
  return localStorage.getItem(RESTORE_KEY) !== '0'
}
function initialDateFormat(): DateFormat {
  return localStorage.getItem(DATE_FORMAT_KEY) === 'absolute' ? 'absolute' : 'relative'
}
/** The repo to reopen on launch, when enabled and still in the known list. */
function initialActivePath(): string | null {
  if (!initialRestore()) return null
  const last = localStorage.getItem(LAST_REPO_KEY)
  return last && loadRepos().some((r) => r.path === last) ? last : null
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

/** Override the accent CSS variables (the rest of the palette is fixed). */
export function applyAccent(id: string): void {
  const p = ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]
  const root = document.documentElement
  root.style.setProperty('--color-accent', p.accent)
  root.style.setProperty('--color-accent-hover', p.hover)
}

/** Load the user's Custom template (colors + dark/light) from localStorage. */
function loadCustom(): { dark: boolean; vars: Record<string, string> } {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (raw) {
      const c = JSON.parse(raw) as { dark?: boolean; vars?: Record<string, string> }
      return {
        dark: typeof c.dark === 'boolean' ? c.dark : DEFAULT_CUSTOM_DARK,
        vars: { ...DEFAULT_CUSTOM_VARS, ...(c.vars ?? {}) }
      }
    }
  } catch {
    /* fall back to defaults */
  }
  return { dark: DEFAULT_CUSTOM_DARK, vars: { ...DEFAULT_CUSTOM_VARS } }
}

/** The concrete dark/light a template+mode resolves to (named templates fix it). */
function resolvedTheme(template: string, mode: ThemeMode): Theme {
  if (template === CUSTOM_ID) return loadCustom().dark ? 'dark' : 'light'
  if (isNamedTemplate(template)) {
    return TEMPLATES.find((t) => t.id === template)?.dark ? 'dark' : 'light'
  }
  return resolveTheme(mode)
}

/**
 * Apply the full appearance: a named template (incl. the user's Custom one)
 * overrides the base + accent CSS variables and fixes light/dark; `classic`
 * clears those overrides and honors the theme-mode + accent picker. Diff/syntax
 * tokens follow `data-theme`.
 */
export function applyAppearance(template: string, mode: ThemeMode, accentId: string): void {
  const root = document.documentElement
  applyTheme(resolvedTheme(template, mode))
  const vars =
    template === CUSTOM_ID
      ? loadCustom().vars
      : (TEMPLATES.find((t) => t.id === template)?.vars ?? {})
  if (isNamedTemplate(template)) {
    for (const v of TEMPLATE_VARS) {
      if (vars[v]) root.style.setProperty(v, vars[v])
      else root.style.removeProperty(v)
    }
  } else {
    for (const v of TEMPLATE_VARS) root.style.removeProperty(v)
    applyAccent(accentId)
  }
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repos: loadRepos(),
  activePath: initialActivePath(),
  selectedSha: null,
  viewMode: 'history',
  selectedFile: null,
  inspectorFile: null,
  inspectorTab: 'history',
  searchQuery: '',
  reflogOpen: false,
  rebaseBase: null,
  terminalOpen: false,
  paletteOpen: false,
  openRepoOpen: false,
  createRepoOpen: false,
  createTagTarget: null,
  settingsOpen: false,
  settingsSection: 'general',
  gitignoreOpen: false,
  prPanelOpen: false,
  createPROpen: false,
  theme: resolvedTheme(initialTemplate(), initialThemeMode()),
  themeMode: initialThemeMode(),
  accent: initialAccent().id,
  template: initialTemplate(),
  customColors: loadCustom().vars,
  customDark: loadCustom().dark,
  defaultView: initialDefaultView(),
  fontScale: initialFontScale(),
  diffMode: initialDiffMode(),
  diffWrap: initialDiffWrap(),
  diffTabWidth: initialDiffTabWidth(),
  autoFetchMinutes: initialAutoFetch(),
  restoreLastRepo: initialRestore(),
  dateFormat: initialDateFormat(),

  addRepo: (repo) =>
    set((s) => {
      // Preserve any existing favorite/color when re-opening a known repo.
      const prev = s.repos.find((r) => r.path === repo.path)
      const entry: RepoEntry = { ...repo, favorite: prev?.favorite, color: prev?.color }
      const repos = [entry, ...s.repos.filter((r) => r.path !== repo.path)]
      saveRepos(repos)
      localStorage.setItem(LAST_REPO_KEY, repo.path)
      return {
        repos,
        activePath: repo.path,
        selectedSha: null,
        selectedFile: null,
        viewMode: s.defaultView
      }
    }),

  removeRepo: (path) =>
    set((s) => {
      const repos = s.repos.filter((r) => r.path !== path)
      saveRepos(repos)
      // Drop selection if the removed repo was the active one.
      if (s.activePath !== path) return { repos }
      return { repos, activePath: null, selectedSha: null, selectedFile: null, searchQuery: '' }
    }),

  toggleFavorite: (path) =>
    set((s) => {
      const repos = s.repos.map((r) =>
        r.path === path ? { ...r, favorite: !r.favorite } : r
      )
      saveRepos(repos)
      return { repos }
    }),

  setRepoColor: (path, color) =>
    set((s) => {
      const repos = s.repos.map((r) => (r.path === path ? { ...r, color } : r))
      saveRepos(repos)
      return { repos }
    }),

  setActive: (path) => {
    if (path) localStorage.setItem(LAST_REPO_KEY, path)
    set((s) => ({
      activePath: path,
      viewMode: s.defaultView,
      selectedSha: null,
      selectedFile: null,
      inspectorFile: null,
      searchQuery: '',
      reflogOpen: false,
      rebaseBase: null,
      prPanelOpen: false,
      createPROpen: false
    }))
  },
  selectCommit: (sha) => set({ selectedSha: sha }),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectFile: (file) => set({ selectedFile: file }),
  openInspector: (file, tab = 'history') => set({ inspectorFile: file, inspectorTab: tab }),
  closeInspector: () => set({ inspectorFile: null }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  openReflog: () => set({ reflogOpen: true }),
  closeReflog: () => set({ reflogOpen: false }),
  openRebase: (base) => set({ rebaseBase: base }),
  closeRebase: () => set({ rebaseBase: null }),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  closePalette: () => set({ paletteOpen: false }),
  openRepoModal: () => set({ openRepoOpen: true }),
  closeRepoModal: () => set({ openRepoOpen: false }),
  openCreateRepo: () => set({ createRepoOpen: true }),
  closeCreateRepo: () => set({ createRepoOpen: false }),
  openCreateTag: (ref) => set({ createTagTarget: ref }),
  closeCreateTag: () => set({ createTagTarget: null }),
  // `section` is optional and ignored unless a real string (so an accidental
  // event arg from an onClick handler can't corrupt it); omitting it keeps the
  // last-viewed section.
  openSettings: (section) =>
    set(typeof section === 'string' ? { settingsOpen: true, settingsSection: section } : { settingsOpen: true }),
  setSettingsSection: (section) => set({ settingsSection: section }),
  closeSettings: () => set({ settingsOpen: false }),
  openGitignore: () => set({ gitignoreOpen: true }),
  closeGitignore: () => set({ gitignoreOpen: false }),
  openPRPanel: () => set({ prPanelOpen: true }),
  closePRPanel: () => set({ prPanelOpen: false }),
  openCreatePR: () => set({ createPROpen: true }),
  closeCreatePR: () => set({ createPROpen: false }),

  setThemeMode: (mode) => {
    localStorage.setItem(THEME_MODE_KEY, mode)
    const s = get()
    applyAppearance(s.template, mode, s.accent)
    set({ themeMode: mode, theme: resolvedTheme(s.template, mode) })
  },

  // Quick toggle (topbar / palette): pick an explicit mode opposite to current.
  toggleTheme: () => get().setThemeMode(get().theme === 'dark' ? 'light' : 'dark'),

  setAccent: (id) => {
    localStorage.setItem(ACCENT_KEY, id)
    const s = get()
    applyAppearance(s.template, s.themeMode, id)
    set({ accent: id })
  },

  setTemplate: (id) => {
    localStorage.setItem(TEMPLATE_KEY, id)
    const s = get()
    applyAppearance(id, s.themeMode, s.accent)
    set({ template: id, theme: resolvedTheme(id, s.themeMode) })
  },

  setCustomColor: (name, value) => {
    const customColors = { ...get().customColors, [name]: value }
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ dark: get().customDark, vars: customColors }))
    set({ customColors })
    // Live-apply only when the Custom template is the active one.
    if (get().template === CUSTOM_ID) applyAppearance(CUSTOM_ID, get().themeMode, get().accent)
  },

  setCustomDark: (dark) => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ dark, vars: get().customColors }))
    set({ customDark: dark })
    if (get().template === CUSTOM_ID) {
      applyAppearance(CUSTOM_ID, get().themeMode, get().accent)
      set({ theme: resolvedTheme(CUSTOM_ID, get().themeMode) })
    }
  },

  setDefaultView: (view) => {
    localStorage.setItem(DEFAULT_VIEW_KEY, view)
    set({ defaultView: view })
  },

  setFontScale: (scale) => {
    const clamped = clampScale(scale)
    localStorage.setItem(FONT_SCALE_KEY, String(clamped))
    applyFontScale(clamped)
    set({ fontScale: clamped })
  },

  setDiffMode: (mode) => {
    localStorage.setItem(DIFF_MODE_KEY, mode)
    set({ diffMode: mode })
  },
  setDiffWrap: (wrap) => {
    localStorage.setItem(DIFF_WRAP_KEY, wrap ? '1' : '0')
    set({ diffWrap: wrap })
  },
  setDiffTabWidth: (width) => {
    localStorage.setItem(DIFF_TAB_KEY, String(width))
    set({ diffTabWidth: width })
  },

  setAutoFetchMinutes: (minutes) => {
    localStorage.setItem(AUTO_FETCH_KEY, String(minutes))
    set({ autoFetchMinutes: minutes })
  },
  setRestoreLastRepo: (restore) => {
    localStorage.setItem(RESTORE_KEY, restore ? '1' : '0')
    set({ restoreLastRepo: restore })
  },
  setDateFormat: (format) => {
    localStorage.setItem(DATE_FORMAT_KEY, format)
    set({ dateFormat: format })
  }
}))

// When following the OS theme, react to live changes (e.g. day/night switch).
// Only the Classic template follows the OS; named templates fix their own mode.
window
  .matchMedia?.('(prefers-color-scheme: light)')
  .addEventListener?.('change', () => {
    const s = useRepoStore.getState()
    if (s.themeMode !== 'system' || isNamedTemplate(s.template)) return
    applyAppearance(s.template, 'system', s.accent)
    useRepoStore.setState({ theme: resolveTheme('system') })
  })
