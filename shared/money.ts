// Money is an integer amount in the currency's minor unit plus its currency code:
// { amount: 4850, currency: 'MYR' } is RM 48.50. Arithmetic that can produce fractions
// (rates, percentages, splits) goes through BigInt with an explicit rounding mode, so no
// floating-point number ever touches an amount.
import { CURRENCIES, type CurrencyCode } from './currencies.js'

export interface Money {
  readonly amount: number
  readonly currency: CurrencyCode
}

/**
 * - `halfUp`: nearest, ties away from zero (the default for bills)
 * - `halfEven`: nearest, ties to even (banker's rounding)
 * - `down`: toward zero
 * - `up`: away from zero
 */
export type Rounding = 'halfUp' | 'halfEven' | 'down' | 'up'

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Cannot combine ${a} and ${b}. Convert one of them with fx.convert() first.`)
    this.name = 'CurrencyMismatchError'
  }
}

export function money(amount: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Money amounts are integers in minor units; got ${amount} ${currency}.`)
  }
  if (!Object.hasOwn(CURRENCIES, currency)) throw new RangeError(`Unknown currency ${currency}.`)
  // Normalise -0 so equality and formatting never see it.
  return { amount: amount === 0 ? 0 : amount, currency }
}

export const zero = (currency: CurrencyCode): Money => money(0, currency)

function sameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency)
}

export function add(a: Money, b: Money): Money {
  sameCurrency(a, b)
  return money(a.amount + b.amount, a.currency)
}

export function subtract(a: Money, b: Money): Money {
  sameCurrency(a, b)
  return money(a.amount - b.amount, a.currency)
}

export function sum(items: readonly Money[], currency: CurrencyCode): Money {
  return items.reduce((total, item) => add(total, item), zero(currency))
}

export const negate = (m: Money): Money => money(-m.amount, m.currency)
export const isZero = (m: Money): boolean => m.amount === 0
export const isNegative = (m: Money): boolean => m.amount < 0

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  sameCurrency(a, b)
  return a.amount === b.amount ? 0 : a.amount < b.amount ? -1 : 1
}

export const equals = (a: Money, b: Money): boolean => a.currency === b.currency && a.amount === b.amount

export function min(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b
}

export function max(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b
}

/** Multiplies by a whole quantity (no rounding needed). */
export function multiply(m: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity)) throw new RangeError(`Quantity must be an integer; got ${quantity}.`)
  return money(m.amount * quantity, m.currency)
}

/** Integer division of n / d with the given rounding. Exported for fx.ts and tests. */
export function divRound(n: bigint, d: bigint, rounding: Rounding): bigint {
  if (d === 0n) throw new RangeError('Division by zero.')
  if (d < 0n) {
    n = -n
    d = -d
  }
  const negative = n < 0n
  const abs = negative ? -n : n
  let q = abs / d
  const r = abs % d
  if (r !== 0n) {
    if (rounding === 'up') q += 1n
    else if (rounding === 'halfUp' && r * 2n >= d) q += 1n
    else if (rounding === 'halfEven' && (r * 2n > d || (r * 2n === d && q % 2n === 1n))) q += 1n
  }
  return negative ? -q : q
}

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Amount is too large to represent exactly.')
  }
  return Number(value)
}

/** m × numerator / denominator, rounded once. */
export function multiplyByRatio(
  m: Money,
  numerator: number | bigint,
  denominator: number | bigint,
  rounding: Rounding,
): Money {
  const n = BigInt(m.amount) * BigInt(numerator)
  return money(toSafeNumber(divRound(n, BigInt(denominator), rounding)), m.currency)
}

/** m × basisPoints / 10 000, e.g. percentOf(m, 900, 'halfUp') is 9% of m. */
export function percentOf(m: Money, basisPoints: number, rounding: Rounding): Money {
  return multiplyByRatio(m, basisPoints, 10_000, rounding)
}

/**
 * Splits m into parts proportional to `weights` without losing a minor unit (largest
 * remainder method). Leftover units go to the largest remainders, ties to the earlier part,
 * so the result is deterministic. All-zero weights split evenly.
 */
export function allocate(m: Money, weights: readonly number[]): Money[] {
  if (!weights.length) throw new RangeError('allocate() needs at least one weight.')
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) throw new RangeError(`Weights must be non-negative integers; got ${weight}.`)
  }
  const effective = weights.every((weight) => weight === 0) ? weights.map(() => 1) : weights
  const total = BigInt(effective.reduce((a, b) => a + b, 0))
  const amount = BigInt(m.amount)
  const sign = amount < 0n ? -1n : 1n
  const abs = amount * sign

  const shares = effective.map((weight) => (abs * BigInt(weight)) / total)
  const remainders = effective.map((weight) => (abs * BigInt(weight)) % total)
  let left = abs - shares.reduce((a, b) => a + b, 0n)
  const order = effective
    .map((_, index) => index)
    .sort((a, b) => (remainders[b]! > remainders[a]! ? 1 : remainders[b]! < remainders[a]! ? -1 : a - b))
  for (const index of order) {
    if (left === 0n) break
    shares[index]! += 1n
    left -= 1n
  }
  return shares.map((share) => money(toSafeNumber(share * sign), m.currency))
}

/** Splits m into n parts that differ by at most one minor unit. */
export function split(m: Money, parts: number): Money[] {
  if (!Number.isSafeInteger(parts) || parts < 1) throw new RangeError(`Cannot split into ${parts} parts.`)
  return allocate(m, Array.from({ length: parts }, () => 1))
}

/** Rounds to a multiple of `increment` minor units, e.g. 5 for Malaysia's 5-sen cash rounding. */
export function roundToIncrement(m: Money, increment: number, rounding: Rounding): Money {
  if (!Number.isSafeInteger(increment) || increment < 1) throw new RangeError(`Bad rounding increment ${increment}.`)
  const units = divRound(BigInt(m.amount), BigInt(increment), rounding)
  return money(toSafeNumber(units * BigInt(increment)), m.currency)
}

/** "48.50" for RM 48.50, "125000" for Rp 125.000: plain digits for CSV exports and inputs. */
export function toDecimalString(m: Money): string {
  const { minorUnits } = CURRENCIES[m.currency]
  const negative = m.amount < 0
  const digits = String(Math.abs(m.amount))
  if (minorUnits === 0) return `${negative ? '-' : ''}${digits}`
  const padded = digits.padStart(minorUnits + 1, '0')
  return `${negative ? '-' : ''}${padded.slice(0, -minorUnits)}.${padded.slice(-minorUnits)}`
}

/**
 * Parses an amount someone typed, such as "48.50", "48,50" or "125000", into Money. Thousands
 * separators are rejected ("125.000" is ambiguous between IDR and a decimal).
 */
export function parseDecimal(input: string, currency: CurrencyCode): Money | null {
  const { minorUnits } = CURRENCIES[currency]
  const cleaned = input.trim().replace(/\s/g, '')
  const match = /^(-)?(\d+)(?:[.,](\d+))?$/.exec(cleaned)
  if (!match) return null
  const [, minus, whole, fraction = ''] = match
  if (fraction.length > minorUnits) return null
  const amount = BigInt(whole! + fraction.padEnd(minorUnits, '0'))
  const value = minus ? -amount : amount
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return money(Number(value), currency)
}

export interface FormatOptions {
  /** Leave out the currency symbol (for tables with a currency column). */
  symbol?: boolean
  /** Show a "+" on positive amounts (for adjustments such as cash rounding). */
  signAlways?: boolean
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(locale: string, minorUnits: number): Intl.NumberFormat {
  const key = `${locale}|${minorUnits}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: minorUnits,
      maximumFractionDigits: minorUnits,
      useGrouping: true,
    })
    formatters.set(key, formatter)
  }
  return formatter
}

/**
 * NT$1,280 · Rp 125.000 · RM 48.50 · S$32.90. The style follows the currency, not the page
 * language, so the Bali menu in Japanese still reads "Rp 125.000". Intl formats the exact
 * decimal string, never a float.
 */
export function format(m: Money, options: FormatOptions = {}): string {
  const info = CURRENCIES[m.currency]
  const digits = formatterFor(info.numberLocale, info.minorUnits).format(
    toDecimalString(money(Math.abs(m.amount), m.currency)) as Intl.StringNumericLiteral,
  )
  const body = options.symbol === false ? digits : `${info.symbol}${info.symbolSpace ? ' ' : ''}${digits}`
  if (m.amount < 0) return `-${body}`
  if (options.signAlways && m.amount > 0) return `+${body}`
  return body
}
