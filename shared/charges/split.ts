// Splitting a bill into checks that are each paid (and invoiced) separately.
//
// - Evenly by N and by custom amounts: the whole bill is priced once, the total is split, and
//   service charge and tax are spread with allocate(), so the checks always add up to the bill.
// - By item and by seat: each check is priced on its own lines (after their discounts), so each
//   check's own service charge and tax are exact for its invoice. The checks can then differ
//   from the unsplit bill by a rounding unit; the order's total becomes the sum of its checks.
import type { Channel, CountryProfile } from '../country-profiles/types.js'
import { add, allocate, money, subtract, sum, zero, type Money } from '../money.js'
import { calculateBill, type BillLine, type BillResult, type BillSettings } from './calculate-bill.js'

export interface CheckAmounts {
  /** Food and drink plus fees, before service charge and exclusive tax. */
  subtotal: Money
  serviceCharge: Money
  tax: Money
  total: Money
}

export interface LineCheck extends CheckAmounts {
  lineIds: string[]
  gross: Money
  discount: Money
}

function distribute(bill: BillResult, totals: Money[]): CheckAmounts[] {
  const weights = totals.map((t) => t.amount)
  const service = allocate(bill.serviceCharge, weights)
  const tax = allocate(bill.tax, weights)
  return totals.map((total, i) => {
    const serviceCharge = service[i]!
    const checkTax = tax[i]!
    const beforeTax = bill.taxInclusive ? subtract(total, serviceCharge) : subtract(subtract(total, serviceCharge), checkTax)
    return { subtotal: beforeTax, serviceCharge, tax: checkTax, total }
  })
}

/** One tap "split evenly by N": totals differ by at most one minor unit. */
export function splitEvenly(bill: BillResult, parts: number): CheckAmounts[] {
  if (!Number.isSafeInteger(parts) || parts < 2) throw new RangeError('Split into at least 2 parts.')
  return distribute(bill, allocate(bill.total, Array.from({ length: parts }, () => 1)))
}

/** Custom amounts must add up to the bill total exactly. */
export function splitByAmounts(bill: BillResult, amounts: readonly Money[]): CheckAmounts[] {
  if (amounts.length < 2) throw new RangeError('Split into at least 2 parts.')
  if (amounts.some((a) => a.amount <= 0)) throw new RangeError('Every part must be more than zero.')
  const given = sum(amounts, bill.currency)
  if (given.amount !== bill.total.amount) throw new RangeError(`Parts add up to ${given.amount}, not ${bill.total.amount}.`)
  return distribute(bill, [...amounts])
}

export interface SplitInput {
  bill: BillResult
  profile: CountryProfile
  settings: BillSettings
  channel: Channel
}

/** Prices a set of already-discounted line amounts as one check. */
function priceCheck(input: SplitInput, parts: { id: string; amount: Money }[], includeFee: boolean): BillResult {
  const lines: BillLine[] = parts.filter((p) => p.amount.amount > 0).map((p) => ({ id: p.id, unitPrice: p.amount, qty: 1 }))
  const settings: BillSettings = includeFee ? input.settings : { ...input.settings, takeaway: { ...input.settings.takeaway, packagingFee: null } }
  return calculateBill(lines, [], input.profile, settings, input.channel)
}

/** Split by item: every line goes to exactly one group. */
export function splitByLines(input: SplitInput, groups: readonly string[][]): LineCheck[] {
  const byId = new Map(input.bill.lines.map((line) => [line.id, line]))
  const seen = new Set<string>()
  for (const group of groups) {
    for (const id of group) {
      if (!byId.has(id)) throw new RangeError(`Unknown line ${id}.`)
      if (seen.has(id)) throw new RangeError(`Line ${id} is in two checks.`)
      seen.add(id)
    }
  }
  if (seen.size !== byId.size) throw new RangeError('Every line must be in a check.')

  const currency = input.bill.currency
  return groups.map((group, index) => {
    const lines = group.map((id) => byId.get(id)!)
    const priced = priceCheck(input, lines.map((line) => ({ id: line.id, amount: line.net })), index === 0)
    return {
      lineIds: [...group],
      gross: sum(lines.map((line) => line.gross), currency),
      discount: sum(lines.map((line) => add(line.discount, line.comp)), currency),
      subtotal: priced.subtotal,
      serviceCharge: priced.serviceCharge,
      tax: priced.tax,
      total: priced.total,
    }
  })
}

/**
 * Split by seat: lines tagged with a seat go to that seat; untagged (shared) lines are divided
 * evenly between the seats with allocate().
 */
export function splitBySeat(input: SplitInput, seatOf: Readonly<Record<string, number | null | undefined>>, seats: readonly number[]): (LineCheck & { seat: number })[] {
  if (seats.length < 2) throw new RangeError('Split by seat needs at least 2 seats.')
  const currency = input.bill.currency
  const parts = new Map<number, { id: string; amount: Money; gross: Money; discount: Money }[]>(seats.map((seat) => [seat, []]))
  for (const line of input.bill.lines) {
    const seat = seatOf[line.id]
    if (seat != null && parts.has(seat)) {
      parts.get(seat)!.push({ id: line.id, amount: line.net, gross: line.gross, discount: add(line.discount, line.comp) })
      continue
    }
    const amounts = allocate(line.net, seats.map(() => 1))
    const grosses = allocate(line.gross, seats.map(() => 1))
    const discounts = allocate(add(line.discount, line.comp), seats.map(() => 1))
    seats.forEach((s, i) => parts.get(s)!.push({ id: `${line.id}~${s}`, amount: amounts[i]!, gross: grosses[i]!, discount: discounts[i]! }))
  }
  return seats.map((seat, index) => {
    const seatParts = parts.get(seat)!
    const priced = priceCheck(input, seatParts, index === 0)
    return {
      seat,
      lineIds: seatParts.map((p) => p.id),
      gross: seatParts.reduce((acc, p) => add(acc, p.gross), zero(currency)),
      discount: seatParts.reduce((acc, p) => add(acc, p.discount), zero(currency)),
      subtotal: priced.subtotal,
      serviceCharge: priced.serviceCharge,
      tax: priced.tax,
      total: priced.total,
    }
  })
}

/** Sum of several checks, for the order total after a line or seat split. */
export function totalOfChecks(checks: readonly CheckAmounts[], currency: Money['currency']): Money {
  return checks.reduce((acc, check) => add(acc, check.total), money(0, currency))
}
