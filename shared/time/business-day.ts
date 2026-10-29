// A business day ends at the branch's cut-off (04:00 by default), not at midnight, so a bar
// bill paid at 01:30 on Saturday belongs to Friday.
import { addDays, fromZoned, localDate, minutesOf, zonedParts } from './zoned.js'

export const DEFAULT_CUTOFF = '04:00'

export function businessDate(instant: Date | number, timeZone: string, cutoff: string = DEFAULT_CUTOFF): string {
  const parts = zonedParts(instant, timeZone)
  const date = localDate(instant, timeZone)
  return parts.hour * 60 + parts.minute < minutesOf(cutoff) ? addDays(date, -1) : date
}

/** [start, end) of a business day as UTC instants. */
export function businessDayRange(date: string, timeZone: string, cutoff: string = DEFAULT_CUTOFF): { start: Date; end: Date } {
  return { start: fromZoned(date, cutoff, timeZone), end: fromZoned(addDays(date, 1), cutoff, timeZone) }
}

/** '2026-10-29' → '20261029', used in bill numbers. */
export const compactDate = (date: string): string => date.replaceAll('-', '')
