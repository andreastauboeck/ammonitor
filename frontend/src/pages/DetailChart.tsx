import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart,
  Line,
  Area,
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
  type ChartUnit,
  type FormData,
  type WeatherPoint,
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
import {
  CI_DELTA_SUFFIX,
  ciDeltaKey,
  lwrKey,
  valueToKey,
} from '../lib/rechartsKeys'
import { variantLabel } from '../lib/variantLabel'
import { useChartScroll } from '../lib/useChartScroll'
import { useTouchTooltip } from '../lib/useTouchTooltip'
import EmissionTooltip from './charts/EmissionTooltip'
import WeatherTooltip from './charts/WeatherTooltip'
import VariantLegend from './charts/VariantLegend'

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
  hiddenValues: Set<string>
  toggleValue: (value: string) => void
  /** Optional CI button handler. When provided, a stats-icon button is
   *  shown per variant in the legend. First click triggers a fetch + makes
   *  the band visible; subsequent clicks toggle visibility (no refetch). */
  onCiClick?: (value: string | number, day: number) => void
  /** Set of `${valueKey}:${day}` currently being fetched. */
  ciLoadingValues?: Set<string>
  /** Set of variant values whose CI band is currently visible. */
  ciVisibleValues?: Set<string>
}

function makeTimeIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DetailChart({
  data,
  day,
  formData,
  hiddenValues,
  toggleValue,
  onCiClick,
  ciLoadingValues,
  ciVisibleValues,
}: DetailChartProps) {
  const { t, i18n } = useTranslation()
  const { resolved } = useTheme()
  const colors = getChartColors(resolved)
  const { active: touchTooltipActive, touchStart, touchDismiss } = useTouchTooltip(4000)
  const { emissionRef, weatherRef, syncScroll, isTouch } = useChartScroll({ onScroll: () => touchDismiss() })
  const eurPerKgN = getEurPerKgN(formData)
  const chartUnit: ChartUnit = formData.chartUnit
  const tanApp = formData.tanApp
  const locale = i18n.language
  const kgUnitLabel = t('units.kg_per_ha')
  const tooltipTrigger: 'click' | 'hover' = isTouch ? 'click' : 'hover'

  const handleChartClick = (e: any) => {
    if (e && e.activeTooltipIndex != null) touchStart()
    else touchDismiss()
  }

  const dayData = data.days.find((d) => d.day === day)
  const variableName = data.variable
  const values = data.values
  const valueKeys = useMemo(() => values.map((v) => valueToKey(v)), [values])
  const visibleValues = useMemo(
    () => values.filter((v) => !hiddenValues.has(String(v))),
    [values, hiddenValues],
  )
  const visibleValueKeys = useMemo(
    () => visibleValues.map((v) => valueToKey(v)),
    [visibleValues],
  )
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
      const key = valueToKey(variant.value)

      let offset = 0
      if (isAppTimeVariable && variantOffsets) {
        const vo = variantOffsets.find((v) => valueToKey(v.value) === key)
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
        byKey[zeroKey][lwrKey(key)] = 0
        byKey[zeroKey][ciDeltaKey(key)] = 0
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
        if (p.er_lwr != null && p.er_upr != null) {
          const lwr = +(p.er_lwr * 100).toFixed(2)
          const upr = +(p.er_upr * 100).toFixed(2)
          byKey[k][lwrKey(key)] = lwr
          byKey[k][ciDeltaKey(key)] = +(upr - lwr).toFixed(2)
        }
      }
    }

    // Forward-fill CI bounds across "intermediate" rows (e.g. zero-hour
    // rows inserted by later-starting variants in app_time mode). Without
    // this, the stacked Area for an earlier variant breaks at every
    // intermediate row where it has no integer-hour data point.
    const sortedRows = Object.values(byKey).sort((a, b) => a.hour - b.hour)
    const variantsWithCi = dayData.variants.filter((v) =>
      v.hourly.some((p) => p.er_lwr != null),
    )
    for (const variant of variantsWithCi) {
      const ck = valueToKey(variant.value)
      // Determine the variant's hour range in chart coordinates so we
      // don't forward-fill past its actual last data point.
      let offset = 0
      if (isAppTimeVariable && variantOffsets) {
        const vo = variantOffsets.find((v) => valueToKey(v.value) === ck)
        offset = vo ? vo.offsetFromEarliest : 0
      }
      const firstHour = offset > 0 ? offset + 0.1 : 1
      const lastHour = variant.hourly.length > 0
        ? variant.hourly[variant.hourly.length - 1].hour + offset
        : 0
      let lastLwr: number | null = null
      let lastDelta: number | null = null
      for (const row of sortedRows) {
        const h = row.hour as number
        if (h < firstHour || h > lastHour) continue
        if (row[lwrKey(ck)] != null) {
          lastLwr = row[lwrKey(ck)] as number
          lastDelta = row[ciDeltaKey(ck)] as number
        } else {
          row[lwrKey(ck)] = lastLwr ?? 0
          row[ciDeltaKey(ck)] = lastDelta ?? 0
        }
      }
    }

    return sortedRows
  }, [dayData, weatherByTime, isAppTimeVariable, variantOffsets, earliestAppHour, t])

  const maxHour = useMemo(() => {
    if (!detailData.length) return 168
    return Math.max(168, (detailData as any[])[detailData.length - 1].hour)
  }, [detailData])

  const detailMax = useMemo(() => {
    let m = 0
    for (const row of detailData as any[]) {
      for (const k of visibleValueKeys) {
        const v = (row[k] ?? 0) as number
        const vLwr = (row[lwrKey(k)] ?? v) as number
        const vDelta = (row[ciDeltaKey(k)] ?? 0) as number
        const vUpr = vLwr + vDelta
        if (vUpr > m) m = vUpr
      }
    }
    return niceMax(m)
  }, [detailData, visibleValueKeys])

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

  const hasCiData = useMemo(() => {
    if (!dayData) return false
    return dayData.variants.some((v) => v.hourly.some((p) => p.er_lwr != null))
  }, [dayData])

  const ciByValue = useMemo(() => {
    const s = new Set<string>()
    if (!dayData) return s
    for (const v of dayData.variants) {
      if (v.hourly.some((p) => p.er_lwr != null)) s.add(String(v.value))
    }
    return s
  }, [dayData])

  const incorpMarkers: IncorpMarker[] = useMemo(() => {
    if (formData.incorpDepth === 'none') return []
    if (!detailData.length) return []

    if (variableName === 'incorp_time') {
      const markers: IncorpMarker[] = []
      values.forEach((value, i) => {
        if (hiddenValues.has(String(value))) return
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
      return values
        .map((value, i) => ({ value, i }))
        .filter(({ value }) => !hiddenValues.has(String(value)))
        .map(({ value, i }) => {
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
  }, [detailData, formData.incorpDepth, formData.incorpTime, variableName, values, isAppTimeVariable, variantOffsets, hiddenValues, t])

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

  /** Detail CI accessor: reads `${k}_lwr` + `${k}_ci_delta` from the row
   *  payload and returns absolute lwr/upr bounds. */
  const getCi = (entry: any) => {
    const row = entry?.payload
    if (!row) return null
    const lwr = row[lwrKey(entry.dataKey as string)]
    const delta = row[ciDeltaKey(entry.dataKey as string)]
    if (lwr == null || delta == null) return null
    return { lwr: lwr as number, upr: (lwr as number) + (delta as number) }
  }

  const isCiKey = (dk: string) => dk.endsWith('_lwr') || dk.endsWith(CI_DELTA_SUFFIX)

  if (!dayData) return null

  const ciControls = onCiClick
    ? {
        fetchedValues: ciByValue,
        visibleValues: ciVisibleValues ?? new Set<string>(),
        loadingValues: ciLoadingValues ?? new Set<string>(),
        onCiClick,
        day,
      }
    : undefined

  return (
    <>
      <VariantLegend
        values={values}
        variableName={variableName}
        hiddenValues={hiddenValues}
        toggleValue={toggleValue}
        swatch="line"
        ci={ciControls}
        showCiChip={hasCiData}
      />

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
                  tickFormatter={(v: number) => v.toFixed(0)}
                  width={30}
                />
                <XAxis dataKey="hour" hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div ref={emissionRef} onScroll={syncScroll('emission')} className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-full min-w-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={detailData}
                margin={{ top: 10, right: 0, left: 0, bottom: 5 }}
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
                      tanApp={tanApp}
                      labelFormatter={fmtLabel}
                      valueKeys={valueKeys}
                      forceHide={isTouch && !touchTooltipActive}
                      colors={colors}
                      chartUnit={chartUnit}
                      eurPerKgN={eurPerKgN}
                      locale={locale}
                      kgUnitLabel={kgUnitLabel}
                      getCi={getCi}
                      showExtraEntries
                      isCiKey={isCiKey}
                    />
                  }
                />
                {visibleValues.map((value) => {
                  const i = values.indexOf(value)
                  const k = valueToKey(value)
                  const color = VARIANT_COLORS[i % VARIANT_COLORS.length]
                  const ciVisible = ciVisibleValues?.has(String(value)) ?? false
                  const hasCi = ciVisible && detailData.some((r: any) => r[lwrKey(k)] != null)
                  return (
                    <Fragment key={k}>
                      {hasCi && (
                        <>
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey={lwrKey(k)}
                            stackId={`ci-${k}`}
                            stroke="none"
                            fill="transparent"
                            fillOpacity={0}
                            dot={false}
                            activeDot={false}
                            isAnimationActive={false}
                            connectNulls
                          />
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey={ciDeltaKey(k)}
                            stackId={`ci-${k}`}
                            stroke={color}
                            strokeWidth={0}
                            fill={color}
                            fillOpacity={0.12}
                            dot={false}
                            activeDot={false}
                            isAnimationActive={false}
                            connectNulls
                          />
                        </>
                      )}
                      <Line
                        type="monotone"
                        dataKey={k}
                        name={variantLabel(t, variableName, value)}
                        yAxisId="left"
                        stroke={color}
                        dot={false}
                        strokeWidth={2}
                        connectNulls
                        activeDot={isTouch ? (touchTooltipActive ? { r: 4, strokeWidth: 0 } : false) : undefined}
                      />
                    </Fragment>
                  )
                })}
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
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex shrink-0 h-full">
          <div style={{ width: chartUnit === 'eur' ? 44 : 36 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={detailData}
                margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`detail-right-${detailMax}-${tanApp}-${eurPerKgN}-${chartUnit}-${resolved}`}
                  yAxisId="right"
                  orientation="right"
                  stroke={colors.axis}
                  tick={{ fontSize: 9, fill: colors.axis }}
                  domain={[0, detailMax]}
                  tickFormatter={(v: number) => {
                    if (chartUnit === 'kgha') return pctToKgPerHa(v, tanApp).toFixed(1)
                    return formatEur(pctToEurPerHa(v, tanApp, eurPerKgN), locale)
                  }}
                  width={chartUnit === 'eur' ? 44 : 36}
                />
                <XAxis dataKey="hour" hide />
              </LineChart>
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

        <div ref={weatherRef} onScroll={syncScroll('weather')} className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-full min-w-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={detailData}
                margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
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
