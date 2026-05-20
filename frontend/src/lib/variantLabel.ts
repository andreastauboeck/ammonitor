import type { TFunction } from 'i18next'
import type { VariableName, VariantDef } from '../pages/types'

/**
 * Canonical display label for a variant value.
 *
 * - Looks up `variants.${variable}.${labelKey || value}` via i18n.
 * - When the variant has `hasCategory: true`, appends ` — ${category}`
 *   from `categories.${variable}.${labelKey}` if that key exists.
 *
 * Falls back to `String(value)` when no translation is found.
 */
export function variantLabel(
  t: TFunction,
  variable: VariableName,
  value: string | number,
  def?: VariantDef,
): string {
  const key = def?.labelKey ?? String(value)
  const main = t(`variants.${variable}.${key}`, { defaultValue: String(value) })
  if (def?.hasCategory) {
    const cat = t(`categories.${variable}.${key}`, { defaultValue: '' })
    if (cat) return `${main} — ${cat}`
  }
  return main
}
