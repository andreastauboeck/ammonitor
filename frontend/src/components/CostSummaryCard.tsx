import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { computeCostSummary, formatEur, getEurPerKgN } from '../lib/costs'
import { formatDayLabel, type ApiResponse, type FormData, type VariableName } from '../pages/types'

function variantLabel(t: any, variable: VariableName, value: string | number): string {
  return t(`variants.${variable}.${value}`, { defaultValue: String(value) })
}

interface CostSummaryCardProps {
  data: ApiResponse
  formData: FormData
  hiddenValues: Set<string>
  /** When set, computes the summary for that single day (detail view).
   *  When null/undefined, averages across all 8 days (overview view). */
  selectedDay?: number | null
}

/**
 * Cost summary side-panel: best/worst variant across either the 8-day
 * average (overview) or a single selected day (detail), €/ha saving,
 * and an optional yearly figure when a farm size is set.
 *
 * Hidden variants (toggled off in the chart legend) are excluded from
 * the best/worst computation.
 */
export default function CostSummaryCard({ data, formData, hiddenValues, selectedDay }: CostSummaryCardProps) {
  const { t, i18n } = useTranslation()
  const eurPerKgN = getEurPerKgN(formData)
  const visibleSet = useMemo(() => {
    const s = new Set(data.values.map((v) => String(v)))
    for (const h of hiddenValues) s.delete(h)
    return s
  }, [data.values, hiddenValues])
  const dayFilter = selectedDay ?? undefined
  const summary = computeCostSummary(
    data,
    formData.tanApp,
    eurPerKgN,
    formData.farmSizeHa,
    visibleSet,
    dayFilter,
  )
  const locale = i18n.language

  const selectedDayLabel = useMemo(() => {
    if (selectedDay == null) return null
    const d = data.days.find((x) => x.day === selectedDay)
    return d ? formatDayLabel(d.start, locale) : null
  }, [data.days, selectedDay, locale])

  const title = selectedDayLabel
    ? t('costs.title_day', { date: selectedDayLabel })
    : t('costs.title_avg')

  if (!summary) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
          {title}
        </div>
        <div className="text-xs text-slate-500 mt-2">—</div>
      </div>
    )
  }

  const variableName = data.variable
  const bestLabel = variantLabel(t, variableName, summary.best.value)
  const worstLabel = variantLabel(t, variableName, summary.worst.value)
  const sameVariant = String(summary.best.value) === String(summary.worst.value)

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3 flex flex-col gap-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
        {title}
      </div>

      <div>
        <div className="text-[10px] text-slate-500 uppercase">{t('costs.best')}</div>
        <div className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">{bestLabel}</div>
        <div className="text-xs text-slate-600 dark:text-slate-300">
          {formatEur(summary.best.eurPerHa, locale)}/ha · {summary.best.avgPct.toFixed(1)}%
        </div>
      </div>

      <div>
        <div className="text-[10px] text-slate-500 uppercase">{t('costs.worst')}</div>
        <div className="font-semibold text-red-600 dark:text-red-400 text-sm">{worstLabel}</div>
        <div className="text-xs text-slate-600 dark:text-slate-300">
          {formatEur(summary.worst.eurPerHa, locale)}/ha · {summary.worst.avgPct.toFixed(1)}%
        </div>
      </div>

      <div>
        <div className="text-[10px] text-slate-500 uppercase">{t('costs.saving_pre')}</div>
        {sameVariant ? (
          <div className="text-xs text-slate-500">—</div>
        ) : (
          <>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {formatEur(summary.savingPerHa, locale)}/ha
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              {t('costs.saving_by', { variant: bestLabel })}
            </div>
            {summary.savingPerYear !== undefined && summary.farmSizeHa && (
              <div className="flex flex-wrap items-baseline gap-x-1 text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                <span>= {formatEur(summary.savingPerYear, locale)}/{t('costs.per_year_short')}</span>
                <span className="text-emerald-600/70 dark:text-emerald-400/70">({summary.farmSizeHa} {t('units.ha')})</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
