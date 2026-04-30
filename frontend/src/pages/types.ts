export type VariableName = 'app.mthd' | 'app.time' | 'man.dm' | 'man.ph' | 'incorp' | 'incorp.depth' | 'man.source'

export interface HourlyPoint {
  hour: number
  er: number
}

export interface VariantData {
  final_loss_pct: number
  hourly: HourlyPoint[]
}

export interface DayData {
  day: number
  start: string
  variants: Record<string, VariantData>
}

export interface WeatherPoint {
  time_iso: string
  air_temp: number
  wind_speed: number
  rain_rate: number
}

export interface ApiResponse {
  variable: VariableName
  variant_labels: string[]
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
  applicationTime: '06:00' | '08:00' | '12:00' | '16:00' | '20:00'
  incorpTime: number
  incorp: 'none' | 'shallow' | 'deep'
}

export const VARIANT_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
]

export const VARIANT_DEFS: Record<VariableName, { value: any; label: string; category?: string }[]> = {
  'app.mthd': [
    { value: 'bc', label: 'Broadcast' },
    { value: 'th', label: 'Trailing hose' },
    { value: 'ts', label: 'Trailing shoe' },
    { value: 'os', label: 'Open slot' },
    { value: 'cs', label: 'Closed slot' },
  ],
  'app.time': [
    { value: '06:00', label: '06:00', category: 'Morning' },
    { value: '08:00', label: '08:00', category: 'Late morning' },
    { value: '12:00', label: '12:00', category: 'Noon' },
    { value: '16:00', label: '16:00', category: 'Afternoon' },
    { value: '20:00', label: '20:00', category: 'Evening' },
  ],
  'man.dm': [
    { value: 2, label: '2%', category: 'Very liquid' },
    { value: 4, label: '4%', category: 'Pig typical' },
    { value: 6, label: '6%', category: 'Cattle typical' },
    { value: 10, label: '10%', category: 'Thick' },
    { value: 14, label: '14%', category: 'Near limit' },
  ],
  'man.ph': [
    { value: 5.5, label: '5.5', category: 'Acidified' },
    { value: 6.5, label: '6.5', category: 'Low' },
    { value: 7.5, label: '7.5', category: 'Cattle typical' },
    { value: 8.0, label: '8.0', category: 'Pig typical' },
    { value: 9.0, label: '9.0', category: 'High' },
  ],
  'incorp': [
    { value: 2, label: '2 h' },
    { value: 4, label: '4 h' },
    { value: 8, label: '8 h' },
    { value: 12, label: '12 h' },
    { value: 24, label: '24 h' },
  ],
  'incorp.depth': [
    { value: 'none', label: 'None' },
    { value: 'shallow', label: 'Shallow' },
    { value: 'deep', label: 'Deep' },
  ],
  'man.source': [
    { value: 'cattle', label: 'Cattle' },
    { value: 'pig', label: 'Pig' },
  ],
}

export const INPUT_LABELS: Record<VariableName, string> = {
  'app.mthd': 'Application technique',
  'app.time': 'Application time',
  'man.dm': 'Dry matter',
  'man.ph': 'pH',
  'incorp.depth': 'Incorp. depth',
  'incorp': 'Incorp. time',
  'man.source': 'Manure source',
}

export const TAN_PRESETS = [20, 30, 40, 50, 60, 70, 80, 100, 120, 150]

export const DEFAULT_FORM_DATA: FormData = {
  tanApp: 60,
  variable: 'app.mthd',
  appMthd: 'th',
  manDm: 6,
  manPh: 7.5,
  manSource: 'cattle',
  applicationTime: '12:00',
  incorpTime: 4,
  incorp: 'none',
}

export function formatDayLabel(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function formatTimeAxis(hour: number): string {
  const days = Math.floor(hour / 24)
  const hours = hour % 24
  if (days === 0) return `${hours}h`
  if (hours === 0) return `${days}d`
  return `${days}d ${hours}h`
}

export function niceMax(value: number): number {
  if (value <= 0) return 5
  const step = value < 10 ? 1 : value < 50 ? 5 : 10
  return Math.ceil(value / step) * step
}
