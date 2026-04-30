import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  type ApiResponse,
  type FormData,
  type VariableName,
  VARIANT_DEFS,
  TAN_PRESETS,
  INPUT_LABELS,
  DEFAULT_FORM_DATA,
  formatDayLabel,
} from './types'
import OverviewChart from './OverviewChart'
import DetailChart from './DetailChart'

const VARIABLE_OPTIONS_BEFORE_INCORP: VariableName[] = [
  'app.mthd', 'app.time', 'man.dm',
]
const VARIABLE_OPTIONS_AFTER_INCORP: VariableName[] = [
  'man.source', 'man.ph',
]

function serializeForm(formData: FormData): Record<string, string> {
  const p: Record<string, string> = {
    variable: formData.variable,
    tanApp: String(formData.tanApp),
    appMthd: formData.appMthd,
    manDm: String(formData.manDm),
    manPh: String(formData.manPh),
    manSource: formData.manSource,
    applicationTime: formData.applicationTime,
    incorpTime: String(formData.incorpTime),
    incorp: formData.incorp,
  }
  return p
}

function deserializeForm(params: URLSearchParams): FormData {
  const d = { ...DEFAULT_FORM_DATA }
  if (params.has('variable')) d.variable = params.get('variable') as VariableName
  if (params.has('tanApp')) d.tanApp = parseFloat(params.get('tanApp')!) || 60
  if (params.has('appMthd') && ['bc', 'th', 'ts', 'os', 'cs'].includes(params.get('appMthd')!))
    d.appMthd = params.get('appMthd')!
  if (params.has('manDm')) d.manDm = parseFloat(params.get('manDm')!) || 6
  if (params.has('manPh')) d.manPh = parseFloat(params.get('manPh')!) || 7.5
  if (params.has('manSource') && ['cattle', 'pig'].includes(params.get('manSource')!))
    d.manSource = params.get('manSource') as 'cattle' | 'pig'
  if (params.has('applicationTime') && ['06:00', '08:00', '12:00', '16:00', '20:00'].includes(params.get('applicationTime')!))
    d.applicationTime = params.get('applicationTime') as FormData['applicationTime']
  if (params.has('incorpTime')) d.incorpTime = parseFloat(params.get('incorpTime')!) || 1
  if (params.has('incorp') && ['none', 'shallow', 'deep'].includes(params.get('incorp')!))
    d.incorp = params.get('incorp') as FormData['incorp']
  return d
}

export default function Calculation() {
  const { lat, lng, day } = useParams<{ lat: string; lng: string; day: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDay = day ? parseInt(day, 10) : null

  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>(() => deserializeForm(searchParams))
  const [showRadioHint, setShowRadioHint] = useState(false)

  const canVaryIncorp = formData.incorp !== 'none'

  useEffect(() => {
    const p = new URLSearchParams(serializeForm(formData))
    setSearchParams(p, { replace: true })
  }, [formData, setSearchParams])

  useEffect(() => {
    if (!lat || !lng) return
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'ammonitor/0.2' } }
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
  }, [lat, lng])

  useEffect(() => {
    if (!lat || !lng) return

    setLoading(true)
    setError(null)

    const browserTz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto'

    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        variable: formData.variable,
        variants: VARIANT_DEFS[formData.variable],
        app_mthd: formData.appMthd,
        man_dm: formData.manDm,
        man_ph: formData.manPh,
        man_source: formData.manSource,
        application_time: formData.applicationTime,
        incorp: formData.incorp,
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
    formData.applicationTime,
    formData.incorp,
    formData.incorpTime,
  ])

  const handleFixedChange = useCallback(
    (name: string, value: any) => {
      setFormData((prev) => {
        const next = { ...prev, [name]: value }
        if (name === 'incorp') {
          if (value === 'none') {
            next.incorpTime = 0
            if (prev.variable === 'incorp' || prev.variable === 'incorp.depth') {
              next.variable = 'app.mthd'
            }
          } else if (prev.incorp === 'none') {
            next.incorpTime = 4
          }
        }
        if (name === 'incorpTime' && value === 0) {
          next.incorp = 'none'
          if (prev.variable === 'incorp' || prev.variable === 'incorp.depth') {
            next.variable = 'app.mthd'
          }
        }
        return next
      })
    },
    [],
  )

  const handleVariableChange = useCallback(
    (variable: VariableName) => {
      setFormData((prev) => {
        if (variable === 'incorp' && prev.incorp === 'none') {
          return { ...prev, variable, incorp: 'shallow' }
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

    if (variable === 'incorp' && !canVaryIncorp) {
      return (
        <select
          value={0}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            setFormData((prev) => {
              if (v === 0) {
                const next: any = { ...prev, incorpTime: 0, incorp: 'none' }
                if (prev.variable === 'incorp') next.variable = 'app.mthd'
                return next
              }
              return { ...prev, incorpTime: v, incorp: 'shallow' }
            })
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
              {d.label}{d.category ? ` — ${d.category}` : ''}
            </option>
          ))}
        </select>
      )
    }

    return (
      <select
        value={String(currentValue ?? '')}
        onChange={(e) => {
          const v = e.target.value
          if (variable === 'man.dm' || variable === 'man.ph' || variable === 'incorp') {
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
            {d.label}{d.category ? ` — ${d.category}` : ''}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 md:px-6 py-3">
        <div className="max-w-full md:max-w-6xl mx-auto">
          {selectedDay !== null ? (
            <button
              onClick={() => navigate(`/calculate/${lat}/${lng}`)}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to overview
            </button>
          ) : (
            <Link
              to={`/?lat=${lat}&lng=${lng}`}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to map
            </Link>
          )}
        </div>
      </div>
      <div className="max-w-full md:max-w-6xl mx-auto p-4 md:p-6">

        <div className="mb-4 md:mb-6">
          {locationLoading ? (
            <p className="text-slate-400">Loading location...</p>
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
          <p className="text-[10px] text-slate-500 mt-0.5">
            Geocoding by{' '}
            <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">Nominatim</a>
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Form panel */}
          <div className={`w-full md:w-1/3 lg:w-1/4 bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-700 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold">Parameters</h2>
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
                  = compare
                </button>
                {showRadioHint && (
                  <div
                    className="absolute right-0 top-full mt-1 z-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 whitespace-nowrap shadow-lg"
                    onClick={() => setShowRadioHint(false)}
                  >
                    Select a radio button to compare variants for that parameter
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">

              {/* TAN applied */}
              <div className="flex items-center gap-2">
                <div className="w-4" />
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-slate-400 mb-1">TAN applied</label>
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
                    <span className="text-xs text-slate-500">kg/ha</span>
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
                      case 'app.mthd':
                        currentValue = formData.appMthd
                        onChange = (v) => handleFixedChange('appMthd', v)
                        break
                      case 'app.time':
                        currentValue = formData.applicationTime
                        onChange = (v) => handleFixedChange('applicationTime', v)
                        break
                      case 'man.dm':
                        currentValue = formData.manDm
                        onChange = (v) => handleFixedChange('manDm', v)
                        break
                      case 'man.ph':
                        currentValue = formData.manPh
                        onChange = (v) => handleFixedChange('manPh', v)
                        break
                      case 'man.source':
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
                            {INPUT_LABELS[variable]}
                            {isVariable && (
                              <span className="ml-1 text-emerald-400">varied</span>
                            )}
                          </label>
                          {renderInput(variable, currentValue, onChange)}
                        </div>
                      </div>
                    )
                  })}
                  {gi === 0 && (
                    <div className="col-span-2 md:col-span-1 rounded-lg border border-slate-600 p-2">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">Incorporation</div>
                      <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                        {(['incorp.depth', 'incorp'] as const).map((variable) => {
                          const isVariable = formData.variable === variable
                          let currentValue: any
                          let onChange: (value: any) => void

                          if (variable === 'incorp.depth') {
                            currentValue = formData.incorp
                            onChange = (v) => handleFixedChange('incorp', v)
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
                                  {variable === 'incorp.depth' ? 'Depth' : 'Time'}
                                  {isVariable && (
                                    <span className="ml-1 text-emerald-400">varied</span>
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
                  ? `Overview NH3 loss by ${INPUT_LABELS[formData.variable]}`
                  : `Detail losses on ${selectedDayData ? formatDayLabel(selectedDayData.start) : ''} by ${INPUT_LABELS[formData.variable]}`}
              </h2>
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
                Error: {error}
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
                    <span className="text-sm text-slate-400">Calculating...</span>
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
