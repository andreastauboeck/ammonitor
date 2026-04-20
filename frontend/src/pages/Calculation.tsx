import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'


interface FormData {
  tanApp: number
  manDm: number
  manPh: number
  manSource: 'cattle' | 'pig'
  applicationTime: '06:00' | '14:00' | '18:00'
  incorpTime: number | null // null = no incorporation
  incorp: 'shallow' | 'deep'
}

interface HourlyPoint {
  ct: number
  e: number
  er: number
  j: number
}

interface TechniqueData {
  final_loss_pct: number
  final_loss_kg: number
  hourly: HourlyPoint[]
}

interface ScenarioData {
  day: number
  start: string
  techniques: Record<string, TechniqueData>
}

interface WeatherPoint {
  time_iso: string
  air_temp: number
  wind_speed: number // m/s from API
  rain_rate: number // mm/h
}

interface ApiResponse {
  scenarios: ScenarioData[]
  weather: WeatherPoint[]
}

// Fixed Y-axis range for rain (mm/h) in the weather chart
const RAIN_AXIS_MAX = 5

const TECHNIQUES = [
  'Broadcast',
  'Trailing hose',
  'Trailing shoe',
  'Open slot',
  'Closed slot',
] as const

const TECH_COLORS: Record<string, string> = {
  'Broadcast': '#ef4444',
  'Trailing hose': '#3b82f6',
  'Trailing shoe': '#8b5cf6',
  'Open slot': '#10b981',
  'Closed slot': '#f59e0b',
}

function formatDayLabel(iso: string): string {
  // iso like "2026-04-20T00:00"
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

function formatTimeAxis(ct: number): string {
  // ct is hours since application. Show as "Dd Hh"
  const days = Math.floor(ct / 24)
  const hours = ct % 24
  if (days === 0) return `${hours}h`
  if (hours === 0) return `${days}d`
  return `${days}d ${hours}h`
}

// Round max value up to a "nice" multiple of 5 for cleaner axis ticks
function niceMax(value: number): number {
  if (value <= 0) return 5
  const step = value < 10 ? 1 : value < 50 ? 5 : 10
  return Math.ceil(value / step) * step
}

// Custom tooltip for emission charts: shows both % of TAN and kg/ha for each series
interface EmissionTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  tanApp: number
  labelFormatter?: (l: any) => string
}

function EmissionTooltip({
  active,
  payload,
  label,
  tanApp,
  labelFormatter,
}: EmissionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  // Filter to series whose dataKey is a technique (not weather)
  const techEntries = payload.filter((p: any) =>
    TECHNIQUES.includes(p.dataKey as any),
  )
  const otherEntries = payload.filter(
    (p: any) => !TECHNIQUES.includes(p.dataKey as any),
  )

  const labelText = labelFormatter ? labelFormatter(label) : label

  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        border: '1px solid #475569',
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '12px',
        color: '#e2e8f0',
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600 }}>{labelText}</div>
      {techEntries.map((entry: any) => {
        const pct = entry.value as number
        const kg = (pct * tanApp) / 100
        return (
          <div
            key={entry.dataKey}
            style={{ color: entry.color, lineHeight: '1.4' }}
          >
            {entry.dataKey}: {pct.toFixed(2)}% ({kg.toFixed(2)} kg/ha)
          </div>
        )
      })}
      {otherEntries.map((entry: any) => (
        <div
          key={entry.dataKey}
          style={{ color: entry.color, lineHeight: '1.4' }}
        >
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  )
}

export default function Calculation() {
  const { lat, lng } = useParams<{ lat: string; lng: string }>()
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const [formData, setFormData] = useState<FormData>({
    tanApp: 60,
    manDm: 6,
    manPh: 7.5,
    manSource: 'cattle',
    applicationTime: '14:00',
    incorpTime: null,
    incorp: 'shallow',
  })

  // Reverse geocode for location name
  useEffect(() => {
    if (!lat || !lng) return
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    )
      .then((res) => res.json())
      .then((data) => {
        const city =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.municipality ||
          data.address?.county
        setLocationName(city || null)
      })
      .catch(() => setLocationName(null))
      .finally(() => setLocationLoading(false))
  }, [lat, lng])

  // Fetch calculation data
  useEffect(() => {
    if (!lat || !lng) return

    setLoading(true)
    setError(null)

    const browserTz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto'

    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        tan_app: formData.tanApp,
        man_dm: formData.manDm,
        man_ph: formData.manPh,
        man_source: formData.manSource,
        application_time: formData.applicationTime,
        // Only send incorporation info when a time has been set; otherwise
        // no incorporation is performed.
        incorp:
          formData.incorpTime !== null ? formData.incorp : 'none',
        incorp_time: formData.incorpTime ?? 0,
        timezone: browserTz,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.text()
          throw new Error(err || `Server responded with ${res.status}`)
        }
        return res.json()
      })
      .then((payload: ApiResponse) => {
        setData(payload)
      })
      .catch((err) => {
        console.error('Calculation error:', err)
        setError(err.message)
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [
    lat,
    lng,
    formData.tanApp,
    formData.manDm,
    formData.manPh,
    formData.manSource,
    formData.applicationTime,
    formData.incorp,
    formData.incorpTime,
  ])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target
    if (name === 'incorpTime') {
      // "" means no incorporation
      setFormData((prev) => ({
        ...prev,
        incorpTime: value === '' ? null : parseFloat(value),
      }))
      return
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }))
  }

  // Build overview chart data: one row per day, with each technique as a bar series
  // Values are in % of TAN (left axis). Right axis shows equivalent kg/ha.
  const overviewData = useMemo(() => {
    if (!data) return []
    return data.scenarios.map((s) => {
      const row: Record<string, any> = {
        day: s.day,
        dayLabel: formatDayLabel(s.start),
        start: s.start,
      }
      for (const tech of TECHNIQUES) {
        row[tech] = s.techniques[tech]?.final_loss_pct ?? 0
      }
      return row
    })
  }, [data])

  // Dynamic max for overview Y-axis — use the largest bar value across all days/techniques
  const overviewMax = useMemo(() => {
    let m = 0
    for (const row of overviewData) {
      for (const tech of TECHNIQUES) {
        const v = row[tech] ?? 0
        if (v > m) m = v
      }
    }
    return niceMax(m)
  }, [overviewData])

  // Weather lookup by time_iso (e.g. "2026-04-20T01:00")
  const weatherByTime = useMemo(() => {
    const m = new Map<string, WeatherPoint>()
    if (!data?.weather) return m
    for (const w of data.weather) m.set(w.time_iso, w)
    return m
  }, [data])

  // Build detail chart data for selected day.
  // Each row combines the per-technique cumulative emissions and the
  // weather at that hour, so both charts can share the same array.
  const detailData = useMemo(() => {
    if (!data || selectedDay === null) return []
    const scenario = data.scenarios.find((s) => s.day === selectedDay)
    if (!scenario) return []

    // Parse scenario start as local time. Backend sends e.g. "2026-04-20T00:00"
    // without timezone, which new Date() treats as local — matching Open-Meteo
    // data that was requested in the user's timezone.
    const startMs = new Date(scenario.start).getTime()

    // Collect hourly points keyed by ct
    const byCt: Record<number, Record<string, any>> = {}
    for (const tech of TECHNIQUES) {
      const t = scenario.techniques[tech]
      if (!t) continue
      for (const p of t.hourly) {
        if (!byCt[p.ct]) {
          const tsMs = startMs + p.ct * 3600 * 1000
          const d = new Date(tsMs)
          // Rebuild time_iso in same "YYYY-MM-DDTHH:MM" local format
          const pad = (n: number) => String(n).padStart(2, '0')
          const timeIso = `${d.getFullYear()}-${pad(
            d.getMonth() + 1,
          )}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          const w = weatherByTime.get(timeIso)
          byCt[p.ct] = {
            ct: p.ct,
            label: formatTimeAxis(p.ct),
            air_temp: w ? +w.air_temp.toFixed(1) : null,
            wind_kmh: w ? +(w.wind_speed * 3.6).toFixed(1) : null,
            rain_rate: w ? +w.rain_rate.toFixed(2) : 0,
          }
        }
        // er is fraction of TAN lost, convert to %
        byCt[p.ct][tech] = +(p.er * 100).toFixed(2)
      }
    }
    return Object.values(byCt).sort((a, b) => a.ct - b.ct)
  }, [data, selectedDay, weatherByTime])

  // Dynamic max for detail Y-axis — largest cumulative emission across all techniques
  const detailMax = useMemo(() => {
    let m = 0
    for (const row of detailData as any[]) {
      for (const tech of TECHNIQUES) {
        const v = (row[tech] ?? 0) as number
        if (v > m) m = v
      }
    }
    return niceMax(m)
  }, [detailData])

  const selectedScenario =
    selectedDay !== null && data
      ? data.scenarios.find((s) => s.day === selectedDay)
      : null

  // Label on the X-axis where the incorporation marker should appear.
  // Chart rows are hourly (ct = 1..168). Round incorp_time up to the next integer
  // hour to pick the closest existing row (ct=0 isn't in the data).
  const incorpMarker = useMemo(() => {
    if (formData.incorpTime === null) return null
    const targetCt = Math.max(1, Math.ceil(formData.incorpTime))
    const row = (detailData as any[]).find((r) => r.ct === targetCt)
    if (!row) return null
    return {
      label: row.label as string,
      info: { mode: formData.incorp, time_h: formData.incorpTime },
    }
  }, [detailData, formData.incorp, formData.incorpTime])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6">
      <div className="max-w-full md:max-w-6xl mx-auto">
        <Link
          to={`/?lat=${lat}&lng=${lng}`}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-4 md:mb-6"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to map
        </Link>

        <div className="mb-4 md:mb-6">
          {locationLoading ? (
            <p className="text-slate-400">Loading location...</p>
          ) : locationName ? (
            <p className="text-2xl font-bold flex items-center gap-2">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {locationName}
            </p>
          ) : (
            <p className="text-2xl font-bold flex items-center gap-2">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {lat}, {lng}
            </p>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Form panel */}
          <div className="w-full md:w-1/3 lg:w-1/4 bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-700">
            <h2 className="text-lg font-semibold mb-3">Parameters</h2>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  TAN applied (kg/ha)
                </label>
                <input
                  type="number"
                  name="tanApp"
                  value={formData.tanApp}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Dry matter (%)
                </label>
                <input
                  type="number"
                  name="manDm"
                  value={formData.manDm}
                  onChange={handleChange}
                  step="0.1"
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">pH</label>
                <input
                  type="number"
                  name="manPh"
                  value={formData.manPh}
                  onChange={handleChange}
                  step="0.1"
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Manure source
                </label>
                <select
                  name="manSource"
                  value={formData.manSource}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                >
                  <option value="cattle">Cattle</option>
                  <option value="pig">Pig</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Application time
                </label>
                <select
                  name="applicationTime"
                  value={formData.applicationTime}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                >
                  <option value="06:00">06:00 (morning)</option>
                  <option value="14:00">14:00 (afternoon)</option>
                  <option value="18:00">18:00 (evening)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Incorporation time (h)
                </label>
                <select
                  name="incorpTime"
                  value={formData.incorpTime ?? ''}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">None</option>
                  <option value={0.25}>0.25 h (15 min)</option>
                  <option value={0.5}>0.5 h (30 min)</option>
                  <option value={1}>1 h</option>
                  <option value={2}>2 h</option>
                  <option value={4}>4 h</option>
                  <option value={8}>8 h</option>
                  <option value={24}>24 h</option>
                </select>
              </div>
              {formData.incorpTime !== null && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Incorporation depth
                  </label>
                  <select
                    name="incorp"
                    value={formData.incorp}
                    onChange={handleChange}
                    className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="shallow">Shallow</option>
                    <option value="deep">Deep</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Chart panel */}
          <div className="w-full md:w-2/3 lg:w-3/4 bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                {selectedDay === null
                  ? 'NH3 loss by application day and technique'
                  : `Detail — ${selectedScenario ? formatDayLabel(selectedScenario.start) : ''}`}
                {loading && (
                  <span className="text-sm font-normal text-slate-400 ml-2">
                    (calculating...)
                  </span>
                )}
              </h2>
              {selectedDay !== null && (
                <button
                  onClick={() => setSelectedDay(null)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600"
                >
                  ← Overview
                </button>
              )}
            </div>

            {error && (
              <div className="mb-2 p-2 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                Error: {error}
              </div>
            )}

            <div className="h-64 md:h-[calc(100vh-18rem)] min-h-[320px] flex flex-col">
              {selectedDay === null ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={overviewData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    onClick={(e: any) => {
                      if (e && typeof e.activeTooltipIndex === 'number') {
                        const row = overviewData[e.activeTooltipIndex]
                        if (row) setSelectedDay(row.day)
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis
                      dataKey="dayLabel"
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      key={`left-${overviewMax}`}
                      yAxisId="left"
                      stroke="#94a3b8"
                      tick={{ fontSize: 10 }}
                      domain={[0, overviewMax]}
                      label={{
                        value: 'NH3 loss (% of TAN)',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#94a3b8',
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      key={`right-${overviewMax}-${formData.tanApp}`}
                      yAxisId="right"
                      orientation="right"
                      stroke="#94a3b8"
                      tick={{ fontSize: 10 }}
                      domain={[0, overviewMax]}
                      tickFormatter={(v: number) =>
                        ((v * formData.tanApp) / 100).toFixed(1)
                      }
                      label={{
                        value: 'NH3 loss (kg/ha)',
                        angle: 90,
                        position: 'insideRight',
                        fill: '#94a3b8',
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      content={
                        <EmissionTooltip tanApp={formData.tanApp} />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {TECHNIQUES.map((tech) => (
                      <Bar
                        key={tech}
                        dataKey={tech}
                        yAxisId="left"
                        fill={TECH_COLORS[tech]}
                        cursor="pointer"
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <>
                  {/* Emissions chart (top ~60%) */}
                  <div className="flex-[3] min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={detailData}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis
                          dataKey="label"
                          stroke="#94a3b8"
                          tick={{ fontSize: 10 }}
                          interval={23}
                        />
                        <YAxis
                          key={`detail-left-${detailMax}`}
                          yAxisId="left"
                          stroke="#94a3b8"
                          tick={{ fontSize: 10 }}
                          domain={[0, detailMax]}
                          label={{
                            value: 'NH3 loss (% of TAN)',
                            angle: -90,
                            position: 'insideLeft',
                            fill: '#94a3b8',
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          key={`detail-right-${detailMax}-${formData.tanApp}`}
                          yAxisId="right"
                          orientation="right"
                          stroke="#94a3b8"
                          tick={{ fontSize: 10 }}
                          domain={[0, detailMax]}
                          tickFormatter={(v: number) =>
                            ((v * formData.tanApp) / 100).toFixed(1)
                          }
                          label={{
                            value: 'NH3 loss (kg/ha)',
                            angle: 90,
                            position: 'insideRight',
                            fill: '#94a3b8',
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          content={
                            <EmissionTooltip tanApp={formData.tanApp} />
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {TECHNIQUES.map((tech) => (
                          <Line
                            key={tech}
                            type="monotone"
                            dataKey={tech}
                            yAxisId="left"
                            stroke={TECH_COLORS[tech]}
                            dot={false}
                            strokeWidth={2}
                          />
                        ))}
                        {incorpMarker && (
                          <ReferenceLine
                            yAxisId="left"
                            x={incorpMarker.label}
                            stroke="#fbbf24"
                            strokeDasharray="4 2"
                            strokeWidth={2}
                            label={{
                              value: `Incorp (${incorpMarker.info.mode}, ${incorpMarker.info.time_h}h)`,
                              position: 'insideTopRight',
                              fill: '#fbbf24',
                              fontSize: 10,
                            }}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Weather chart (bottom ~40%) */}
                  <div className="flex-[2] min-h-0 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={detailData}
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis
                          dataKey="label"
                          stroke="#94a3b8"
                          tick={{ fontSize: 10 }}
                          interval={23}
                          label={{
                            value: 'Time since application',
                            position: 'insideBottom',
                            offset: -2,
                            fill: '#94a3b8',
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#94a3b8"
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'Temp (°C) / Wind (km/h)',
                            angle: -90,
                            position: 'insideLeft',
                            fill: '#94a3b8',
                            fontSize: 10,
                          }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#94a3b8"
                          tick={{ fontSize: 10 }}
                          domain={[0, RAIN_AXIS_MAX]}
                          label={{
                            value: 'Rain (mm/h)',
                            angle: 90,
                            position: 'insideRight',
                            fill: '#94a3b8',
                            fontSize: 10,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: '#e2e8f0' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          yAxisId="right"
                          dataKey="rain_rate"
                          name="Rain (mm/h)"
                          fill="#3b82f6"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="air_temp"
                          name="Air temp (°C)"
                          stroke="#f97316"
                          dot={false}
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="wind_kmh"
                          name="Wind (km/h)"
                          stroke="#22d3ee"
                          dot={false}
                          strokeWidth={2}
                        />
                        {incorpMarker && (
                          <ReferenceLine
                            yAxisId="left"
                            x={incorpMarker.label}
                            stroke="#fbbf24"
                            strokeDasharray="4 2"
                            strokeWidth={2}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
            {selectedDay === null && overviewData.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Click a day group to see hourly details.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
