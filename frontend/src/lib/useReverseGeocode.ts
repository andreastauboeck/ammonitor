import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Reverse-geocode lat/lng to a human-readable place name via Nominatim
 * (OpenStreetMap). Re-runs when lat/lng or language changes.
 */
export function useReverseGeocode(
  lat: string | undefined,
  lng: string | undefined,
): { locationName: string | null; locationLoading: boolean } {
  const { i18n } = useTranslation()
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)

  useEffect(() => {
    if (!lat || !lng) {
      setLocationLoading(false)
      return
    }
    const controller = new AbortController()
    setLocationLoading(true)
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${i18n.language}`,
      {
        headers: { 'User-Agent': 'ammonitor/0.3' },
        signal: controller.signal,
      },
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

  return { locationName, locationLoading }
}
