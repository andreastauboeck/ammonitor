import type { FormData, VariableName } from '../pages/types'

/**
 * Apply a value change to a single non-variable form field, propagating
 * the small set of cascading rules:
 *
 * - `incorpDepth === 'none'` ⇒ reset `incorpTime` to 0; if the user was
 *   varying `incorp_time`/`incorp_depth`, fall back to varying `app_mthd`.
 * - Switching `incorpDepth` away from `'none'` ⇒ default `incorpTime` to 4.
 * - Setting `incorpTime > 0` while depth is `'none'` ⇒ bump depth to
 *   `'shallow'` (so the incorporation is actually applied).
 */
export function applyFixedChange<K extends keyof FormData>(
  prev: FormData,
  name: K,
  value: FormData[K],
): FormData {
  const next: FormData = { ...prev, [name]: value }
  if (name === 'incorpDepth') {
    if (value === 'none') {
      next.incorpTime = 0
      if (prev.variable === 'incorp_time' || prev.variable === 'incorp_depth') {
        next.variable = 'app_mthd'
      }
    } else if (prev.incorpDepth === 'none') {
      next.incorpTime = 4
    }
  }
  if (
    name === 'incorpTime' &&
    typeof value === 'number' &&
    value > 0 &&
    prev.incorpDepth === 'none'
  ) {
    next.incorpDepth = 'shallow'
  }
  return next
}

/**
 * Apply a variable-selector change. When the user picks `incorp_time`
 * but `incorpDepth` is still `'none'`, auto-bump depth to `'shallow'` so
 * the variant rows are meaningful.
 */
export function applyVariableChange(
  prev: FormData,
  variable: VariableName,
): FormData {
  if (variable === 'incorp_time' && prev.incorpDepth === 'none') {
    return { ...prev, variable, incorpDepth: 'shallow', incorpTime: 4 }
  }
  return { ...prev, variable }
}
