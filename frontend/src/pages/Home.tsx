import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import type { Map } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const customIcon = L.icon({
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [60, 60],
  iconAnchor: [30, 60],
  popupAnchor: [0, -150],
  shadowSize: [80, 80],
  shadowAnchor: [23, 80],
})

interface BackendStatus {
  status: string
  version: string
  environment: string
}

interface Location {
  lat: number
  lng: number
}

type ConnectionState =
  | { kind: 'loading' }
  | { kind: 'connected'; data: BackendStatus }
  | { kind: 'apiError'; data: BackendStatus }
  | { kind: 'networkError'; message: string }

function MapClickHandler({ onLocationSelect }: { onLocationSelect: (loc: Location) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export default function Home() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({ kind: 'loading' })
  const [address, setAddress] = useState('')
  const [location, setLocation] = useState<Location | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const mapRef = useRef<Map | null>(null)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const latParam = searchParams.get('lat')
    const lngParam = searchParams.get('lng')
    if (latParam && lngParam) {
      const lat = parseFloat(latParam)
      const lng = parseFloat(lngParam)
      if (!isNaN(lat) && !isNaN(lng)) {
        setLocation({ lat, lng })
        setTimeout(() => mapRef.current?.flyTo([lat, lng], 13), 100)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/status', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Backend responded with ${res.status}`)
        const data: BackendStatus = await res.json()
        setConnectionState(data.status === 'ok' ? { kind: 'connected', data } : { kind: 'apiError', data })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setConnectionState({ kind: 'networkError', message: err instanceof Error ? err.message : 'Unknown error' })
      })
    return () => controller.abort()
  }, [])

  const handleLocationChange = (newLocation: Location) => {
    setLocation(newLocation)
    setSearchParams({ lat: newLocation.lat.toString(), lng: newLocation.lng.toString() })
  }

  const handleGeocode = async () => {
    if (!address.trim()) return
    setIsGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
        { headers: { 'User-Agent': 'ammonitor/0.2' } }
      )
      const data = await res.json()
      if (data && data.length > 0) {
        const newLocation = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
        setLocation(newLocation)
        setSearchParams({ lat: newLocation.lat.toString(), lng: newLocation.lng.toString() })
        mapRef.current?.flyTo([newLocation.lat, newLocation.lng], 13)
      }
    } catch (err) {
      console.error('Geocoding failed:', err)
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGeocode()
  }

  const handleStartCalculation = () => {
    if (location) navigate(`/calculate/${location.lat}/${location.lng}`)
  }

  const statusDot =
    connectionState.kind === 'connected' ? 'bg-green-400'
      : connectionState.kind === 'apiError' ? 'bg-orange-400'
        : 'bg-red-500'

  const version = connectionState.kind === 'connected' ? connectionState.data.version : null

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">

      {/* ── Hero + Map ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-10 md:pt-16 pb-8">
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-8 items-start">

          {/* Left: intro + search */}
          <div className="lg:w-2/5 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-28 h-32 rounded-xl bg-amber-50 flex items-center justify-center">
                <img src="/logo.png" alt="" className="w-24 h-28" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">ammonitor</h1>
            </div>

            <p className="text-lg text-slate-300 mb-1">
              Predict ammonia losses. Compare strategies. Protect the climate and harvest more.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Select a field on the map or search for a location, then start a calculation.
            </p>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter address…"
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleGeocode}
                disabled={isGeocoding}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {isGeocoding ? '…' : 'Search'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mb-5">
              Geocoding by{' '}
              <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">Nominatim</a>
              {' · '}Map data &copy;{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">OpenStreetMap</a>
            </p>

            {location && (
              <div className="hidden lg:block">
                <p className="text-sm text-slate-400 mb-3">
                  <span className="font-medium text-slate-200">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
                  {' '}selected
                </p>
                <button
                  onClick={handleStartCalculation}
                  className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors font-semibold"
                >
                  Start Calculation →
                </button>
              </div>
            )}
          </div>

          {/* Right: map */}
          <div className="lg:w-3/5 w-full">
            <div className="h-72 md:h-96 rounded-xl overflow-hidden border border-slate-700">
              <MapContainer center={[48.5, 10]} zoom={4} className="h-full w-full" ref={mapRef}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onLocationSelect={handleLocationChange} />
                {location && <Marker position={[location.lat, location.lng]} icon={customIcon} />}
              </MapContainer>
            </div>
          </div>
        </div>

        {location && (
          <div className="lg:hidden mt-4">
            <p className="text-sm text-slate-400 mb-3">
              <span className="font-medium text-slate-200">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
              {' '}selected
            </p>
            <button
              onClick={handleStartCalculation}
              className="w-full px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors font-semibold"
            >
              Start Calculation →
            </button>
          </div>
        )}
      </div>

      {/* ── About ── */}
      <div className="border-t border-slate-800">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">

          <h2 className="text-2xl font-bold mb-4">About ammonitor</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            Ammonitor helps farmers and advisors make informed decisions about manure application.
            By combining real-time weather forecasts with the ALFAM2 emission model, it predicts
            how much ammonia (NH₃) will be lost after spreading — and how different application
            strategies compare over the next 7 days.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-emerald-400 font-semibold mb-1">Compare strategies</div>
              <p className="text-xs text-slate-400">Vary application technique, time, dry matter, pH, incorporation — see which minimises loss.</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-blue-400 font-semibold mb-1">Real weather data</div>
              <p className="text-xs text-slate-400">Forecasts from Open-Meteo drive the model, so predictions reflect actual conditions.</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-amber-400 font-semibold mb-1">Instant results</div>
              <p className="text-xs text-slate-400">Get a 7-day emission profile in seconds — no setup, no installation, no cost.</p>
            </div>
          </div>

          <div className="border-l-4 border-emerald-500 pl-4 py-2 mb-6">
            <h3 className="text-lg font-semibold mb-2">Powered by ALFAM2</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              The{' '}
              <a href="https://projects.au.dk/alfam" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-400">ALFAM2</a>{' '}
              model (Hafner et al.) is a semi-empirical model for predicting ammonia volatilisation
              from field-applied manure, developed from over 2,000 measurements across Europe.
              We gratefully acknowledge the ALFAM2 team for making their work openly available —
              without it, ammonitor would not be possible.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-rose-400 font-semibold mb-1">Open source</div>
              <p className="text-xs text-slate-400">Code available on{' '}
                <a href="https://github.com/andreastauboeck/ammonitor" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">GitHub</a>{' '}
                under AGPL-3.0. Inspect, fork, contribute.
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-cyan-400 font-semibold mb-1">Public API</div>
              <p className="text-xs text-slate-400">Programmatic access via{' '}
                <a href="/docs" className="underline hover:text-slate-300">Swagger docs</a>. Integrate ammonitor into your own tools.
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-emerald-400 font-semibold mb-1">Free forever</div>
              <p className="text-xs text-slate-400">No account, no subscription, no limits. Ammonitor will always be free to use.</p>
            </div>
          </div>

          <p className="text-sm text-slate-400">
            Weather forecasts provided by{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Open-Meteo</a>
            {' '}under{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">CC BY 4.0</a>.
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {version && <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">v{version}</span>}
          <span>AGPL-3.0</span>
          <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${statusDot}`} />Backend</span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">OpenStreetMap</a>
          <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">Nominatim</a>
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">Open-Meteo</a>
          <a href="https://projects.au.dk/alfam" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">ALFAM2</a>
        </div>
      </div>
    </div>
  )
}
