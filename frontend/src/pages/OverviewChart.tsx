import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  type ApiResponse,
  type ChartUnit,
  type FormData,
  type VariableName,
  VARIANT_COLORS,
  niceMax,
} from './types'
import { useTheme } from '../theme/ThemeContext'
import { getChartColors, type ChartColors } from '../theme/chartColors'
import {
  formatEur,
  getEurPerKgN,
  pctToEurPerHa,
  pctToKgPerHa,
} from '../lib/costs'

function variantLabel(t: any, variable: VariableName, value: string | number): string {
  return t(`variants.${variable}.${value}`, { defaultValue: String(value) })
}

/** Convert a variant value to a Recharts-safe dataKey (no dots — Recharts treats dots as nested path access). */
function valueToKey(value: string | number): string {
  return String(value).replace(/\./g, '_')
}

interface EmissionTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  tanApp: number
  forceHide?: boolean
  colors: ChartColors
  chartUnit: ChartUnit
  eurPerKgN: number
  locale: string
  kgUnitLabel: string
}

function EmissionTooltip({
  active, payload, label, tanApp, forceHide, colors,
  chartUnit, eurPerKgN, locale, kgUnitLabel,
}: EmissionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  if (forceHide) return <div style={{ visibility: 'hidden', height: 0 }} />
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
      <div style={{ fontWeight: 600 }}>{label}</div>
      {payload.map((entry: any) => {
        const pct = entry.value as number
        const kg = pctToKgPerHa(pct, tanApp)
        const eur = pctToEurPerHa(pct, tanApp, eurPerKgN)
        const main = `${pct.toFixed(1)}%`
        const secondary = chartUnit === 'kgha'
          ? `${kg.toFixed(1)} ${kgUnitLabel}`
          : `${formatEur(eur, locale)}/ha`
        return (
          <div key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: {main} ({secondary})
          </div>
        )
      })}
    </div>
  )
}

interface WeatherTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  forceHide?: boolean
  colors: ChartColors
}

function WeatherTooltip({ active, payload, label, forceHide, colors }: WeatherTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  if (forceHide) return <div style={{ visibility: 'hidden', height: 0 }} />
  const showKeys = ['air_temp', 'wind_kmh', 'rain_rate']
  const filtered = payload.filter((entry: any) => showKeys.includes(entry.dataKey))
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
      <div style={{ fontWeight: 600 }}>{label}</div>
      {filtered.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
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

interface OverviewChartProps {
  data: ApiResponse
  formData: FormData
  onDayClick: (day: number) => void
  hiddenValues: Set<string>
  toggleValue: (value: string) => void
}

export default function OverviewChart({
  data,
  formData,
  onDayClick,
  hiddenValues,
  toggleValue,
}: OverviewChartProps) {
  const { t, i18n } = useTranslation()
  const { resolved } = useTheme()
  const colors = getChartColors(resolved)
  const variableName = data.variable
  const values = data.values
  const isTouch = useIsTouch()
  const eurPerKgN = getEurPerKgN(formData)
  const chartUnit: ChartUnit = formData.chartUnit
  const tanApp = formData.tanApp
  const locale = i18n.language
  const kgUnitLabel = t('units.kg_per_ha')
  const emissionScrollRef = useRef<HTMLDivElement>(null)
  const weatherScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingRef = useRef(false)
  const syncIdRef = useRef(`overview-${Math.random().toString(36).slice(2)}`)
  const [scrollTooltip, setScrollTooltip] = useState(false)
  const scrollDismissRef = useRef<ReturnType<typeof setTimeout>>()

  const visibleValues = useMemo(
    () => values.filter((v) => !hiddenValues.has(String(v))),
    [values, hiddenValues],
  )

  useEffect(() => {
    return () => {
      if (scrollDismissRef.current) clearTimeout(scrollDismissRef.current)
    }
  }, [])

  const overviewData = useMemo(() => {
    return data.days.map((d) => {
      const row: Record<string, any> = {
        day: d.day,
        dayLabel: new Date(d.start).toLocaleDateString(i18n.language, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        start: d.start,
      }
      for (const v of d.variants) {
        row[valueToKey(v.value)] = v.final_loss_pct
      }
      return row
    })
  }, [data, i18n.language])

  const overviewMax = useMemo(() => {
    let m = 0
    for (const row of overviewData) {
      for (const v of visibleValues) {
        const cell = row[valueToKey(v)] ?? 0
        if (cell > m) m = cell
      }
    }
    return niceMax(m)
  }, [overviewData, visibleValues])

  const handleEmissionClick = (e: any) => {
    if (e && typeof e.activeTooltipIndex === 'number') {
      const row = overviewData[e.activeTooltipIndex]
      if (row) onDayClick(row.day)
    }
  }

  const handleWeatherClick = (_e: any) => {}

  const syncScroll = (source: 'emission' | 'weather') => () => {
    if (isSyncingRef.current) return
    if (isTouch) {
      setScrollTooltip(true)
      if (scrollDismissRef.current) clearTimeout(scrollDismissRef.current)
      scrollDismissRef.current = setTimeout(() => setScrollTooltip(false), 1200)
    }
    const src = source === 'emission' ? emissionScrollRef.current : weatherScrollRef.current
    const tgt = source === 'emission' ? weatherScrollRef.current : emissionScrollRef.current
    if (!src || !tgt) return
    isSyncingRef.current = true
    tgt.scrollLeft = src.scrollLeft
    requestAnimationFrame(() => { isSyncingRef.current = false })
  }

  const weatherOverviewData = useMemo(() => {
    if (!data.weather || data.weather.length === 0 || data.days.length === 0) return []
    const firstDayDate = new Date(data.days[0].start)
    const lastDayDate = new Date(data.days[data.days.length - 1].start)
    lastDayDate.setHours(23, 59, 59, 999)
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    const dayBuckets: Record<string, { temps: number[]; winds: number[]; rains: number[] }> = {}
    for (const d of data.days) {
      dayBuckets[d.start.slice(0, 10)] = { temps: [], winds: [], rains: [] }
    }
    for (const w of data.weather) {
      const d = new Date(w.time_iso)
      if (d < firstDayDate || d > lastDayDate) continue
      const bucket = dayBuckets[w.time_iso.slice(0, 10)]
      if (bucket) {
        bucket.temps.push(w.air_temp)
        bucket.winds.push(w.wind_speed)
        bucket.rains.push(w.rain_rate)
      }
    }
    return data.days.map((d) => {
      const bucket = dayBuckets[d.start.slice(0, 10)]
      const temps = bucket?.temps ?? []
      const winds = (bucket?.winds ?? []).map((w: number) => w * 3.6)
      const avgTemp = avg(temps)
      const avgWind = avg(winds)
      const minTemp = temps.length ? Math.min(...temps) : 0
      const maxTemp = temps.length ? Math.max(...temps) : 0
      const minWind = winds.length ? Math.min(...winds) : 0
      const maxWind = winds.length ? Math.max(...winds) : 0
      return {
        day: d.day,
        dayLabel: new Date(d.start).toLocaleDateString(i18n.language, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        air_temp: +avgTemp.toFixed(1),
        air_temp_min: +minTemp.toFixed(1),
        air_temp_delta: +(maxTemp - minTemp).toFixed(1),
        wind_kmh: +avgWind.toFixed(1),
        wind_kmh_min: +minWind.toFixed(1),
        wind_kmh_delta: +(maxWind - minWind).toFixed(1),
        rain_rate: +(bucket?.rains ?? []).reduce((a: number, b: number) => a + b, 0).toFixed(1),
      }
    })
  }, [data, i18n.language])

  const weatherLeftMax = useMemo(() => {
    let m = 0
    for (const row of weatherOverviewData) {
      const tempMax = (row.air_temp_min ?? 0) + (row.air_temp_delta ?? 0)
      const windMax = (row.wind_kmh_min ?? 0) + (row.wind_kmh_delta ?? 0)
      if (tempMax > m) m = tempMax
      if (windMax > m) m = windMax
    }
    return niceMax(m)
  }, [weatherOverviewData])

  const weatherRightMax = useMemo(() => {
    let m = 0
    for (const row of weatherOverviewData) {
      if ((row.rain_rate ?? 0) > m) m = row.rain_rate
    }
    return niceMax(Math.max(m, 1))
  }, [weatherOverviewData])

  return (
    <>
      {/* Fixed legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300 mb-1 shrink-0">
        {values.map((value, i) => {
          const hidden = hiddenValues.has(String(value))
          return (
            <button
              key={String(value)}
              type="button"
              onClick={() => toggleValue(String(value))}
              className={`inline-flex items-center gap-1 cursor-pointer select-none transition-opacity ${hidden ? 'opacity-30' : 'opacity-100'}`}
            >
              <span
                className="inline-block w-3 h-3 border"
                style={{
                  backgroundColor: hidden ? 'transparent' : VARIANT_COLORS[i % VARIANT_COLORS.length],
                  borderColor: VARIANT_COLORS[i % VARIANT_COLORS.length],
                }}
              />
              {variantLabel(t, variableName, value)}
            </button>
          )
        })}
      </div>

      <div className="flex-[3] min-h-0 flex">
        {/* Left fixed column: vertical label + left y-axis */}
        <div className="flex shrink-0 h-full">
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              {t('charts.nh3_loss_pct')}
            </span>
          </div>
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overviewData}
                margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`left-${overviewMax}-${resolved}`}
                  yAxisId="left"
                  stroke={colors.axis}
                  tick={{ fontSize: 9, fill: colors.axis }}
                  domain={[0, overviewMax]}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  width={30}
                />
                <XAxis dataKey="dayLabel" hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Middle scrollable column */}
        <div ref={emissionScrollRef} onScroll={syncScroll('emission')} className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-full min-w-[600px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overviewData}
                margin={{ top: 10, right: 0, left: 0, bottom: 5 }}
                barCategoryGap="10%"
                barGap={2}
                syncId={syncIdRef.current}
                onClick={handleEmissionClick}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="dayLabel" stroke={colors.axis} tick={{ fontSize: 11, fill: colors.axis }} />
                <YAxis yAxisId="left" domain={[0, overviewMax]} hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, overviewMax]} hide />
                <Tooltip
                  trigger="hover"
                  content={
                    <EmissionTooltip
                      tanApp={tanApp}
                      forceHide={isTouch && !scrollTooltip}
                      colors={colors}
                      chartUnit={chartUnit}
                      eurPerKgN={eurPerKgN}
                      locale={locale}
                      kgUnitLabel={kgUnitLabel}
                    />
                  }
                  cursor={isTouch ? false : { fill: colors.cursorFill }}
                />
                {visibleValues.map((value) => {
                  const i = values.indexOf(value)
                  return (
                    <Bar
                      key={String(value)}
                      dataKey={valueToKey(value)}
                      name={variantLabel(t, variableName, value)}
                      yAxisId="left"
                      fill={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                      cursor="pointer"
                    />
                  )
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right fixed column: right y-axis + vertical label (secondary unit) */}
        <div className="flex shrink-0 h-full">
          <div style={{ width: chartUnit === 'eur' ? 44 : 36 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overviewData}
                margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`right-${overviewMax}-${tanApp}-${eurPerKgN}-${chartUnit}-${resolved}`}
                  yAxisId="right"
                  orientation="right"
                  stroke={colors.axis}
                  tick={{ fontSize: 9, fill: colors.axis }}
                  domain={[0, overviewMax]}
                  tickFormatter={(v: number) => {
                    if (chartUnit === 'kgha') return pctToKgPerHa(v, tanApp).toFixed(1)
                    return formatEur(pctToEurPerHa(v, tanApp, eurPerKgN), locale)
                  }}
                  width={chartUnit === 'eur' ? 44 : 36}
                />
                <XAxis dataKey="dayLabel" hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              {chartUnit === 'eur' ? t('charts.nh3_loss_eur') : t('charts.nh3_loss_kgha')}
            </span>
          </div>
        </div>
      </div>

      {/* Weather legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300 mt-2 mb-1 shrink-0">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#f97316' }} />
          {t('charts.avg_temp')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#22d3ee' }} />
          {t('charts.avg_wind')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#3b82f6' }} />
          {t('charts.avg_rain')}
        </span>
      </div>

      {/* Weather chart */}
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
                data={weatherOverviewData}
                margin={{ top: 5, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`left-w-${weatherLeftMax}-${resolved}`}
                  yAxisId="left"
                  stroke={colors.axis}
                  tick={{ fontSize: 9, fill: colors.axis }}
                  domain={[0, weatherLeftMax]}
                  width={30}
                />
                <XAxis dataKey="dayLabel" hide />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div ref={weatherScrollRef} onScroll={syncScroll('weather')} className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-full min-w-[600px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={weatherOverviewData}
                margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
                syncId={syncIdRef.current}
                onClick={handleWeatherClick}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis
                  dataKey="dayLabel"
                  stroke={colors.axis}
                  tick={{ fontSize: 11, fill: colors.axis }}
                  scale="band"
                />
                <YAxis yAxisId="left" domain={[0, weatherLeftMax]} hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, weatherRightMax]} hide />
                <Tooltip
                  trigger="hover"
                  content={<WeatherTooltip forceHide={isTouch && !scrollTooltip} colors={colors} />}
                  cursor={isTouch ? false : { fill: colors.cursorFill }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="air_temp_min"
                  stackId="temp"
                  stroke="#f97316"
                  strokeWidth={0.5}
                  strokeOpacity={0.3}
                  fill="transparent"
                  fillOpacity={0}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="air_temp_delta"
                  stackId="temp"
                  stroke="#f97316"
                  strokeWidth={0.5}
                  strokeOpacity={0.3}
                  fill="#f97316"
                  fillOpacity={0.07}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="air_temp"
                  name={t('charts.avg_temp')}
                  stroke="#f97316"
                  dot={false}
                  strokeWidth={2}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="wind_kmh_min"
                  stackId="wind"
                  stroke="#22d3ee"
                  strokeWidth={0.5}
                  strokeOpacity={0.3}
                  fill="transparent"
                  fillOpacity={0}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="wind_kmh_delta"
                  stackId="wind"
                  stroke="#22d3ee"
                  strokeWidth={0.5}
                  strokeOpacity={0.3}
                  fill="#22d3ee"
                  fillOpacity={0.07}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="wind_kmh"
                  name={t('charts.avg_wind')}
                  stroke="#22d3ee"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rain_rate"
                  name={t('charts.avg_rain')}
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex shrink-0 h-full">
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={weatherOverviewData}
                margin={{ top: 5, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`right-w-${weatherRightMax}-${resolved}`}
                  yAxisId="right"
                  orientation="right"
                  stroke={colors.axis}
                  tick={{ fontSize: 9, fill: colors.axis }}
                  domain={[0, weatherRightMax]}
                  width={30}
                />
                <XAxis dataKey="dayLabel" hide />
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

      {overviewData.length > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          {isTouch ? t('calculation.tip_tap') : t('calculation.tip_click')}
        </p>
      )}
    </>
  )
}
