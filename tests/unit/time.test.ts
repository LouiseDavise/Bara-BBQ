import { describe, expect, it } from 'vitest'
import { businessDate, businessDayRange } from '../../shared/time/business-day.js'
import { isOpenAt, openStatus, type WeeklyHours } from '../../shared/time/opening-hours.js'
import { addDays, daysBetween, fromZoned, isDateString, localTime, offsetMinutes, weekdayOf, zonedParts } from '../../shared/time/zoned.js'

describe('zones', () => {
  const instant = Date.parse('2026-10-29T12:00:00Z')

  it('puts Bali one hour ahead of Jakarta', () => {
    expect(zonedParts(instant, 'Asia/Jakarta').hour).toBe(19)
    expect(zonedParts(instant, 'Asia/Makassar').hour).toBe(20)
    expect(offsetMinutes(instant, 'Asia/Jakarta')).toBe(420)
    expect(offsetMinutes(instant, 'Asia/Makassar')).toBe(480)
  })

  it('turns local wall-clock times into UTC', () => {
    expect(fromZoned('2026-10-29', '17:30', 'Asia/Makassar').toISOString()).toBe('2026-10-29T09:30:00.000Z')
    expect(fromZoned('2026-10-29', '17:30', 'Asia/Jakarta').toISOString()).toBe('2026-10-29T10:30:00.000Z')
    expect(fromZoned('2026-10-29', '24:00', 'Asia/Taipei').toISOString()).toBe('2026-10-29T16:00:00.000Z')
  })

  it('handles daylight-saving gaps and overlaps correctly', () => {
    // 02:30 doesn't exist on 8 March 2026 in New York: resolve to 03:30 EDT.
    expect(fromZoned('2026-03-08', '02:30', 'America/New_York').toISOString()).toBe('2026-03-08T07:30:00.000Z')
    // 01:30 happens twice on 1 November 2026: take the earlier (EDT).
    expect(fromZoned('2026-11-01', '01:30', 'America/New_York').toISOString()).toBe('2026-11-01T05:30:00.000Z')
  })

  it('does calendar arithmetic on date strings', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(weekdayOf('2026-10-29')).toBe(4)
    expect(daysBetween('2026-10-01', '2026-10-29')).toBe(28)
    expect(isDateString('2026-02-29')).toBe(false)
    expect(isDateString('2028-02-29')).toBe(true)
  })
})

describe('business day', () => {
  it('ends at 04:00 local, not midnight', () => {
    // 01:30 on Saturday 31 Oct in Singapore belongs to Friday 30 Oct.
    expect(businessDate(Date.parse('2026-10-30T17:30:00Z'), 'Asia/Singapore')).toBe('2026-10-30')
    expect(businessDate(Date.parse('2026-10-30T20:00:00Z'), 'Asia/Singapore')).toBe('2026-10-31')
  })

  it('uses each branch’s own zone (WITA vs WIB)', () => {
    const instant = Date.parse('2026-10-30T20:30:00Z') // 04:30 in Bali, 03:30 in Jakarta
    expect(businessDate(instant, 'Asia/Makassar')).toBe('2026-10-31')
    expect(businessDate(instant, 'Asia/Jakarta')).toBe('2026-10-30')
  })

  it('honours a custom cut-off', () => {
    expect(businessDate(Date.parse('2026-10-30T17:30:00Z'), 'Asia/Singapore', '01:00')).toBe('2026-10-31')
  })

  it('gives the business day as a UTC range', () => {
    const range = businessDayRange('2026-10-29', 'Asia/Singapore')
    expect(range.start.toISOString()).toBe('2026-10-28T20:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-10-29T20:00:00.000Z')
  })
})

describe('opening hours', () => {
  const lunchDinner = [
    { from: '11:30', to: '14:30' },
    { from: '17:30', to: '22:30' },
  ]
  const hours: WeeklyHours = {
    sun: [{ from: '11:30', to: '14:30' }, { from: '14:30', to: '22:00' }],
    mon: lunchDinner,
    tue: lunchDinner,
    wed: lunchDinner,
    thu: lunchDinner,
    fri: [{ from: '11:30', to: '14:30' }, { from: '17:30', to: '00:00' }],
    sat: [{ from: '11:30', to: '14:30' }, { from: '17:30', to: '01:00' }],
  }
  const tz = 'Asia/Taipei'
  const at = (date: string, time: string) => fromZoned(date, time, tz)

  it('knows overnight ranges', () => {
    expect(isOpenAt(at('2026-10-30', '23:30'), hours, [], tz)).toBe(true) // Friday
    expect(isOpenAt(at('2026-10-31', '00:30'), hours, [], tz)).toBe(false) // Friday's range ended at 00:00
    expect(isOpenAt(at('2026-11-01', '00:30'), hours, [], tz)).toBe(true) // Saturday's range runs to 01:00
  })

  it('applies special closures', () => {
    const typhoon = [{ date: '2026-10-29', kind: 'weather' as const, closed: true, reason: { en: 'Typhoon day' } }]
    expect(isOpenAt(at('2026-10-29', '12:00'), hours, typhoon, tz)).toBe(false)
    expect(isOpenAt(at('2026-10-29', '12:00'), hours, [], tz)).toBe(true)
  })

  it('reports when it opens next and when it closes', () => {
    const closed = openStatus(at('2026-10-29', '15:00'), hours, [], tz)
    expect(closed.open).toBe(false)
    expect(localTime(closed.opensAt!, tz)).toBe('17:30')

    const open = openStatus(at('2026-11-01', '12:00'), hours, [], tz) // Sunday, back-to-back ranges merge
    expect(open.open).toBe(true)
    expect(localTime(open.closesAt!, tz)).toBe('22:00')
  })
})
