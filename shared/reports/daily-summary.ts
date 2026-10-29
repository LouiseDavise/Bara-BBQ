// Builds one branch's DailySummary from that business day's documents. The live system updates
// summaries as payments land and the nightly job rebuilds them with this function; the seed uses
// it for history, so reports and HQ read the same numbers either way.
import type { LocalCurrency } from '../currencies.js'
import { divRound } from '../money.js'
import { repriceOrder } from '../orders.js'
import { zonedParts } from '../time/zoned.js'
import type { DailySummary, FeedbackDoc, TimeEntryDoc } from '../types/finance.js'
import type { ReservationDoc } from '../types/guests.js'
import { MICRO } from '../types/inventory.js'
import type { OrderDoc, PaymentDoc } from '../types/orders.js'

export interface SummaryInput {
  branchId: string
  businessDate: string
  currency: LocalCurrency
  timeZone: string
  /** Closed (and voided) bills of the business day. */
  orders: readonly OrderDoc[]
  /** Succeeded payments of the business day. */
  payments: readonly PaymentDoc[]
  /** Refunds made on the business day, in minor units. */
  refunds: readonly number[]
  timeEntries: readonly TimeEntryDoc[]
  feedback: readonly FeedbackDoc[]
  reservations: readonly ReservationDoc[]
  /** Totals of goods received that day, in minor units. */
  purchases: readonly number[]
  /** Recipe cost per menu item at this branch, in micro-minor units. */
  unitCostMicro: Readonly<Record<string, number>>
}

const bump = (record: Record<string, number>, key: string, amount: number) => {
  record[key] = (record[key] ?? 0) + amount
}

export function summarizeDay(input: SummaryInput): Omit<DailySummary, 'updatedAt' | 'origin' | 'finalized'> {
  const summary: Omit<DailySummary, 'updatedAt' | 'origin' | 'finalized'> = {
    branchId: input.branchId,
    businessDate: input.businessDate,
    currency: input.currency,
    bills: 0,
    covers: 0,
    gross: 0,
    comps: 0,
    discounts: 0,
    voids: 0,
    voidCount: 0,
    discountCount: 0,
    refunds: input.refunds.reduce((a, b) => a + b, 0),
    itemNet: 0,
    packaging: 0,
    serviceCharge: 0,
    tax: 0,
    total: 0,
    netSales: 0,
    rounding: 0,
    tips: 0,
    byPayment: {},
    byChannel: {},
    byCategory: {},
    byItem: {},
    byHour: {},
    byStaff: {},
    byLanguage: {},
    theoreticalCost: 0,
    purchases: input.purchases.reduce((a, b) => a + b, 0),
    labourMinutes: 0,
    labourCost: 0,
    ratingSum: 0,
    ratingCount: 0,
    reservations: { booked: 0, seatedCovers: 0, noShows: 0, cancelled: 0 },
  }

  let costMicro = 0
  for (const order of input.orders) {
    if (order.status !== 'closed') continue
    const bill = repriceOrder(order)
    summary.bills += 1
    summary.covers += order.covers ?? 0
    summary.gross += bill.gross.amount
    summary.comps += bill.comps.amount
    summary.discounts += bill.itemDiscounts.amount + bill.billDiscounts.amount
    if (bill.itemDiscounts.amount + bill.billDiscounts.amount > 0) summary.discountCount += 1
    summary.itemNet += bill.net.amount
    summary.packaging += bill.packagingFee.amount
    summary.serviceCharge += bill.serviceCharge.amount
    summary.tax += bill.tax.amount
    summary.total += bill.total.amount
    summary.netSales += bill.total.amount - bill.tax.amount

    const channel = (summary.byChannel[order.channel] ??= { bills: 0, total: 0 })
    channel.bills += 1
    channel.total += bill.total.amount

    const closedAt = order.closedAt?.toMillis() ?? order.openedAt.toMillis()
    const hour = String(zonedParts(closedAt, input.timeZone).hour).padStart(2, '0')
    const slot = (summary.byHour[hour] ??= { bills: 0, covers: 0, total: 0 })
    slot.bills += 1
    slot.covers += order.covers ?? 0
    slot.total += bill.total.amount

    const staffKey = order.serverId ?? order.openedBy
    const staff = (summary.byStaff[staffKey] ??= { bills: 0, total: 0 })
    staff.bills += 1
    staff.total += bill.total.amount

    const language = (summary.byLanguage[order.guestLanguage] ??= { bills: 0, total: 0 })
    language.bills += 1
    language.total += bill.total.amount

    const priced = new Map(bill.lines.map((line) => [line.id, line]))
    for (const line of order.lines) {
      if (line.status === 'voided') {
        if (line.firedAt) {
          summary.voids += (line.unitPrice.amount + line.modifiers.reduce((a, m) => a + m.priceDelta.amount, 0)) * line.qty
          summary.voidCount += 1
        }
        continue
      }
      const net = priced.get(line.id)?.net.amount ?? 0
      bump(summary.byCategory, line.categoryId, net)
      const item = (summary.byItem[line.menuItemId] ??= { qty: 0, net: 0, cost: 0 })
      item.qty += line.qty
      item.net += net
      const lineCostMicro = (input.unitCostMicro[line.menuItemId] ?? 0) * line.qty
      item.cost += Number(divRound(BigInt(lineCostMicro), BigInt(MICRO), 'halfUp'))
      costMicro += lineCostMicro
    }
  }
  summary.theoreticalCost = Number(divRound(BigInt(costMicro), BigInt(MICRO), 'halfUp'))

  for (const payment of input.payments) {
    if (payment.status !== 'succeeded' && payment.status !== 'partiallyRefunded') continue
    bump(summary.byPayment, payment.method, payment.amount.amount)
    summary.rounding += payment.rounding.amount
    summary.tips += payment.tip.amount
  }

  for (const entry of input.timeEntries) {
    if (entry.minutes === null) continue
    summary.labourMinutes += entry.minutes
    summary.labourCost += Number(divRound(BigInt(entry.minutes) * BigInt(entry.hourlyRate.amount), 60n, 'halfUp'))
  }

  for (const item of input.feedback) {
    summary.ratingSum += item.rating
    summary.ratingCount += 1
  }

  for (const reservation of input.reservations) {
    if (reservation.status === 'cancelled') summary.reservations.cancelled += 1
    else summary.reservations.booked += 1
    if (reservation.status === 'noShow') summary.reservations.noShows += 1
    if (reservation.status === 'seated' || reservation.status === 'finished') {
      summary.reservations.seatedCovers += reservation.party.adults + reservation.party.children
    }
  }
  return summary
}
