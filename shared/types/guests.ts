// branches/{branchId}/reservations and the group-wide customers/{customerId} guest profiles.
import type { CountryCode } from '../country-profiles/types.js'
import type { LocalCurrency } from '../currencies.js'
import type { Locale } from '../locales.js'
import type { Money } from '../money.js'
import type { Origin, TimestampLike } from './common.js'

export type ReservationStatus = 'booked' | 'confirmed' | 'arrived' | 'seated' | 'finished' | 'noShow' | 'cancelled'
export type Dietary = 'halal' | 'vegetarian' | 'vegan' | 'noAlcohol'

export interface ReservationDoc {
  id: string
  /** BARA-SIN-7KQ2 */
  code: string
  /** sha256 of the manage-link token; the token itself is only ever emailed or messaged. */
  tokenHash: string
  customerId: string | null
  name: string
  phoneE164: string
  email: string | null
  party: { adults: number; children: number }
  startAt: TimestampLike
  endAt: TimestampLike
  businessDate: string
  /** Start time in the branch's zone, 'HH:mm', for lists and timelines. */
  localTime: string
  tableIds: string[]
  status: ReservationStatus
  source: 'online' | 'phone' | 'walkIn'
  occasion: 'birthday' | 'anniversary' | 'business' | 'date' | 'celebration' | null
  notes: string | null
  allergies: string | null
  dietary: Dietary[]
  seating: 'any' | 'indoor' | 'outdoor' | 'counter' | 'private'
  language: Locale
  policyAccepted: { version: string; at: TimestampLike }
  deposit: { amount: Money; paymentId: string | null; status: 'pending' | 'paid' | 'refunded' } | null
  createdAt: TimestampLike
  updatedAt: TimestampLike
  origin: Origin
}

export interface ConsentRecord {
  marketing: boolean
  noticeVersion: string
  at: TimestampLike
  source: 'reservation' | 'takeaway' | 'staff'
}

export interface CustomerDoc {
  id: string
  name: string
  phoneE164: string | null
  email: string | null
  language: Locale
  allergies: string | null
  dietary: Dietary[]
  notes: string | null
  tags: ('vip' | 'regular' | 'tourist')[]
  /** Consent is recorded per country, under that country's personal data law. */
  consent: Partial<Record<CountryCode, ConsentRecord>>
  /** Lifetime counters; spend is kept per currency and never added across currencies. */
  stats: {
    visits: Record<string, number>
    noShows: number
    spend: Partial<Record<LocalCurrency, number>>
    firstVisitAt: TimestampLike | null
    lastVisitAt: TimestampLike | null
  }
  createdAt: TimestampLike
  origin: Origin
}
