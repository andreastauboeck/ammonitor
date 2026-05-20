/**
 * Cost translation helpers: ALFAM2 % loss → kg N/ha → €/ha.
 *
 * Pure functions, no side effects, no UI.
 */
import {
  type ApiResponse,
  type ChartUnit,
  type FormData,
  FERTILIZER_PRESETS,
} from '../pages/types'

/** Resolve €/kg N from current form state (preset or custom). */
export function getEurPerKgN(formData: FormData): number {
  if (formData.fertilizer === 'custom') {
    const v = formData.customEurPerKgN
    return Number.isFinite(v) && v > 0 ? v : FERTILIZER_PRESETS.can.eurPerKgN
  }
  return FERTILIZER_PRESETS[formData.fertilizer].eurPerKgN
}

/** % TAN loss → kg N/ha. */
export function pctToKgPerHa(pct: number, tanApp: number): number {
  return (pct * tanApp) / 100
}

/** % TAN loss → €/ha. */
export function pctToEurPerHa(pct: number, tanApp: number, eurPerKgN: number): number {
  return pctToKgPerHa(pct, tanApp) * eurPerKgN
}

/** Convert a % value into the active chart unit (numeric). */
export function pctToUnit(
  pct: number,
  unit: ChartUnit,
  tanApp: number,
  eurPerKgN: number,
): number {
  switch (unit) {
    case 'kgha':
      return pctToKgPerHa(pct, tanApp)
    case 'eur':
      return pctToEurPerHa(pct, tanApp, eurPerKgN)
  }
}

/** Format a number for the active unit and locale. */
export function formatUnit(
  pct: number,
  unit: ChartUnit,
  tanApp: number,
  eurPerKgN: number,
  locale: string,
): string {
  const v = pctToUnit(pct, unit, tanApp, eurPerKgN)
  switch (unit) {
    case 'kgha':
      return `${v.toFixed(1)} kg/ha`
    case 'eur':
      return formatEur(v, locale) + '/ha'
  }
}

/** Format a EUR amount using the active locale. */
export function formatEur(amount: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount)
  } catch {
    return `€${amount.toFixed(2)}`
  }
}

export interface VariantSummary {
  value: string | number
  /** 8-day average % TAN loss. */
  avgPct: number
  /** Same average expressed in €/ha. */
  eurPerHa: number
}

export interface CostSummary {
  best: VariantSummary
  worst: VariantSummary
  /** Worst − Best, in €/ha. Always ≥ 0. */
  savingPerHa: number
  /** Optional yearly figure if a farm size is provided. */
  savingPerYear?: number
  farmSizeHa?: number
}

/**
 * Compute average % loss + €/ha per variant across all 8 days, and
 * derive best/worst/saving.
 */
export function computeCostSummary(
  data: ApiResponse,
  tanApp: number,
  eurPerKgN: number,
  farmSizeHa?: number,
  visibleValues?: Set<string>,
  dayFilter?: number,
): CostSummary | null {
  if (!data.days.length || !data.values.length) return null

  const visible = data.values.filter((v) => !visibleValues || visibleValues.has(String(v)))
  if (!visible.length) return null

  // Restrict to a single day when dayFilter is provided; otherwise average
  // across all available days.
  const dayPool = dayFilter !== undefined
    ? data.days.filter((d) => d.day === dayFilter)
    : data.days

  // For each variant value, average final_loss_pct across the day pool.
  const summaries: VariantSummary[] = visible.map((value) => {
    let sum = 0
    let count = 0
    for (const day of dayPool) {
      const v = day.variants.find((x) => String(x.value) === String(value))
      if (v) {
        sum += v.final_loss_pct
        count++
      }
    }
    const avg = count > 0 ? sum / count : 0
    return {
      value,
      avgPct: avg,
      eurPerHa: pctToEurPerHa(avg, tanApp, eurPerKgN),
    }
  })

  let best = summaries[0]
  let worst = summaries[0]
  for (const s of summaries) {
    if (s.eurPerHa < best.eurPerHa) best = s
    if (s.eurPerHa > worst.eurPerHa) worst = s
  }

  const savingPerHa = Math.max(0, worst.eurPerHa - best.eurPerHa)
  const savingPerYear =
    farmSizeHa && farmSizeHa > 0 ? savingPerHa * farmSizeHa : undefined

  return { best, worst, savingPerHa, savingPerYear, farmSizeHa }
}
