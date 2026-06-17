import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { LANGUAGES } from '../i18n'

/**
 * Icon-only language picker: a Languages glyph with a transparent native
 * `<select>` laid over it, so clicking the icon opens the language dropdown
 * without showing the current language as text.
 */
export function LanguageSwitcher(): React.JSX.Element {
  const { i18n } = useTranslation()

  return (
    <div className="relative flex items-center rounded-[var(--radius-card)] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg">
      <span className="pointer-events-none p-1.5">
        <Languages size={16} strokeWidth={1.75} />
      </span>
      <select
        value={i18n.language}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        title="Language"
        aria-label="Language"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} disabled={!l.ready} className="bg-surface text-fg">
            {l.label}
            {l.ready ? '' : ' …'}
          </option>
        ))}
      </select>
    </div>
  )
}
