import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import type { Map } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const customIcon = L.icon({
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [100, 100],
  iconAnchor: [50, 100],
  popupAnchor: [0, -150],
  shadowSize: [150, 150],
  shadowAnchor: [44, 150],
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
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    kind: 'loading',
  })
  const [showStatus, setShowStatus] = useState(false)
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
        setTimeout(() => {
          mapRef.current?.flyTo([lat, lng], 13)
        }, 100)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/status', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Backend responded with ${res.status}`)
        }
        const data: BackendStatus = await res.json()
        if (data.status === 'ok') {
          setConnectionState({ kind: 'connected', data })
        } else {
          setConnectionState({ kind: 'apiError', data })
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'Unknown error'
        setConnectionState({ kind: 'networkError', message })
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
        const newLocation = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        }
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
    if (e.key === 'Enter') {
      handleGeocode()
    }
  }

  const handleStartCalculation = () => {
    if (location) {
      navigate(`/calculate/${location.lat}/${location.lng}`)
    }
  }

  const statusColor =
    connectionState.kind === 'connected'
      ? 'bg-green-400'
      : connectionState.kind === 'apiError'
        ? 'bg-orange-400'
        : 'bg-red-500'

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-700">
        <h1 className="text-4xl font-bold mb-2">Ammonitor</h1>
        <p className="text-slate-400 mb-4">Enter an address or click on the map to select a location.</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter address..."
            className="flex-1 px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleGeocode}
            disabled={isGeocoding}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isGeocoding ? '...' : 'Search'}
          </button>
        </div>
        <p className="text-[10px] text-slate-500 -mt-2 mb-4">
          Geocoding by{' '}
          <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">Nominatim</a>
          {' · '}Map data &copy;{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">OpenStreetMap</a>
        </p>

        <div className="h-64 rounded-xl overflow-hidden border border-slate-700 mb-4">
          <MapContainer
            center={[51.505, -0.09]}
            zoom={4}
            className="h-full w-full"
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onLocationSelect={handleLocationChange} />
            {location && <Marker position={[location.lat, location.lng]} icon={customIcon} />}
          </MapContainer>
        </div>

        {location && (
          <p className="text-sm text-slate-400 mb-4">
            Selected: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </p>
        )}

        {location && (
          <button
            onClick={handleStartCalculation}
            className="w-full mb-4 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors font-medium"
          >
            Start Calculation
          </button>
        )}

        <button
          onClick={() => setShowStatus(!showStatus)}
          className="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          <span className={`w-3 h-3 rounded-full ${statusColor}`}></span>
          <svg
            className={`w-4 h-4 transition-transform ${showStatus ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            showStatus ? 'max-h-96 mt-4 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
            <h2 className="text-lg font-semibold mb-3">Server status</h2>
            {connectionState.kind === 'loading' && (
              <p className="text-slate-400">Checking backend...</p>
            )}
            {(connectionState.kind === 'networkError' || connectionState.kind === 'apiError') && (
              <div className={connectionState.kind === 'networkError' ? 'text-red-400' : 'text-orange-400'}>
                <p className="font-medium">
                  {connectionState.kind === 'networkError'
                    ? 'Could not reach backend'
                    : 'Backend returned an error'}
                </p>
                {'message' in connectionState && (
                  <p className="text-sm mt-1 opacity-80">{connectionState.message}</p>
                )}
                {'data' in connectionState && (
                  <p className="text-sm mt-1 opacity-80">Status: {connectionState.data.status}</p>
                )}
              </div>
            )}
            {connectionState.kind === 'connected' && (
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-slate-400">Status</dt>
                <dd>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
                    {connectionState.data.status}
                  </span>
                </dd>
                <dt className="text-slate-400">Version</dt>
                <dd>{connectionState.data.version}</dd>
                <dt className="text-slate-400">Environment</dt>
                <dd>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {connectionState.data.environment}
                  </span>
                </dd>
              </dl>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}