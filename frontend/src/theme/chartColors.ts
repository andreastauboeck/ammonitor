import type { ResolvedTheme } from './ThemeContext'

export interface ChartColors {
  axis: string         // axis line + tick text
  grid: string         // CartesianGrid stroke
  tooltipBg: string    // tooltip background
  tooltipBorder: string
  tooltipText: string
  cursorFill: string   // hover cursor highlight
  legend: string       // legend text
  axisLabel: string    // small vertical labels
}

export function getChartColors(theme: ResolvedTheme): ChartColors {
  if (theme === 'dark') {
    return {
      axis: '#94a3b8',          // slate-400
      grid: '#475569',          // slate-600
      tooltipBg: '#1e293b',     // slate-800
      tooltipBorder: '#475569', // slate-600
      tooltipText: '#e2e8f0',   // slate-200
      cursorFill: 'rgba(148, 163, 184, 0.1)',
      legend: '#cbd5e1',        // slate-300
      axisLabel: '#94a3b8',     // slate-400
    }
  }
  // light
  return {
    axis: '#475569',           // slate-600
    grid: '#cbd5e1',           // slate-300
    tooltipBg: '#ffffff',      // white
    tooltipBorder: '#cbd5e1',  // slate-300
    tooltipText: '#1e293b',    // slate-800
    cursorFill: 'rgba(71, 85, 105, 0.08)',
    legend: '#475569',         // slate-600
    axisLabel: '#64748b',      // slate-500
  }
}
