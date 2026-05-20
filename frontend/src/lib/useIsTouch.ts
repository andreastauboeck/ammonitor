import { useEffect, useState } from 'react'

/**
 * Detects whether the current device has touch input. Checked once on
 * mount via `ontouchstart`, `maxTouchPoints`, or `pointer: coarse`.
 */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsTouch(
      'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches,
    )
  }, [])
  return isTouch
}
