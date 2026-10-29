// Opening hours in a branch's local wall-clock time, with overnight ranges (17:30–01:00),
// special days (holidays, typhoon closures, modified hours) and live open/closed status.
import type { LocalizedText } from '../localized.js'
import { addDays, fromZoned, localDate, minutesOf, weekdayOf } from './zoned.js'

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayKey = (typeof DAY_KEYS)[number]

/** A range that starts on a day. `to` at or before `from` means it ends after midnight. */
export interface TimeRange {
  from: string
  to: string
}

/** Keyed by day name because Firestore can't store nested arrays. */
export type WeeklyHours = Record<DayKey, TimeRange[]>

export interface SpecialDay {
  date: string
  kind: 'holiday' | 'closure' | 'event' | 'weather'
  closed: boolean
  /** Replacement hours for the day when it isn't closed. */
  ranges?: TimeRange[]
  reason: LocalizedText
  /** Seeded holiday dates that move every year and should be double-checked. */
  verify?: boolean
}

export interface Interval {
  start: Date
  end: Date
}

export const dayKeyOf = (date: string): DayKey => DAY_KEYS[weekdayOf(date)]!

/** The ranges that start on a local date, after special days are applied. */
export function rangesFor(date: string, hours: WeeklyHours, specials: readonly SpecialDay[] = []): TimeRange[] {
  const special = specials.find((day) => day.date === date)
  if (special) return special.closed ? [] : (special.ranges ?? hours[dayKeyOf(date)])
  return hours[dayKeyOf(date)]
}

export function intervalsFor(
  date: string,
  hours: WeeklyHours,
  specials: readonly SpecialDay[],
  timeZone: string,
): Interval[] {
  return rangesFor(date, hours, specials).map((range) => {
    const overnight = minutesOf(range.to) <= minutesOf(range.from)
    return {
      start: fromZoned(date, range.from, timeZone),
      end: fromZoned(overnight ? addDays(date, 1) : date, range.to, timeZone),
    }
  })
}

function intervalsAround(instant: Date, hours: WeeklyHours, specials: readonly SpecialDay[], timeZone: string, days: number): Interval[] {
  const today = localDate(instant, timeZone)
  const intervals: Interval[] = []
  for (let offset = -1; offset <= days; offset++) {
    intervals.push(...intervalsFor(addDays(today, offset), hours, specials, timeZone))
  }
  return intervals.sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function isOpenAt(instant: Date, hours: WeeklyHours, specials: readonly SpecialDay[], timeZone: string): boolean {
  const t = instant.getTime()
  return intervalsAround(instant, hours, specials, timeZone, 0).some((i) => i.start.getTime() <= t && t < i.end.getTime())
}

export interface OpenStatus {
  open: boolean
  /** When open: the moment it closes (back-to-back ranges are merged). */
  closesAt: Date | null
  /** When closed: the next opening within the look-ahead window. */
  opensAt: Date | null
}

export function openStatus(
  instant: Date,
  hours: WeeklyHours,
  specials: readonly SpecialDay[],
  timeZone: string,
  lookaheadDays = 14,
): OpenStatus {
  const t = instant.getTime()
  const intervals = intervalsAround(instant, hours, specials, timeZone, lookaheadDays)
  const index = intervals.findIndex((i) => i.start.getTime() <= t && t < i.end.getTime())
  if (index >= 0) {
    let closesAt = intervals[index]!.end
    for (const next of intervals.slice(index + 1)) {
      if (next.start.getTime() > closesAt.getTime()) break
      if (next.end.getTime() > closesAt.getTime()) closesAt = next.end
    }
    return { open: true, closesAt, opensAt: null }
  }
  const next = intervals.find((i) => i.start.getTime() > t)
  return { open: false, closesAt: null, opensAt: next?.start ?? null }
}
