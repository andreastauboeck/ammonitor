import { useMemo } from 'react'
import {
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
}

function EmissionTooltip({
  active,
  payload,
  label,
  tanApp,
  labelFormatter,
  variantLabels,
}: EmissionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

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
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '12px',
        color: '#e2e8f0',
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600 }}>{labelText}</div>
      {variantEntries.map((entry: any) => {
        const pct = entry.value as number
        const kg = (pct * tanApp) / 100
        return (
          <div key={entry.dataKey} style={{ color: entry.color, lineHeight: '1.4' }}>
            {entry.dataKey}: {pct.toFixed(2)}% ({kg.toFixed(2)} kg/ha)
          </div>
        )
      })}
      {otherEntries.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color, lineHeight: '1.4' }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  )
}

interface IncorpMarker {
  hour: number
  info: { mode: string; time_h: number }
}

interface DetailChartProps {
  data: ApiResponse
  day: number
  formData: FormData
}

export default function DetailChart({ data, day, formData }: DetailChartProps) {
  const scenario = data.scenarios.find((s) => s.day === day)
  const variantLabels = data.variant_labels

  const weatherByTime = useMemo(() => {
    const m = new Map<string, WeatherPoint>()
    if (!data?.weather) return m
    for (const w of data.weather) m.set(w.time_iso, w)
    return m
  }, [data])

  const detailData = useMemo(() => {
    if (!scenario) return []
    const startMs = new Date(scenario.start).getTime()

    const byHour: Record<number, Record<string, any>> = {}
    for (const label of variantLabels) {
      const t = scenario.variants[label]
      if (!t) continue
      for (const p of t.hourly) {
        if (!byHour[p.hour]) {
          const tsMs = startMs + p.hour * 3600 * 1000
          const d = new Date(tsMs)
          const pad = (n: number) => String(n).padStart(2, '0')
          const timeIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          const w = weatherByTime.get(timeIso)
          byHour[p.hour] = {
            hour: p.hour,
            label: formatTimeAxis(p.hour),
            air_temp: w ? +w.air_temp.toFixed(1) : null,
            wind_kmh: w ? +(w.wind_speed * 3.6).toFixed(1) : null,
            rain_rate: w ? +w.rain_rate.toFixed(2) : 0,
          }
        }
        byHour[p.hour][label] = +(p.er * 100).toFixed(2)
      }
    }
    return Object.values(byHour).sort((a, b) => a.hour - b.hour)
  }, [scenario, variantLabels, weatherByTime])

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

  const incorpMarker: IncorpMarker | null = useMemo(() => {
    if (formData.incorp === 'none') return null
    const targetHour = Math.max(1, Math.ceil(formData.incorpTime))
    const row = (detailData as any[]).find((r) => r.hour === targetHour)
    if (!row) return null
    return {
      hour: targetHour,
      info: { mode: formData.incorp, time_h: formData.incorpTime },
    }
  }, [detailData, formData.incorp, formData.incorpTime])

  const fmtLabel = (l: any) =>
    typeof l === 'number' ? formatTimeAxis(l) : String(l)

  if (!scenario) return null

  return (
    <>
      <div className="flex-[3] min-h-0 flex">
        <div className="flex items-center justify-center w-5 shrink-0">
          <span className="text-[10px] text-slate-400 writing-mode-vertical" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            NH3 loss (% of TAN)
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={detailData}
              margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis
                dataKey="hour"
                type="number"
                scale="log"
                domain={[1, 168]}
                ticks={[1, 2, 4, 8, 24, 48, 96, 168]}
                tickFormatter={(h: number) => formatTimeAxis(h)}
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                key={`detail-left-${detailMax}`}
                yAxisId="left"
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
                domain={[0, detailMax]}
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
              />
              <Tooltip
                content={
                  <EmissionTooltip
                    tanApp={formData.tanApp}
                    labelFormatter={fmtLabel}
                    variantLabels={variantLabels}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {variantLabels.map((label, i) => (
                <Line
                  key={label}
                  type="monotone"
                  dataKey={label}
                  yAxisId="left"
                  stroke={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
              {incorpMarker && (
                <ReferenceLine
                  yAxisId="left"
                  x={incorpMarker.hour}
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
        <div className="flex items-center justify-center w-5 shrink-0">
          <span className="text-[10px] text-slate-400" style={{ writingMode: 'vertical-rl' }}>
            NH3 loss (kg/ha)
          </span>
        </div>
      </div>

      <div className="flex-[2] min-h-0 mt-2 flex">
        <div className="flex items-center justify-center w-5 shrink-0">
          <span className="text-[10px] text-slate-400" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            Temp (°C) / Wind (km/h)
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={detailData}
              margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis
                dataKey="hour"
                type="number"
                scale="log"
                domain={[1, 168]}
                ticks={[1, 2, 4, 8, 24, 48, 96, 168]}
                tickFormatter={(h: number) => formatTimeAxis(h)}
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                yAxisId="left"
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#e2e8f0' }}
                labelFormatter={fmtLabel}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="rain_rate"
                name="Rain (mm/h)"
                stroke="#3b82f6"
                dot={false}
                strokeWidth={2}
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
                  x={incorpMarker.hour}
                  stroke="#fbbf24"
                  strokeDasharray="4 2"
                  strokeWidth={2}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center w-5 shrink-0">
          <span className="text-[10px] text-slate-400" style={{ writingMode: 'vertical-rl' }}>
            Rain (mm/h)
          </span>
        </div>
      </div>
    </>
  )
}
