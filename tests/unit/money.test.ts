import { describe, expect, it } from 'vitest'
import {
  add,
  allocate,
  CurrencyMismatchError,
  divRound,
  format,
  money,
  multiplyByRatio,
  parseDecimal,
  percentOf,
  roundToIncrement,
  split,
  subtract,
  sum,
  toDecimalString,
} from '../../shared/money.js'

describe('money()', () => {
  it('accepts integers in minor units and rejects anything else', () => {
    expect(money(4850, 'MYR')).toEqual({ amount: 4850, currency: 'MYR' })
    expect(() => money(48.5, 'MYR')).toThrow(RangeError)
    expect(() => money(Number.MAX_SAFE_INTEGER + 1, 'IDR')).toThrow(RangeError)
    expect(() => money(1, 'XYZ' as never)).toThrow(RangeError)
  })

  it('normalises negative zero', () => {
    expect(Object.is(money(-0, 'SGD').amount, 0)).toBe(true)
  })
})

describe('add / subtract / sum', () => {
  it('works in one currency', () => {
    expect(add(money(1800, 'SGD'), money(4200, 'SGD'))).toEqual(money(6000, 'SGD'))
    expect(subtract(money(1800, 'SGD'), money(4200, 'SGD'))).toEqual(money(-2400, 'SGD'))
    expect(sum([money(1, 'TWD'), money(2, 'TWD'), money(3, 'TWD')], 'TWD')).toEqual(money(6, 'TWD'))
    expect(sum([], 'IDR')).toEqual(money(0, 'IDR'))
  })

  it('refuses to mix currencies', () => {
    expect(() => add(money(100, 'SGD'), money(100, 'MYR'))).toThrow(CurrencyMismatchError)
    expect(() => sum([money(100, 'TWD'), money(100, 'IDR')], 'TWD')).toThrow(CurrencyMismatchError)
  })
})

describe('divRound', () => {
  it.each([
    ['halfUp', 105n, 10n, 11n],
    ['halfUp', 104n, 10n, 10n],
    ['halfUp', -105n, 10n, -11n],
    ['halfEven', 105n, 10n, 10n],
    ['halfEven', 115n, 10n, 12n],
    ['halfEven', 106n, 10n, 11n],
    ['down', 109n, 10n, 10n],
    ['down', -109n, 10n, -10n],
    ['up', 101n, 10n, 11n],
    ['up', -101n, 10n, -11n],
  ] as const)('%s %d / %d = %d', (mode, n, d, expected) => {
    expect(divRound(n, d, mode)).toBe(expected)
  })

  it('throws on division by zero', () => {
    expect(() => divRound(1n, 0n, 'halfUp')).toThrow(RangeError)
  })
})

describe('percentOf / multiplyByRatio', () => {
  it('rounds once, explicitly', () => {
    expect(percentOf(money(11660, 'SGD'), 900, 'halfUp')).toEqual(money(1049, 'SGD')) // 10.494
    expect(percentOf(money(9603, 'MYR'), 600, 'halfUp')).toEqual(money(576, 'MYR')) // 5.7618
    expect(percentOf(money(105, 'SGD'), 1000, 'halfEven')).toEqual(money(10, 'SGD'))
    expect(percentOf(money(105, 'SGD'), 1000, 'halfUp')).toEqual(money(11, 'SGD'))
  })

  it('splits Taiwan tax out of an inclusive total as total × 5 / 105', () => {
    expect(multiplyByRatio(money(2816, 'TWD'), 5, 105, 'halfUp')).toEqual(money(134, 'TWD'))
    expect(multiplyByRatio(money(2560, 'TWD'), 5, 105, 'halfUp')).toEqual(money(122, 'TWD'))
  })
})

describe('allocate', () => {
  it('never loses a minor unit', () => {
    expect(allocate(money(100, 'SGD'), [1, 1, 1]).map((m) => m.amount)).toEqual([34, 33, 33])
    expect(split(money(2817, 'TWD'), 2).map((m) => m.amount)).toEqual([1409, 1408])
    expect(allocate(money(1500, 'SGD'), [9000, 5000]).map((m) => m.amount)).toEqual([964, 536])
  })

  it('keeps zero weights at zero and splits evenly when every weight is zero', () => {
    expect(allocate(money(10, 'MYR'), [1, 0, 1]).map((m) => m.amount)).toEqual([5, 0, 5])
    expect(allocate(money(10, 'MYR'), [0, 0, 0]).map((m) => m.amount)).toEqual([4, 3, 3])
  })

  it('handles negative amounts symmetrically', () => {
    expect(allocate(money(-100, 'SGD'), [1, 1, 1]).map((m) => m.amount)).toEqual([-34, -33, -33])
  })

  it('always sums to the original amount', () => {
    let seed = 7
    const next = () => (seed = (seed * 48271) % 2147483647)
    for (let run = 0; run < 200; run++) {
      const amount = (next() % 2_000_000) - 1_000_000
      const weights = Array.from({ length: 1 + (next() % 7) }, () => next() % 1000)
      const parts = allocate(money(amount, 'IDR'), weights)
      expect(parts.reduce((a, b) => a + b.amount, 0)).toBe(amount)
    }
  })

  it('rejects bad weights', () => {
    expect(() => allocate(money(1, 'SGD'), [])).toThrow(RangeError)
    expect(() => allocate(money(1, 'SGD'), [1.5])).toThrow(RangeError)
    expect(() => allocate(money(1, 'SGD'), [-1])).toThrow(RangeError)
  })
})

describe('roundToIncrement', () => {
  it.each([
    [10179, 10180],
    [10177, 10175],
    [10172, 10170],
    [10173, 10175],
    [10171, 10170],
    [10178, 10180],
  ])('rounds RM %d sen to the nearest 5 sen: %d', (amount, expected) => {
    expect(roundToIncrement(money(amount, 'MYR'), 5, 'halfUp').amount).toBe(expected)
  })

  it('rounds rupiah to Rp 100', () => {
    expect(roundToIncrement(money(519750, 'IDR'), 100, 'halfUp').amount).toBe(519800)
    expect(roundToIncrement(money(519749, 'IDR'), 100, 'halfUp').amount).toBe(519700)
  })
})

describe('format', () => {
  it('matches each country’s display style', () => {
    expect(format(money(1280, 'TWD'))).toBe('NT$1,280')
    expect(format(money(125000, 'IDR'))).toBe('Rp 125.000')
    expect(format(money(4850, 'MYR'))).toBe('RM 48.50')
    expect(format(money(3290, 'SGD'))).toBe('S$32.90')
    expect(format(money(123456789, 'IDR'))).toBe('Rp 123.456.789')
    expect(format(money(1234567, 'SGD'))).toBe('S$12,345.67')
  })

  it('handles signs and the symbol-less form', () => {
    expect(format(money(-1, 'SGD'))).toBe('-S$0.01')
    expect(format(money(1, 'MYR'), { signAlways: true })).toBe('+RM 0.01')
    expect(format(money(4850, 'MYR'), { symbol: false })).toBe('48.50')
  })
})

describe('decimal strings', () => {
  it('prints plain digits for CSV', () => {
    expect(toDecimalString(money(5, 'MYR'))).toBe('0.05')
    expect(toDecimalString(money(-1234, 'MYR'))).toBe('-12.34')
    expect(toDecimalString(money(125000, 'IDR'))).toBe('125000')
  })

  it('parses what a person types', () => {
    expect(parseDecimal('48.50', 'MYR')).toEqual(money(4850, 'MYR'))
    expect(parseDecimal('48,5', 'MYR')).toEqual(money(4850, 'MYR'))
    expect(parseDecimal(' 125000 ', 'IDR')).toEqual(money(125000, 'IDR'))
    expect(parseDecimal('125.000', 'IDR')).toBeNull()
    expect(parseDecimal('1.234', 'MYR')).toBeNull()
    expect(parseDecimal('abc', 'SGD')).toBeNull()
    expect(parseDecimal('-3.20', 'SGD')).toEqual(money(-320, 'SGD'))
  })
})
