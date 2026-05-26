import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface InfoPopoverProps {
  content: string
}

/** Small info icon that opens a popover on click. Closes on outside click or Escape.
 *  Renders via portal to avoid overflow clipping by parent containers. */
export default function InfoPopover({ content }: InfoPopoverProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setRect({ top: r.top, left: r.left })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false)
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  const handleToggle = () => {
    updatePosition()
    setOpen(!open)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="inline-flex shrink-0 items-center justify-center w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold leading-none hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors"
        aria-label="Info"
      >
        i
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed w-56 p-2.5 text-xs rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-lg z-[100] text-slate-700 dark:text-slate-200 leading-relaxed"
          style={{
            left: rect.left,
            top: rect.top - 8,
            transform: 'translateY(-100%)',
          }}
        >
          {content}
          <div
            className="absolute w-2.5 h-2.5 bg-white dark:bg-slate-700 border-r border-b border-slate-200 dark:border-slate-600 transform rotate-45"
            style={{ left: 8, bottom: -5 }}
          />
        </div>,
        document.body,
      )}
    </>
  )
}
