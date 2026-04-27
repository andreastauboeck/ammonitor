export interface FormData {
  tanApp: number
  manDm: number
  manPh: number
  manSource: 'cattle' | 'pig'
  applicationTime: '06:00' | '14:00' | '18:00'
  incorpTime: number | null
  incorp: 'shallow' | 'deep'
}

export interface HourlyPoint {
  ct: number
  e: number
  er: number
  j: number
}

export interface TechniqueData {
  final_loss_pct: number
  final_loss_kg: number
  hourly: HourlyPoint[]
}

export interface ScenarioData {
  day: number
  start: string
  techniques: Record<string, TechniqueData>
}

export interface WeatherPoint {
  time_iso: string
  air_temp: number
  wind_speed: number
  rain_rate: number
}

export interface ApiResponse {
  scenarios: ScenarioData[]
  weather: WeatherPoint[]
}

export const TECHNIQUES = [
  'Broadcast',
  'Trailing hose',
  'Trailing shoe',
  'Open slot',
  'Closed slot',
] as const

export const TECH_COLORS: Record<string, string> = {
  'Broadcast': '#ef4444',
  'Trailing hose': '#3b82f6',
  'Trailing shoe': '#8b5cf6',
  'Open slot': '#10b981',
  'Closed slot': '#f59e0b',
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

export function formatTimeAxis(ct: number): string {
  const days = Math.floor(ct / 24)
  const hours = ct % 24
  if (days === 0) return `${hours}h`
  if (hours === 0) return `${days}d`
  return `${days}d ${hours}h`
}

export function niceMax(value: number): number {
  if (value <= 0) return 5
  const step = value < 10 ? 1 : value < 50 ? 5 : 10
  return Math.ceil(value / step) * step
}
