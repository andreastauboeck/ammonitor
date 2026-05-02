import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  type ApiResponse,
  type FormData,
  type VariableName,
  type VariantDef,
  VARIANT_DEFS,
  TAN_PRESETS,
  DEFAULT_FORM_DATA,
  formatDayLabel,
} from './types'
import OverviewChart from './OverviewChart'
import DetailChart from './DetailChart'
import LanguageSwitcher from '../components/LanguageSwitcher'

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

function serializeForm(formData: FormData): Record<string, string> {
  return {
    variable: formData.variable,
    tanApp: String(formData.tanApp),
    appMthd: formData.appMthd,
    manDm: String(formData.manDm),
    manPh: String(formData.manPh),
    manSource: formData.manSource,
    appTime: String(formData.appTime),
    incorpTime: String(formData.incorpTime),
    incorpDepth: formData.incorpDepth,
  }
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



  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((d) => {
        if (d.alfam2_version) setAlfam2Info({ version: d.alfam2_version, parsSet: d.alfam2_pars_set })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const p = new URLSearchParams(serializeForm(formData))
    setSearchParams(p, { replace: true })
  }, [formData, setSearchParams])

  useEffect(() => {
    if (!lat || !lng) return
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${i18n.language}`,
      { headers: { 'User-Agent': 'ammonitor/0.3' } }
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
      .catch(() => setLocationName(null))
      .finally(() => setLocationLoading(false))
  }, [lat, lng, i18n.language])

  useEffect(() => {
    if (!lat || !lng) return

    setLoading(true)
    setError(null)

    const browserTz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto'

    const values = VARIANT_DEFS[formData.variable].map((d) => d.value)

    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      })
      .catch((err) => {
        console.error('Calculation error:', err)
        setError(err.message)
        setData(null)
      })
      .finally(() => setLoading(false))
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

  const renderInput = (
    variable: VariableName,
    currentValue: any,
    onChange: (value: any) => void,
  ) => {
    const defs = VARIANT_DEFS[variable]
    const isVariable = formData.variable === variable
    const isDisabled = isVariable
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
            ? 'bg-slate-900/50 border-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-slate-700 border-slate-600'
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
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 md:px-6 py-3">
        <div className="max-w-full md:max-w-6xl mx-auto flex items-center gap-2">
          {selectedDay !== null ? (
            <button
              onClick={() => navigate(`/calculate/${lat}/${lng}`)}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('calculation.back_to_overview')}
            </button>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('calculation.back_to_map')}
            </Link>
          )}
          <Link to="/" className="flex-1 text-center">
            <span className="inline-flex items-center gap-1.5 text-slate-300 hover:text-slate-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-400">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline font-semibold text-sm">ammonitor</span>
            </span>
          </Link>
          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
      <div className="max-w-full md:max-w-6xl mx-auto p-4 md:p-6">

        <div className="mb-4 md:mb-6">
          {locationLoading ? (
            <p className="text-slate-400">{t('calculation.loading_location')}</p>
          ) : locationName ? (
            <p className="text-2xl font-bold flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {locationName}
            </p>
          ) : (
            <p className="text-2xl font-bold">{lat}, {lng}</p>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Form panel */}
          <div className={`w-full md:w-1/3 lg:w-1/4 bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-700 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold">{t('calculation.parameters')}</h2>
              <div className="ml-auto relative">
                <button
                  type="button"
                  onClick={() => setShowRadioHint((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-400 transition-colors"
                  aria-label="Radio button info"
                >
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border-2 border-current">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  </span>
                  = {t('calculation.compare')}
                </button>
                {showRadioHint && (
                  <div
                    className="absolute right-0 top-full mt-1 z-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 whitespace-normal max-w-[16rem] shadow-lg"
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
                  <label className="block text-xs text-slate-400 mb-1">{t('calculation.tan_applied')}</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={formData.tanApp}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, tanApp: parseFloat(e.target.value) }))
                      }
                      className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
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
                          <label className="block text-xs text-slate-400 mb-1">
                            {t(`variables.${variable}`)}
                            {isVariable && (
                              <span className="ml-1 text-emerald-400">{t('calculation.varied')}</span>
                            )}
                          </label>
                          {renderInput(variable, currentValue, onChange)}
                        </div>
                      </div>
                    )
                  })}
                  {gi === 0 && (
                    <div className="col-span-2 md:col-span-1 rounded-lg border border-slate-600 p-2">
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
                                <label className="block text-xs text-slate-400 mb-1">
                                  {variable === 'incorp_depth' ? t('calculation.depth') : t('calculation.time')}
                                  {isVariable && (
                                    <span className="ml-1 text-emerald-400">{t('calculation.varied')}</span>
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

          {/* Chart panel */}
          <div className="w-full md:w-2/3 lg:w-3/4 bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-700">
            <div className="flex items-center mb-3">
              {selectedDay !== null && (
                <button
                  onClick={() => navigate(`/calculate/${lat}/${lng}/${Math.max(0, selectedDay - 1)}`, { replace: true })}
                  disabled={selectedDay <= 0}
                  className="p-2 mr-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
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
              {alfam2Info && selectedDay === null && (
                <span className="text-[10px] text-slate-600 ml-2 shrink-0 hidden sm:inline">
                  ALFAM2 v{alfam2Info.version} · {t('calculation.pars_set', { parsSet: alfam2Info.parsSet })}
                </span>
              )}
              {selectedDay !== null && (
                <button
                  onClick={() => navigate(`/calculate/${lat}/${lng}/${Math.min((data?.days.length ?? 1) - 1, selectedDay + 1)}`, { replace: true })}
                  disabled={!data || selectedDay >= data.days.length - 1}
                  className="p-2 ml-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                  aria-label="Next day"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            {error && (
              <div className="mb-2 p-2 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                {t('common.error')}: {error}
              </div>
            )}

            <div className="relative h-64 md:h-[calc(100vh-18rem)] min-h-[320px] flex flex-col">
              {loading && !data && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full border-2 border-slate-600" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-emerald-400 animate-spin" />
                    </div>
                    <span className="text-sm text-slate-400">{t('calculation.calculating')}</span>
                  </div>
                </div>
              )}
              {loading && data && (
                <div className="absolute inset-0 z-20 bg-slate-800/60 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-600" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-emerald-400 animate-spin" />
                  </div>
                </div>
              )}
              {data && selectedDay === null && (
                <OverviewChart
                  data={data}
                  formData={formData}
                  onDayClick={handleDayClick}
                />
              )}
              {data && selectedDay !== null && (
                <DetailChart
                  data={data}
                  day={selectedDay}
                  formData={formData}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
