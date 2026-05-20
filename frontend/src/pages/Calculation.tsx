import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  type FertilizerId,
  FERTILIZER_PRESETS,
  FERTILIZER_PRICES_DATE,
  formatDayLabel,
  type FormData,
  TAN_PRESETS,
  type VariableName,
  VARIANT_DEFS,
} from './types'
import OverviewChart from './OverviewChart'
import DetailChart from './DetailChart'
import SettingsMenu from '../components/SettingsMenu'
import SiteIcon from '../components/SiteIcon'
import ShareButton from '../components/ShareButton'
import UnitToggle from '../components/UnitToggle'
import CostSummaryCard from '../components/CostSummaryCard'
import { useHiddenValues } from '../lib/useHiddenValues'
import { useCalculation } from '../lib/useCalculation'
import { useCiFetcher } from '../lib/useCiFetcher'
import { useReverseGeocode } from '../lib/useReverseGeocode'
import { variantLabel } from '../lib/variantLabel'
import { deserializeForm, useFormUrlSync } from '../lib/formUrlSync'
import { applyFixedChange, applyVariableChange } from '../lib/formCascade'

const VARIABLE_OPTIONS_BEFORE_INCORP: VariableName[] = [
  'app_mthd',
  'app_time',
  'man_dm',
]
const VARIABLE_OPTIONS_AFTER_INCORP: VariableName[] = ['man_source', 'man_ph']

const VARIABLE_FORM_KEY: Record<VariableName, keyof FormData> = {
  app_mthd: 'appMthd',
  app_time: 'appTime',
  man_dm: 'manDm',
  man_ph: 'manPh',
  man_source: 'manSource',
  incorp_depth: 'incorpDepth',
  incorp_time: 'incorpTime',
}

function DayNavButton({ direction, disabled, onClick }: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 ${direction === 'prev' ? 'mr-2' : 'ml-2'} rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors`}
      aria-label={direction === 'prev' ? 'Previous day' : 'Next day'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        {direction === 'prev' ? (
          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
        ) : (
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        )}
      </svg>
    </button>
  )
}

export default function Calculation() {
  const { t, i18n } = useTranslation()
  const { lat, lng, day } = useParams<{ lat: string; lng: string; day: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDay = day ? parseInt(day, 10) : null

  const [alfam2Info, setAlfam2Info] = useState<{ version: string; parsSet: string } | null>(null)

  const [formData, setFormData] = useState<FormData>(() => deserializeForm(searchParams))
  const [showRadioHint, setShowRadioHint] = useState(false)
  const [showFarmSize, setShowFarmSize] = useState<boolean>(() => !!formData.farmSizeHa)

  // Sync URL search params with formData.
  useFormUrlSync(formData, setSearchParams)

  // Location name + main calculation + CI fetch — all extracted into hooks.
  const { locationName, locationLoading } = useReverseGeocode(lat, lng)
  const { data, setData, loading, error } = useCalculation({ lat, lng, formData })
  const { ciLoadingValues, ciVisibleValues, handleCiClick } = useCiFetcher({
    data,
    setData,
    lat,
    lng,
    formData,
  })

  // Shared hidden-variant state for the chart legend and cost summary.
  const { hiddenValues, toggleValue } = useHiddenValues(
    data?.variable ?? formData.variable,
    data?.values ?? [],
  )

  // Logo expansion: on hover (desktop) or when scrolled to top (touch devices).
  const [iconHover, setIconHover] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [hasScrollbar, setHasScrollbar] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => {
      setAtTop(window.scrollY <= 4)
      setHasScrollbar(document.documentElement.scrollHeight > window.innerHeight + 4)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [data, loading, selectedDay, formData.variable, showFarmSize])

  const iconExpanded = iconHover || !hasScrollbar || atTop

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/status', { signal: controller.signal })
      .then((res) => res.json())
      .then((d) => {
        if (d.alfam2_version)
          setAlfam2Info({ version: d.alfam2_version, parsSet: d.alfam2_pars_set })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [])

  const handleFixedChange = useCallback(
    <K extends keyof FormData>(name: K, value: FormData[K]) => {
      setFormData((prev) => applyFixedChange(prev, name, value))
    },
    [],
  )

  const handleVariableChange = useCallback((variable: VariableName) => {
    setFormData((prev) => applyVariableChange(prev, variable))
  }, [])

  const handleDayClick = useCallback(
    (d: number) => {
      navigate(`/calculate/${lat}/${lng}/${d}`)
    },
    [navigate, lat, lng],
  )

  const selectedDayData =
    selectedDay !== null && data
      ? data.days.find((d) => d.day === selectedDay)
      : null

  // Build a readable subject for sharing: "Vienna" for overview,
  // "Vienna — Apr 28" for detail.
  const shareSubject = (() => {
    const loc =
      locationName ??
      (lat && lng ? `${parseFloat(lat).toFixed(2)}, ${parseFloat(lng).toFixed(2)}` : null)
    if (!loc) return null
    if (selectedDayData) {
      return `${loc} — ${formatDayLabel(selectedDayData.start, i18n.language)}`
    }
    return loc
  })()

  const renderInput = (
    variable: VariableName,
    currentValue: any,
    onChange: (value: any) => void,
  ) => {
    const defs = VARIANT_DEFS[variable]
    const isDisabled = formData.variable === variable
    const isNumeric =
      variable === 'man_dm' ||
      variable === 'man_ph' ||
      variable === 'incorp_time' ||
      variable === 'app_time'

    return (
      <select
        value={String(currentValue ?? '')}
        onChange={(e) => {
          const v = e.target.value
          if (isNumeric) onChange(parseFloat(v))
          else onChange(v)
        }}
        disabled={isDisabled}
        className={`w-full px-2 py-1.5 text-sm rounded-lg border focus:outline-none focus:border-indigo-500 ${
          isDisabled
            ? 'bg-slate-100 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100'
        }`}
      >
        {defs.map((d) => (
          <option key={String(d.value)} value={String(d.value)}>
            {variantLabel(t, variable, d.value, d)}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className={`sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 transition-[padding] duration-200 ease-out ${iconExpanded ? 'py-3' : 'py-1'}`}>
        <div className="flex items-center gap-2">
          {selectedDay !== null ? (
            <button
              onClick={() => navigate(`/calculate/${lat}/${lng}`)}
              className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('calculation.back_to_overview')}
            </button>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('calculation.back_to_map')}
            </Link>
          )}
          <Link
            to="/"
            className="flex-1 text-center"
            aria-label="ammonitor"
            onMouseEnter={() => setIconHover(true)}
            onMouseLeave={() => setIconHover(false)}
            onFocus={() => setIconHover(true)}
            onBlur={() => setIconHover(false)}
            onClick={(e) => {
              if (window.scrollY > 4) {
                e.preventDefault()
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }}
          >
            <span className="inline-flex items-center gap-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              <SiteIcon expanded={iconExpanded} />
              <span className="hidden sm:inline font-semibold text-sm">ammonitor</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <ShareButton subject={shareSubject} />
            <SettingsMenu />
          </div>
        </div>
      </div>
      <div className="p-4 md:p-6">
        <div className="mb-4 md:mb-6">
          {locationLoading ? (
            <p className="text-slate-500 dark:text-slate-400">{t('calculation.loading_location')}</p>
          ) : locationName ? (
            <p className="text-2xl font-bold flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {locationName}
            </p>
          ) : (
            <p className="text-2xl font-bold">{lat}, {lng}</p>
          )}
        </div>

        <div className={`flex flex-col lg:grid lg:gap-6 items-stretch lg:min-h-[470px] ${iconExpanded ? 'lg:grid-cols-[18rem_minmax(0,1fr)_16rem] lg:h-[calc(100vh-11rem)]' : 'lg:grid-cols-[18rem_minmax(0,1fr)_16rem] lg:h-[calc(100vh-10rem)]'}`}>
          {/* Form panel — fixed width on lg+, full width below */}
          <div className={`w-full lg:w-auto lg:shrink-0 lg:min-h-0 lg:overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-200 dark:border-slate-700 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold">{t('calculation.parameters')}</h2>
              <div className="ml-auto relative">
                <button
                  type="button"
                  onClick={() => setShowRadioHint((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  aria-label="Radio button info"
                >
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border-2 border-current">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  </span>
                  = {t('calculation.compare')}
                </button>
                {showRadioHint && (
                  <div
                    className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 whitespace-normal max-w-[16rem] shadow-lg"
                    onClick={() => setShowRadioHint(false)}
                  >
                    {t('calculation.compare_hint')}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
              {/* TAN applied */}
              <div className="flex items-center gap-2">
                <div className="w-4" />
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{t('calculation.tan_applied')}</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={formData.tanApp}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, tanApp: parseFloat(e.target.value) }))
                      }
                      className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      {TAN_PRESETS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-500">{t('units.kg_per_ha')}</span>
                  </div>
                </div>
              </div>

              {/* Variable inputs with radio buttons */}
              {[VARIABLE_OPTIONS_BEFORE_INCORP, VARIABLE_OPTIONS_AFTER_INCORP].map((group, gi) => (
                <React.Fragment key={gi}>
                  {group.map((variable) => {
                    const isVariable = formData.variable === variable
                    const formKey = VARIABLE_FORM_KEY[variable]
                    const currentValue = formData[formKey]
                    const onChange = (v: any) => handleFixedChange(formKey, v)

                    return (
                      <div key={variable} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="variable"
                          checked={isVariable}
                          onChange={() => handleVariableChange(variable)}
                          className="shrink-0 accent-emerald-400"
                        />
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                            {t(`variables.${variable}`)}
                            {isVariable && (
                              <span className="ml-1 text-emerald-600 dark:text-emerald-400">{t('calculation.varied')}</span>
                            )}
                          </label>
                          {renderInput(variable, currentValue, onChange)}
                        </div>
                      </div>
                    )
                  })}
                  {gi === 0 && (
                    <div className="col-span-2 md:col-span-1 rounded-lg border border-slate-300 dark:border-slate-600 p-2">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">{t('calculation.incorporation')}</div>
                      <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                        {(['incorp_depth', 'incorp_time'] as const).map((variable) => {
                          const isVariable = formData.variable === variable
                          const formKey = VARIABLE_FORM_KEY[variable]
                          const currentValue = formData[formKey]
                          const onChange = (v: any) => handleFixedChange(formKey, v)

                          return (
                            <div key={variable} className="flex items-center gap-1">
                              <input
                                type="radio"
                                name="variable"
                                checked={isVariable}
                                onChange={() => handleVariableChange(variable)}
                                className="shrink-0 accent-emerald-400"
                              />
                              <div className="flex-1 min-w-0">
                                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                  {variable === 'incorp_depth' ? t('calculation.depth') : t('calculation.time')}
                                  {isVariable && (
                                    <span className="ml-1 text-emerald-600 dark:text-emerald-400">{t('calculation.varied')}</span>
                                  )}
                                </label>
                                {renderInput(variable, currentValue, onChange)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Chart panel — grows to fill available space */}
          <div className="w-full min-w-0 lg:min-h-0 bg-slate-50 dark:bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-200 dark:border-slate-700 flex flex-col">
            {/* Up-arrow back-to-overview, only in detail view */}
            {selectedDay !== null && (
              <div className="flex justify-center mb-1">
                <button
                  onClick={() => navigate(`/calculate/${lat}/${lng}`)}
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label={t('calculation.back_to_overview')}
                  title={t('calculation.back_to_overview')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832l-3.71 3.938a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
                  </svg>
                  {t('calculation.back_to_overview')}
                </button>
              </div>
            )}

            <div className="flex items-center mb-1">
              {selectedDay !== null && (
                <DayNavButton
                  direction="prev"
                  onClick={() => navigate(`/calculate/${lat}/${lng}/${Math.max(0, selectedDay - 1)}`, { replace: true })}
                  disabled={selectedDay <= 0}
                />
              )}
              <h2 className="text-lg font-semibold flex-1 text-center">
                {selectedDay === null
                  ? t('calculation.overview_title', { variable: t(`variables.${formData.variable}`) })
                  : t('calculation.detail_title', {
                      date: selectedDayData ? formatDayLabel(selectedDayData.start, i18n.language) : '',
                      variable: t(`variables.${formData.variable}`),
                    })}
              </h2>
              {selectedDay !== null && (
                <DayNavButton
                  direction="next"
                  onClick={() => navigate(`/calculate/${lat}/${lng}/${Math.min((data?.days.length ?? 1) - 1, selectedDay + 1)}`, { replace: true })}
                  disabled={!data || selectedDay >= data.days.length - 1}
                />
              )}
            </div>
            {alfam2Info && (
              <p className="text-[9px] text-slate-400 dark:text-slate-600 text-center mb-2">
                ALFAM2 v{alfam2Info.version} · {t('calculation.pars_set', { parsSet: alfam2Info.parsSet })}
              </p>
            )}

            <div className="flex justify-end mb-2">
              <UnitToggle
                value={formData.chartUnit}
                onChange={(u) => setFormData((prev) => ({ ...prev, chartUnit: u }))}
              />
            </div>

            {error && (
              <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {t('common.error')}: {error}
              </div>
            )}

            <div className="relative flex-1 min-h-[280px] h-[60vh] md:h-[calc(100vh-17rem)] lg:h-auto flex flex-col">
              {loading && !data && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 dark:border-t-emerald-400 animate-spin" />
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{t('calculation.calculating')}</span>
                  </div>
                </div>
              )}
              {loading && data && (
                <div className="absolute inset-0 z-20 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 dark:border-t-emerald-400 animate-spin" />
                  </div>
                </div>
              )}
              {data && selectedDay === null && (
                <OverviewChart
                  data={data}
                  formData={formData}
                  onDayClick={handleDayClick}
                  hiddenValues={hiddenValues}
                  toggleValue={toggleValue}
                  ciVisibleValues={ciVisibleValues}
                />
              )}
              {data && selectedDay !== null && (
                <DetailChart
                  data={data}
                  day={selectedDay}
                  formData={formData}
                  hiddenValues={hiddenValues}
                  toggleValue={toggleValue}
                  onCiClick={handleCiClick}
                  ciLoadingValues={ciLoadingValues}
                  ciVisibleValues={ciVisibleValues}
                />
              )}
            </div>
          </div>

          {/* Cost panel — basis inputs + summary; fixed width on lg+, stacks below chart on smaller screens */}
          <div className="w-full lg:w-auto lg:shrink-0 lg:min-h-0 lg:overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-200 dark:border-slate-700 flex flex-col gap-4">
            {/* Cost basis inputs */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-2">
                {t('costs.basis_title')}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <div>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <label className="block text-xs text-slate-600 dark:text-slate-400">
                      {t('fertilizers.label')}
                    </label>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {t('costs.prices_as_of', { date: FERTILIZER_PRICES_DATE })}
                    </span>
                  </div>
                  <select
                    value={formData.fertilizer}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        fertilizer: e.target.value as FertilizerId,
                      }))
                    }
                    className="w-full px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {(Object.keys(FERTILIZER_PRESETS) as FertilizerId[]).map((id) => (
                      <option key={id} value={id}>
                        {t(`fertilizers.${id}`)}
                        {id !== 'custom'
                          ? ` (${FERTILIZER_PRESETS[id].eurPerKgN.toFixed(2)} ${t('units.eur_per_kg_n')})`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {formData.fertilizer === 'custom' && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.customEurPerKgN}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          if (!isNaN(v) && v > 0) {
                            setFormData((prev) => ({ ...prev, customEurPerKgN: v }))
                          }
                        }}
                        className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs text-slate-500">{t('units.eur_per_kg_n')}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFarmSize}
                      onChange={(e) => {
                        const next = e.target.checked
                        setShowFarmSize(next)
                        if (!next) {
                          setFormData((prev) => ({ ...prev, farmSizeHa: undefined }))
                        } else if (!formData.farmSizeHa) {
                          setFormData((prev) => ({ ...prev, farmSizeHa: 100 }))
                        }
                      }}
                      className="accent-emerald-400"
                    />
                    {t('costs.calc_annual')}
                  </label>
                  {showFarmSize && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={formData.farmSizeHa ?? ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          setFormData((prev) => ({
                            ...prev,
                            farmSizeHa: !isNaN(v) && v > 0 ? v : undefined,
                          }))
                        }}
                        className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                        placeholder={t('costs.farm_size')}
                      />
                      <span className="text-xs text-slate-500">{t('units.ha')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cost summary */}
            {data && (
              <CostSummaryCard
                data={data}
                formData={formData}
                hiddenValues={hiddenValues}
                selectedDay={selectedDay}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
