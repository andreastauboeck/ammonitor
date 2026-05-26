import { tickBottom } from '../lib/chartTickCalc'

interface YAxisTickOverlayProps {
  /** 'left' sticks to left edge, 'right' to right edge */
  side: 'left' | 'right'
  /** Tick values (including 0) */
  ticks: number[]
  /** Formatter for each tick value */
  formatTick: (tick: number) => string
  /** Total offset subtracted from 100% (AXIS_BOTTOM + margin.top) */
  offset: number
  /** Axis color for tick text */
  color: string
}

/** Reusable sticky Y-axis tick overlay that positions HTML labels
 *  exactly on the chart's horizontal grid lines. */
export default function YAxisTickOverlay({ side, ticks, formatTick, offset, color }: YAxisTickOverlayProps) {
  const stickyClass = side === 'left'
    ? 'sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 relative h-full shrink-0 min-w-max pr-1'
    : 'sticky right-0 bg-slate-50 dark:bg-slate-800 z-10 relative h-full shrink-0 min-w-max pl-1'

  const absClass = side === 'left'
    ? 'absolute right-0 text-[9px] whitespace-nowrap'
    : 'absolute left-0 text-[9px] whitespace-nowrap'

  return (
    <div className={stickyClass}>
      {/* Invisible height reference for flex alignment */}
      <div className="invisible pointer-events-none" style={{ height: 0 }}>
        {ticks.map((tick, i) => (
          <div key={i} className="text-[9px] whitespace-nowrap">{formatTick(tick)}</div>
        ))}
      </div>
      {/* Positioned tick labels */}
      {ticks.map((tick, i) => {
        if (tick === 0) return null
        return (
          <div
            key={i}
            className={absClass}
            style={{
              bottom: tickBottom(offset, i, ticks.length),
              transform: 'translateY(50%)',
              color,
            }}
          >
            {formatTick(tick)}
          </div>
        )
      })}
    </div>
  )
}
