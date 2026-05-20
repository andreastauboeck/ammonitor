import { useRef } from 'react'
import { useIsTouch } from './useIsTouch'

/**
 * Syncs scroll position between two chart panels (emission / weather)
 * so users only need to scroll one to move both.
 */
export function useChartScroll(options?: {
  onScroll?: (source: 'emission' | 'weather') => void
}) {
  const isTouch = useIsTouch()
  const isSyncingRef = useRef(false)
  const emissionRef = useRef<HTMLDivElement>(null)
  const weatherRef = useRef<HTMLDivElement>(null)
  const syncScroll = (source: 'emission' | 'weather') => () => {
    if (options?.onScroll) options.onScroll(source)
    if (isSyncingRef.current) return
    const src = source === 'emission' ? emissionRef.current : weatherRef.current
    const tgt = source === 'emission' ? weatherRef.current : emissionRef.current
    if (!src || !tgt) return
    isSyncingRef.current = true
    tgt.scrollLeft = src.scrollLeft
    requestAnimationFrame(() => { isSyncingRef.current = false })
  }

  return { emissionRef, weatherRef, syncScroll, isTouch }
}
