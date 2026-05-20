import { Dispatch, SetStateAction, useCallback, useState } from 'react'
import { type ApiResponse, type FormData, type VariableName } from '../pages/types'

interface UseCiFetcherArgs {
  data: ApiResponse | null
  setData: Dispatch<SetStateAction<ApiResponse | null>>
  lat: string | undefined
  lng: string | undefined
  formData: FormData
}

export interface UseCiFetcherResult {
  /** `${valueKey}:${day}` keys currently being fetched. */
  ciLoadingValues: Set<string>
  /** Variant values whose CI band is currently visible. */
  ciVisibleValues: Set<string>
  /** Click handler — fetches CI on first call, toggles visibility thereafter. */
  handleCiClick: (value: string | number, day: number) => void
}

/**
 * Apply a variant value onto the right scalar parameter of `formData`.
 *
 * The /api/calculate-ci endpoint accepts all scalars directly (no
 * `variable` discriminator), so we resolve which scalar gets overridden
 * by the chosen variant value here, in the frontend.
 */
function resolveScalars(
  formData: FormData,
  variable: VariableName,
  value: string | number,
) {
  const scalars = {
    app_mthd: formData.appMthd,
    man_dm: formData.manDm,
    man_ph: formData.manPh,
    man_source: formData.manSource,
    app_time: formData.appTime,
    incorp_depth: formData.incorpDepth,
    incorp_time: formData.incorpTime,
  }
  switch (variable) {
    case 'app_mthd':
      scalars.app_mthd = String(value)
      break
    case 'app_time':
      scalars.app_time = typeof value === 'number' ? value : parseInt(String(value), 10)
      break
    case 'man_dm':
      scalars.man_dm = typeof value === 'number' ? value : parseFloat(String(value))
      break
    case 'man_ph':
      scalars.man_ph = typeof value === 'number' ? value : parseFloat(String(value))
      break
    case 'man_source':
      scalars.man_source = String(value).toLowerCase() === 'pig' ? 'pig' : 'cattle'
      break
    case 'incorp_depth':
      scalars.incorp_depth = String(value) as FormData['incorpDepth']
      if (scalars.incorp_depth === 'none') scalars.incorp_time = 0
      break
    case 'incorp_time':
      scalars.incorp_time =
        typeof value === 'number' ? value : parseFloat(String(value))
      break
  }
  return scalars
}

/**
 * Owns the CI fetch + visibility state for variant confidence intervals.
 *
 * - First click on a variant's CI button POSTs `/api/calculate-ci` for
 *   (variant, day) and merges the result into `data.days[day].variants`.
 * - Subsequent clicks toggle the visibility of the CI band locally
 *   without re-fetching.
 * - Loading set is keyed by `${valueKey}:${day}` so the same variant on
 *   different days is tracked separately.
 *
 * The request body contains only resolved scalar parameters; the
 * `variable` / `value` discriminator pair is resolved client-side.
 */
export function useCiFetcher({
  data,
  setData,
  lat,
  lng,
  formData,
}: UseCiFetcherArgs): UseCiFetcherResult {
  const [ciLoadingValues, setCiLoadingValues] = useState<Set<string>>(
    () => new Set(),
  )
  const [ciVisibleValues, setCiVisibleValues] = useState<Set<string>>(
    () => new Set(),
  )

  const toggleCiVisible = useCallback((value: string | number) => {
    const key = String(value)
    setCiVisibleValues((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const fetchCi = useCallback(
    (value: string | number, day: number) => {
      if (!data || !lat || !lng) return
      const valueKey = String(value)
      const loadingKey = `${valueKey}:${day}`
      setCiLoadingValues((prev) => {
        if (prev.has(loadingKey)) return prev
        const next = new Set(prev)
        next.add(loadingKey)
        return next
      })

      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto'
      const scalars = resolveScalars(formData, data.variable, value)

      fetch('/api/calculate-ci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          day,
          timezone: browserTz,
          conf_int: 0.95,
          n_ci: 100,
          ...scalars,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.text()
            throw new Error(err || `Server responded with ${res.status}`)
          }
          return res.json()
        })
        .then((payload: { day: number; start: string; variant: any }) => {
          if (!payload.variant) return
          setData((prev) => {
            if (!prev) return prev
            const nextDays = prev.days.map((d) => {
              if (d.day !== payload.day) return d
              const nextVariants = d.variants.map((v) =>
                String(v.value) === valueKey
                  ? // Backend's `variant.value` is the resolved scalar
                    // (e.g. "bc"); preserve the original variant value
                    // shape stored in the frontend (which is what the
                    // merge keys + Recharts dataKeys use).
                    { ...payload.variant, value: v.value }
                  : v,
              )
              return { ...d, variants: nextVariants }
            })
            return { ...prev, days: nextDays }
          })
          // Auto-show CI on successful fetch.
          setCiVisibleValues((prev) => {
            if (prev.has(valueKey)) return prev
            const next = new Set(prev)
            next.add(valueKey)
            return next
          })
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          console.error('CI fetch error:', message)
        })
        .finally(() => {
          setCiLoadingValues((prev) => {
            if (!prev.has(loadingKey)) return prev
            const next = new Set(prev)
            next.delete(loadingKey)
            return next
          })
        })
    },
    [data, lat, lng, formData, setData],
  )

  const handleCiClick = useCallback(
    (value: string | number, day: number) => {
      if (!data) return
      const valueKey = String(value)
      const dayData = data.days.find((d) => d.day === day)
      const variant = dayData?.variants.find(
        (v) => String(v.value) === valueKey,
      )
      const hasFetched = !!(
        variant && variant.hourly.some((p) => p.er_lwr != null)
      )
      if (hasFetched) {
        toggleCiVisible(value)
      } else {
        fetchCi(value, day)
      }
    },
    [data, fetchCi, toggleCiVisible],
  )

  return { ciLoadingValues, ciVisibleValues, handleCiClick }
}
