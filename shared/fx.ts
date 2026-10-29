// FX conversion for HQ reports. A month's rate table stores, for each currency, how many units
// of it buy one USD, as a decimal string ("32.4512"). Rates are parsed into exact fractions and
// conversions use BigInt, so a consolidated figure is reproducible from the rate it records.
import { CURRENCIES, type CurrencyCode } from './currencies.js'
import { divRound, money, type Money, type Rounding } from './money.js'

export const FX_BASE = 'USD' as const

export interface FxMonth {
  /** 'YYYY-MM' */
  month: string
  base: typeof FX_BASE
  /** Units of the currency per 1 USD, as decimal strings. USD itself is implicitly "1". */
  rates: Partial<Record<CurrencyCode, string>>
  source: 'manual' | 'api'
  lockedAt?: string | null
}

export interface Conversion {
  money: Money
  /** Units of `to` per 1 unit of `from`, to 8 decimals, as recorded next to the figure. */
  rate: string
  month: string
}

interface Ratio {
  num: bigint
  den: bigint
}

const RATE_PATTERN = /^\d{1,9}(\.\d{1,12})?$/

export function isValidRate(rate: unknown): rate is string {
  return typeof rate === 'string' && RATE_PATTERN.test(rate) && /[1-9]/.test(rate)
}

export function parseRate(rate: string): Ratio {
  if (!isValidRate(rate)) throw new RangeError(`Bad FX rate "${rate}".`)
  const [whole, fraction = ''] = rate.split('.')
  return { num: BigInt(whole! + fraction), den: 10n ** BigInt(fraction.length) }
}

function perUsd(table: FxMonth, currency: CurrencyCode): Ratio {
  if (currency === FX_BASE) return { num: 1n, den: 1n }
  const rate = table.rates[currency]
  if (!rate) throw new RangeError(`No ${currency} rate for ${table.month}.`)
  return parseRate(rate)
}

/** Units of `to` per 1 unit of `from`, as an exact fraction. */
export function crossRate(table: FxMonth, from: CurrencyCode, to: CurrencyCode): Ratio {
  const a = perUsd(table, from)
  const b = perUsd(table, to)
  // (b.num / b.den) / (a.num / a.den)
  return { num: b.num * a.den, den: b.den * a.num }
}

function ratioToString(ratio: Ratio, decimals = 8): string {
  const scaled = divRound(ratio.num * 10n ** BigInt(decimals), ratio.den, 'halfUp')
  const digits = scaled.toString().padStart(decimals + 1, '0')
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`
}

/**
 * Converts between currencies with the month's table, rounding once in the target's minor unit.
 * minor_to = minor_from × rate × 10^mu_to / 10^mu_from
 */
export function convert(m: Money, to: CurrencyCode, table: FxMonth, rounding: Rounding = 'halfUp'): Conversion {
  if (m.currency === to) return { money: m, rate: '1.00000000', month: table.month }
  const ratio = crossRate(table, m.currency, to)
  const scaleFrom = 10n ** BigInt(CURRENCIES[m.currency].minorUnits)
  const scaleTo = 10n ** BigInt(CURRENCIES[to].minorUnits)
  const amount = divRound(BigInt(m.amount) * ratio.num * scaleTo, ratio.den * scaleFrom, rounding)
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Converted amount is too large.')
  }
  return { money: money(Number(amount), to), rate: ratioToString(ratio), month: table.month }
}

/**
 * Adds figures from several currencies into one reporting currency. Each figure is converted
 * on its own and then summed, so the consolidated total always equals the sum of the
 * converted branch figures shown next to it.
 */
export function consolidate(
  figures: readonly Money[],
  to: CurrencyCode,
  table: FxMonth,
): { total: Money; parts: Conversion[] } {
  const parts = figures.map((figure) => convert(figure, to, table))
  const total = parts.reduce((acc, part) => acc + part.money.amount, 0)
  return { total: money(total, to), parts }
}

/** The month whose rates apply to a business date: '2026-10-29' → '2026-10'. */
export const fxMonthOf = (businessDate: string): string => businessDate.slice(0, 7)
