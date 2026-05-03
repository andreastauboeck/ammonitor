export type VariableName =
  | 'app_mthd'
  | 'app_time'
  | 'man_dm'
  | 'man_ph'
  | 'incorp_depth'
  | 'incorp_time'
  | 'man_source'

export interface HourlyPoint {
  hour: number
  er: number
}

export interface VariantResult {
  value: string | number
  final_loss_pct: number
  hourly: HourlyPoint[]
}

export interface DayData {
  day: number
  start: string
  variants: VariantResult[]
}

export interface WeatherPoint {
  time_iso: string
  air_temp: number
  wind_speed: number
  rain_rate: number
}

export interface ApiResponse {
  variable: VariableName
  values: (string | number)[]
  days: DayData[]
  weather: WeatherPoint[]
}

export interface FormData {
  tanApp: number
  variable: VariableName
  appMthd: string
  manDm: number
  manPh: number
  manSource: 'cattle' | 'pig'
  appTime: number
  incorpTime: number
  incorpDepth: 'none' | 'shallow' | 'deep'
}

export const VARIANT_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
]

/**
 * Variant definitions: per variable, the list of allowed values.
 * Display labels are looked up via i18n: t(`variants.${variable}.${value}`)
 * Categories (educational hints) via: t(`categories.${variable}.${value}`)
 *
 * The `categoryKey` field below is the i18n key suffix used when a category
 * exists. If absent, no category is rendered.
 */
export interface VariantDef {
  value: string | number
  /** i18n key suffix (within variants.<variable>) for the display label. Defaults to String(value). */
  labelKey?: string
  /** Whether this value has a category translation key (categories.<variable>.<value>). */
  hasCategory?: boolean
}

export const VARIANT_DEFS: Record<VariableName, VariantDef[]> = {
  'app_mthd': [
    { value: 'bc' },
    { value: 'th' },
    { value: 'ts' },
    { value: 'os' },
    { value: 'cs' },
  ],
  'app_time': [
    { value: 6, hasCategory: true },
    { value: 8, hasCategory: true },
    { value: 12, hasCategory: true },
    { value: 16, hasCategory: true },
    { value: 20, hasCategory: true },
  ],
  'man_dm': [
    { value: 2, hasCategory: true },
    { value: 4, hasCategory: true },
    { value: 6, hasCategory: true },
    { value: 10, hasCategory: true },
    { value: 14, hasCategory: true },
  ],
  'man_ph': [
    { value: 5.5, hasCategory: true },
    { value: 6.5, hasCategory: true },
    { value: 7.5, hasCategory: true },
    { value: 8.0, hasCategory: true },
    { value: 9.0, hasCategory: true },
  ],
  'incorp_time': [
    { value: 0 },
    { value: 2 },
    { value: 4 },
    { value: 8 },
    { value: 12 },
    { value: 24 },
  ],
  'incorp_depth': [
    { value: 'none' },
    { value: 'shallow' },
    { value: 'deep' },
  ],
  'man_source': [
    { value: 'cattle' },
    { value: 'pig' },
  ],
}

export const TAN_PRESETS = [20, 30, 40, 50, 60, 70, 80, 100, 120, 150]

export const DEFAULT_FORM_DATA: FormData = {
  tanApp: 60,
  variable: 'app_mthd',
  appMthd: 'bc',
  manDm: 6,
  manPh: 7.5,
  manSource: 'cattle',
  appTime: 12,
  incorpTime: 0,
  incorpDepth: 'none',
}

/** Format a date string (ISO) using the active i18n locale. */
export function formatDayLabel(iso: string, locale?: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function niceMax(value: number): number {
  if (value <= 0) return 5
  const step = value < 10 ? 1 : value < 50 ? 5 : 10
  return Math.ceil(value / step) * step
}
