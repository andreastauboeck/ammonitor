import { useCallback, useEffect, useState } from 'react'

/**
 * Per-variable hidden-variant state, persisted to localStorage under
 * `ammonitor-hidden-${variableName}`. Each variable has its own independent
 * hidden set so toggling between variables preserves prior choices.
 *
 * The toggle enforces a minimum of 2 visible variants so there's always
 * a pair to compare.
 */
export function useHiddenValues(
  variableName: string,
  values: readonly (string | number)[],
): {
  hiddenValues: Set<string>
  toggleValue: (value: string) => void
} {
  const [hiddenValues, setHiddenValues] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`ammonitor-hidden-${variableName}`)
      if (stored) return new Set(JSON.parse(stored) as string[])
    } catch {}
    return new Set()
  })

  // Reload when the variable changes so each variable has its own set.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`ammonitor-hidden-${variableName}`)
      setHiddenValues(stored ? new Set(JSON.parse(stored) as string[]) : new Set())
    } catch {
      setHiddenValues(new Set())
    }
  }, [variableName])

  // Persist on change.
  useEffect(() => {
    try {
      const key = `ammonitor-hidden-${variableName}`
      if (hiddenValues.size > 0) {
        localStorage.setItem(key, JSON.stringify([...hiddenValues]))
      } else {
        localStorage.removeItem(key)
      }
    } catch {}
  }, [hiddenValues, variableName])

  const toggleValue = useCallback(
    (value: string) => {
      setHiddenValues((prev) => {
        const next = new Set(prev)
        if (next.has(value)) {
          next.delete(value)
        } else {
          // Count how many of the current values are actually visible,
          // ignoring stale entries. Keep at least 2 visible.
          const valueSet = new Set(values.map((v) => String(v)))
          let visibleCount = 0
          for (const v of valueSet) if (!prev.has(v)) visibleCount++
          if (visibleCount <= 2) return prev
          next.add(value)
        }
        return next
      })
    },
    [values],
  )

  return { hiddenValues, toggleValue }
}
