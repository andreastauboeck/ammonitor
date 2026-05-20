import { useEffect } from 'react'
import {
  DEFAULT_FORM_DATA,
  type FertilizerId,
  type FormData,
  type VariableName,
} from '../pages/types'

const ALL_VARIABLES: VariableName[] = [
  'app_mthd',
  'app_time',
  'man_dm',
  'man_ph',
  'incorp_depth',
  'incorp_time',
  'man_source',
]

const FERT_IDS: FertilizerId[] = ['can', 'urea', 'uan', 'ssa', 'custom']

const COST_STORAGE_KEY = 'ammonitor-cost-params'

interface CostParams {
  fertilizer: FertilizerId
  customEurPerKgN: number
  farmSizeHa?: number
  chartUnit: 'kgha' | 'eur'
}

function loadCostDefaults(): Partial<CostParams> {
  try {
    const raw = localStorage.getItem(COST_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Partial<CostParams>
  } catch {}
  return {}
}

function saveCostDefaults(formData: FormData): void {
  try {
    const cost: CostParams = {
      fertilizer: formData.fertilizer,
      customEurPerKgN: formData.customEurPerKgN,
      farmSizeHa: formData.farmSizeHa,
      chartUnit: formData.chartUnit,
    }
    localStorage.setItem(COST_STORAGE_KEY, JSON.stringify(cost))
  } catch {}
}

/** Convert `formData` into URL search params (plain string→string map). */
export function serializeForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {
    variable: formData.variable,
    tanApp: String(formData.tanApp),
    appMthd: formData.appMthd,
    manDm: String(formData.manDm),
    manPh: String(formData.manPh),
    manSource: formData.manSource,
    appTime: String(formData.appTime),
    incorpTime: String(formData.incorpTime),
    incorpDepth: formData.incorpDepth,
    fert: formData.fertilizer,
    unit: formData.chartUnit,
  }
  if (formData.fertilizer === 'custom') {
    out.eurkgn = String(formData.customEurPerKgN)
  }
  if (formData.farmSizeHa && formData.farmSizeHa > 0) {
    out.farmha = String(formData.farmSizeHa)
  }
  return out
}

/** Parse URL search params into a `FormData` (with safe fallbacks). */
export function deserializeForm(params: URLSearchParams): FormData {
  const d = { ...DEFAULT_FORM_DATA }
  const stored = loadCostDefaults()

  if (
    params.has('variable') &&
    ALL_VARIABLES.includes(params.get('variable') as VariableName)
  ) {
    d.variable = params.get('variable') as VariableName
  }
  if (params.has('tanApp')) d.tanApp = parseFloat(params.get('tanApp')!) || 60
  if (
    params.has('appMthd') &&
    ['bc', 'th', 'ts', 'os', 'cs'].includes(params.get('appMthd')!)
  ) {
    d.appMthd = params.get('appMthd')!
  }
  if (params.has('manDm')) d.manDm = parseFloat(params.get('manDm')!) || 6
  if (params.has('manPh')) d.manPh = parseFloat(params.get('manPh')!) || 7.5
  if (
    params.has('manSource') &&
    ['cattle', 'pig'].includes(params.get('manSource')!)
  ) {
    d.manSource = params.get('manSource') as 'cattle' | 'pig'
  }
  if (params.has('appTime')) {
    const h = parseInt(params.get('appTime')!, 10)
    if (!isNaN(h) && h >= 0 && h <= 23) d.appTime = h
  }
  if (params.has('incorpTime'))
    d.incorpTime = parseFloat(params.get('incorpTime')!) || 0
  if (
    params.has('incorpDepth') &&
    ['none', 'shallow', 'deep'].includes(params.get('incorpDepth')!)
  ) {
    d.incorpDepth = params.get('incorpDepth') as FormData['incorpDepth']
  }
  if (
    params.has('fert') &&
    FERT_IDS.includes(params.get('fert') as FertilizerId)
  ) {
    d.fertilizer = params.get('fert') as FertilizerId
  } else if (stored.fertilizer && FERT_IDS.includes(stored.fertilizer)) {
    d.fertilizer = stored.fertilizer
  }
  if (params.has('eurkgn')) {
    const v = parseFloat(params.get('eurkgn')!)
    if (!isNaN(v) && v > 0) d.customEurPerKgN = v
  } else if (typeof stored.customEurPerKgN === 'number' && stored.customEurPerKgN > 0) {
    d.customEurPerKgN = stored.customEurPerKgN
  }
  if (params.has('farmha')) {
    const v = parseFloat(params.get('farmha')!)
    if (!isNaN(v) && v > 0) d.farmSizeHa = v
  } else if (typeof stored.farmSizeHa === 'number' && stored.farmSizeHa > 0) {
    d.farmSizeHa = stored.farmSizeHa
  }
  if (params.has('unit')) {
    const u = params.get('unit')
    if (u === 'kgha' || u === 'eur') d.chartUnit = u
  } else if (stored.chartUnit === 'kgha' || stored.chartUnit === 'eur') {
    d.chartUnit = stored.chartUnit
  }
  return d
}

/**
 * Keeps the URL `?...` in sync with the current `formData`. Uses replace
 * semantics so URL changes don't push history entries.
 * Also persists cost parameters to localStorage.
 */
export function useFormUrlSync(
  formData: FormData,
  setSearchParams: (
    nextInit: URLSearchParams,
    navigateOpts?: { replace?: boolean },
  ) => void,
): void {
  useEffect(() => {
    const p = new URLSearchParams(serializeForm(formData))
    setSearchParams(p, { replace: true })
  }, [formData, setSearchParams])

  useEffect(() => {
    saveCostDefaults(formData)
  }, [
    formData.fertilizer,
    formData.customEurPerKgN,
    formData.farmSizeHa,
    formData.chartUnit,
  ])
}
