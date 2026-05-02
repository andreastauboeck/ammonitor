import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import type { Map } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import LanguageSwitcher from '../components/LanguageSwitcher'

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
  const { t, i18n } = useTranslation()
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
        `https://nominatim.openstreetmap.org/search?format=json&accept-language=${i18n.language}&q=${encodeURIComponent(address)}`,
        { headers: { 'User-Agent': 'ammonitor/0.3' } }
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

      {/* ── Top bar with language switcher ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-3 flex justify-end">
        <LanguageSwitcher />
      </div>

      {/* ── Hero + Map ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-8">
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
              {t('home.tagline')}
            </p>
            <p className="text-sm text-slate-500 mb-6">
              {t('home.subtitle')}
            </p>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('home.search_placeholder')}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleGeocode}
                disabled={isGeocoding}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {isGeocoding ? '…' : t('home.search_button')}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mb-5">
              {t('calculation.geocoding_by')}{' '}
              <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">Nominatim</a>
              {' · '}{t('home.map_data')} &copy;{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">OpenStreetMap</a>
            </p>

            {location && (
              <div className="hidden lg:block">
                <p className="text-sm text-slate-400 mb-3">
                  <span className="font-medium text-slate-200">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
                  {' '}{t('home.selected')}
                </p>
                <button
                  onClick={handleStartCalculation}
                  className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors font-semibold"
                >
                  {t('home.start_button')} →
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
              {' '}{t('home.selected')}
            </p>
            <button
              onClick={handleStartCalculation}
              className="w-full px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors font-semibold"
            >
              {t('home.start_button')} →
            </button>
          </div>
        )}
      </div>

      {/* ── About ── */}
      <div className="border-t border-slate-800">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">

          <h2 className="text-2xl font-bold mb-4">{t('home.about_title')}</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            {t('home.about_body')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-emerald-400 font-semibold mb-1">{t('home.feature_compare_title')}</div>
              <p className="text-xs text-slate-400">{t('home.feature_compare_body')}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-blue-400 font-semibold mb-1">{t('home.feature_weather_title')}</div>
              <p className="text-xs text-slate-400">{t('home.feature_weather_body')}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-amber-400 font-semibold mb-1">{t('home.feature_instant_title')}</div>
              <p className="text-xs text-slate-400">{t('home.feature_instant_body')}</p>
            </div>
          </div>

          <div className="border-l-4 border-emerald-500 pl-4 py-2 mb-6">
            <h3 className="text-lg font-semibold mb-2">{t('home.alfam2_title')}</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {t('home.alfam2_body_pre')}{' '}
              <a href="https://projects.au.dk/alfam" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-400">ALFAM2</a>{' '}
              {t('home.alfam2_body_post')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-rose-400 font-semibold mb-1">{t('home.info_open_source_title')}</div>
              <p className="text-xs text-slate-400">{t('home.info_open_source_body_pre')}{' '}
                <a href="https://github.com/andreastauboeck/ammonitor" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">GitHub</a>{' '}
                {t('home.info_open_source_body_post')}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-cyan-400 font-semibold mb-1">{t('home.info_api_title')}</div>
              <p className="text-xs text-slate-400">{t('home.info_api_body_pre')}{' '}
                <a href="/docs" className="underline hover:text-slate-300">{t('home.info_api_link')}</a>{t('home.info_api_body_post')}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="text-emerald-400 font-semibold mb-1">{t('home.info_free_title')}</div>
              <p className="text-xs text-slate-400">{t('home.info_free_body')}</p>
            </div>
          </div>

          <p className="text-sm text-slate-400">
            {t('home.weather_credit_pre')}{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Open-Meteo</a>
            {' '}{t('home.weather_credit_under')}{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">CC BY 4.0</a>.
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {version && <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">v{version}</span>}
          <span>AGPL-3.0</span>
          <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${statusDot}`} />{t('home.backend')}</span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">OpenStreetMap</a>
          <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">Nominatim</a>
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">Open-Meteo</a>
          <a href="https://projects.au.dk/alfam" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">ALFAM2</a>
          <Link to="/imprint" className="hover:text-slate-300">{t('home.footer_imprint')}</Link>
          <Link to="/privacy" className="hover:text-slate-300">{t('home.footer_privacy')}</Link>
          <Link to="/terms" className="hover:text-slate-300">{t('home.footer_terms')}</Link>
        </div>
      </div>
    </div>
  )
}
