import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { variantLabel } from '../../lib/variantLabel'
import { VARIANT_COLORS, type VariableName, type VariantDef } from '../types'

export type LegendSwatch = 'bar' | 'line'

/**
 * Per-variant CI button wiring. When omitted (OverviewChart) the CI
 * button column is not rendered.
 */
export interface CiLegendControls {
  /** Variant values for which CI data has been fetched (current day). */
  fetchedValues: Set<string>
  /** Variant values whose CI band is currently visible. */
  visibleValues: Set<string>
  /** `${valueKey}:${day}` keys currently being fetched. */
  loadingValues: Set<string>
  /** Click handler — first click fetches, subsequent toggle visibility. */
  onCiClick: (value: string | number, day: number) => void
  /** Day index passed through to onCiClick. */
  day: number
}

export interface VariantLegendProps {
  values: readonly (string | number)[]
  variableName: VariableName
  hiddenValues: Set<string>
  toggleValue: (value: string) => void
  /** Swatch shape: filled square (bars) or short line (lines). */
  swatch: LegendSwatch
  /** Optional per-variant CI controls (DetailChart). */
  ci?: CiLegendControls
  /** Whether to render a "95% certainty" chip at the end. */
  showCiChip?: boolean
  /** Variant defs (subscript label-key + category hints) keyed by index. */
  variantDefs?: readonly VariantDef[]
}

/**
 * Clickable variant pills with hidden/visible state. Optionally renders a
 * stats-icon CI toggle button after each pill (DetailChart). Reused by
 * both OverviewChart and DetailChart.
 */
export default function VariantLegend({
  values,
  variableName,
  hiddenValues,
  toggleValue,
  swatch,
  ci,
  showCiChip,
  variantDefs,
}: VariantLegendProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300 mb-1 shrink-0">
      {values.map((value, i) => {
        const valueKey = String(value)
        const hidden = hiddenValues.has(valueKey)
        const color = VARIANT_COLORS[i % VARIANT_COLORS.length]
        const def = variantDefs?.[i]
        return (
          <span key={valueKey} className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleValue(valueKey)}
              className={`inline-flex items-center gap-1 cursor-pointer select-none transition-opacity ${hidden ? 'opacity-30' : 'opacity-100'}`}
            >
              <Swatch swatch={swatch} color={color} hidden={hidden} />
              {variantLabel(t as TFunction, variableName, value, def)}
            </button>
            {ci && (
              <CiButton t={t as TFunction} value={value} hidden={hidden} ci={ci} />
            )}
          </span>
        )
      })}
      {showCiChip && <CiChip swatch={swatch} />}
    </div>
  )
}

function Swatch({
  swatch,
  color,
  hidden,
}: {
  swatch: LegendSwatch
  color: string
  hidden: boolean
}) {
  if (swatch === 'bar') {
    return (
      <span
        className="inline-block w-3 h-3 border"
        style={{
          backgroundColor: hidden ? 'transparent' : color,
          borderColor: color,
        }}
      />
    )
  }
  // line
  return (
    <span className="inline-block w-3 h-0.5" style={{ backgroundColor: color }} />
  )
}

function CiButton({
  t,
  value,
  hidden,
  ci,
}: {
  t: TFunction
  value: string | number
  hidden: boolean
  ci: CiLegendControls
}) {
  const valueKey = String(value)
  const hasFetched = ci.fetchedValues.has(valueKey)
  const ciVisible = ci.visibleValues.has(valueKey)
  const ciLoading = ci.loadingValues.has(`${valueKey}:${ci.day}`)
  const ciDisabled = hidden || ciLoading
  let ciTitle = t('charts.fetch_ci')
  if (hasFetched && ciVisible) ciTitle = t('charts.hide_ci')
  else if (hasFetched && !ciVisible) ciTitle = t('charts.show_ci')
  return (
    <button
      type="button"
      onClick={() => ci.onCiClick(value, ci.day)}
      disabled={ciDisabled}
      title={ciTitle}
      aria-pressed={hasFetched && ciVisible}
      className={`inline-flex items-center justify-center w-5 h-5 rounded border transition-colors ${
        ciDisabled
          ? 'border-slate-300 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
          : ciLoading
            ? 'border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 cursor-wait'
            : hasFetched && ciVisible
              ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'
              : hasFetched
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                : 'border-slate-400 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      {ciLoading ? (
        <span className="text-[10px] leading-none">…</span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          className="w-3 h-3"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="2" y="9" width="2.5" height="5" />
          <rect x="6.75" y="5" width="2.5" height="9" />
          <rect x="11.5" y="2" width="2.5" height="12" />
        </svg>
      )}
    </button>
  )
}

function CiChip({ swatch }: { swatch: LegendSwatch }) {
  const { t } = useTranslation()
  if (swatch === 'bar') {
    return (
      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
        ─╴ {t('charts.ci_label')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-slate-500">
      <span
        className="inline-block w-3 h-2 rounded-sm"
        style={{ backgroundColor: 'rgba(148,163,184,0.12)' }}
      />
      {t('charts.ci_label')}
    </span>
  )
}
