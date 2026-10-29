// Branch settings: everything an owner can change per branch. Country defaults come from
// country-profiles; `pricing` holds only the overrides, merged by resolvePricing().
import type { Channel, CountryProfile, PricingRules, TenderId } from './country-profiles/types.js'
import type { LocalizedText } from './localized.js'
import type { Money } from './money.js'
import type { DayKey } from './time/opening-hours.js'

export interface PricingOverrides {
  serviceCharge?: Partial<PricingRules['serviceCharge']>
  tax?: Partial<PricingRules['tax']>
  rounding?: Partial<PricingRules['rounding']>
  /** `required` can't be overridden: Malaysia's 5-sen rounding is the law. */
  cashRounding?: Partial<Omit<PricingRules['cashRounding'], 'required'>>
}

export interface Station {
  id: string
  name: LocalizedText
}

export interface PeakWindow {
  days: DayKey[]
  from: string
  to: string
}

export interface DiningRules {
  /** Dining time limit during peak windows, in minutes; null for no limit. */
  timeLimitMin: number | null
  peak: PeakWindow[]
  minSpendPerAdult: Money | null
  /** How long a late reservation is held before it can be released. */
  lateHoldMin: number
}

export interface ReservationRules {
  enabled: boolean
  stepMin: number
  /** Dining duration by party size: the first entry whose maxParty fits is used. */
  durations: { maxParty: number; lunchMin: number; dinnerMin: number }[]
  /** Bookings starting at or after this time use the dinner duration. */
  dinnerFrom: string
  bufferMin: number
  maxCoversPer15: number
  /** Share of tables kept for walk-ins, in percent. */
  walkInHoldbackPct: number
  /** Party size from which a booking needs a deposit or becomes an enquiry. */
  largePartyAt: number
  largeParty: 'deposit' | 'enquiry'
  depositPerGuest: Money | null
  cancelWindowH: number
  bookingWindowDays: number
}

export interface TakeawayRules {
  enabled: boolean
  maxPer15: number
  prepMin: number
  /** "Pay at pickup" is offered only below this amount; null disables it. */
  payAtPickupMax: Money | null
  packagingFee: Money | null
  byoDiscount: Money | null
}

export interface BranchSettings {
  pricing: PricingOverrides
  businessDayCutoff: string
  dining: DiningRules
  reservations: ReservationRules
  takeaway: TakeawayRules
  qr: { mode: 'staffOpens' | 'autoOpen'; confirmByWaiter: boolean; maxQtyPerItem: number }
  /** Largest discount a cashier gives without a manager PIN, in basis points. */
  discounts: { cashierLimitBp: number }
  permissions: { managersCanChangePrice: boolean; waitersTakePayment: boolean }
  kds: { amberMin: number; redMin: number; sound: boolean }
  stations: Station[]
  /** Enabled tenders in button order; a subset of the country profile's. */
  tenders: TenderId[]
  receipts: { footer: LocalizedText; feedbackQr: boolean }
  labour: { dailyLimitH: number }
  notifications: { dailyEmail: boolean; lowRatingAt: number }
  /** Minutes of inactivity before a shared device returns to the PIN screen. */
  idleLockMin: number
}

/** The service charge, tax and rounding a branch actually uses. */
export function resolvePricing(profile: CountryProfile, overrides: PricingOverrides | undefined): PricingRules {
  const base = profile.pricing
  const cash = { ...base.cashRounding, ...overrides?.cashRounding, required: base.cashRounding.required }
  if (cash.required) cash.enabled = true
  return {
    serviceCharge: { ...base.serviceCharge, ...overrides?.serviceCharge },
    tax: { ...base.tax, ...overrides?.tax },
    rounding: { ...base.rounding, ...overrides?.rounding },
    cashRounding: cash,
  }
}

export const serviceChargeApplies = (rules: PricingRules, channel: Channel): boolean =>
  rules.serviceCharge.bp > 0 && rules.serviceCharge.channels.includes(channel)
