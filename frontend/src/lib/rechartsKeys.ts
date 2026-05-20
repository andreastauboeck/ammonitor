/**
 * Recharts uses dot-notation in `dataKey` strings as a nested-path
 * accessor. Variant values that contain dots (e.g. `5.5` for pH) would
 * therefore be interpreted as `row[5][5]` instead of `row["5.5"]`.
 * `valueToKey` produces a safe key by replacing dots with underscores.
 *
 * The CI-related keys live alongside the main value key in the same
 * data row:
 *   - `${k}_ci`        : ErrorBar tuple [lwrDelta, uprDelta] (OverviewChart)
 *   - `${k}_lwr`       : lower bound for stacked-Area CI (DetailChart)
 *   - `${k}_ci_delta`  : upper-lower delta for the stacked Area
 */

export function valueToKey(value: string | number): string {
  return String(value).replace(/\./g, '_')
}

export const CI_DELTA_SUFFIX = '_ci_delta'

export function ciKey(k: string): string {
  return `${k}_ci`
}

export function lwrKey(k: string): string {
  return `${k}_lwr`
}

export function ciDeltaKey(k: string): string {
  return `${k}${CI_DELTA_SUFFIX}`
}
