import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ThemeSwitcher from './ThemeSwitcher'
import LanguageSwitcher from './LanguageSwitcher'

export default function SettingsMenu() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2).toUpperCase()

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = () => setOpen((v) => !v)

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ zIndex: open ? 1100 : 'auto' }}
    >
      <div
        className="inline-flex items-stretch rounded-md bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 overflow-hidden"
        role="group"
        aria-label={t('settings.label')}
      >
        {/* Cog (theme/general settings) */}
        <button
          type="button"
          onClick={toggle}
          aria-label={t('settings.theme')}
          aria-expanded={open}
          title={t('settings.theme')}
          className="inline-flex items-center justify-center w-7 h-7 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/40 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Divider */}
        <span className="w-px bg-slate-300 dark:bg-slate-700" aria-hidden="true" />

        {/* Globe (language) */}
        <button
          type="button"
          onClick={toggle}
          aria-label={t('settings.language')}
          aria-expanded={open}
          title={t('settings.language')}
          className="inline-flex items-center gap-1 h-7 px-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/40 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 010 18a14 14 0 010-18z" />
          </svg>
          <span className="text-[10px] font-semibold leading-none">{currentLang}</span>
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={t('settings.label')}
          className="absolute right-0 top-full mt-1 min-w-[12rem] p-3 rounded-lg shadow-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          style={{ zIndex: 1100 }}
        >
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider font-medium text-slate-500 mb-1.5">
              {t('settings.theme')}
            </div>
            <ThemeSwitcher />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-medium text-slate-500 mb-1.5">
              {t('settings.language')}
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </div>
  )
}
