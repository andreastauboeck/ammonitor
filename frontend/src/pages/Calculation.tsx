import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface FormData {
  tan: number
  dryMatter: number
  ph: number
  manureSource: 'cattle' | 'pig'
  applicationDate: string
}

const sampleData = [
  { date: '2026-04-10', Broadcast: 28.9, 'Trailing hose': 19.3, 'Trailing shoe': 12.9, Injection: 3.2 },
  { date: '2026-04-11', Broadcast: 36.6, 'Trailing hose': 24.4, 'Trailing shoe': 16.3, Injection: 4.1 },
  { date: '2026-04-12', Broadcast: 49.8, 'Trailing hose': 33.2, 'Trailing shoe': 22.1, Injection: 5.5 },
  { date: '2026-04-13', Broadcast: 72.8, 'Trailing hose': 48.5, 'Trailing shoe': 32.4, Injection: 8.1 },
  { date: '2026-04-14', Broadcast: 38.2, 'Trailing hose': 25.5, 'Trailing shoe': 17.0, Injection: 4.2 },
  { date: '2026-04-15', Broadcast: 40.3, 'Trailing hose': 26.8, 'Trailing shoe': 17.9, Injection: 4.5 },
  { date: '2026-04-16', Broadcast: 45.4, 'Trailing hose': 30.3, 'Trailing shoe': 20.2, Injection: 5.0 },
]

const techniques = ['Broadcast', 'Trailing hose', 'Trailing shoe', 'Injection']
const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981']

export default function Calculation() {
  const { lat, lng } = useParams<{ lat: string; lng: string }>()
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [formData, setFormData] = useState<FormData>({
    tan: 60,
    dryMatter: 6,
    ph: 7.5,
    manureSource: 'cattle',
    applicationDate: new Date().toISOString().slice(0, 16),
  })

  useEffect(() => {
    if (!lat || !lng) return

    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then(res => res.json())
      .then(data => {
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || data.address?.county
        setLocationName(city || null)
      })
      .catch(() => setLocationName(null))
      .finally(() => setLocationLoading(false))
  }, [lat, lng])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'tan' || name === 'dryMatter' || name === 'ph' ? parseFloat(value) : value,
    }))
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6">
      <div className="max-w-full md:max-w-6xl mx-auto">
        <Link
          to={`/?lat=${lat}&lng=${lng}`}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-4 md:mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to map
        </Link>

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
            <p className="text-2xl font-bold flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {lat}, {lng}
            </p>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-full md:w-1/3 lg:w-1/4 bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-700">
            <h2 className="text-lg font-semibold mb-3">Parameters</h2>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">TAN (kg/ha)</label>
                <input
                  type="number"
                  name="tan"
                  value={formData.tan}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Dry Matter (%)</label>
                <input
                  type="number"
                  name="dryMatter"
                  value={formData.dryMatter}
                  onChange={handleChange}
                  step="0.1"
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">pH</label>
                <input
                  type="number"
                  name="ph"
                  value={formData.ph}
                  onChange={handleChange}
                  step="0.1"
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Manure Source</label>
                <select
                  name="manureSource"
                  value={formData.manureSource}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                >
                  <option value="cattle">Cattle</option>
                  <option value="pig">Pig</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Application Date/Time</label>
                <input
                  type="datetime-local"
                  name="applicationDate"
                  value={formData.applicationDate}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="w-full md:w-2/3 lg:w-3/4 bg-slate-800 rounded-xl shadow-xl p-4 md:p-5 border border-slate-700">
            <h2 className="text-lg font-semibold mb-3">NH3 Loss by Application Technique</h2>
            <div className="h-64 md:h-[calc(100vh-16rem)] min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sampleData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} label={{ value: 'NH3 loss (% of TAN)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {techniques.map((tech, idx) => (
                    <Bar key={tech} dataKey={tech} fill={colors[idx]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}