import { useTranslation } from 'react-i18next'
import type { ChartUnit } from '../pages/types'

interface UnitToggleProps {
  value: ChartUnit
  onChange: (next: ChartUnit) => void
}

const ORDER: ChartUnit[] = ['kgha', 'eur']

const I18N_KEY: Record<ChartUnit, string> = {
  kgha: 'units.kg_per_ha',
  eur: 'units.eur_per_ha',
}

export default function UnitToggle({ value, onChange }: UnitToggleProps) {
  const { t } = useTranslation()
  return (
    <div className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
      <span className="hidden sm:inline mr-1">{t('costs.show_as')}:</span>
      <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
        {ORDER.map((u) => {
          const active = u === value
          return (
            <button
              key={u}
              type="button"
              onClick={() => onChange(u)}
              aria-pressed={active}
              className={
                'px-2 py-1 transition-colors ' +
                (active
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600')
              }
            >
              {t(I18N_KEY[u])}
            </button>
          )
        })}
      </div>
    </div>
  )
}