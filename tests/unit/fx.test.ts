import { describe, expect, it } from 'vitest'
import { consolidate, convert, crossRate, fxMonthOf, isValidRate, parseRate, type FxMonth } from '../../shared/fx.js'
import { money } from '../../shared/money.js'

const october: FxMonth = {
  month: '2026-10',
  base: 'USD',
  source: 'manual',
  rates: { TWD: '32.0', IDR: '16000', MYR: '4.40', SGD: '1.28', JPY: '150', KRW: '1380' },
}

describe('rates', () => {
  it('validates decimal strings', () => {
    expect(isValidRate('32.4512')).toBe(true)
    expect(isValidRate('16000')).toBe(true)
    expect(isValidRate('0')).toBe(false)
    expect(isValidRate('-1')).toBe(false)
    expect(isValidRate('1e5')).toBe(false)
    expect(isValidRate(32)).toBe(false)
  })

  it('parses into exact fractions', () => {
    expect(parseRate('32.4512')).toEqual({ num: 324512n, den: 10000n })
    // 32.0 TWD per USD ÷ 1.28 SGD per USD = 25 TWD per SGD
    expect(crossRate(october, 'SGD', 'TWD')).toEqual({ num: 32000n, den: 1280n })
  })
})

describe('convert', () => {
  it('converts in the target currency’s minor unit', () => {
    expect(convert(money(10000, 'SGD'), 'TWD', october)).toEqual({ money: money(2500, 'TWD'), rate: '25.00000000', month: '2026-10' })
    expect(convert(money(1_000_000, 'IDR'), 'TWD', october).money).toEqual(money(2000, 'TWD'))
    expect(convert(money(10179, 'MYR'), 'SGD', october).money).toEqual(money(2961, 'SGD')) // 29.6116…
    expect(convert(money(100, 'USD'), 'TWD', october).money).toEqual(money(32, 'TWD'))
    expect(convert(money(2500, 'TWD'), 'USD', october).money).toEqual(money(7813, 'USD')) // 78.125 → 78.13
  })

  it('returns the same amount for the same currency', () => {
    expect(convert(money(123, 'SGD'), 'SGD', october).money).toEqual(money(123, 'SGD'))
  })

  it('refuses a currency the month has no rate for', () => {
    expect(() => convert(money(100, 'AUD'), 'TWD', october)).toThrow(RangeError)
  })
})

describe('consolidate', () => {
  it('totals equal the sum of the converted branch figures', () => {
    const { total, parts } = consolidate(
      [money(4_250_000, 'IDR'), money(12709, 'SGD'), money(10179, 'MYR'), money(2816, 'TWD')],
      'USD',
      october,
    )
    expect(total.amount).toBe(parts.reduce((acc, p) => acc + p.money.amount, 0))
    expect(total.currency).toBe('USD')
  })

  it('maps a business date to its FX month', () => {
    expect(fxMonthOf('2026-10-29')).toBe('2026-10')
  })
})
