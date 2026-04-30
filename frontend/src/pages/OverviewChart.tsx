import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '12px',
        color: '#e2e8f0',
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map((entry: any) => {
        const pct = entry.value as number
        const kg = (pct * tanApp) / 100
        return (
          <div key={entry.dataKey} style={{ color: entry.color, lineHeight: '1.4' }}>
            {entry.dataKey}: {pct.toFixed(2)}% ({kg.toFixed(2)} kg/ha)
          </div>
        )
      })}
    </div>
  )
}

interface OverviewChartProps {
  data: ApiResponse
  formData: FormData
  onDayClick: (day: number) => void
}

export default function OverviewChart({ data, formData, onDayClick }: OverviewChartProps) {
  const variantLabels = data.variant_labels

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
      <div className="flex-1 min-h-0 flex">
        <div className="flex items-center justify-center w-5 shrink-0">
          <span className="text-[10px] text-slate-400" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            NH3 loss (% of TAN)
          </span>
        </div>
        <div className="flex-1 min-w-0">
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
              <YAxis
                key={`left-${overviewMax}`}
                yAxisId="left"
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
                domain={[0, overviewMax]}
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
              />
              <Tooltip content={<EmissionTooltip tanApp={formData.tanApp} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
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
        <div className="flex items-center justify-center w-5 shrink-0">
          <span className="text-[10px] text-slate-400" style={{ writingMode: 'vertical-rl' }}>
            NH3 loss (kg/ha)
          </span>
        </div>
      </div>
      {overviewData.length > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          Click a day group to see hourly details.
        </p>
      )}
    </>
  )
}
