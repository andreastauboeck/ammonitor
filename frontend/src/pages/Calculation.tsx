import React, {useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Link, useNavigate, useParams, useSearchParams} from 'react-router-dom'
import {
  type ApiResponse,
  DEFAULT_FORM_DATA,
  type FertilizerId,
  FERTILIZER_PRESETS,
  FERTILIZER_PRICES_DATE,
  formatDayLabel,
  type FormData,
  TAN_PRESETS,
  type VariableName,
  VARIANT_DEFS,
  type VariantDef,
} from './types'
import OverviewChart from './OverviewChart'
import DetailChart from './DetailChart'
import SettingsMenu from '../components/SettingsMenu'
import SiteIcon from '../components/SiteIcon'
import ShareButton from '../components/ShareButton'
import UnitToggle from '../components/UnitToggle'
import CostSummaryCard from '../components/CostSummaryCard'
import {useHiddenValues} from '../lib/useHiddenValues'

const VARIABLE_OPTIONS_BEFORE_INCORP: VariableName[] = [
  'app_mthd', 'app_time', 'man_dm',
]
const VARIABLE_OPTIONS_AFTER_INCORP: VariableName[] = [
  'man_source', 'man_ph',
]

const ALL_VARIABLES: VariableName[] = [
  'app_mthd', 'app_time', 'man_dm', 'man_ph',
  'incorp_depth', 'incorp_time', 'man_source',
]

const FERT_IDS: FertilizerId[] = ['can', 'urea', 'uan', 'ssa', 'custom']

function serializeForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {
    variable: formData.variable,
    tanApp: String(formData.tanApp),
    appMthd: formData.appMthd,
    manDm: String(formData.manDm),
    manPh: String(formData.manPh),
    manSource: formData.manSource,
    appTime: String(formData.appTime),
    incorpTime: String(formData.incorpTime),
    incorpDepth: formData.incorpDepth,
    fert: formData.fertilizer,
    unit: formData.chartUnit,
  }
  if (formData.fertilizer === 'custom') {
    out.eurkgn = String(formData.customEurPerKgN)
  }
  if (formData.farmSizeHa && formData.farmSizeHa > 0) {
    out.farmha = String(formData.farmSizeHa)
  }
  return out
}

function deserializeForm(params: URLSearchParams): FormData {
  const d = { ...DEFAULT_FORM_DATA }
  if (params.has('variable') && ALL_VARIABLES.includes(params.get('variable') as VariableName))
    d.variable = params.get('variable') as VariableName
  if (params.has('tanApp')) d.tanApp = parseFloat(params.get('tanApp')!) || 60
  if (params.has('appMthd') && ['bc', 'th', 'ts', 'os', 'cs'].includes(params.get('appMthd')!))
    d.appMthd = params.get('appMthd')!
  if (params.has('manDm')) d.manDm = parseFloat(params.get('manDm')!) || 6
  if (params.has('manPh')) d.manPh = parseFloat(params.get('manPh')!) || 7.5
  if (params.has('manSource') && ['cattle', 'pig'].includes(params.get('manSource')!))
    d.manSource = params.get('manSource') as 'cattle' | 'pig'
  if (params.has('appTime')) {
    const h = parseInt(params.get('appTime')!, 10)
    if (!isNaN(h) && h >= 0 && h <= 23) d.appTime = h
  }
  if (params.has('incorpTime')) d.incorpTime = parseFloat(params.get('incorpTime')!) || 0
  if (params.has('incorpDepth') && ['none', 'shallow', 'deep'].includes(params.get('incorpDepth')!))
    d.incorpDepth = params.get('incorpDepth') as FormData['incorpDepth']
  if (params.has('fert') && FERT_IDS.includes(params.get('fert') as FertilizerId)) {
    d.fertilizer = params.get('fert') as FertilizerId
  }
  if (params.has('eurkgn')) {
    const v = parseFloat(params.get('eurkgn')!)
    if (!isNaN(v) && v > 0) d.customEurPerKgN = v
  }
  if (params.has('farmha')) {
    const v = parseFloat(params.get('farmha')!)
    if (!isNaN(v) && v > 0) d.farmSizeHa = v
  }
  if (params.has('unit')) {
    const u = params.get('unit')
    if (u === 'kgha' || u === 'eur') {
      d.chartUnit = u
    }
  }
  return d
}

/** Format a variant value for display, using i18n translations. */
function variantLabel(t: any, variable: VariableName, value: string | number, def?: VariantDef): string {
  const key = def?.labelKey ?? String(value)
  const main = t(`variants.${variable}.${key}`, { defaultValue: String(value) })
  if (def?.hasCategory) {
    const cat = t(`categories.${variable}.${key}`, { defaultValue: '' })
    if (cat) return `${main} — ${cat}`
  }
  return main
}

export default function Calculation() {
  const { t, i18n } = useTranslation()
  const { lat, lng, day } = useParams<{ lat: string; lng: string; day: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDay = day ? parseInt(day, 10) : null

  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [alfam2Info, setAlfam2Info] = useState<{ version: string; parsSet: string } | null>(null)

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>(() => deserializeForm(searchParams))
  const [showRadioHint, setShowRadioHint] = useState(false)
  const [showFarmSize, setShowFarmSize] = useState<boolean>(() => !!formData.farmSizeHa)

  // Shared hidden-variant state for the overview chart legend and cost summary.
  // Hook is called unconditionally; when no data has loaded yet, we pass the
  // currently-selected variable + an empty values array.
  const {hiddenValues, toggleValue} = useHiddenValues(
    data?.variable ?? formData.variable,
    data?.values ?? [],
  )

  // Logo expansion: on hover (desktop) or when scrolled to top (touch devices).
  const [iconHover, setIconHover] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    )
    const onScroll = () => setAtTop(window.scrollY <= 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const iconExpanded = iconHover || (isTouch && atTop)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/status', { signal: controller.signal })
      .then((res) => res.json())
      .then((d) => {
        if (d.alfam2_version) setAlfam2Info({ version: d.alfam2_version, parsSet: d.alfam2_pars_set })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const p = new URLSearchParams(serializeForm(formData))
    setSearchParams(p, { replace: true })
  }, [formData, setSearchParams])

  useEffect(() => {
    if (!lat || !lng) return
    const controller = new AbortController()
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${i18n.language}`,
      { headers: { 'User-Agent': 'ammonitor/0.3' }, signal: controller.signal }
    )
      .then((res) => res.json())
      .then((d) => {
        const city =
          d.address?.city ||
          d.address?.town ||
          d.address?.village ||
          d.address?.municipality ||
          d.address?.county
        setLocationName(city || null)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setLocationName(null)
      })
      .finally(() => setLocationLoading(false))
    return () => controller.abort()
  }, [lat, lng, i18n.language])

  useEffect(() => {
    if (!lat || !lng) return

    const controller = new AbortController()

    setLoading(true)
    setError(null)

    const browserTz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto'

    const values = VARIANT_DEFS[formData.variable].map((d) => d.value)

    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        variable: formData.variable,
        values,
        app_mthd: formData.appMthd,
        man_dm: formData.manDm,
        man_ph: formData.manPh,
        man_source: formData.manSource,
        app_time: formData.appTime,
        incorp_depth: formData.incorpDepth,
        incorp_time: formData.incorpTime,
        timezone: browserTz,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.text()
          throw new Error(err || `Server responded with ${res.status}`)
        }
        return res.json()
      })
      .then((payload: ApiResponse) => {
        setData(payload)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : String(err)
        console.error('Calculation error:', message)
        setError(message)
        setData(null)
        setLoading(false)
      })
    return () => controller.abort()
  }, [
    lat,
    lng,
    formData.variable,
    formData.appMthd,
    formData.manDm,
    formData.manPh,
    formData.manSource,
    formData.appTime,
    formData.incorpDepth,
    formData.incorpTime,
  ])

  const handleFixedChange = useCallback(
    (name: string, value: any) => {
      setFormData((prev) => {
        const next = { ...prev, [name]: value }
        if (name === 'incorpDepth') {
          if (value === 'none') {
            next.incorpTime = 0
            if (prev.variable === 'incorp_time' || prev.variable === 'incorp_depth') {
              next.variable = 'app_mthd'
            }
          } else if (prev.incorpDepth === 'none') {
            next.incorpTime = 4
          }
        }
        if (name === 'incorpTime' && value > 0 && prev.incorpDepth === 'none') {
          next.incorpDepth = 'shallow'
        }
        return next
      })
    },
    [],
  )

  const handleVariableChange = useCallback(
    (variable: VariableName) => {
      setFormData((prev) => {
        if (variable === 'incorp_time' && prev.incorpDepth === 'none') {
          return { ...prev, variable, incorpDepth: 'shallow', incorpTime: 4 }
        }
        return { ...prev, variable }
      })
    },
    [],
  )

  const handleDayClick = useCallback(
    (day: number) => {
      navigate(`/calculate/${lat}/${lng}/${day}`)
    },
    [navigate, lat, lng],
  )

  const selectedDayData =
    selectedDay !== null && data
      ? data.days.find((d) => d.day === selectedDay)
      : null

  // Build a readable subject for sharing: "Vienna" for overview, "Vienna — Apr 28" for detail.
  const shareSubject = (() => {
    const loc = locationName ?? (lat && lng ? `${parseFloat(lat).toFixed(2)}, ${parseFloat(lng).toFixed(2)}` : null)
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
    const isNumeric = (
      variable === 'man_dm' || variable === 'man_ph' ||
      variable === 'incorp_time' || variable === 'app_time'
    )

    return (
      <select
        value={String(currentValue ?? '')}
        onChange={(e) => {
          const v = e.target.value
          if (isNumeric) {
            onChange(parseFloat(v))
          } else {
            onChange(v)
          }
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
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3">
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

        <div className="flex flex-col lg:grid lg:grid-cols-[18rem_minmax(0,1fr)_16rem] gap-4 lg:gap-6 items-stretch lg:h-[calc(100vh-11rem)] lg:min-h-[470px]">
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
                    let currentValue: any = undefined
                    let onChange: (value: any) => void = () => {}

                    switch (variable) {
                      case 'app_mthd':
                        currentValue = formData.appMthd
                        onChange = (v) => handleFixedChange('appMthd', v)
                        break
                      case 'app_time':
                        currentValue = formData.appTime
                        onChange = (v) => handleFixedChange('appTime', v)
                        break
                      case 'man_dm':
                        currentValue = formData.manDm
                        onChange = (v) => handleFixedChange('manDm', v)
                        break
                      case 'man_ph':
                        currentValue = formData.manPh
                        onChange = (v) => handleFixedChange('manPh', v)
                        break
                      case 'man_source':
                        currentValue = formData.manSource
                        onChange = (v) => handleFixedChange('manSource', v)
                        break
                    }

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
                          let currentValue: any
                          let onChange: (value: any) => void

                          if (variable === 'incorp_depth') {
                            currentValue = formData.incorpDepth
                            onChange = (v) => handleFixedChange('incorpDepth', v)
                          } else {
                            currentValue = formData.incorpTime
                            onChange = (v) => handleFixedChange('incorpTime', v)
                          }

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
                <button
                  onClick={() => navigate(`/calculate/${lat}/${lng}/${Math.max(0, selectedDay - 1)}`, { replace: true })}
                  disabled={selectedDay <= 0}
                  className="p-2 mr-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                  aria-label="Previous day"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
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
                <button
                  onClick={() => navigate(`/calculate/${lat}/${lng}/${Math.min((data?.days.length ?? 1) - 1, selectedDay + 1)}`, { replace: true })}
                  disabled={!data || selectedDay >= data.days.length - 1}
                  className="p-2 ml-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                  aria-label="Next day"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
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
                />
              )}
              {data && selectedDay !== null && (
                <DetailChart
                  data={data}
                  day={selectedDay}
                  formData={formData}
                  hiddenValues={hiddenValues}
                  toggleValue={toggleValue}
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
