import { useEffect, useRef, useState } from 'react'

/**
 * Shared hook for touch-device tooltip display + auto-dismiss.
 *
 * On touch devices:
 * - Clicking on a chart element shows the tooltip
 * - Scrolling dismisses the tooltip
 * - Tooltip auto-dismisses after a configurable delay
 */
export function useTouchTooltip(autoDismissMs: number = 1200) {
  const [active, setActive] = useState(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [])

  const touchStart = () => {
    setActive(true)
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = setTimeout(() => setActive(false), autoDismissMs)
  }

  const touchDismiss = () => {
    if (active) {
      setActive(false)
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }

  return { active, touchStart, touchDismiss }
}
