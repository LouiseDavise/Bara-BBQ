// Wall-clock maths in a named IANA time zone using only Intl. Instants are stored as UTC;
// a branch's dates and times are always worked out in its own zone (Bali is UTC+8, Jakarta UTC+7).

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday, as in Date#getDay

export interface ZonedParts {
  year: number
  month: number // 1–12
  day: number
  hour: number // 0–23
  minute: number
  second: number
  weekday: Weekday
}

const WEEKDAYS: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const partFormatters = new Map<string, Intl.DateTimeFormat>()

function partFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
    partFormatters.set(timeZone, formatter)
  }
  return formatter
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    partFormatter(timeZone)
    return true
  } catch {
    return false
  }
}

const toMillis = (instant: Date | number): number => (typeof instant === 'number' ? instant : instant.getTime())

export function zonedParts(instant: Date | number, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {}
  for (const part of partFormatter(timeZone).formatToParts(toMillis(instant))) parts[part.type] = part.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday!] ?? 0,
  }
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0')

/** 'YYYY-MM-DD' of the instant in the zone. */
export function localDate(instant: Date | number, timeZone: string): string {
  const p = zonedParts(instant, timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** 'HH:mm' of the instant in the zone. */
export function localTime(instant: Date | number, timeZone: string): string {
  const p = zonedParts(instant, timeZone)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** Minutes the zone is ahead of UTC at that instant (Asia/Makassar → 480). */
export function offsetMinutes(instant: Date | number, timeZone: string): number {
  const ms = toMillis(instant)
  const p = zonedParts(ms, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - (ms - (ms % 1000))) / 60_000)
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^(\d{2}):(\d{2})$/

export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d
}

export function isTimeString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = TIME_PATTERN.exec(value)
  return !!match && Number(match[1]) <= 24 && Number(match[2]) <= 59 && !(Number(match[1]) === 24 && Number(match[2]) !== 0)
}

/** '17:30' → 1050. '24:00' is allowed and means the end of the day. */
export function minutesOf(time: string): number {
  if (!isTimeString(time)) throw new RangeError(`Bad time "${time}".`)
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

/** 1050 → '17:30'; wraps past midnight (1500 → '01:00'). */
export function timeOf(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`
}

/** Calendar arithmetic on 'YYYY-MM-DD' strings, independent of any zone. */
export function addDays(date: string, days: number): string {
  if (!isDateString(date)) throw new RangeError(`Bad date "${date}".`)
  const [y, m, d] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(y!, m! - 1, d! + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

export function weekdayOf(date: string): Weekday {
  if (!isDateString(date)) throw new RangeError(`Bad date "${date}".`)
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() as Weekday
}

/** Whole days from `a` to `b` ('2026-10-01' → '2026-10-29' is 28). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by!, bm! - 1, bd!) - Date.UTC(ay!, am! - 1, ad!)) / 86_400_000)
}

/**
 * The UTC instant of a wall-clock date and time in a zone. '24:00' means midnight at the end
 * of `date`. A time that doesn't exist (skipped by a DST change) resolves to the instant after
 * the gap; an ambiguous time resolves to the earlier instant.
 */
export function fromZoned(date: string, time: string, timeZone: string): Date {
  let minutes = minutesOf(time)
  let day = date
  if (minutes === 1440) {
    day = addDays(date, 1)
    minutes = 0
  }
  const [y, m, d] = day.split('-').map(Number)
  const wallAsUtc = Date.UTC(y!, m! - 1, d!, Math.floor(minutes / 60), minutes % 60)
  const wanted = timeOf(minutes)
  // A zone has at most one offset change within a day either side, so the offsets a day
  // before, at, and a day after cover every candidate instant.
  const offsetBefore = offsetMinutes(wallAsUtc - 86_400_000, timeZone)
  const offsets = new Set([offsetBefore, offsetMinutes(wallAsUtc, timeZone), offsetMinutes(wallAsUtc + 86_400_000, timeZone)])
  const matches = [...offsets]
    .map((offset) => wallAsUtc - offset * 60_000)
    .filter((candidate) => localDate(candidate, timeZone) === day && localTime(candidate, timeZone) === wanted)
    .sort((a, b) => a - b)
  // No match means the time fell in a DST gap: use the pre-change offset, which lands after it.
  return new Date(matches[0] ?? wallAsUtc - offsetBefore * 60_000)
}

/** Adds minutes to an instant. */
export const addMinutes = (instant: Date, minutes: number): Date => new Date(instant.getTime() + minutes * 60_000)
