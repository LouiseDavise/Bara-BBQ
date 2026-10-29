// Phone numbers: validated against the branch's country, international numbers accepted,
// stored in E.164 (+6581234567). Rules cover the four countries we operate in; other
// countries get a shape check only.
import type { CountryCode } from './country-profiles/types.js'

interface CountryRules {
  callingCode: string
  /** National significant number (no trunk 0) patterns. */
  mobile: RegExp
  landline: RegExp
  /** Countries that dial a trunk 0 before the national number. */
  trunkZero: boolean
}

const RULES: Record<CountryCode, CountryRules> = {
  TW: { callingCode: '886', mobile: /^9\d{8}$/, landline: /^[2-8]\d{7,8}$/, trunkZero: true },
  ID: { callingCode: '62', mobile: /^8\d{8,11}$/, landline: /^[2-7]\d{7,10}$/, trunkZero: true },
  MY: { callingCode: '60', mobile: /^1\d{8,9}$/, landline: /^[3-9]\d{7,8}$/, trunkZero: true },
  SG: { callingCode: '65', mobile: /^[89]\d{7}$/, landline: /^[36]\d{7}$/, trunkZero: false },
}

const BY_CALLING_CODE = new Map(Object.entries(RULES).map(([country, rules]) => [rules.callingCode, country as CountryCode]))

export type PhoneError = 'empty' | 'invalid'

export type PhoneResult =
  | { ok: true; e164: string; country: CountryCode | null; mobile: boolean }
  | { ok: false; error: PhoneError }

function checkNational(country: CountryCode, national: string): PhoneResult {
  const rules = RULES[country]
  const mobile = rules.mobile.test(national)
  if (!mobile && !rules.landline.test(national)) return { ok: false, error: 'invalid' }
  return { ok: true, e164: `+${rules.callingCode}${national}`, country, mobile }
}

/** Parses what a guest typed. `defaultCountry` is the branch's country. */
export function parsePhone(input: string, defaultCountry: CountryCode): PhoneResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: 'empty' }
  if (/[^\d\s+().-]/.test(trimmed)) return { ok: false, error: 'invalid' }
  let digits = trimmed.replace(/[\s().-]/g, '')
  let international = false
  if (digits.startsWith('+')) {
    international = true
    digits = digits.slice(1)
  } else if (digits.startsWith('00')) {
    international = true
    digits = digits.slice(2)
  }
  if (!/^\d+$/.test(digits)) return { ok: false, error: 'invalid' }

  if (international) {
    for (const length of [3, 2]) {
      const country = BY_CALLING_CODE.get(digits.slice(0, length))
      if (country) {
        const national = digits.slice(length).replace(/^0/, '')
        return checkNational(country, national)
      }
    }
    // Any other country: E.164 allows up to 15 digits and never starts with 0.
    if (/^[1-9]\d{7,14}$/.test(digits)) return { ok: true, e164: `+${digits}`, country: null, mobile: true }
    return { ok: false, error: 'invalid' }
  }

  const rules = RULES[defaultCountry]
  // People in Indonesia and Malaysia often paste "62812…" / "6012…" without the plus.
  if (digits.startsWith(rules.callingCode) && digits.length > 9) {
    const asInternational = checkNational(defaultCountry, digits.slice(rules.callingCode.length))
    if (asInternational.ok) return asInternational
  }
  const national = rules.trunkZero && digits.startsWith('0') ? digits.slice(1) : digits
  return checkNational(defaultCountry, national)
}

/** Local display style: 0912-345-678 · 0812-3456-7890 · 012-345 6789 · 8123 4567. */
export function formatPhone(e164: string, style: 'national' | 'international' = 'national'): string {
  const digits = e164.replace(/^\+/, '')
  const country = BY_CALLING_CODE.get(digits.slice(0, 3)) ?? BY_CALLING_CODE.get(digits.slice(0, 2))
  if (!country) return e164
  const rules = RULES[country]
  const national = digits.slice(rules.callingCode.length)
  let grouped: string
  switch (country) {
    case 'TW':
      grouped = national.length === 9 && national.startsWith('9')
        ? `0${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`
        : `0${national.slice(0, 1)}-${national.slice(1, -4)}-${national.slice(-4)}`
      break
    case 'ID':
      grouped = `0${national.slice(0, 3)}-${national.slice(3, 7)}-${national.slice(7)}`
      break
    case 'MY':
      grouped = national.startsWith('1')
        ? `0${national.slice(0, 2)}-${national.slice(2, national.length - 4)} ${national.slice(-4)}`
        : `0${national.slice(0, 1)}-${national.slice(1, -4)} ${national.slice(-4)}`
      break
    case 'SG':
      grouped = `${national.slice(0, 4)} ${national.slice(4)}`
      break
  }
  if (style === 'national') return grouped
  const withoutTrunk = rules.trunkZero ? grouped.replace(/^0/, '') : grouped
  return `+${rules.callingCode} ${withoutTrunk}`
}

/** wa.me link for click-to-chat (the brief's default WhatsApp channel). */
export function whatsAppLink(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/^\+/, '')}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
