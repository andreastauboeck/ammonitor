import { useTranslation } from 'react-i18next'
import { useTheme, type ThemeMode } from '../theme/ThemeContext'

const MODES: { mode: ThemeMode; labelKey: string; icon: 'sun' | 'moon' | 'system' }[] = [
  { mode: 'light', labelKey: 'theme.light', icon: 'sun' },
  { mode: 'dark', labelKey: 'theme.dark', icon: 'moon' },
  { mode: 'system', labelKey: 'theme.system', icon: 'system' },
]

function Icon({ name, className }: { name: 'sun' | 'moon' | 'system'; className?: string }) {
  if (name === 'sun') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM2.75 9.25a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zM15.75 9.25a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5h-1.5zM4.4 4.4a.75.75 0 011.06 0l1.06 1.06a.75.75 0 01-1.06 1.06L4.4 5.46a.75.75 0 010-1.06zM13.48 13.48a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM15.6 4.4a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM6.52 13.48a.75.75 0 010 1.06L5.46 15.6a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.06 0z" />
      </svg>
    )
  }
  if (name === 'moon') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105l.401 1.402a.75.75 0 01-.722.948H7.676a.75.75 0 01-.722-.948L7.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm2.25-.75a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h11.5a.75.75 0 00.75-.75v-8.5a.75.75 0 00-.75-.75H4.25z" clipRule="evenodd" />
    </svg>
  )
}

export default function ThemeSwitcher() {
  const { mode, setMode } = useTheme()
  const { t } = useTranslation()

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 p-0.5 text-xs">
      {MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          onClick={() => setMode(m.mode)}
          title={t(m.labelKey)}
          aria-label={t(m.labelKey)}
          className={`px-1.5 py-1 rounded transition-colors ${
            mode === m.mode
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          aria-pressed={mode === m.mode}
        >
          <Icon name={m.icon} className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  )
}
