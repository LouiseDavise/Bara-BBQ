// branches/{branchId}/stock, stockMovements, suppliers and purchaseOrders.
import type { LocalCurrency } from '../currencies.js'
import type { Money } from '../money.js'
import type { Origin, TimestampLike } from './common.js'

/**
 * Unit costs are integers in micro-minor units: minor unit × 10 000 per gram, millilitre or
 * piece. S$0.012 per gram (1.2¢) is 12 000.
 */
export const MICRO = 10_000

export interface StockDoc {
  ingredientId: string
  /** In the ingredient's base unit. May go negative: that shows up as a count variance. */
  onHand: number
  par: number
  reorderQty: number
  supplierId: string | null
  unitCostMicro: number
  currency: LocalCurrency
  updatedAt: TimestampLike
  origin: Origin
}

export type StockReason = 'sale' | 'voidReturn' | 'receive' | 'count' | 'waste' | 'adjust'

/** Append-only. */
export interface StockMovementDoc {
  id: string
  ingredientId: string
  delta: number
  reason: StockReason
  ref: { type: 'order' | 'purchaseOrder' | 'stockCount' | 'day'; id: string } | null
  unitCostMicro: number
  note: string | null
  at: TimestampLike
  businessDate: string
  by: string
  origin: Origin
}

export interface SupplierDoc {
  id: string
  name: string
  contact: string
  phoneE164: string
  email: string | null
  taxId: string | null
  terms: string
  ingredientIds: string[]
  origin: Origin
}

export interface PurchaseOrderDoc {
  id: string
  number: string
  supplierId: string
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'
  lines: { ingredientId: string; qty: number; unitCostMicro: number }[]
  total: Money
  expectedOn: string
  receivedAt: TimestampLike | null
  supplierInvoice: { number: string; photo: string | null; inputTax: Money } | null
  businessDate: string
  createdBy: string
  origin: Origin
}
