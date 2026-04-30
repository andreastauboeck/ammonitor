import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import {
  type ApiResponse,
  type FormData,
  type WeatherPoint,
  VARIANT_COLORS,
  formatTimeAxis,
  niceMax,
} from './types'

interface EmissionTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  tanApp: number
  labelFormatter?: (l: any) => string
  variantLabels: string[]
  forceHide?: boolean
}

function EmissionTooltip({
  active,
  payload,
  label,
  tanApp,
  labelFormatter,
  variantLabels,
  forceHide,
}: EmissionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  if (forceHide) return <div style={{ visibility: 'hidden', height: 0 }} />

  const variantEntries = payload.filter((p: any) =>
    variantLabels.includes(p.dataKey as any),
  )
  const otherEntries = payload.filter(
    (p: any) => !variantLabels.includes(p.dataKey as any),
  )

  const labelText = labelFormatter ? labelFormatter(label) : label

  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        border: '1px solid #475569',
        borderRadius: '6px',
        padding: '4px 6px',
        fontSize: '10px',
        color: '#e2e8f0',
        lineHeight: '1.25',
      }}
    >
      <div style={{ fontWeight: 600 }}>{labelText}</div>
      {variantEntries.map((entry: any) => {
        const pct = entry.value as number
        const kg = (pct * tanApp) / 100
        return (
          <div key={entry.dataKey} style={{ color: entry.color }}>
            {entry.dataKey}: {pct.toFixed(1)}% ({kg.toFixed(1)} kg/ha)
          </div>
        )
      })}
      {otherEntries.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  )
}

interface WeatherTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  labelFormatter?: (l: any) => string
  forceHide?: boolean
}

function WeatherTooltip({ active, payload, label, labelFormatter, forceHide }: WeatherTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  if (forceHide) return <div style={{ visibility: 'hidden', height: 0 }} />
  const labelText = labelFormatter ? labelFormatter(label) : label
  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        border: '1px solid #475569',
        borderRadius: '6px',
        padding: '4px 6px',
        fontSize: '10px',
        color: '#e2e8f0',
        lineHeight: '1.25',
      }}
    >
      <div style={{ fontWeight: 600 }}>{labelText}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  )
}

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const check = () =>
      typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches)
    setIsTouch(check())
  }, [])
  return isTouch
}

interface IncorpMarker {
  hour: number
  label: string
  color: string
}

interface DetailChartProps {
  data: ApiResponse
  day: number
  formData: FormData
}

function parseIncorpHour(label: string): number | null {
  const m = label.match(/(\d+(?:\.\d+)?)\s*h/i)
  return m ? parseFloat(m[1]) : null
}

function parseAppHour(label: string): number | null {
  const m = label.match(/^(\d{1,2}):(\d{2})$/)
  return m ? parseInt(m[1], 10) : null
}

function makeTimeIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DetailChart({ data, day, formData }: DetailChartProps) {
  const emissionScrollRef = useRef<HTMLDivElement>(null)
  const weatherScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingRef = useRef(false)
  const isTouch = useIsTouch()
  const tooltipTrigger: 'click' | 'hover' = isTouch ? 'click' : 'hover'
  const [touchTooltipActive, setTouchTooltipActive] = useState(false)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout>>()

  const handleChartClick = (e: any) => {
    if (!isTouch) return
    if (e && e.activeTooltipIndex != null) {
      setTouchTooltipActive(true)
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      autoDismissRef.current = setTimeout(() => setTouchTooltipActive(false), 4000)
    } else {
      setTouchTooltipActive(false)
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
  }

  useEffect(() => {
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
  }, [])

  const syncScroll = (source: 'emission' | 'weather') => () => {
    if (isSyncingRef.current) return
    if (isTouch && touchTooltipActive) {
      setTouchTooltipActive(false)
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
    const src = source === 'emission' ? emissionScrollRef.current : weatherScrollRef.current
    const tgt = source === 'emission' ? weatherScrollRef.current : emissionScrollRef.current
    if (!src || !tgt) return
    isSyncingRef.current = true
    tgt.scrollLeft = src.scrollLeft
    requestAnimationFrame(() => { isSyncingRef.current = false })
  }

  const dayData = data.days.find((d) => d.day === day)
  const variantLabels = data.variant_labels
  const isAppTimeVariable = formData.variable === 'app.time'

  const variantOffsets = useMemo(() => {
    if (!isAppTimeVariable) return null
    const offsets: { label: string; appHour: number; offsetFromEarliest: number }[] = []
    let earliest = 24
    for (const label of variantLabels) {
      const h = parseAppHour(label)
      if (h !== null && h < earliest) earliest = h
    }
    for (const label of variantLabels) {
      const h = parseAppHour(label)
      offsets.push({ label, appHour: h ?? 0, offsetFromEarliest: (h ?? 0) - earliest })
    }
    return offsets
  }, [isAppTimeVariable, variantLabels])

  const earliestAppHour = variantOffsets ? Math.min(...variantOffsets.map((v) => v.appHour)) : 0

  const weatherByTime = useMemo(() => {
    const m = new Map<string, WeatherPoint>()
    if (!data?.weather) return m
    for (const w of data.weather) m.set(w.time_iso, w)
    return m
  }, [data])

  const detailData = useMemo(() => {
    if (!dayData) return []
    const startDate = new Date(dayData.start)
    const baseDate = new Date(startDate)
    if (isAppTimeVariable) {
      baseDate.setHours(earliestAppHour, 0, 0, 0)
    }

    const ZERO_HOUR = 0.1
    const byKey: Record<string, Record<string, any>> = {}

    for (const label of variantLabels) {
      const t = dayData.variants[label]
      if (!t) continue

      let offset = 0
      if (isAppTimeVariable && variantOffsets) {
        const vo = variantOffsets.find((v) => v.label === label)
        offset = vo ? vo.offsetFromEarliest : 0
      }

      const startHour = isAppTimeVariable ? offset : 0

      if (offset > 0) {
        const zeroKey = String(startHour + ZERO_HOUR)
        if (!byKey[zeroKey]) {
          const tsDate = new Date(baseDate.getTime() + startHour * 3600 * 1000)
          const timeIso = makeTimeIso(tsDate)
          const w = weatherByTime.get(timeIso)
          byKey[zeroKey] = {
            hour: startHour + ZERO_HOUR,
            label: isAppTimeVariable ? formatHybridLabel(baseDate, startHour) : formatTimeAxis(0),
            air_temp: w ? +w.air_temp.toFixed(1) : null,
            wind_kmh: w ? +(w.wind_speed * 3.6).toFixed(1) : null,
            rain_rate: w ? +w.rain_rate.toFixed(2) : 0,
          }
        }
        byKey[zeroKey][label] = 0
      }

      for (const p of t.hourly) {
        const realHour = p.hour + offset
        const key = String(realHour)

        if (!byKey[key]) {
          const tsDate = new Date(baseDate.getTime() + realHour * 3600 * 1000)
          const timeIso = makeTimeIso(tsDate)
          const w = weatherByTime.get(timeIso)
          byKey[key] = {
            hour: realHour,
            label: isAppTimeVariable ? formatHybridLabel(baseDate, realHour) : formatTimeAxis(realHour),
            air_temp: w ? +w.air_temp.toFixed(1) : null,
            wind_kmh: w ? +(w.wind_speed * 3.6).toFixed(1) : null,
            rain_rate: w ? +w.rain_rate.toFixed(2) : 0,
          }
        }
        byKey[key][label] = +(p.er * 100).toFixed(2)
      }
    }
    return Object.values(byKey).sort((a, b) => a.hour - b.hour)
  }, [dayData, variantLabels, weatherByTime, isAppTimeVariable, variantOffsets, earliestAppHour])

  const maxHour = useMemo(() => {
    if (!detailData.length) return 168
    return Math.max(168, (detailData as any[])[detailData.length - 1].hour)
  }, [detailData])

  const detailMax = useMemo(() => {
    let m = 0
    for (const row of detailData as any[]) {
      for (const label of variantLabels) {
        const v = (row[label] ?? 0) as number
        if (v > m) m = v
      }
    }
    return niceMax(m)
  }, [detailData, variantLabels])

  const weatherLeftMax = useMemo(() => {
    let m = 0
    for (const row of detailData as any[]) {
      const t = (row.air_temp ?? 0) as number
      const w = (row.wind_kmh ?? 0) as number
      if (t > m) m = t
      if (w > m) m = w
    }
    return niceMax(m)
  }, [detailData])

  const weatherRightMax = useMemo(() => {
    let m = 0
    for (const row of detailData as any[]) {
      const r = (row.rain_rate ?? 0) as number
      if (r > m) m = r
    }
    return niceMax(Math.max(m, 1))
  }, [detailData])

  const incorpMarkers: IncorpMarker[] = useMemo(() => {
    if (formData.incorp === 'none') return []
    if (!detailData.length) return []

    if (formData.variable === 'incorp') {
      const markers: IncorpMarker[] = []
      for (let i = 0; i < variantLabels.length; i++) {
        const hour = parseIncorpHour(variantLabels[i])
        if (hour == null) continue
        let xHour = hour
        if (isAppTimeVariable && variantOffsets) {
          xHour = hour + variantOffsets[i].offsetFromEarliest
        }
        markers.push({
          hour: xHour,
          label: variantLabels[i],
          color: VARIANT_COLORS[i % VARIANT_COLORS.length],
        })
      }
      return markers
    }

    const targetHour = formData.incorpTime
    const closest = (detailData as any[]).reduce((prev: any, curr: any) =>
      Math.abs(curr.hour - targetHour) < Math.abs(prev.hour - targetHour) ? curr : prev,
    )
    if (!closest) return []
    return [{
      hour: closest.hour,
      label: `Incorp (${formData.incorp}, ${formData.incorpTime}h)`,
      color: '#fbbf24',
    }]
  }, [detailData, formData.incorp, formData.incorpTime, formData.variable, variantLabels, isAppTimeVariable, variantOffsets])

  const logTicks = useMemo(() => {
    const ticks = [1, 2, 4, 8, 24, 48, 96, 168]
    if (maxHour > 168) ticks.push(maxHour)
    return ticks
  }, [maxHour])

  const fmtLabel = useMemo(() => {
    if (!isAppTimeVariable) {
      return (l: any) => typeof l === 'number' ? formatTimeAxis(l) : String(l)
    }
    const baseDate = dayData ? new Date(dayData.start) : new Date()
    baseDate.setHours(earliestAppHour, 0, 0, 0)
    return (l: any) => {
      if (typeof l !== 'number') return String(l)
      return formatHybridLabel(baseDate, l)
    }
  }, [isAppTimeVariable, dayData, earliestAppHour])

  if (!dayData) return null

  return (
    <>
      {/* Fixed legend for emission chart */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-300 mb-1 shrink-0">
        {variantLabels.map((label, i) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5"
              style={{ backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* === EMISSION CHART (sticky y-axes, scrollable middle) === */}
      <div className="flex-[3] min-h-0 flex">
        {/* Left fixed column: vertical label + left y-axis */}
        <div className="flex shrink-0 h-full">
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              NH3 loss (% of TAN)
            </span>
          </div>
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={detailData}
                margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`detail-left-${detailMax}`}
                  yAxisId="left"
                  stroke="#94a3b8"
                  tick={{ fontSize: 9 }}
                  domain={[0, detailMax]}
                  width={30}
                />
                <XAxis dataKey="hour" hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Middle scrollable column: main chart with hidden y-axes */}
        <div ref={emissionScrollRef} onScroll={syncScroll('emission')} className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-full min-w-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={detailData}
                margin={{ top: 10, right: 0, left: 0, bottom: 5 }}
                syncId="detail-charts"
                onClick={isTouch ? handleChartClick : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis
                  dataKey="hour"
                  type="number"
                  scale="log"
                  domain={[1, maxHour]}
                  ticks={logTicks}
                  tickFormatter={isAppTimeVariable ? fmtLabel : (h: number) => formatTimeAxis(h)}
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                />
                <YAxis yAxisId="left" domain={[0, detailMax]} hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, detailMax]} hide />
                <Tooltip
                  trigger={tooltipTrigger}
                  cursor={isTouch ? (touchTooltipActive ? { fill: 'rgba(148, 163, 184, 0.1)' } : false) : { fill: 'rgba(148, 163, 184, 0.1)' }}
                  wrapperStyle={isTouch && !touchTooltipActive ? { visibility: 'hidden' } : undefined}
                  content={
                    <EmissionTooltip
                      tanApp={formData.tanApp}
                      labelFormatter={fmtLabel}
                      variantLabels={variantLabels}
                      forceHide={isTouch && !touchTooltipActive}
                    />
                  }
                />
                {variantLabels.map((label, i) => (
                  <Line
                    key={label}
                    type="monotone"
                    dataKey={label}
                    yAxisId="left"
                    stroke={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                    activeDot={isTouch ? (touchTooltipActive ? { r: 4, strokeWidth: 0 } : false) : undefined}
                  />
                ))}
                {incorpMarkers.map((m) => (
                  <ReferenceLine
                    key={m.label}
                    yAxisId="left"
                    x={m.hour}
                    stroke={m.color}
                    strokeDasharray="4 2"
                    strokeWidth={2}
                    label={{
                      value: m.label,
                      position: 'insideTopRight',
                      fill: m.color,
                      fontSize: 10,
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right fixed column: right y-axis + vertical label */}
        <div className="flex shrink-0 h-full">
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={detailData}
                margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`detail-right-${detailMax}-${formData.tanApp}`}
                  yAxisId="right"
                  orientation="right"
                  stroke="#94a3b8"
                  tick={{ fontSize: 9 }}
                  domain={[0, detailMax]}
                  tickFormatter={(v: number) =>
                    ((v * formData.tanApp) / 100).toFixed(1)
                  }
                  width={30}
                />
                <XAxis dataKey="hour" hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              NH3 loss (kg/ha)
            </span>
          </div>
        </div>
      </div>

      {/* Fixed legend for weather chart */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-300 mt-2 mb-1 shrink-0">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#f97316' }} />
          Air temp (°C)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#22d3ee' }} />
          Wind (km/h)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#3b82f6' }} />
          Rain (mm/h)
        </span>
      </div>

      {/* === WEATHER CHART (sticky y-axes, scrollable middle) === */}
      <div className="flex-[2] min-h-0 flex">
        {/* Left fixed column */}
        <div className="flex shrink-0 h-full">
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              Temp (°C) / Wind (km/h)
            </span>
          </div>
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={detailData}
                margin={{ top: 5, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`weather-left-${weatherLeftMax}`}
                  yAxisId="left"
                  stroke="#94a3b8"
                  tick={{ fontSize: 9 }}
                  domain={[0, weatherLeftMax]}
                  width={30}
                />
                <XAxis dataKey="hour" hide />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Middle scrollable */}
        <div ref={weatherScrollRef} onScroll={syncScroll('weather')} className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-full min-w-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={detailData}
                margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
                syncId="detail-charts"
                onClick={isTouch ? handleChartClick : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis
                  dataKey="hour"
                  type="number"
                  scale="log"
                  domain={[1, maxHour]}
                  ticks={logTicks}
                  tickFormatter={isAppTimeVariable ? fmtLabel : (h: number) => formatTimeAxis(h)}
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                />
                <YAxis yAxisId="left" domain={[0, weatherLeftMax]} hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, weatherRightMax]} hide />
                <Tooltip
                  trigger={tooltipTrigger}
                  cursor={isTouch ? (touchTooltipActive ? { fill: 'rgba(148, 163, 184, 0.1)' } : false) : { fill: 'rgba(148, 163, 184, 0.1)' }}
                  wrapperStyle={isTouch && !touchTooltipActive ? { visibility: 'hidden' } : undefined}
                  content={<WeatherTooltip labelFormatter={fmtLabel} forceHide={isTouch && !touchTooltipActive} />}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rain_rate"
                  name="Rain (mm/h)"
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={2}
                  activeDot={isTouch ? (touchTooltipActive ? { r: 4, strokeWidth: 0 } : false) : undefined}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="air_temp"
                  name="Air temp (°C)"
                  stroke="#f97316"
                  dot={false}
                  strokeWidth={2}
                  activeDot={isTouch ? (touchTooltipActive ? { r: 4, strokeWidth: 0 } : false) : undefined}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="wind_kmh"
                  name="Wind (km/h)"
                  stroke="#22d3ee"
                  dot={false}
                  strokeWidth={2}
                  activeDot={isTouch ? (touchTooltipActive ? { r: 4, strokeWidth: 0 } : false) : undefined}
                />
                {incorpMarkers.map((m) => (
                  <ReferenceLine
                    key={m.label}
                    yAxisId="left"
                    x={m.hour}
                    stroke={m.color}
                    strokeDasharray="4 2"
                    strokeWidth={2}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right fixed column */}
        <div className="flex shrink-0 h-full">
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={detailData}
                margin={{ top: 5, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`weather-right-${weatherRightMax}`}
                  yAxisId="right"
                  orientation="right"
                  stroke="#94a3b8"
                  tick={{ fontSize: 9 }}
                  domain={[0, weatherRightMax]}
                  width={30}
                />
                <XAxis dataKey="hour" hide />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              Rain (mm/h)
            </span>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-1">
        Weather data by{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">
          Open-Meteo.com
        </a>
      </p>
    </>
  )
}

function formatHybridLabel(baseDate: Date, hoursSinceBase: number): string {
  const d = new Date(baseDate.getTime() + hoursSinceBase * 3600 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const daysSince = Math.floor(hoursSinceBase / 24)
  if (daysSince === 0) return `${clock} (+${hoursSinceBase}h)`
  const remaining = hoursSinceBase % 24
  if (remaining === 0) return `Day ${daysSince}, ${clock} (+${hoursSinceBase}h)`
  return `Day ${daysSince}, ${clock} (+${hoursSinceBase}h)`
}
