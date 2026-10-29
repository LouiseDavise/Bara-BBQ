// The charges engine. Every bill, split, receipt, report and seeded order is priced here.
//
// Order of operations:
//   1. line gross = (unit price + modifiers) × qty; voided lines count as 0; comps are given away
//   2. item-level discounts, per line
//   3. bill-level discounts in the order given, each allocated back to its lines
//   4. takeaway packaging fee (taxable, no service charge)
//   5. service charge on the discounted subtotal, only on the channels the branch charges it on
//   6. tax: inclusive (split out of the total, Taiwan) or exclusive (added, on subtotal and, if
//      the setting says so, the service charge)
// Cash rounding is not part of the bill: it applies to the cash part of a payment only
// (see cash-rounding.ts).
import type { Channel, CountryProfile, PricingRules } from '../country-profiles/types.js'
import type { LocalCurrency } from '../currencies.js'
import { add, allocate, min, money, multiply, multiplyByRatio, percentOf, subtract, sum, zero, type Money } from '../money.js'
import { resolvePricing, serviceChargeApplies, type BranchSettings } from '../settings.js'

export interface BillLine {
  id: string
  unitPrice: Money
  /** Sum of the line's modifier price deltas, per unit. */
  modifierTotal?: Money
  qty: number
  categoryId?: string
  voided?: boolean
  /** Complimentary: the guest isn't charged; the value is reported as a comp. */
  comp?: boolean
}

export interface Discount {
  id: string
  kind: 'percent' | 'fixed'
  /** Basis points for 'percent' (2000 = 20%); minor units for 'fixed'. */
  value: number
  /** 'item' discounts apply per line first; 'bill' discounts then apply in order. */
  level: 'item' | 'bill'
  /** Limit to these lines; omit both filters for every line. */
  lineIds?: string[]
  categoryIds?: string[]
}

export interface LineCharges {
  id: string
  gross: Money
  comp: Money
  discount: Money
  /** gross − comp − discount */
  net: Money
  serviceCharge: Money
  tax: Money
  /** What the line costs the guest, including its share of service charge (and exclusive tax). */
  total: Money
}

export interface BillResult {
  currency: LocalCurrency
  channel: Channel
  lines: LineCharges[]
  gross: Money
  comps: Money
  itemDiscounts: Money
  billDiscounts: Money
  discounts: { id: string; amount: Money }[]
  /** Sum of line nets: food and drink after comps and discounts. */
  net: Money
  packagingFee: Money
  /** net + packaging fee */
  subtotal: Money
  serviceCharge: Money
  taxBase: Money
  tax: Money
  taxInclusive: boolean
  /** Payable before any cash rounding. */
  total: Money
  /** Tax share of the packaging fee (the rest of the tax is spread over the lines). */
  packagingFeeTax: Money
  /** The rules that were applied, snapshotted onto the order. */
  rules: PricingRules
}

export type BillSettings = Pick<BranchSettings, 'pricing' | 'takeaway'>

interface WorkingLine {
  line: BillLine
  gross: Money
  comp: Money
  discount: Money
  net: Money
}

function applies(discount: Discount, line: BillLine): boolean {
  if (discount.lineIds && !discount.lineIds.includes(line.id)) return false
  if (discount.categoryIds && !(line.categoryId && discount.categoryIds.includes(line.categoryId))) return false
  return true
}

function assertLine(line: BillLine, currency: LocalCurrency): void {
  if (!Number.isSafeInteger(line.qty) || line.qty < 1) throw new RangeError(`Line ${line.id}: qty must be a whole number ≥ 1.`)
  if (line.unitPrice.currency !== currency || (line.modifierTotal && line.modifierTotal.currency !== currency)) {
    throw new RangeError(`Line ${line.id} is not priced in ${currency}.`)
  }
  if (line.unitPrice.amount < 0) throw new RangeError(`Line ${line.id} has a negative price.`)
}

function assertDiscount(discount: Discount): void {
  if (!Number.isSafeInteger(discount.value) || discount.value < 0) throw new RangeError(`Discount ${discount.id} has a bad value.`)
  if (discount.kind === 'percent' && discount.value > 10_000) throw new RangeError(`Discount ${discount.id} is over 100%.`)
}

export function calculateBill(
  lines: readonly BillLine[],
  discounts: readonly Discount[],
  countryProfile: CountryProfile,
  branchSettings: BillSettings,
  channel: Channel,
): BillResult {
  const fee = branchSettings.takeaway.packagingFee
  return priceBill(lines, discounts, resolvePricing(countryProfile, branchSettings.pricing), countryProfile.currency, fee, channel)
}

/**
 * The same calculation from already-resolved rules: used to re-price a saved bill with the
 * rules snapshotted onto it (order.pricing), so later setting changes never alter history.
 */
export function priceBill(
  lines: readonly BillLine[],
  discounts: readonly Discount[],
  rules: PricingRules,
  currency: LocalCurrency,
  packagingFeeSetting: Money | null,
  channel: Channel,
): BillResult {
  const mode = rules.rounding.mode
  const none = zero(currency)

  // 1. Gross, comps
  const working: WorkingLine[] = lines.map((line) => {
    assertLine(line, currency)
    const unit = line.modifierTotal ? add(line.unitPrice, line.modifierTotal) : line.unitPrice
    const gross = line.voided ? none : multiply(unit, line.qty)
    const comp = line.comp ? gross : none
    return { line, gross, comp, discount: none, net: subtract(gross, comp) }
  })

  const discountTotals = new Map<string, Money>()
  const record = (id: string, amount: Money) => discountTotals.set(id, add(discountTotals.get(id) ?? none, amount))
  const take = (entry: WorkingLine, amount: Money) => {
    entry.discount = add(entry.discount, amount)
    entry.net = subtract(entry.net, amount)
  }

  // 2. Item-level discounts, line by line
  let itemDiscounts = none
  for (const discount of discounts.filter((d) => d.level === 'item')) {
    assertDiscount(discount)
    for (const entry of working) {
      if (entry.net.amount === 0 || !applies(discount, entry.line)) continue
      const amount =
        discount.kind === 'percent' ? percentOf(entry.net, discount.value, mode) : min(money(discount.value, currency), entry.net)
      take(entry, amount)
      record(discount.id, amount)
      itemDiscounts = add(itemDiscounts, amount)
    }
  }

  // 3. Bill-level discounts, in order, each spread over the lines it covers
  let billDiscounts = none
  for (const discount of discounts.filter((d) => d.level === 'bill')) {
    assertDiscount(discount)
    const eligible = working.filter((entry) => entry.net.amount > 0 && applies(discount, entry.line))
    const base = sum(eligible.map((entry) => entry.net), currency)
    const amount = discount.kind === 'percent' ? percentOf(base, discount.value, mode) : min(money(discount.value, currency), base)
    if (amount.amount > 0) {
      allocate(amount, eligible.map((entry) => entry.net.amount)).forEach((share, i) => take(eligible[i]!, share))
    }
    record(discount.id, amount)
    billDiscounts = add(billDiscounts, amount)
  }

  const net = sum(working.map((entry) => entry.net), currency)
  const hasItems = working.some((entry) => entry.gross.amount > 0)

  // 4. Packaging fee
  const fee = packagingFeeSetting
  const packagingFee = channel === 'takeaway' && hasItems && fee && fee.amount > 0 ? money(fee.amount, currency) : none
  const subtotal = add(net, packagingFee)

  // 5 & 6. Service charge and tax
  const chargeService = serviceChargeApplies(rules, channel)
  const { bp: taxBp, inclusive, onServiceCharge } = rules.tax
  const taxOf = (base: Money) =>
    inclusive ? multiplyByRatio(base, taxBp, 10_000 + taxBp, mode) : percentOf(base, taxBp, mode)

  let lineService: Money[]
  let lineTax: Money[]
  let packagingFeeTax: Money

  if (rules.rounding.level === 'line') {
    lineService = working.map((entry) => (chargeService ? percentOf(entry.net, rules.serviceCharge.bp, mode) : none))
    lineTax = working.map((entry, i) => taxOf(onServiceCharge ? add(entry.net, lineService[i]!) : entry.net))
    packagingFeeTax = taxOf(packagingFee)
  } else {
    const serviceCharge = chargeService ? percentOf(net, rules.serviceCharge.bp, mode) : none
    lineService = working.length ? allocate(serviceCharge, working.map((entry) => entry.net.amount)) : []
    const taxableLines = working.map((entry, i) => (onServiceCharge ? add(entry.net, lineService[i]!) : entry.net))
    const tax = taxOf(add(sum(taxableLines, currency), packagingFee))
    // Spread the bill's tax over the lines and the fee in proportion to what was taxed.
    const shares = allocate(tax, [...taxableLines.map((m) => m.amount), packagingFee.amount])
    packagingFeeTax = shares.pop()!
    lineTax = shares
  }

  const serviceCharge = sum(lineService, currency)
  const tax = add(sum(lineTax, currency), packagingFeeTax)
  const taxBase = add(subtotal, onServiceCharge ? serviceCharge : none)
  const total = inclusive ? add(subtotal, serviceCharge) : add(add(subtotal, serviceCharge), tax)

  const lineResults: LineCharges[] = working.map((entry, i) => {
    const service = lineService[i]!
    const lineTaxAmount = lineTax[i]!
    return {
      id: entry.line.id,
      gross: entry.gross,
      comp: entry.comp,
      discount: entry.discount,
      net: entry.net,
      serviceCharge: service,
      tax: lineTaxAmount,
      total: inclusive ? add(entry.net, service) : add(add(entry.net, service), lineTaxAmount),
    }
  })

  return {
    currency,
    channel,
    lines: lineResults,
    gross: sum(working.map((entry) => entry.gross), currency),
    comps: sum(working.map((entry) => entry.comp), currency),
    itemDiscounts,
    billDiscounts,
    discounts: discounts.map((d) => ({ id: d.id, amount: discountTotals.get(d.id) ?? none })),
    net,
    packagingFee,
    subtotal,
    serviceCharge,
    taxBase,
    tax,
    taxInclusive: inclusive,
    total,
    packagingFeeTax,
    rules,
  }
}
