// Currency facts used by money.ts. Minor units are what we store; TWD and IDR are treated as
// whole units (that's how they're priced and paid), even though ISO 4217 lists IDR with 2.

export const LOCAL_CURRENCIES = ['TWD', 'IDR', 'MYR', 'SGD'] as const
export type LocalCurrency = (typeof LOCAL_CURRENCIES)[number]

/** Currencies HQ can consolidate into. */
export const REPORTING_CURRENCIES = ['TWD', 'USD', 'SGD', 'MYR', 'IDR'] as const
export type ReportingCurrency = (typeof REPORTING_CURRENCIES)[number]

/** Extra currencies only used for the "≈ ¥" price hint shown to tourists. */
export const HINT_CURRENCIES = ['JPY', 'KRW', 'CNY', 'AUD', 'USD'] as const

export type CurrencyCode = LocalCurrency | 'USD' | 'JPY' | 'KRW' | 'CNY' | 'AUD'

export interface CurrencyInfo {
  code: CurrencyCode
  /** Digits after the decimal point in the stored minor unit. */
  minorUnits: number
  symbol: string
  /** "Rp 125.000" and "RM 48.50" have a space; "NT$1,280" and "S$32.90" don't. */
  symbolSpace: boolean
  /** Locale whose digit grouping the amount uses, whatever the page language is. */
  numberLocale: string
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  TWD: { code: 'TWD', minorUnits: 0, symbol: 'NT$', symbolSpace: false, numberLocale: 'en-US' },
  IDR: { code: 'IDR', minorUnits: 0, symbol: 'Rp', symbolSpace: true, numberLocale: 'id-ID' },
  MYR: { code: 'MYR', minorUnits: 2, symbol: 'RM', symbolSpace: true, numberLocale: 'en-MY' },
  SGD: { code: 'SGD', minorUnits: 2, symbol: 'S$', symbolSpace: false, numberLocale: 'en-SG' },
  USD: { code: 'USD', minorUnits: 2, symbol: 'US$', symbolSpace: false, numberLocale: 'en-US' },
  JPY: { code: 'JPY', minorUnits: 0, symbol: '¥', symbolSpace: false, numberLocale: 'ja-JP' },
  KRW: { code: 'KRW', minorUnits: 0, symbol: '₩', symbolSpace: false, numberLocale: 'ko-KR' },
  CNY: { code: 'CNY', minorUnits: 2, symbol: 'CN¥', symbolSpace: false, numberLocale: 'zh-CN' },
  AUD: { code: 'AUD', minorUnits: 2, symbol: 'A$', symbolSpace: false, numberLocale: 'en-AU' },
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && Object.hasOwn(CURRENCIES, value)
}

export function isLocalCurrency(value: unknown): value is LocalCurrency {
  return typeof value === 'string' && (LOCAL_CURRENCIES as readonly string[]).includes(value)
}
