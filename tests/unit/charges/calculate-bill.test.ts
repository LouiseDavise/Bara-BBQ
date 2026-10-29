import { describe, expect, it } from 'vitest'
import { calculateBill, type BillLine, type BillSettings } from '../../../shared/charges/calculate-bill.js'
import { cashDue, changeFor } from '../../../shared/charges/cash-rounding.js'
import { countryProfile, type Channel, type CountryCode } from '../../../shared/country-profiles/index.js'
import { money } from '../../../shared/money.js'
import { resolvePricing, type PricingOverrides } from '../../../shared/settings.js'
import { toLines, workedExamples } from './worked-examples.js'

function settings(pricing: PricingOverrides = {}, packagingFee: number | null = null, currency = 'SGD' as const): BillSettings {
  return {
    pricing,
    takeaway: {
      enabled: true,
      maxPer15: 6,
      prepMin: 20,
      payAtPickupMax: null,
      packagingFee: packagingFee === null ? null : { amount: packagingFee, currency },
      byoDiscount: null,
    },
  }
}

describe('worked examples', () => {
  it.each(workedExamples.map((example) => [example.name, example] as const))('%s', (_, example) => {
    const profile = countryProfile(example.country)
    const bill = calculateBill(
      toLines(example, profile.currency),
      example.discounts ?? [],
      profile,
      settings(example.pricing, example.packagingFee ?? null, profile.currency as never),
      example.channel,
    )
    expect({
      net: bill.net.amount,
      serviceCharge: bill.serviceCharge.amount,
      tax: bill.tax.amount,
      total: bill.total.amount,
    }).toEqual({
      net: example.expected.net,
      serviceCharge: example.expected.serviceCharge,
      tax: example.expected.tax,
      total: example.expected.total,
    })
    if (example.expected.cashDue !== undefined) {
      const rules = resolvePricing(profile, example.pricing)
      expect(cashDue(bill.total, rules.cashRounding).due.amount).toBe(example.expected.cashDue)
    }
  })
})

describe('calculateBill', () => {
  const sg = countryProfile('SG')
  const lines: BillLine[] = [
    { id: 'sate', unitPrice: money(1800, 'SGD'), qty: 2, categoryId: 'food' },
    { id: 'iga', unitPrice: money(4200, 'SGD'), qty: 1, categoryId: 'food', modifierTotal: money(300, 'SGD') },
    { id: 'jamu', unitPrice: money(1400, 'SGD'), qty: 2, categoryId: 'drinks' },
  ]

  it('adds modifier prices per unit', () => {
    const bill = calculateBill(lines, [], sg, settings(), 'dineIn')
    expect(bill.lines.find((l) => l.id === 'iga')!.gross).toEqual(money(4500, 'SGD'))
  })

  it('applies item discounts before bill discounts and spreads the bill discount over lines', () => {
    const bill = calculateBill(
      [
        { id: 'a', unitPrice: money(10000, 'SGD'), qty: 1 },
        { id: 'b', unitPrice: money(5000, 'SGD'), qty: 1 },
      ],
      [
        { id: 'voucher', kind: 'fixed', value: 1500, level: 'bill' },
        { id: 'tenOffA', kind: 'percent', value: 1000, level: 'item', lineIds: ['a'] },
      ],
      sg,
      settings(),
      'dineIn',
    )
    expect(bill.itemDiscounts).toEqual(money(1000, 'SGD'))
    expect(bill.billDiscounts).toEqual(money(1500, 'SGD'))
    expect(bill.lines.map((l) => l.net.amount)).toEqual([8036, 4464])
    expect(bill.discounts).toEqual([
      { id: 'voucher', amount: money(1500, 'SGD') },
      { id: 'tenOffA', amount: money(1000, 'SGD') },
    ])
  })

  it('caps a fixed discount at what it covers', () => {
    const bill = calculateBill(lines, [{ id: 'big', kind: 'fixed', value: 999_999, level: 'bill', categoryIds: ['drinks'] }], sg, settings(), 'dineIn')
    expect(bill.billDiscounts).toEqual(money(2800, 'SGD'))
    expect(bill.lines.find((l) => l.id === 'jamu')!.net).toEqual(money(0, 'SGD'))
  })

  it('keeps line breakdowns consistent with the totals in every country and channel', () => {
    let seed = 11
    const next = () => (seed = (seed * 48271) % 2147483647)
    const countries: CountryCode[] = ['TW', 'ID', 'MY', 'SG']
    const channels: Channel[] = ['dineIn', 'takeaway', 'counter']
    for (let run = 0; run < 300; run++) {
      const profile = countryProfile(countries[run % 4]!)
      const unit = profile.currency === 'IDR' ? 1000 : profile.currency === 'TWD' ? 10 : 10
      const randomLines: BillLine[] = Array.from({ length: 1 + (next() % 8) }, (_, i) => ({
        id: `l${i}`,
        unitPrice: money((1 + (next() % 500)) * unit, profile.currency),
        qty: 1 + (next() % 3),
        categoryId: next() % 2 ? 'food' : 'drinks',
        comp: next() % 17 === 0,
        voided: next() % 13 === 0,
      }))
      const bill = calculateBill(
        randomLines,
        next() % 3 === 0 ? [{ id: 'hh', kind: 'percent', value: 2000, level: 'bill', categoryIds: ['drinks'] }] : [],
        profile,
        settings(next() % 2 ? { rounding: { level: 'line' } } : {}, next() % 2 ? 5 * unit : null, profile.currency as never),
        channels[next() % 3]!,
      )
      const total = (key: 'net' | 'serviceCharge' | 'tax' | 'total') => bill.lines.reduce((acc, l) => acc + l[key].amount, 0)
      expect(total('net')).toBe(bill.net.amount)
      expect(total('serviceCharge')).toBe(bill.serviceCharge.amount)
      expect(total('tax') + bill.packagingFeeTax.amount).toBe(bill.tax.amount)
      const expectedTotal = bill.subtotal.amount + bill.serviceCharge.amount + (bill.taxInclusive ? 0 : bill.tax.amount)
      expect(bill.total.amount).toBe(expectedTotal)
      expect(bill.gross.amount - bill.comps.amount - bill.itemDiscounts.amount - bill.billDiscounts.amount).toBe(bill.net.amount)
    }
  })

  it('snapshots the rules it used', () => {
    const rupiah: BillLine[] = [{ id: 'iga', unitPrice: money(245000, 'IDR'), qty: 1 }]
    const bill = calculateBill(rupiah, [], countryProfile('ID'), settings({ serviceCharge: { bp: 500 } }), 'dineIn')
    expect(bill.rules.serviceCharge.bp).toBe(500)
    expect(bill.rules.tax).toEqual({ bp: 1000, inclusive: false, onServiceCharge: true })
  })

  it('prices an empty bill at zero', () => {
    const bill = calculateBill([], [], sg, settings({}, 50), 'takeaway')
    expect(bill.total).toEqual(money(0, 'SGD'))
    expect(bill.packagingFee).toEqual(money(0, 'SGD'))
  })

  it('refuses lines in another currency, bad quantities and bad discounts', () => {
    expect(() => calculateBill([{ id: 'x', unitPrice: money(100, 'MYR'), qty: 1 }], [], sg, settings(), 'dineIn')).toThrow(RangeError)
    expect(() => calculateBill([{ id: 'x', unitPrice: money(100, 'SGD'), qty: 0 }], [], sg, settings(), 'dineIn')).toThrow(RangeError)
    expect(() => calculateBill(lines, [{ id: 'd', kind: 'percent', value: 12_000, level: 'bill' }], sg, settings(), 'dineIn')).toThrow(RangeError)
  })
})

describe('cash rounding', () => {
  const my = resolvePricing(countryProfile('MY'), {})

  it('is required in Malaysia and can’t be switched off', () => {
    expect(resolvePricing(countryProfile('MY'), { cashRounding: { enabled: false } }).cashRounding.enabled).toBe(true)
    expect(cashDue(money(10179, 'MYR'), my.cashRounding)).toEqual({ due: money(10180, 'MYR'), adjustment: money(1, 'MYR') })
    expect(cashDue(money(10127, 'MYR'), my.cashRounding)).toEqual({ due: money(10125, 'MYR'), adjustment: money(-2, 'MYR') })
  })

  it('is off by default in Singapore and Indonesia', () => {
    const sg = resolvePricing(countryProfile('SG'), {})
    expect(cashDue(money(12709, 'SGD'), sg.cashRounding).due).toEqual(money(12709, 'SGD'))
  })

  it('works out change', () => {
    expect(changeFor(money(15000, 'MYR'), money(10180, 'MYR'))).toEqual(money(4820, 'MYR'))
    expect(changeFor(money(10000, 'MYR'), money(10180, 'MYR'))).toBeNull()
  })
})
