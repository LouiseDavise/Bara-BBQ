import { describe, expect, it } from 'vitest'
import { generateDay, planDay, type SeedDoc } from '../../../lib/seed/history.js'
import { buildWorld } from '../../../lib/seed/world.js'
import { repriceOrder } from '../../../shared/orders.js'
import { addDays, weekdayOf } from '../../../shared/time/zoned.js'
import type { DailySummary } from '../../../shared/types/finance.js'
import type { OrderDoc } from '../../../shared/types/orders.js'

const world = buildWorld()

/** Timestamps → millis, so documents compare with toEqual. */
function plain(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: unknown }).toMillis === 'function') return (value as { toMillis(): number }).toMillis()
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]))
  return value
}
const byPath = (docs: SeedDoc[]) => new Map(docs.map((d) => [d.path, plain(d.data)]))
const orders = (docs: SeedDoc[]) => docs.filter((d) => d.path.includes('/orders/')).map((d) => d.data as unknown as OrderDoc)
const summaryOf = (docs: SeedDoc[]) => docs.find((d) => d.path.includes('/dailySummaries/'))!.data as unknown as DailySummary

describe('history generator', () => {
  it('produces the same day every time', () => {
    const a = generateDay(world, 'sin', '2026-10-20')
    const b = generateDay(world, 'sin', '2026-10-20')
    expect(byPath(a.docs)).toEqual(byPath(b.docs))
  })

  it('gives the same final documents whether a day is written at once or in catch-up windows', () => {
    const date = '2026-10-17'
    const plan = planDay(world, 'dps', date)
    const full = byPath(generateDay(world, 'dps', date).docs)
    const cuts = [plan.dayStart, plan.dayStart + 9 * 3_600_000, plan.dayStart + 14 * 3_600_000, plan.dayStart + 17.5 * 3_600_000, plan.dayEnd]
    const merged = new Map<string, unknown>()
    for (let i = 0; i < cuts.length - 1; i++) {
      for (const [path, data] of byPath(generateDay(world, 'dps', date, { from: cuts[i], until: cuts[i + 1] }).docs)) merged.set(path, data)
    }
    expect(merged).toEqual(full)
  })

  it('prices every bill exactly as the charges engine does', () => {
    for (const branchId of world.branchIds) {
      for (const order of orders(generateDay(world, branchId, '2026-10-09').docs)) {
        expect(repriceOrder(order).total).toEqual(order.totals.total)
      }
    }
  })

  it('numbers bills without gaps', () => {
    const numbers = orders(generateDay(world, 'tpe', '2026-10-24').docs).map((o) => Number(o.number.split('-').at(-1)))
    expect(numbers).toEqual(numbers.map((_, i) => i + 1))
  })

  it('keeps alcohol off the Kuala Lumpur menu', () => {
    expect(world.branches.kul!.menu.some((item) => item.dietary.containsAlcohol)).toBe(false)
    for (const order of orders(generateDay(world, 'kul', '2026-10-24').docs)) {
      for (const line of order.lines) expect(line.categoryId).not.toBe('cocktails')
    }
  })

  it('gives each branch its own rhythm', () => {
    const days = Array.from({ length: 28 }, (_, i) => addDays('2026-09-28', i))
    const totals = (branchId: string, pick: (s: DailySummary) => number, filter: (d: string) => boolean = () => true) =>
      days.filter(filter).reduce((acc, d) => acc + pick(summaryOf(generateDay(world, branchId, d).docs)), 0)
    const hours = (branchId: string, list: string[]) => totals(branchId, (s) => list.reduce((acc, h) => acc + (s.byHour[h]?.bills ?? 0), 0))

    // Bali is busiest around sunset; Singapore at lunch; Kuala Lumpur at weekends.
    expect(hours('dps', ['18', '19', '20'])).toBeGreaterThan(hours('dps', ['13', '14', '15']) * 2)
    expect(hours('sin', ['12', '13', '14'])).toBeGreaterThan(hours('sin', ['19', '20', '21']))
    const weekend = totals('kul', (s) => s.bills, (d) => [0, 6].includes(weekdayOf(d))) / 8
    const weekday = totals('kul', (s) => s.bills, (d) => ![0, 6].includes(weekdayOf(d))) / 20
    expect(weekend).toBeGreaterThan(weekday * 1.3)
  })

  it('stays inside the nightly write budget', () => {
    // A busy Saturday: the night adds one day per branch, deletes the day that drops out,
    // and books reservations a week ahead.
    let added = 0
    for (const branchId of world.branchIds) {
      added += generateDay(world, branchId, '2026-10-24').docs.length
      added += generateDay(world, branchId, '2026-10-31', { until: planDay(world, branchId, '2026-10-31').dayStart }).docs.length
    }
    const nightly = added * 2
    expect(nightly).toBeLessThan(5_000)
  })
})
