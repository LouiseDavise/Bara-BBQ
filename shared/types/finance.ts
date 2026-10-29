// branches/{branchId}/expenses, timeEntries, feedback and the pre-aggregated dailySummaries.
import type { Channel } from '../country-profiles/types.js'
import type { LocalCurrency } from '../currencies.js'
import type { Locale } from '../locales.js'
import type { Money } from '../money.js'
import type { Origin, TimestampLike } from './common.js'

export const EXPENSE_CATEGORIES = [
  'rent',
  'payroll',
  'statutory',
  'utilities',
  'gasCharcoal',
  'marketing',
  'maintenance',
  'royalties',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface ExpenseDoc {
  id: string
  category: ExpenseCategory
  amount: Money
  /** Input tax on the expense, where the country lets it be claimed. */
  inputTax: Money | null
  /** The day the cost belongs to; also its business date. */
  businessDate: string
  month: string
  supplier: string | null
  receiptPhoto: string | null
  note: string | null
  by: string
  createdAt: TimestampLike
  origin: Origin
}

export interface TimeEntryDoc {
  id: string
  staffId: string
  in: TimestampLike
  out: TimestampLike | null
  minutes: number | null
  businessDate: string
  hourlyRate: Money
  flags: ('overDailyLimit' | 'missingClockOut')[]
  origin: Origin
}

export interface FeedbackDoc {
  id: string
  orderId: string
  rating: 1 | 2 | 3 | 4 | 5
  comment: string | null
  language: Locale
  at: TimestampLike
  businessDate: string
  alerted: boolean
  origin: Origin
}

/**
 * One business day of one branch, pre-aggregated so reports and HQ never scan raw orders.
 * Every amount is in minor units of `currency`.
 */
export interface DailySummary {
  branchId: string
  businessDate: string
  currency: LocalCurrency
  bills: number
  covers: number
  /** Line value before comps and discounts. */
  gross: number
  comps: number
  discounts: number
  /** Value of lines voided after they were fired. */
  voids: number
  voidCount: number
  discountCount: number
  refunds: number
  /** Food and drink after comps and discounts (tax-inclusive where menu prices are). */
  itemNet: number
  packaging: number
  serviceCharge: number
  tax: number
  /** What guests were charged: itemNet + packaging + service charge (+ exclusive tax). */
  total: number
  /** total − tax: the sales figure for the P&L. */
  netSales: number
  rounding: number
  tips: number
  byPayment: Record<string, number>
  byChannel: Partial<Record<Channel, { bills: number; total: number }>>
  byCategory: Record<string, number>
  byItem: Record<string, { qty: number; net: number; cost: number }>
  /** Keyed by local hour '00'–'23' when the bill closed. */
  byHour: Record<string, { bills: number; covers: number; total: number }>
  byStaff: Record<string, { bills: number; total: number }>
  byLanguage: Partial<Record<Locale, { bills: number; total: number }>>
  /** Recipe cost of everything sold. */
  theoreticalCost: number
  /** Goods received that day (COGS basis for the P&L). */
  purchases: number
  labourMinutes: number
  labourCost: number
  ratingSum: number
  ratingCount: number
  reservations: { booked: number; seatedCovers: number; noShows: number; cancelled: number }
  /** Set by the nightly job once the day is rebuilt from raw data. */
  finalized: boolean
  updatedAt: TimestampLike | null
  origin: Origin
}
