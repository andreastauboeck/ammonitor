import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  ErrorBar,
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
  VARIANT_COLORS,
  niceMax,
} from './types'
import { useTheme } from '../theme/ThemeContext'
import { getChartColors } from '../theme/chartColors'
import {
  formatEur,
  getEurPerKgN,
  pctToEurPerHa,
  pctToKgPerHa,
} from '../lib/costs'
import { ciKey, valueToKey } from '../lib/rechartsKeys'
import { variantLabel } from '../lib/variantLabel'
import { useIsTouch } from '../lib/useIsTouch'
import EmissionTooltip from './charts/EmissionTooltip'
import WeatherTooltip from './charts/WeatherTooltip'
import VariantLegend from './charts/VariantLegend'

interface OverviewChartProps {
  data: ApiResponse
  formData: FormData
  onDayClick: (day: number) => void
  hiddenValues: Set<string>
  toggleValue: (value: string) => void
  /** Set of variant values whose CI band is currently visible. Only
   *  variants in this set will get ErrorBar overlays on their bars. */
  ciVisibleValues?: Set<string>
}

export default function OverviewChart({
  data,
  formData,
  onDayClick,
  hiddenValues,
  toggleValue,
  ciVisibleValues,
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

  const valueKeys = useMemo(() => values.map((v) => valueToKey(v)), [values])

  useEffect(() => {
    return () => {
      if (scrollDismissRef.current) clearTimeout(scrollDismissRef.current)
    }
  }, [])

  const hasCiData = useMemo(() => {
    if (!ciVisibleValues || ciVisibleValues.size === 0) return false
    return data.days.some((d) =>
      d.variants.some(
        (v) => ciVisibleValues.has(String(v.value)) && v.final_loss_lwr != null,
      ),
    )
  }, [data, ciVisibleValues])

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
        const key = valueToKey(v.value)
        row[key] = v.final_loss_pct
        if (v.final_loss_lwr != null && v.final_loss_upr != null) {
          row[ciKey(key)] = [
            +(v.final_loss_pct - v.final_loss_lwr).toFixed(2),
            +(v.final_loss_upr - v.final_loss_pct).toFixed(2),
          ]
        }
      }
      return row
    })
  }, [data, i18n.language])

  const overviewMax = useMemo(() => {
    let m = 0
    for (const row of overviewData) {
      for (const v of visibleValues) {
        const key = valueToKey(v)
        const cell = row[key] ?? 0
        const ci = row[ciKey(key)]
        const upr = ci ? cell + ci[1] : cell
        if (upr > m) m = upr
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

  const handleWeatherClick = (e: any) => {
    if (e && typeof e.activeTooltipIndex === 'number') {
      const row = weatherOverviewData[e.activeTooltipIndex]
      if (row) onDayClick(row.day)
    }
  }

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

  const weatherDayTicks = useMemo(
    () => weatherOverviewData.map((row) => row.day),
    [weatherOverviewData],
  )

  const weatherDayLabel = (dayValue: number) => {
    const row = weatherOverviewData.find((d) => d.day === dayValue)
    return row?.dayLabel ?? String(dayValue)
  }

  /** Overview CI accessor: reads `${k}_ci` (ErrorBar delta tuple) and
   *  reconstructs absolute bounds from the variant's own value. */
  const getCi = (entry: any) => {
    // Recharts passes the variant payload; we look up the matching `_ci`
    // entry in the same tooltip payload via the shared row data.
    // The simpler approach: find from row directly using the entry's
    // dataKey, but the tooltip doesn't expose the row — we rely on
    // valueKeys + payload entries. Since Overview adds `${k}_ci` as a
    // hidden series only on ErrorBar, those entries do appear in the
    // payload. We map them via dataKey suffix.
    const ciEntry = (entry?.payload ?? {})[ciKey(entry.dataKey as string)]
    if (!ciEntry || !Array.isArray(ciEntry)) return null
    const pct = entry.value as number
    return { lwr: pct - ciEntry[0], upr: pct + ciEntry[1] }
  }

  return (
    <>
      <VariantLegend
        values={values}
        variableName={variableName}
        hiddenValues={hiddenValues}
        toggleValue={toggleValue}
        swatch="bar"
        showCiChip={hasCiData}
      />

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
                      valueKeys={valueKeys}
                      getCi={getCi}
                    />
                  }
                  cursor={isTouch ? false : { fill: colors.cursorFill }}
                />
                {visibleValues.map((value) => {
                  const i = values.indexOf(value)
                  const k = valueToKey(value)
                  const color = VARIANT_COLORS[i % VARIANT_COLORS.length]
                  const ciVisible = ciVisibleValues?.has(String(value)) ?? false
                  const hasCi = ciVisible && overviewData.some((r: any) => r[ciKey(k)] != null)
                  return (
                    <Bar
                      key={String(value)}
                      dataKey={k}
                      name={variantLabel(t, variableName, value)}
                      yAxisId="left"
                      fill={color}
                      cursor="pointer"
                    >
                      {hasCi && (
                        <ErrorBar
                          dataKey={ciKey(k)}
                          width={4}
                          strokeWidth={1}
                          stroke={colors.errorBar}
                        />
                      )}
                    </Bar>
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
                  dataKey="day"
                  type="number"
                  domain={[-0.5, Math.max(weatherOverviewData.length - 0.5, 0.5)]}
                  ticks={weatherDayTicks}
                  tickFormatter={weatherDayLabel}
                  stroke={colors.axis}
                  tick={{ fontSize: 11, fill: colors.axis }}
                />
                <YAxis yAxisId="left" domain={[0, weatherLeftMax]} hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, weatherRightMax]} hide />
                <Tooltip
                  trigger="hover"
                  content={
                    <WeatherTooltip
                      forceHide={isTouch && !scrollTooltip}
                      colors={colors}
                      filterKeys={['air_temp', 'wind_kmh', 'rain_rate']}
                      labelFormatter={(l) => weatherDayLabel(Number(l))}
                    />
                  }
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
