import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  type VariableName,
  VARIANT_COLORS,
  niceMax,
} from './types'
import { useTheme } from '../theme/ThemeContext'
import { getChartColors, type ChartColors } from '../theme/chartColors'

function variantLabel(t: any, variable: VariableName, value: string | number): string {
  return t(`variants.${variable}.${value}`, { defaultValue: String(value) })
}

interface EmissionTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  tanApp: number
  labelFormatter?: (l: any) => string
  valueKeys: string[]
  forceHide?: boolean
  unit: string
  colors: ChartColors
}

function EmissionTooltip({
  active,
  payload,
  label,
  tanApp,
  labelFormatter,
  valueKeys,
  forceHide,
  unit,
  colors,
}: EmissionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  if (forceHide) return <div style={{ visibility: 'hidden', height: 0 }} />

  const variantEntries = payload.filter((p: any) =>
    valueKeys.includes(p.dataKey as any),
  )
  const otherEntries = payload.filter(
    (p: any) => !valueKeys.includes(p.dataKey as any),
  )

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
        const kg = (pct * tanApp) / 100
        return (
          <div key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: {pct.toFixed(1)}% ({kg.toFixed(1)} {unit})
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
  colors: ChartColors
}

function WeatherTooltip({ active, payload, label, labelFormatter, forceHide, colors }: WeatherTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  if (forceHide) return <div style={{ visibility: 'hidden', height: 0 }} />
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
  hideLabel?: boolean
}

interface DetailChartProps {
  data: ApiResponse
  day: number
  formData: FormData
}

function makeTimeIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DetailChart({ data, day, formData }: DetailChartProps) {
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const colors = getChartColors(resolved)
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
  const variableName = data.variable
  const values = data.values
  const valueKeys = values.map((v) => String(v))
  const isAppTimeVariable = variableName === 'app_time'

  const variantOffsets = useMemo(() => {
    if (!isAppTimeVariable) return null
    const offsets: { value: string | number; appHour: number; offsetFromEarliest: number }[] = []
    let earliest = 24
    for (const v of values) {
      const h = typeof v === 'number' ? v : parseInt(String(v), 10)
      if (!isNaN(h) && h < earliest) earliest = h
    }
    for (const v of values) {
      const h = typeof v === 'number' ? v : parseInt(String(v), 10)
      offsets.push({ value: v, appHour: h, offsetFromEarliest: h - earliest })
    }
    return offsets
  }, [isAppTimeVariable, values])

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

    for (const variant of dayData.variants) {
      const key = String(variant.value)

      let offset = 0
      if (isAppTimeVariable && variantOffsets) {
        const vo = variantOffsets.find((v) => String(v.value) === key)
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
            label: isAppTimeVariable ? formatHybridLabel(t, baseDate, startHour) : formatTimeAxis(t, 0),
            air_temp: w ? +w.air_temp.toFixed(1) : null,
            wind_kmh: w ? +(w.wind_speed * 3.6).toFixed(1) : null,
            rain_rate: w ? +w.rain_rate.toFixed(2) : 0,
          }
        }
        byKey[zeroKey][key] = 0
      }

      for (const p of variant.hourly) {
        const realHour = p.hour + offset
        const k = String(realHour)

        if (!byKey[k]) {
          const tsDate = new Date(baseDate.getTime() + (realHour - 1) * 3600 * 1000)
          const timeIso = makeTimeIso(tsDate)
          const w = weatherByTime.get(timeIso)
          byKey[k] = {
            hour: realHour,
            label: isAppTimeVariable ? formatHybridLabel(t, baseDate, realHour) : formatTimeAxis(t, realHour),
            air_temp: w ? +w.air_temp.toFixed(1) : null,
            wind_kmh: w ? +(w.wind_speed * 3.6).toFixed(1) : null,
            rain_rate: w ? +w.rain_rate.toFixed(2) : 0,
          }
        }
        byKey[k][key] = +(p.er * 100).toFixed(2)
      }
    }
    return Object.values(byKey).sort((a, b) => a.hour - b.hour)
  }, [dayData, weatherByTime, isAppTimeVariable, variantOffsets, earliestAppHour, t])

  const maxHour = useMemo(() => {
    if (!detailData.length) return 168
    return Math.max(168, (detailData as any[])[detailData.length - 1].hour)
  }, [detailData])

  const detailMax = useMemo(() => {
    let m = 0
    for (const row of detailData as any[]) {
      for (const k of valueKeys) {
        const v = (row[k] ?? 0) as number
        if (v > m) m = v
      }
    }
    return niceMax(m)
  }, [detailData, valueKeys])

  const weatherLeftMax = useMemo(() => {
    let m = 0
    for (const row of detailData as any[]) {
      const t1 = (row.air_temp ?? 0) as number
      const w1 = (row.wind_kmh ?? 0) as number
      if (t1 > m) m = t1
      if (w1 > m) m = w1
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
    if (formData.incorpDepth === 'none') return []
    if (!detailData.length) return []

    if (variableName === 'incorp_time') {
      const markers: IncorpMarker[] = []
      values.forEach((value, i) => {
        const hour = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(hour) || hour < 0) return
        let xHour = hour === 0 ? 1 : hour
        if (isAppTimeVariable && variantOffsets) {
          xHour = (hour === 0 ? 1 : hour) + variantOffsets[i].offsetFromEarliest
        }
        markers.push({
          hour: xHour,
          label: variantLabel(t, variableName, value),
          color: VARIANT_COLORS[i % VARIANT_COLORS.length],
        })
      })
      return markers
    }

    const targetHour = formData.incorpTime
    if (targetHour < 0) return []
    const markerHour = targetHour === 0 ? 1 : targetHour

    if (isAppTimeVariable && variantOffsets) {
      return values.map((value, i) => {
        const offset = variantOffsets[i].offsetFromEarliest
        return {
          hour: markerHour + offset,
          label: `${variantLabel(t, 'app_time', value)} — ${t('detail.incorp_marker', { depth: t(`variants.incorp_depth.${formData.incorpDepth}`), hours: formData.incorpTime })}`,
          color: VARIANT_COLORS[i % VARIANT_COLORS.length],
          hideLabel: true,
        }
      })
    }

    const closest = (detailData as any[]).reduce((prev: any, curr: any) =>
      Math.abs(curr.hour - markerHour) < Math.abs(prev.hour - markerHour) ? curr : prev,
    )
    if (!closest) return []
    return [{
      hour: closest.hour,
      label: t('detail.incorp_marker', { depth: t(`variants.incorp_depth.${formData.incorpDepth}`), hours: formData.incorpTime }),
      color: '#fbbf24',
    }]
  }, [detailData, formData.incorpDepth, formData.incorpTime, variableName, values, isAppTimeVariable, variantOffsets, t])

  const logTicks = useMemo(() => {
    const ticks = [1, 2, 4, 8, 24, 48, 96, 168]
    if (maxHour > 168) ticks.push(maxHour)
    return ticks
  }, [maxHour])

  const fmtLabel = useMemo(() => {
    if (!isAppTimeVariable) {
      return (l: any) => typeof l === 'number' ? formatTimeAxis(t, l) : String(l)
    }
    const baseDate = dayData ? new Date(dayData.start) : new Date()
    baseDate.setHours(earliestAppHour, 0, 0, 0)
    return (l: any) => {
      if (typeof l !== 'number') return String(l)
      return formatHybridLabel(t, baseDate, l)
    }
  }, [isAppTimeVariable, dayData, earliestAppHour, t])

  if (!dayData) return null

  return (
    <>
      {/* Fixed legend for emission chart */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300 mb-1 shrink-0">
        {values.map((value, i) => (
          <span key={String(value)} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5"
              style={{ backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
            />
            {variantLabel(t, variableName, value)}
          </span>
        ))}
      </div>

      {/* === EMISSION CHART === */}
      <div className="flex-[3] min-h-0 flex">
        <div className="flex shrink-0 h-full">
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              {t('charts.nh3_loss_pct')}
            </span>
          </div>
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={detailData}
                margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`detail-left-${detailMax}-${resolved}`}
                  yAxisId="left"
                  stroke={colors.axis}
                  tick={{ fontSize: 9, fill: colors.axis }}
                  domain={[0, detailMax]}
                  width={30}
                />
                <XAxis dataKey="hour" hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div ref={emissionScrollRef} onScroll={syncScroll('emission')} className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-full min-w-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={detailData}
                margin={{ top: 10, right: 0, left: 0, bottom: 5 }}
                syncId="detail-charts"
                onClick={isTouch ? handleChartClick : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis
                  dataKey="hour"
                  type="number"
                  scale="log"
                  domain={[1, maxHour]}
                  ticks={logTicks}
                  tickFormatter={isAppTimeVariable ? fmtLabel : (h: number) => formatTimeAxis(t, h)}
                  stroke={colors.axis}
                  tick={{ fontSize: 10, fill: colors.axis }}
                />
                <YAxis yAxisId="left" domain={[0, detailMax]} hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, detailMax]} hide />
                <Tooltip
                  trigger={tooltipTrigger}
                  cursor={isTouch ? (touchTooltipActive ? { fill: colors.cursorFill } : false) : { fill: colors.cursorFill }}
                  wrapperStyle={isTouch && !touchTooltipActive ? { visibility: 'hidden' } : undefined}
                  content={
                    <EmissionTooltip
                      tanApp={formData.tanApp}
                      labelFormatter={fmtLabel}
                      valueKeys={valueKeys}
                      forceHide={isTouch && !touchTooltipActive}
                      unit={t('units.kg_per_ha')}
                      colors={colors}
                    />
                  }
                />
                {values.map((value, i) => (
                  <Line
                    key={String(value)}
                    type="monotone"
                    dataKey={String(value)}
                    name={variantLabel(t, variableName, value)}
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
                    key={m.hour + '-' + m.color}
                    yAxisId="left"
                    x={m.hour}
                    stroke={m.color}
                    strokeDasharray="4 2"
                    strokeWidth={2}
                    label={m.hideLabel ? undefined : {
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

        <div className="flex shrink-0 h-full">
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={detailData}
                margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`detail-right-${detailMax}-${formData.tanApp}-${resolved}`}
                  yAxisId="right"
                  orientation="right"
                  stroke={colors.axis}
                  tick={{ fontSize: 9, fill: colors.axis }}
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
            <span className="text-[9px] text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              {t('charts.nh3_loss_kgha')}
            </span>
          </div>
        </div>
      </div>

      {/* Weather legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300 mt-2 mb-1 shrink-0">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#f97316' }} />
          {t('charts.air_temp')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#22d3ee' }} />
          {t('charts.wind')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#3b82f6' }} />
          {t('charts.rain')}
        </span>
      </div>

      {/* === WEATHER CHART === */}
      <div className="flex-[2] min-h-0 flex">
        <div className="flex shrink-0 h-full">
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              {t('charts.temp_wind_short')}
            </span>
          </div>
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={detailData}
                margin={{ top: 5, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`weather-left-${weatherLeftMax}-${resolved}`}
                  yAxisId="left"
                  stroke={colors.axis}
                  tick={{ fontSize: 9, fill: colors.axis }}
                  domain={[0, weatherLeftMax]}
                  width={30}
                />
                <XAxis dataKey="hour" hide />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div ref={weatherScrollRef} onScroll={syncScroll('weather')} className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-full min-w-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={detailData}
                margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
                syncId="detail-charts"
                onClick={isTouch ? handleChartClick : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis
                  dataKey="hour"
                  type="number"
                  scale="log"
                  domain={[1, maxHour]}
                  ticks={logTicks}
                  tickFormatter={isAppTimeVariable ? fmtLabel : (h: number) => formatTimeAxis(t, h)}
                  stroke={colors.axis}
                  tick={{ fontSize: 10, fill: colors.axis }}
                />
                <YAxis yAxisId="left" domain={[0, weatherLeftMax]} hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, weatherRightMax]} hide />
                <Tooltip
                  trigger={tooltipTrigger}
                  cursor={isTouch ? (touchTooltipActive ? { fill: colors.cursorFill } : false) : { fill: colors.cursorFill }}
                  wrapperStyle={isTouch && !touchTooltipActive ? { visibility: 'hidden' } : undefined}
                  content={<WeatherTooltip labelFormatter={fmtLabel} forceHide={isTouch && !touchTooltipActive} colors={colors} />}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rain_rate"
                  name={t('charts.rain')}
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={2}
                  activeDot={isTouch ? (touchTooltipActive ? { r: 4, strokeWidth: 0 } : false) : undefined}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="air_temp"
                  name={t('charts.air_temp')}
                  stroke="#f97316"
                  dot={false}
                  strokeWidth={2}
                  activeDot={isTouch ? (touchTooltipActive ? { r: 4, strokeWidth: 0 } : false) : undefined}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="wind_kmh"
                  name={t('charts.wind')}
                  stroke="#22d3ee"
                  dot={false}
                  strokeWidth={2}
                  activeDot={isTouch ? (touchTooltipActive ? { r: 4, strokeWidth: 0 } : false) : undefined}
                />
                {incorpMarkers.map((m) => (
                  <ReferenceLine
                    key={m.hour + '-' + m.color}
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

        <div className="flex shrink-0 h-full">
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={detailData}
                margin={{ top: 5, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`weather-right-${weatherRightMax}-${resolved}`}
                  yAxisId="right"
                  orientation="right"
                  stroke={colors.axis}
                  tick={{ fontSize: 9, fill: colors.axis }}
                  domain={[0, weatherRightMax]}
                  width={30}
                />
                <XAxis dataKey="hour" hide />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              {t('charts.rain_short')}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function formatTimeAxis(t: any, hour: number): string {
  const days = Math.floor(hour / 24)
  const hours = hour % 24
  if (days === 0) return t('time.hours_short', { n: hours })
  if (hours === 0) return t('time.days_short', { n: days })
  return t('time.days_hours', { d: days, h: hours })
}

function formatHybridLabel(t: any, baseDate: Date, hoursSinceBase: number): string {
  const d = new Date(baseDate.getTime() + hoursSinceBase * 3600 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const daysSince = Math.floor(hoursSinceBase / 24)
  if (daysSince === 0) return t('time.clock_offset', { clock, h: hoursSinceBase })
  return t('time.day_clock', { day: daysSince, clock, h: hoursSinceBase })
}
