// branches/{branchId}: the branch profile, hours and settings.
import type { CountryCode, OnlinePaymentProviderId } from '../country-profiles/types.js'
import type { LocalCurrency } from '../currencies.js'
import type { LocalizedText } from '../localized.js'
import type { Locale } from '../locales.js'
import type { Money } from '../money.js'
import type { BranchSettings } from '../settings.js'
import type { SpecialDay, WeeklyHours } from '../time/opening-hours.js'
import type { ImageRef, Origin } from './common.js'

export interface BranchTaxIds {
  /** Legal company name printed on receipts and invoices. */
  companyName: string
  ubn?: string
  npwp?: string
  sstNo?: string
  tin?: string
  brn?: string
  gstRegNo?: string
  uen?: string
}

export interface BranchProviders {
  payment: OnlinePaymentProviderId
  invoice: 'mock' | 'ecpay' | 'myinvois' | 'internal'
  messaging: 'mock' | 'line' | 'whatsapp-link' | 'whatsapp-cloud'
  email: 'mock' | 'resend'
}

export interface BranchDoc {
  id: string
  /** Upper-case code used in bill numbers: SIN-20261029-0042. */
  code: string
  /** Public URL segment: /en/singapore/. */
  slug: string
  country: CountryCode
  currency: LocalCurrency
  timeZone: string
  status: 'active' | 'draft' | 'closed'
  sort: number
  openedOn: string
  name: LocalizedText
  city: LocalizedText
  neighbourhood: LocalizedText
  address: LocalizedText
  postalCode: string
  transport: LocalizedText
  geo: { lat: number; lng: number }
  phoneE164: string
  email: string
  /** LINE official account ID (Taiwan) or WhatsApp number in E.164. */
  messaging: { channel: 'line' | 'whatsapp'; id: string }
  socials: { instagram?: string; facebook?: string }
  googleReviewUrl: string | null
  taxIds: BranchTaxIds
  flags: { halal: boolean; alcohol: boolean }
  features: { chefsCounter: boolean; privateRoom: boolean; garden: boolean; terrace: boolean; sunsetBar: boolean }
  capacity: { tables: number; covers: number }
  averageSpend: { min: Money; max: Money }
  languages: { enabled: Locale[]; default: Locale }
  hours: WeeklyHours
  specialDays: SpecialDay[]
  settings: BranchSettings
  providers: BranchProviders
  deliveryLinks: { platform: string; url: string }[]
  media: { hero: ImageRef | null; gallery: ImageRef[] }
  origin: Origin
}
