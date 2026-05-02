import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import type { Map } from 'leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-gesture-handling/dist/leaflet-gesture-handling.css'
import { GestureHandling } from 'leaflet-gesture-handling'
import SettingsMenu from '../components/SettingsMenu'

// Register the gesture handler globally so MapContainer can opt-in via prop.
;(L.Map as any).addInitHook('addHandler', 'gestureHandling', GestureHandling)

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
  alfam2_version: string
  alfam2_pars_set: string
}

interface Location {
  lat: number
  lng: number
}

interface SavedLocation {
  lat: number
  lng: number
  name: string
  ts: number
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
  const [locationName, setLocationName] = useState<string | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isGeolocating, setIsGeolocating] = useState(false)
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [editingTs, setEditingTs] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const mapRef = useRef<Map | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ammonitor-locations')
      if (raw) setSavedLocations(JSON.parse(raw))
    } catch {}
  }, [])

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

  const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${i18n.language}`,
        { headers: { 'User-Agent': 'ammonitor/0.3' } }
      )
      const d = await res.json()
      return d.address?.city || d.address?.town || d.address?.village || d.address?.municipality || d.address?.county || null
    } catch {
      return null
    }
  }

  const saveAndNavigate = (loc: Location, name: string | null) => {
    const displayName = name || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`
    try {
      const raw = localStorage.getItem('ammonitor-locations')
      const locations: SavedLocation[] = raw ? JSON.parse(raw) : []
      const filtered = locations.filter((l) => Math.abs(l.lat - loc.lat) > 0.0001 || Math.abs(l.lng - loc.lng) > 0.0001)
      filtered.unshift({ lat: loc.lat, lng: loc.lng, name: displayName, ts: Date.now() })
      localStorage.setItem('ammonitor-locations', JSON.stringify(filtered.slice(0, 20)))
    } catch {}
    navigate(`/calculate/${loc.lat}/${loc.lng}`)
  }

  const handleLocationChange = (newLocation: Location) => {
    setLocation(newLocation)
    setLocationName(null)
    reverseGeocode(newLocation.lat, newLocation.lng).then((name) => setLocationName(name))
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
        const name = data[0].display_name?.split(',')[0] || null
        setLocation(newLocation)
        setLocationName(name)
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

  const handleGeolocate = () => {
    if (!navigator.geolocation) return
    setIsGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(newLocation)
        setLocationName(null)
        reverseGeocode(newLocation.lat, newLocation.lng).then((name) => setLocationName(name))
        mapRef.current?.flyTo([newLocation.lat, newLocation.lng], 13)
        setIsGeolocating(false)
      },
      () => setIsGeolocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSelectSaved = (loc: SavedLocation) => {
    setLocation({ lat: loc.lat, lng: loc.lng })
    setLocationName(loc.name)
    mapRef.current?.flyTo([loc.lat, loc.lng], 13)
  }

  const handleDeleteSaved = (e: React.MouseEvent, loc: SavedLocation) => {
    e.stopPropagation()
    const next = savedLocations.filter((l) => l.ts !== loc.ts)
    setSavedLocations(next)
    try {
      localStorage.setItem('ammonitor-locations', JSON.stringify(next))
    } catch {}
  }

  const handleStartRename = (e: React.MouseEvent, loc: SavedLocation) => {
    e.stopPropagation()
    setEditingTs(loc.ts)
    setEditingValue(loc.name)
  }

  const handleCommitRename = () => {
    if (editingTs === null) return
    const trimmed = editingValue.trim()
    const next = savedLocations.map((l) =>
      l.ts === editingTs && trimmed ? { ...l, name: trimmed } : l
    )
    setSavedLocations(next)
    try {
      localStorage.setItem('ammonitor-locations', JSON.stringify(next))
    } catch {}
    setEditingTs(null)
    setEditingValue('')
  }

  const handleCancelRename = () => {
    setEditingTs(null)
    setEditingValue('')
  }

  const handleStartCalculation = () => {
    if (location) saveAndNavigate(location, locationName)
  }

  const statusDot =
    connectionState.kind === 'connected' ? 'bg-green-400'
      : connectionState.kind === 'apiError' ? 'bg-orange-400'
        : 'bg-red-500'

  const version = connectionState.kind === 'connected' ? connectionState.data.version : null

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">

      {/* ── Top bar with settings menu ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-3 flex justify-end items-center">
        <SettingsMenu />
      </div>

      {/* ── Hero + Map ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-8">
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-8 items-start">

          {/* Left: intro + search */}
          <div className="lg:w-2/5 flex flex-col">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-28 h-32 rounded-xl bg-amber-50 flex items-center justify-center">
                <img src="/logo.png" alt="" className="w-24 h-28" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">ammonitor</h1>
            </div>

            <p className="text-lg text-slate-700 dark:text-slate-300 mb-1 text-center">
              {t('home.tagline')}
            </p>
            <p className="text-sm text-slate-500 mb-6 text-center">
              {t('home.subtitle')}
            </p>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('home.search_placeholder')}
                className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleGeocode}
                disabled={isGeocoding}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {isGeocoding ? '…' : t('home.search_button')}
              </button>
              <button
                onClick={handleGeolocate}
                disabled={isGeolocating}
                title={t('home.gps_button')}
                className="px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-700 dark:text-slate-300">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {savedLocations.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-slate-500 mb-1">{t('home.recent_locations')}</p>
                <div className="flex flex-wrap gap-1">
                  {savedLocations.map((loc, i) => {
                    const isEditing = editingTs === loc.ts
                    const tone = i === 0
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-700 hover:border-emerald-500 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-300 dark:hover:border-emerald-600'
                      : 'bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500'
                    return (
                      <span
                        key={loc.ts}
                        className={`group inline-flex items-center text-[11px] rounded border transition-colors ${tone}`}
                      >
                        {isEditing ? (
                          <>
                            <input
                              autoFocus
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitRename()
                                else if (e.key === 'Escape') handleCancelRename()
                              }}
                              onBlur={handleCommitRename}
                              className="px-2 py-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-500 outline-none w-32"
                            />
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={handleCommitRename}
                              title={t('home.save_name')}
                              aria-label={t('home.save_name')}
                              className="px-1.5 py-1 border-l border-current/20 opacity-70 hover:opacity-100 hover:text-emerald-400"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSelectSaved(loc)}
                              className="px-2 py-1 hover:text-slate-900 dark:hover:text-slate-200"
                            >
                              {loc.name}
                            </button>
                            <button
                              onClick={(e) => handleStartRename(e, loc)}
                              title={t('home.rename_location')}
                              aria-label={t('home.rename_location')}
                              className="px-1.5 py-1 border-l border-current/20 opacity-50 hover:opacity-100 hover:text-indigo-400"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => handleDeleteSaved(e, loc)}
                              title={t('home.delete_location')}
                              aria-label={t('home.delete_location')}
                              className="px-1.5 py-1 border-l border-current/20 opacity-50 hover:opacity-100 hover:text-rose-400"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                              </svg>
                            </button>
                          </>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {location && (
              <>
                {/* Phone portrait: Calculate button sits right under recent locations */}
                <div className="lg:hidden mb-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 text-center">
                    <span className="font-medium text-slate-900 dark:text-slate-200">{locationName || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</span>
                    {' '}{t('home.selected')}
                  </p>
                  <button
                    onClick={handleStartCalculation}
                    className="w-full px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors font-semibold"
                  >
                    {t('home.start_button')} →
                  </button>
                </div>
                {/* Desktop: Calculate button under search panel, beside the map */}
                <div className="hidden lg:block">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    <span className="font-medium text-slate-900 dark:text-slate-200">{locationName || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</span>
                    {' '}{t('home.selected')}
                  </p>
                  <button
                    onClick={handleStartCalculation}
                    className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors font-semibold"
                  >
                    {t('home.start_button')} →
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right: map */}
          <div className="lg:w-3/5 w-full">
            <div className="h-72 md:h-96 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700">
              <MapContainer
                center={[48.5, 10]}
                zoom={4}
                className="h-full w-full"
                ref={mapRef}
                {...({
                  gestureHandling: true,
                  gestureHandlingOptions: {
                    text: {
                      touch: t('map.gesture_touch'),
                      scroll: t('map.gesture_scroll'),
                      scrollMac: t('map.gesture_scroll_mac'),
                    },
                  },
                } as any)}
              >
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

      </div>

      {/* ── About ── */}
      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">

          <h2 className="text-2xl font-bold mb-4">{t('home.about_title')}</h2>
          <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
            {t('home.about_body')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold mb-1">{t('home.feature_compare_title')}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('home.feature_compare_body')}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-blue-600 dark:text-blue-400 font-semibold mb-1">{t('home.feature_weather_title')}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('home.feature_weather_body')}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-amber-600 dark:text-amber-400 font-semibold mb-1">{t('home.feature_instant_title')}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('home.feature_instant_body')}</p>
            </div>
          </div>

          <div className="border-l-4 border-emerald-500 pl-4 py-2 mb-6">
            <h3 className="text-lg font-semibold mb-2">{t('home.alfam2_title')}</h3>
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              {t('home.alfam2_body_pre')}{' '}
              <a href="https://projects.au.dk/alfam" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-600 dark:hover:text-emerald-400">ALFAM2</a>{' '}
              {t('home.alfam2_body_post')}
            </p>
            {connectionState.kind === 'connected' && connectionState.data.alfam2_version && (
              <p className="text-xs text-slate-500 mt-2">
                {t('home.alfam2_version_info', { version: connectionState.data.alfam2_version, parsSet: connectionState.data.alfam2_pars_set })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-rose-600 dark:text-rose-400 font-semibold mb-1">{t('home.info_open_source_title')}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('home.info_open_source_body_pre')}{' '}
                <a href="https://github.com/andreastauboeck/ammonitor" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-300">GitHub</a>{' '}
                {t('home.info_open_source_body_post')}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-cyan-600 dark:text-cyan-400 font-semibold mb-1">{t('home.info_api_title')}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('home.info_api_body_pre')}{' '}
                <a href="/docs" className="underline hover:text-slate-900 dark:hover:text-slate-300">{t('home.info_api_link')}</a>{t('home.info_api_body_post')}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold mb-1">{t('home.info_free_title')}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('home.info_free_body')}</p>
            </div>
          </div>

          </div>
        </div>

        {/* ── Footer ── */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {version && <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">v{version}</span>}
          <span>AGPL-3.0</span>
          <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${statusDot}`} />{t('home.backend')}</span>
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-slate-300">Open-Meteo</a>
          <span className="text-slate-400 dark:text-slate-600">CC BY 4.0</span>
          <a href="https://projects.au.dk/alfam" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-slate-300">ALFAM2</a>
          <Link to="/imprint" className="hover:text-slate-900 dark:hover:text-slate-300">{t('home.footer_imprint')}</Link>
          <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-slate-300">{t('home.footer_privacy')}</Link>
          <Link to="/terms" className="hover:text-slate-900 dark:hover:text-slate-300">{t('home.footer_terms')}</Link>
        </div>
      </div>
    </div>
  )
}
