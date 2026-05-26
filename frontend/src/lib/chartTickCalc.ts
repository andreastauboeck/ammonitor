/** Constants for HTML Y-axis tick overlay positioning.
 *
 * The `bottom` CSS value for each tick is computed as:
 *   calc(AXIS_BOTTOM + fraction * (100% - AXIS_BOTTOM - MARGIN_TOP))
 *
 * AXIS_BOTTOM (35px) = XAxis height (~30px) + chart margin.bottom (5px)
 * MARGIN_TOP varies: 10px for emission charts, 5px for weather charts.
 *
 * This ensures tick labels sit exactly on the horizontal grid lines,
 * with the top tick pushed above the chart area to avoid clipping.
 */

/** XAxis height (~30px) + chart margin.bottom (5px) */
export const AXIS_BOTTOM = 35

/** Emission chart margin.top */
export const EMISSION_MARGIN_TOP = 10

/** Weather chart margin.top */
export const WEATHER_MARGIN_TOP = 5

/** Total offset subtracted from 100% for emission chart ticks */
export const EMISSION_TICK_OFFSET = AXIS_BOTTOM + EMISSION_MARGIN_TOP // 45

/** Total offset subtracted from 100% for weather chart ticks */
export const WEATHER_TICK_OFFSET = AXIS_BOTTOM + WEATHER_MARGIN_TOP // 40

/** Generate the `bottom` CSS value for a tick at index `i` of `total` ticks. */
export function tickBottom(offset: number, i: number, total: number): string {
  return `calc(${AXIS_BOTTOM}px + ${i / (total - 1)} * (100% - ${offset}px))`
}
