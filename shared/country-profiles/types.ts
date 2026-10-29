import type { LocalCurrency } from '../currencies.js'
import type { LocalizedText } from '../localized.js'
import type { Locale } from '../locales.js'
import type { Rounding } from '../money.js'

export const COUNTRY_CODES = ['TW', 'ID', 'MY', 'SG'] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

export const CHANNELS = ['dineIn', 'takeaway', 'counter'] as const
export type Channel = (typeof CHANNELS)[number]

export type TenderId =
  | 'cash'
  | 'card'
  | 'linePay'
  | 'jkoPay'
  | 'easyCard'
  | 'qris'
  | 'goPay'
  | 'ovo'
  | 'shopeePay'
  | 'bankTransfer'
  | 'duitNow'
  | 'tng'
  | 'grabPay'
  | 'nets'
  | 'payNow'

export interface TenderDef {
  id: TenderId
  kind: 'cash' | 'card' | 'wallet' | 'transfer'
  label: LocalizedText
}

/** Everything calculateBill() needs to know about service charge, tax and rounding. */
export interface PricingRules {
  /** Basis points (1000 = 10%), charged only on the listed channels. */
  serviceCharge: { bp: number; channels: Channel[] }
  /**
   * inclusive: menu prices already contain the tax, which is split out (Taiwan).
   * onServiceCharge: the service charge is taxed too.
   */
  tax: { bp: number; inclusive: boolean; onServiceCharge: boolean }
  /** 'bill': service and tax computed once on the bill; 'line': per line, then summed. */
  rounding: { level: 'bill' | 'line'; mode: Rounding }
  /** Applied to the cash part of a payment only, shown as a rounding line. */
  cashRounding: { enabled: boolean; required: boolean; increment: number; mode: Rounding }
}

export type InvoiceKind = 'tw-einvoice' | 'my-myinvois' | 'sg-gst' | 'id-receipt'
export type TaxIdField = 'ubn' | 'npwp' | 'sstNo' | 'gstRegNo'
export type OnlinePaymentProviderId = 'mock' | 'tappay' | 'ecpay' | 'midtrans' | 'xendit' | 'stripe'

export interface CountryProfile {
  code: CountryCode
  name: LocalizedText
  /** When these defaults were last checked against current rules. Shown in branch settings. */
  lastReviewed: string
  /** What an accountant should confirm before a real launch. */
  reviewNotes: string
  currency: LocalCurrency
  defaultTimeZone: string
  callingCode: string
  pricing: PricingRules
  taxName: LocalizedText
  serviceChargeName: LocalizedText
  invoicing: { kind: InvoiceKind; taxIdField: TaxIdField; taxIdLabel: LocalizedText; eInvoice: boolean }
  tenders: TenderDef[]
  onlinePaymentProviders: OnlinePaymentProviderId[]
  messaging: 'line' | 'whatsapp'
  deliveryPlatforms: { id: string; name: string }[]
  taxReport: { period: 'monthly' | 'bimonthly' | 'quarterly'; form: string }
  /** Example local number shown as an input placeholder. */
  phoneExample: string
  /** Default guest languages, default first. */
  guestLanguages: Locale[]
  /** Cash denominations in minor units, largest first, for drawer counts and quick-cash buttons. */
  denominations: { value: number; kind: 'note' | 'coin' }[]
  labour: { dailyLimitH: number }
  privacyLaw: LocalizedText
}
