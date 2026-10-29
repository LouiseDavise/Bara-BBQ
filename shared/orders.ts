// Helpers between stored order documents and the charges engine.
import { priceBill, type BillLine, type BillResult } from './charges/calculate-bill.js'
import { sum } from './money.js'
import type { OrderDoc, OrderLine } from './types/orders.js'

export function toBillLine(line: OrderLine): BillLine {
  const currency = line.unitPrice.currency
  return {
    id: line.id,
    unitPrice: line.unitPrice,
    modifierTotal: sum(line.modifiers.map((m) => m.priceDelta), currency),
    qty: line.qty,
    categoryId: line.categoryId,
    voided: line.status === 'voided',
    comp: line.comp !== null,
  }
}

/** Re-prices a saved order with the rules snapshotted on it, never today's settings. */
export function repriceOrder(order: OrderDoc): BillResult {
  const fee = order.totals.packagingFee.amount > 0 ? order.totals.packagingFee : null
  return priceBill(order.lines.map(toBillLine), order.discounts, order.pricing, order.totals.total.currency as BillResult['currency'], fee, order.channel)
}
