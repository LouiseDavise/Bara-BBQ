// branches/{branchId}/orders (one per bill), payments, invoices, shifts and cash movements.
import type { Discount } from '../charges/calculate-bill.js'
import type { CheckAmounts } from '../charges/split.js'
import type { Channel, PricingRules, TenderId } from '../country-profiles/types.js'
import type { LocalizedText } from '../localized.js'
import type { Locale } from '../locales.js'
import type { Money } from '../money.js'
import type { Origin, TimestampLike } from './common.js'
import type { RecipeLine } from './menu.js'

export type LineStatus = 'pending' | 'scheduled' | 'fired' | 'preparing' | 'done' | 'served' | 'voided'

/** A line snapshots everything about the dish at the time it was ordered. */
export interface OrderLine {
  id: string
  menuItemId: string
  masterItemId: string | null
  categoryId: string
  name: LocalizedText
  unitPrice: Money
  modifiers: { groupId: string; optionId: string; name: LocalizedText; priceDelta: Money }[]
  qty: number
  spice: number | null
  notes: string | null
  seat: number | null
  course: number
  held: boolean
  station: string
  status: LineStatus
  allergenIds: string[]
  /** Ingredients deducted when fired, and returned if voided before cooking. */
  recipe: RecipeLine[]
  /** Staff ID, or 'guest' for QR and online orders. */
  addedBy: string
  addedAt: TimestampLike
  firedAt: TimestampLike | null
  voided: { reason: string; by: string; approvedBy: string | null; returnedStock: boolean; at: TimestampLike } | null
  comp: { reason: string; by: string } | null
}

export interface OrderDiscount extends Discount {
  name: string
  promoId: string | null
  by: string
  approvedBy: string | null
}

export interface OrderTotals {
  gross: Money
  comps: Money
  itemDiscounts: Money
  billDiscounts: Money
  net: Money
  packagingFee: Money
  subtotal: Money
  serviceCharge: Money
  tax: Money
  taxInclusive: boolean
  total: Money
}

export interface Check {
  id: string
  mode: 'even' | 'custom' | 'items' | 'seat'
  label: string
  lineIds: string[] | null
  seat: number | null
  amounts: CheckAmounts
  status: 'open' | 'paid'
  invoiceId: string | null
}

export interface TakeawayInfo {
  number: string
  pickupAt: TimestampLike
  asap: boolean
  name: string
  phoneE164: string
  statusToken: string
  status: 'received' | 'preparing' | 'ready' | 'pickedUp' | 'cancelled'
  payAtPickup: boolean
}

export interface OrderDoc {
  id: string
  /** SIN-20261029-0042 */
  number: string
  channel: Channel
  source: 'waiter' | 'qr' | 'pos' | 'online'
  status: 'open' | 'closed' | 'void'
  sessionId: string | null
  tableIds: string[]
  tableLabel: string | null
  covers: number | null
  reservationId: string | null
  takeaway: TakeawayInfo | null
  guestLanguage: Locale
  customerId: string | null
  lines: OrderLine[]
  discounts: OrderDiscount[]
  /** The service charge, tax and rounding rules this bill was priced with. */
  pricing: PricingRules
  totals: OrderTotals
  checks: Check[]
  paid: Money
  tips: Money
  balance: Money
  /** Sum of the cash-rounding lines of its cash payments. */
  cashRounding: Money
  openedAt: TimestampLike
  openedBy: string
  serverId: string | null
  closedAt: TimestampLike | null
  closedBy: string | null
  openedBusinessDate: string
  /** Business date the bill closed on; sales count on this day. */
  businessDate: string | null
  version: number
  origin: Origin
}

export interface PaymentDoc {
  id: string
  orderId: string
  orderNumber: string
  checkId: string | null
  method: TenderId
  /** Applied to the bill. */
  amount: Money
  /** Cash rounding line (cash only; can be negative). The drawer receives amount + rounding. */
  rounding: Money
  tip: Money
  tendered: Money | null
  change: Money | null
  /** 'terminal' for in-store card terminals and wallet QR stands recorded by the cashier. */
  provider: 'terminal' | 'cash' | 'mock' | 'tappay' | 'ecpay' | 'midtrans' | 'xendit' | 'stripe'
  providerRef: string | null
  card: { brand: string; approvalCode: string } | null
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partiallyRefunded'
  shiftId: string | null
  at: TimestampLike
  businessDate: string
  by: string
  idempotencyKey: string | null
  origin: Origin
}

export type InvoiceType = 'tw-b2c' | 'tw-b2b' | 'my-individual' | 'my-consolidated' | 'sg-tax-invoice'

export interface InvoiceDoc {
  id: string
  orderId: string | null
  orderNumber: string | null
  checkId: string | null
  type: InvoiceType
  number: string
  randomCode: string | null
  carrier: { type: 'mobile' | 'citizen'; id: string } | null
  donationCode: string | null
  buyer: { name: string; taxId: string | null; brn: string | null; address: string | null; email: string | null } | null
  amounts: { net: Money; tax: Money; total: Money }
  /** TW: '2026-09/10'; MY consolidated: '2026-10'. */
  period: string
  status: 'issued' | 'void' | 'allowance' | 'pending' | 'failed'
  printed: boolean
  provider: 'mock' | 'ecpay' | 'myinvois' | 'internal'
  providerRef: string | null
  issuedAt: TimestampLike
  businessDate: string
  origin: Origin
}

export interface ShiftDoc {
  id: string
  openedBy: string
  openedAt: TimestampLike
  float: Money
  status: 'open' | 'closed'
  closedAt: TimestampLike | null
  closedBy: string | null
  /** Count per denomination (minor units → count), keyed as strings for Firestore. */
  counted: Record<string, number> | null
  countedTotal: Money | null
  expected: Money | null
  difference: Money | null
  businessDate: string
  origin: Origin
}

export interface CashMovementDoc {
  id: string
  shiftId: string
  kind: 'payIn' | 'payOut'
  amount: Money
  reason: string
  by: string
  approvedBy: string | null
  at: TimestampLike
  businessDate: string
  origin: Origin
}
