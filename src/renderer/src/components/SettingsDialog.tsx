import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  FileDiff,
  Keyboard,
  Minus,
  Monitor,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  UserRound,
  X
} from 'lucide-react'
import {
  ACCENTS,
  DIFF_TAB_WIDTHS,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  useRepoStore
} from '../store/repoStore'
import type { DiffMode, ThemeMode, ViewMode } from '../store/repoStore'
import { useShortcutsStore } from '../store/shortcutsStore'
import { TEMPLATES, CUSTOM_ID, CUSTOM_FIELDS } from '../lib/templates'
import { SHORTCUT_COMMANDS, comboFromEvent, comboKeys } from '../lib/shortcuts'
import { MOD_KEY as MOD } from '../lib/platform'
import { LANGUAGES } from '../i18n'
import { IdentitySettings } from './IdentitySettings'

type SectionId = 'general' | 'appearance' | 'diff' | 'git' | 'shortcuts'

/** Built-in, non-rebindable shortcuts shown for reference. */
function fixedShortcuts(t: (k: string) => string): { keys: string[]; label: string }[] {
  return [
    { keys: ['G', 'H'], label: t('settings.shortcut.goHistory') },
    { keys: ['G', 'C'], label: t('settings.shortcut.goChanges') },
    { keys: [`${MOD}`, '↵'], label: t('settings.shortcut.commit') },
    { keys: ['Esc'], label: t('settings.shortcut.dismiss') }
  ]
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-xs text-fg">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string; icon?: typeof Sun }[]
  onChange: (v: T) => void
}): React.JSX.Element {
  return (
    <div className="flex rounded-[var(--radius-card)] border border-border p-0.5">
      {options.map((o) => {
        const Icon = o.icon
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-xs transition-colors ${
              active ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {Icon && <Icon size={13} strokeWidth={1.75} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsDialog(): React.JSX.Element | null {
  const { t, i18n } = useTranslation()
  const open = useRepoStore((s) => s.settingsOpen)
  const closeSettings = useRepoStore((s) => s.closeSettings)
  const themeMode = useRepoStore((s) => s.themeMode)
  const setThemeMode = useRepoStore((s) => s.setThemeMode)
  const accent = useRepoStore((s) => s.accent)
  const setAccent = useRepoStore((s) => s.setAccent)
  const template = useRepoStore((s) => s.template)
  const setTemplate = useRepoStore((s) => s.setTemplate)
  const customColors = useRepoStore((s) => s.customColors)
  const customDark = useRepoStore((s) => s.customDark)
  const setCustomColor = useRepoStore((s) => s.setCustomColor)
  const setCustomDark = useRepoStore((s) => s.setCustomDark)
  const defaultView = useRepoStore((s) => s.defaultView)
  const setDefaultView = useRepoStore((s) => s.setDefaultView)
  const fontScale = useRepoStore((s) => s.fontScale)
  const setFontScale = useRepoStore((s) => s.setFontScale)
  const diffMode = useRepoStore((s) => s.diffMode)
  const setDiffMode = useRepoStore((s) => s.setDiffMode)
  const diffWrap = useRepoStore((s) => s.diffWrap)
  const setDiffWrap = useRepoStore((s) => s.setDiffWrap)
  const diffTabWidth = useRepoStore((s) => s.diffTabWidth)
  const setDiffTabWidth = useRepoStore((s) => s.setDiffTabWidth)
  const bindings = useShortcutsStore((s) => s.bindings)
  const setBinding = useShortcutsStore((s) => s.setBinding)
  const resetBinding = useShortcutsStore((s) => s.resetBinding)
  const resetAll = useShortcutsStore((s) => s.resetAll)
  const [section, setSection] = useState<SectionId>('general')
  const [recordingId, setRecordingId] = useState<string | null>(null)

  // Escape dismisses (the Cmd/Ctrl+, toggle is owned by the global dispatcher).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && useRepoStore.getState().settingsOpen) closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeSettings])

  // Record a new combo for a command. Captures in the capture phase so it
  // pre-empts the global dispatcher; Escape cancels without closing Settings.
  function startRecording(id: string): void {
    if (recordingId) return
    setRecordingId(id)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        cleanup()
        return
      }
      const combo = comboFromEvent(e)
      if (!combo) return
      e.preventDefault()
      e.stopImmediatePropagation()
      setBinding(id, combo)
      cleanup()
    }
    const cleanup = (): void => {
      window.removeEventListener('keydown', onKey, true)
      setRecordingId(null)
    }
    window.addEventListener('keydown', onKey, true)
  }

  if (!open) return null

  const nav: { id: SectionId; label: string; icon: typeof Sun }[] = [
    { id: 'general', label: t('settings.general'), icon: SlidersHorizontal },
    { id: 'appearance', label: t('settings.appearance'), icon: Palette },
    { id: 'diff', label: t('settings.diff'), icon: FileDiff },
    { id: 'git', label: t('settings.git'), icon: UserRound },
    { id: 'shortcuts', label: t('settings.shortcuts'), icon: Keyboard }
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={closeSettings}
    >
      <div
        className="flex h-[460px] w-[680px] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Left nav */}
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-bg/40 p-2">
          <h2 className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {t('actions.settings')}
          </h2>
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSection(n.id)}
              className={`flex items-center gap-2 rounded-[var(--radius-card)] px-2.5 py-1.5 text-xs transition-colors ${
                section === n.id
                  ? 'bg-surface-2 text-fg'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
              }`}
            >
              <n.icon size={15} strokeWidth={1.75} />
              {n.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto p-5">
          <button
            type="button"
            aria-label={t('common.cancel')}
            onClick={closeSettings}
            className="absolute right-3 top-3 rounded-[var(--radius-card)] p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
          >
            <X size={16} />
          </button>

          {section === 'general' && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-fg">{t('settings.general')}</h3>
              <Row label={t('settings.language')}>
                <select
                  value={i18n.language}
                  onChange={(e) => void i18n.changeLanguage(e.target.value)}
                  className="cursor-pointer rounded-[var(--radius-card)] border border-border bg-bg px-2 py-1 text-xs text-fg outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} disabled={!l.ready}>
                      {l.label}
                      {l.ready ? '' : ' …'}
                    </option>
                  ))}
                </select>
              </Row>
              <div className="border-t border-border" />
              <Row label={t('settings.startView')}>
                <Segmented<ViewMode>
                  value={defaultView}
                  onChange={setDefaultView}
                  options={[
                    { value: 'history', label: t('tabs.history') },
                    { value: 'changes', label: t('tabs.changes') }
                  ]}
                />
              </Row>
            </section>
          )}

          {section === 'appearance' && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-fg">{t('settings.appearance')}</h3>

              <p className="mb-1 text-xs text-fg">{t('settings.template')}</p>
              <p className="mb-3 text-[11px] leading-relaxed text-fg-subtle">
                {t('settings.templateHint')}
              </p>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {TEMPLATES.map((tpl) => {
                  // The Custom card previews the user's live colors.
                  const sw =
                    tpl.id === CUSTOM_ID
                      ? [
                          customColors['--color-bg'],
                          customColors['--color-surface'],
                          customColors['--color-accent'],
                          customColors['--color-fg']
                        ]
                      : tpl.swatch
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplate(tpl.id)}
                      className={`flex flex-col gap-1.5 rounded-[var(--radius-card)] border p-1.5 text-start transition-colors ${
                        template === tpl.id
                          ? 'border-accent bg-surface-2'
                          : 'border-border hover:bg-surface-2'
                      }`}
                    >
                      <span className="flex h-5 overflow-hidden rounded-[4px]">
                        {sw.map((c, i) => (
                          <span key={i} className="flex-1" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="flex items-center gap-1 truncate text-[11px] text-fg">
                        {template === tpl.id && (
                          <Check size={11} strokeWidth={3} className="shrink-0 text-accent" />
                        )}
                        <span className="truncate">{tpl.label}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              {template === CUSTOM_ID && (
                <div className="mb-3 rounded-[var(--radius-card)] border border-border p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-fg">{t('settings.custom.title')}</span>
                    <Segmented<'light' | 'dark'>
                      value={customDark ? 'dark' : 'light'}
                      onChange={(v) => setCustomDark(v === 'dark')}
                      options={[
                        { value: 'light', label: t('settings.themeLight'), icon: Sun },
                        { value: 'dark', label: t('settings.themeDark'), icon: Moon }
                      ]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {CUSTOM_FIELDS.map((f) => (
                      <label
                        key={f.var}
                        className="flex items-center justify-between gap-2 text-[11px] text-fg-muted"
                      >
                        <span className="truncate">{t(f.labelKey)}</span>
                        <input
                          type="color"
                          value={customColors[f.var] ?? '#000000'}
                          onChange={(e) => setCustomColor(f.var, e.target.value)}
                          className="h-5 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-border" />

              <Row label={t('settings.theme')}>
                <Segmented<ThemeMode>
                  value={themeMode}
                  onChange={setThemeMode}
                  options={[
                    { value: 'light', label: t('settings.themeLight'), icon: Sun },
                    { value: 'dark', label: t('settings.themeDark'), icon: Moon },
                    { value: 'system', label: t('settings.themeSystem'), icon: Monitor }
                  ]}
                />
              </Row>
              <div className="border-t border-border" />
              <Row label={t('settings.zoom')}>
                <button
                  type="button"
                  onClick={() => setFontScale(fontScale - 0.1)}
                  disabled={fontScale <= MIN_FONT_SCALE}
                  aria-label={t('settings.zoomOut')}
                  className="rounded-[var(--radius-card)] border border-border p-1 text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                >
                  <Minus size={13} strokeWidth={2} />
                </button>
                <span className="w-12 text-center text-xs tabular-nums text-fg">
                  {Math.round(fontScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setFontScale(fontScale + 0.1)}
                  disabled={fontScale >= MAX_FONT_SCALE}
                  aria-label={t('settings.zoomIn')}
                  className="rounded-[var(--radius-card)] border border-border p-1 text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                >
                  <Plus size={13} strokeWidth={2} />
                </button>
                {fontScale !== 1 && (
                  <button
                    type="button"
                    onClick={() => setFontScale(1)}
                    title={t('settings.zoomReset')}
                    aria-label={t('settings.zoomReset')}
                    className="rounded-[var(--radius-card)] p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
                  >
                    <RotateCcw size={13} strokeWidth={1.75} />
                  </button>
                )}
              </Row>
              <div className="border-t border-border" />
              <div className="py-3">
                <p className="mb-1 text-xs text-fg">{t('settings.accent')}</p>
                <p className="mb-3 text-[11px] leading-relaxed text-fg-subtle">
                  {t('settings.accentHint')}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      title={a.label}
                      onClick={() => setAccent(a.id)}
                      style={{ background: a.accent }}
                      className="flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110"
                    >
                      {accent === a.id && <Check size={15} strokeWidth={3} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {section === 'diff' && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-fg">{t('settings.diff')}</h3>
              <Row label={t('settings.diffDefaultView')}>
                <Segmented<DiffMode>
                  value={diffMode}
                  onChange={setDiffMode}
                  options={[
                    { value: 'inline', label: t('diff.inline') },
                    { value: 'split', label: t('diff.split') }
                  ]}
                />
              </Row>
              <div className="border-t border-border" />
              <Row label={t('settings.diffWrap')}>
                <Segmented<'on' | 'off'>
                  value={diffWrap ? 'on' : 'off'}
                  onChange={(v) => setDiffWrap(v === 'on')}
                  options={[
                    { value: 'off', label: t('settings.off') },
                    { value: 'on', label: t('settings.on') }
                  ]}
                />
              </Row>
              <div className="border-t border-border" />
              <Row label={t('settings.diffTabWidth')}>
                <Segmented<string>
                  value={String(diffTabWidth)}
                  onChange={(v) => setDiffTabWidth(Number(v))}
                  options={DIFF_TAB_WIDTHS.map((w) => ({ value: String(w), label: String(w) }))}
                />
              </Row>
            </section>
          )}

          {section === 'git' && (
            <section>
              <IdentitySettings />
            </section>
          )}

          {section === 'shortcuts' && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-fg">{t('settings.shortcuts')}</h3>
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-[var(--radius-card)] border border-border px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg"
                >
                  {t('settings.shortcut.resetAll')}
                </button>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-fg-subtle">
                {t('settings.shortcut.editHint')}
              </p>
              <ul className="flex flex-col">
                {SHORTCUT_COMMANDS.map((cmd) => {
                  const combo = bindings[cmd.id]
                  const recording = recordingId === cmd.id
                  return (
                    <li
                      key={cmd.id}
                      className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0"
                    >
                      <span className="text-xs text-fg-muted">{t(cmd.labelKey)}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startRecording(cmd.id)}
                          className={`flex min-h-[26px] min-w-[96px] items-center justify-center gap-1 rounded-[5px] border px-2 py-0.5 transition-colors ${
                            recording
                              ? 'border-accent text-accent'
                              : 'border-border text-fg hover:bg-surface-2'
                          }`}
                        >
                          {recording ? (
                            <span className="text-[11px]">{t('settings.shortcut.recording')}</span>
                          ) : combo ? (
                            comboKeys(combo).map((k, i) => (
                              <kbd
                                key={i}
                                className="rounded-[4px] bg-bg px-1.5 py-0.5 text-[11px] text-fg"
                              >
                                {k}
                              </kbd>
                            ))
                          ) : (
                            <span className="text-[11px] text-fg-subtle">
                              {t('settings.shortcut.unbound')}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => resetBinding(cmd.id)}
                          title={t('settings.shortcut.reset')}
                          aria-label={t('settings.shortcut.reset')}
                          className="rounded-[var(--radius-card)] p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
                        >
                          <RotateCcw size={13} strokeWidth={1.75} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
                {t('settings.shortcut.fixed')}
              </p>
              <ul className="flex flex-col">
                {fixedShortcuts(t).map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0"
                  >
                    <span className="text-xs text-fg-muted">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="min-w-[22px] rounded-[5px] border border-border bg-bg px-1.5 py-0.5 text-center text-[11px] text-fg-subtle"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
