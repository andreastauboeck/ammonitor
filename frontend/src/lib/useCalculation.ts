import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { type ApiResponse, type FormData, VARIANT_DEFS } from '../pages/types'

interface UseCalculationArgs {
  lat: string | undefined
  lng: string | undefined
  formData: FormData
}

interface UseCalculationResult {
  data: ApiResponse | null
  setData: Dispatch<SetStateAction<ApiResponse | null>>
  loading: boolean
  error: string | null
}

/**
 * Runs the `/api/calculate` POST whenever any model parameter changes.
 *
 * `setData` is exposed so the caller can merge in CI fetch results from
 * `useCiFetcher` without re-running the full calculation.
 */
export function useCalculation({
  lat,
  lng,
  formData,
}: UseCalculationArgs): UseCalculationResult {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lat || !lng) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto'
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

  return { data, setData, loading, error }
}
