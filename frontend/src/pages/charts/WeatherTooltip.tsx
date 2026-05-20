import type { ChartColors } from '../../theme/chartColors'

export interface WeatherTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  forceHide?: boolean
  colors: ChartColors
  /** When provided, only payload entries whose dataKey is in this set render. */
  filterKeys?: string[]
  /** Optional label formatter. */
  labelFormatter?: (l: any) => string
}

/**
 * Shared weather tooltip. Overview passes `filterKeys` to hide stacked
 * helper series (`*_min`, `*_delta`); Detail passes `labelFormatter` for
 * hybrid clock labels.
 */
export default function WeatherTooltip({
  active,
  payload,
  label,
  forceHide,
  colors,
  filterKeys,
  labelFormatter,
}: WeatherTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  if (forceHide) return <div style={{ visibility: 'hidden', height: 0 }} />
  const labelText = labelFormatter ? labelFormatter(label) : label
  const entries = filterKeys
    ? payload.filter((entry: any) => filterKeys.includes(entry.dataKey))
    : payload
  return (
    <div
      style={{
        backgroundColor: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        borderRadius: '6px',
        padding: '4px 6px',
        fontSize: '10px',
        color: colors.tooltipText,
        lineHeight: '1.25',
      }}
    >
      <div style={{ fontWeight: 600 }}>{labelText}</div>
      {entries.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}:{' '}
          {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
        </div>
      ))}
    </div>
  )
}
