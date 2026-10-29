import { describe, expect, it } from 'vitest'
import { calculateBill, type BillLine, type BillSettings } from '../../../shared/charges/calculate-bill.js'
import { splitByAmounts, splitByLines, splitBySeat, splitEvenly, totalOfChecks } from '../../../shared/charges/split.js'
import { countryProfile } from '../../../shared/country-profiles/index.js'
import { money } from '../../../shared/money.js'

const settings: BillSettings = {
  pricing: {},
  takeaway: { enabled: true, maxPer15: 6, prepMin: 20, payAtPickupMax: null, packagingFee: null, byoDiscount: null },
}

const tw = countryProfile('TW')
const sg = countryProfile('SG')

const taipeiLines: BillLine[] = [
  { id: 'iga', unitPrice: money(880, 'TWD'), qty: 2 },
  { id: 'ikan', unitPrice: money(800, 'TWD'), qty: 1 },
]

const singaporeLines: BillLine[] = [
  { id: 'sate', unitPrice: money(1800, 'SGD'), qty: 2 },
  { id: 'iga', unitPrice: money(4200, 'SGD'), qty: 1 },
  { id: 'jamu', unitPrice: money(1400, 'SGD'), qty: 2 },
]

function consistent(check: { subtotal: { amount: number }; serviceCharge: { amount: number }; tax: { amount: number }; total: { amount: number } }, inclusive: boolean) {
  const expected = check.subtotal.amount + check.serviceCharge.amount + (inclusive ? 0 : check.tax.amount)
  expect(check.total.amount).toBe(expected)
}

describe('splitEvenly', () => {
  it('splits the Taipei NT$2,816 bill into two halves with the tax split out of each', () => {
    const bill = calculateBill(taipeiLines, [], tw, settings, 'dineIn')
    const halves = splitEvenly(bill, 2)
    expect(halves.map((h) => h.total.amount)).toEqual([1408, 1408])
    expect(halves.map((h) => h.tax.amount)).toEqual([67, 67])
    expect(halves.map((h) => h.serviceCharge.amount)).toEqual([128, 128])
    halves.forEach((h) => consistent(h, true))
  })

  it('always adds back up to the bill, each check internally consistent', () => {
    const bill = calculateBill(singaporeLines, [], sg, settings, 'dineIn')
    for (const parts of [2, 3, 4, 7]) {
      const checks = splitEvenly(bill, parts)
      expect(totalOfChecks(checks, 'SGD')).toEqual(bill.total)
      expect(checks.reduce((acc, c) => acc + c.tax.amount, 0)).toBe(bill.tax.amount)
      expect(checks.reduce((acc, c) => acc + c.serviceCharge.amount, 0)).toBe(bill.serviceCharge.amount)
      const totals = checks.map((c) => c.total.amount)
      expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1)
      checks.forEach((c) => consistent(c, false))
    }
  })

  it('needs at least two parts', () => {
    const bill = calculateBill(singaporeLines, [], sg, settings, 'dineIn')
    expect(() => splitEvenly(bill, 1)).toThrow(RangeError)
  })
})

describe('splitByAmounts', () => {
  it('accepts custom amounts that add up to the total', () => {
    const bill = calculateBill(singaporeLines, [], sg, settings, 'dineIn')
    const checks = splitByAmounts(bill, [money(5000, 'SGD'), money(7709, 'SGD')])
    expect(checks.map((c) => c.total.amount)).toEqual([5000, 7709])
    checks.forEach((c) => consistent(c, false))
  })

  it('refuses amounts that don’t', () => {
    const bill = calculateBill(singaporeLines, [], sg, settings, 'dineIn')
    expect(() => splitByAmounts(bill, [money(5000, 'SGD'), money(7000, 'SGD')])).toThrow(RangeError)
  })
})

describe('splitByLines', () => {
  it('prices each check on its own lines', () => {
    const bill = calculateBill(singaporeLines, [], sg, settings, 'dineIn')
    const checks = splitByLines({ bill, profile: sg, settings, channel: 'dineIn' }, [['sate', 'iga'], ['jamu']])
    expect(checks[0]!.subtotal).toEqual(money(7800, 'SGD'))
    expect(checks[0]!.serviceCharge).toEqual(money(780, 'SGD'))
    expect(checks[0]!.tax).toEqual(money(772, 'SGD')) // 9% × 85.80 = 7.722
    expect(checks[1]!.total).toEqual(money(3357, 'SGD')) // 28.00 + 2.80 + 2.772 → 2.77
    expect(Math.abs(totalOfChecks(checks, 'SGD').amount - bill.total.amount)).toBeLessThanOrEqual(1)
  })

  it('requires every line in exactly one check', () => {
    const bill = calculateBill(singaporeLines, [], sg, settings, 'dineIn')
    const input = { bill, profile: sg, settings, channel: 'dineIn' as const }
    expect(() => splitByLines(input, [['sate'], ['iga']])).toThrow(RangeError)
    expect(() => splitByLines(input, [['sate', 'iga'], ['iga', 'jamu']])).toThrow(RangeError)
  })
})

describe('splitBySeat', () => {
  it('gives tagged lines to their seat and shares the rest evenly', () => {
    const bill = calculateBill(singaporeLines, [], sg, settings, 'dineIn')
    const checks = splitBySeat({ bill, profile: sg, settings, channel: 'dineIn' }, { sate: 1, iga: 2 }, [1, 2])
    // Seat 1: sate 36.00 + half the jamu 14.00; seat 2: iga 42.00 + half the jamu 14.00
    expect(checks.map((c) => c.subtotal.amount)).toEqual([5000, 5600])
    checks.forEach((c) => consistent(c, false))
  })
})
