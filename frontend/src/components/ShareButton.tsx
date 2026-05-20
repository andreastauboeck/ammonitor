import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ShareButtonProps {
  /** Optional readable subject for the share text/title (e.g. "Vienna" or "Vienna — Apr 28"). */
  subject?: string | null
}

/**
 * Share the current view's URL via the Web Share API on mobile / modern desktop,
 * falling back to clipboard with a brief toast on browsers without it.
 */
export default function ShareButton({ subject }: ShareButtonProps) {
  const { t } = useTranslation()
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    const title = subject ? `ammonitor — ${subject}` : 'ammonitor'
    const text = subject
      ? t('share.text_with_subject', { subject })
      : t('share.text_default')

    // Native share first (if available).
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (err) {
        // User cancelled — silent.
        if ((err as Error)?.name === 'AbortError') return
        // Other failures fall through to clipboard.
      }
    }

    // Clipboard fallback.
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url)
        showToast(t('share.copied'))
      } else {
        showToast(t('share.error'))
      }
    } catch {
      showToast(t('share.error'))
    }
  }

  return (
    <div className="relative" style={{ zIndex: toast ? 1100 : 'auto' }}>
      <button
        type="button"
        onClick={handleShare}
        aria-label={t('share.label')}
        title={t('share.label')}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M13 4.5a2.5 2.5 0 1 1 .703 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.475l6.733-3.367A2.516 2.516 0 0 1 13 4.5z" />
        </svg>
      </button>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full mt-2 px-3 py-1.5 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs shadow-lg whitespace-nowrap pointer-events-none"
          style={{ zIndex: 1100 }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
