import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { type ApiResponse, type FormData, formatDayLabel } from './types'
import OverviewChart from './OverviewChart'
import DetailChart from './DetailChart'

export default function Calculation() {
  const { lat, lng, day } = useParams<{ lat: string; lng: string; day: string }>()
  const navigate = useNavigate()
  const selectedDay = day ? parseInt(day, 10) : null

  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    tanApp: 60,
    manDm: 6,
    manPh: 7.5,
    manSource: 'cattle',
    applicationTime: '14:00',
    incorpTime: null,
    incorp: 'shallow',
  })

  useEffect(() => {
    if (!lat || !lng) return
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    )
      .then((res) => res.json())
      .then((data) => {
        const city =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.municipality ||
          data.address?.county
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
        tan_app: formData.tanApp,
        man_dm: formData.manDm,
        man_ph: formData.manPh,
        man_source: formData.manSource,
        application_time: formData.applicationTime,
        incorp:
          formData.incorpTime !== null ? formData.incorp : 'none',
        incorp_time: formData.incorpTime ?? 0,
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
    formData.tanApp,
    formData.manDm,
    formData.manPh,
    formData.manSource,
    formData.applicationTime,
    formData.incorp,
    formData.incorpTime,
  ])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target
    if (name === 'incorpTime') {
      setFormData((prev) => ({
        ...prev,
        incorpTime: value === '' ? null : parseFloat(value),
      }))
      return
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }))
  }

  const handleDayClick = (day: number) => {
    navigate(`/calculate/${lat}/${lng}/${day}`)
  }

  const selectedScenario =
    selectedDay !== null && data
      ? data.scenarios.find((s) => s.day === selectedDay)
      : null

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 md:px-6 py-3">
        <div className="max-w-full md:max-w-6xl mx-auto">
          {selectedDay !== null ? (
            <button
              onClick={() => navigate(-1)}
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
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {locationName}
            </p>
          ) : (
            <p className="text-2xl font-bold flex items-center gap-2">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {lat}, {lng}
            </p>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Form panel */}
          <div className="w-full md:w-1/3 lg:w-1/4 bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-700">
            <h2 className="text-lg font-semibold mb-3">Parameters</h2>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  TAN applied (kg/ha)
                </label>
                <input
                  type="number"
                  name="tanApp"
                  value={formData.tanApp}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Dry matter (%)
                </label>
                <input
                  type="number"
                  name="manDm"
                  value={formData.manDm}
                  onChange={handleChange}
                  step="0.1"
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">pH</label>
                <input
                  type="number"
                  name="manPh"
                  value={formData.manPh}
                  onChange={handleChange}
                  step="0.1"
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Manure source
                </label>
                <select
                  name="manSource"
                  value={formData.manSource}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                >
                  <option value="cattle">Cattle</option>
                  <option value="pig">Pig</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Application time
                </label>
                <select
                  name="applicationTime"
                  value={formData.applicationTime}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                >
                  <option value="06:00">06:00 (morning)</option>
                  <option value="14:00">14:00 (afternoon)</option>
                  <option value="18:00">18:00 (evening)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Incorporation time (h)
                </label>
                <select
                  name="incorpTime"
                  value={formData.incorpTime ?? ''}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">None</option>
                  <option value={0.25}>0.25 h (15 min)</option>
                  <option value={0.5}>0.5 h (30 min)</option>
                  <option value={1}>1 h</option>
                  <option value={2}>2 h</option>
                  <option value={4}>4 h</option>
                  <option value={8}>8 h</option>
                  <option value={24}>24 h</option>
                </select>
              </div>
              {formData.incorpTime !== null && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Incorporation depth
                  </label>
                  <select
                    name="incorp"
                    value={formData.incorp}
                    onChange={handleChange}
                    className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="shallow">Shallow</option>
                    <option value="deep">Deep</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Chart panel */}
          <div className="w-full md:w-2/3 lg:w-3/4 bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                {selectedDay === null
                  ? 'NH3 loss by application day and technique'
                  : `Detail — ${selectedScenario ? formatDayLabel(selectedScenario.start) : ''}`}
                {loading && (
                  <span className="text-sm font-normal text-slate-400 ml-2">
                    (calculating...)
                  </span>
                )}
              </h2>
            </div>

            {error && (
              <div className="mb-2 p-2 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                Error: {error}
              </div>
            )}

            <div className="h-64 md:h-[calc(100vh-18rem)] min-h-[320px] flex flex-col">
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
