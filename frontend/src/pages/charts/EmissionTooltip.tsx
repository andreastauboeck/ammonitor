import type { ChartUnit } from '../types'
import type { ChartColors } from '../../theme/chartColors'
import { formatEur, pctToEurPerHa, pctToKgPerHa } from '../../lib/costs'

/** Resolved CI bounds (absolute %, not deltas). Null when no CI for the entry. */
export type CiBounds = { lwr: number; upr: number } | null

/** Strategy to read CI for a single payload entry. */
export type GetCi = (entry: any) => CiBounds

export interface EmissionTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  tanApp: number
  forceHide?: boolean
  colors: ChartColors
  chartUnit: ChartUnit
  eurPerKgN: number
  locale: string
  kgUnitLabel: string
  /** Recharts dataKey strings (one per variant) we treat as "variant series". */
  valueKeys: string[]
  /** Optional label formatter (used by DetailChart for hybrid clock labels). */
  labelFormatter?: (l: any) => string
  /** Extract resolved CI bounds for a variant entry. */
  getCi: GetCi
  /**
   * When true, payload entries whose dataKey is NOT in `valueKeys` AND is
   * NOT recognized as CI metadata are rendered after the variant entries
   * (DetailChart shows incorporation markers etc.).
   */
  showExtraEntries?: boolean
  /** Predicate to identify CI-metadata dataKeys (so we skip them in extras). */
  isCiKey?: (dataKey: string) => boolean
}

/**
 * Shared variant-emission tooltip used by both Overview (bars) and Detail
 * (lines). Renders one row per variant: `name: pct% (secondary unit)
 * [lwr–upr%]?`. Behaviour parametrised via `getCi` / `isCiKey` so each
 * chart can plug its own CI data shape.
 */
export default function EmissionTooltip({
  active,
  payload,
  label,
  tanApp,
  forceHide,
  colors,
  chartUnit,
  eurPerKgN,
  locale,
  kgUnitLabel,
  valueKeys,
  labelFormatter,
  getCi,
  showExtraEntries,
  isCiKey,
}: EmissionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  if (forceHide) return <div style={{ visibility: 'hidden', height: 0 }} />

  const variantEntries = payload.filter((p: any) => valueKeys.includes(p.dataKey))
  const extraEntries = showExtraEntries
    ? payload.filter(
        (p: any) =>
          !valueKeys.includes(p.dataKey) &&
          !(isCiKey ? isCiKey(p.dataKey as string) : false),
      )
    : []

  const labelText = labelFormatter ? labelFormatter(label) : label

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
      {variantEntries.map((entry: any) => {
        const pct = entry.value as number
        const kg = pctToKgPerHa(pct, tanApp)
        const eur = pctToEurPerHa(pct, tanApp, eurPerKgN)
        const main = `${pct.toFixed(1)}%`
        const secondary =
          chartUnit === 'kgha'
            ? `${kg.toFixed(1)} ${kgUnitLabel}`
            : `${formatEur(eur, locale)}/ha`
        const ci = getCi(entry)
        return (
          <div key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: {main} ({secondary})
            {ci && (
              <span style={{ color: '#94a3b8', fontSize: '9px' }}>
                {' '}[{ci.lwr.toFixed(1)}–{ci.upr.toFixed(1)}%]
              </span>
            )}
          </div>
        )
      })}
      {extraEntries.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  )
}
