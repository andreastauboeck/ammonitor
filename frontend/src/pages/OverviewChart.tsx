import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  type ApiResponse,
  type FormData,
  VARIANT_COLORS,
  niceMax,
} from './types'

interface EmissionTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  tanApp: number
}

function EmissionTooltip({ active, payload, label, tanApp }: EmissionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
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
      <div style={{ fontWeight: 600 }}>{label}</div>
      {payload.map((entry: any) => {
        const pct = entry.value as number
        const kg = (pct * tanApp) / 100
        return (
          <div key={entry.dataKey} style={{ color: entry.color }}>
            {entry.dataKey}: {pct.toFixed(1)}% ({kg.toFixed(1)} kg/ha)
          </div>
        )
      })}
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
}

export default function OverviewChart({ data, formData, onDayClick }: OverviewChartProps) {
  const variantLabels = data.variant_labels
  const isTouch = useIsTouch()

  const overviewData = useMemo(() => {
    return data.days.map((d) => {
      const row: Record<string, any> = {
        day: d.day,
        dayLabel: new Date(d.start).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        start: d.start,
      }
      for (const label of variantLabels) {
        row[label] = d.variants[label]?.final_loss_pct ?? 0
      }
      return row
    })
  }, [data, variantLabels])

  const overviewMax = useMemo(() => {
    let m = 0
    for (const row of overviewData) {
      for (const label of variantLabels) {
        const v = row[label] ?? 0
        if (v > m) m = v
      }
    }
    return niceMax(m)
  }, [overviewData, variantLabels])

  return (
    <>
      {/* Fixed legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-300 mb-1 shrink-0">
        {variantLabels.map((label, i) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-3 h-3"
              style={{ backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
            />
            {label}
          </span>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Left fixed column: vertical label + left y-axis */}
        <div className="flex shrink-0 h-full">
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              NH3 loss (% of TAN)
            </span>
          </div>
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overviewData}
                margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`left-${overviewMax}`}
                  yAxisId="left"
                  stroke="#94a3b8"
                  tick={{ fontSize: 9 }}
                  domain={[0, overviewMax]}
                  width={30}
                />
                <XAxis dataKey="dayLabel" hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Middle scrollable column */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-full min-w-[334px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overviewData}
                margin={{ top: 10, right: 0, left: 0, bottom: 5 }}
                barCategoryGap="10%"
                barGap={2}
                onClick={(e: any) => {
                  if (e && typeof e.activeTooltipIndex === 'number') {
                    const row = overviewData[e.activeTooltipIndex]
                    if (row) onDayClick(row.day)
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="dayLabel" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" domain={[0, overviewMax]} hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, overviewMax]} hide />
                <Tooltip
                  content={isTouch ? <></> : <EmissionTooltip tanApp={formData.tanApp} />}
                  cursor={isTouch ? false : { fill: 'rgba(148, 163, 184, 0.1)' }}
                />
                {variantLabels.map((label, i) => (
                  <Bar
                    key={label}
                    dataKey={label}
                    yAxisId="left"
                    fill={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                    cursor="pointer"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right fixed column: right y-axis + vertical label */}
        <div className="flex shrink-0 h-full">
          <div style={{ width: 30 }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overviewData}
                margin={{ top: 10, right: 0, left: 0, bottom: 30 }}
              >
                <YAxis
                  key={`right-${overviewMax}-${formData.tanApp}`}
                  yAxisId="right"
                  orientation="right"
                  stroke="#94a3b8"
                  tick={{ fontSize: 9 }}
                  domain={[0, overviewMax]}
                  tickFormatter={(v: number) =>
                    ((v * formData.tanApp) / 100).toFixed(1)
                  }
                  width={30}
                />
                <XAxis dataKey="dayLabel" hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center w-3">
            <span className="text-[9px] text-slate-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              NH3 loss (kg/ha)
            </span>
          </div>
        </div>
      </div>
      {overviewData.length > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          {isTouch ? 'Tap' : 'Click'} a day group to see hourly details.
        </p>
      )}
    </>
  )
}
