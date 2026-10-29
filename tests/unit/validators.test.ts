import { describe, expect, it } from 'vitest'
import { billNumber, CODE_ALPHABET, reservationCode, secureRandomInt, takeawayNumber } from '../../shared/numbering.js'
import { formatPhone, parsePhone, whatsAppLink } from '../../shared/phone.js'
import {
  invoicePeriod,
  isValidCitizenCarrier,
  isValidDonationCode,
  isValidMobileCarrier,
  isValidUbn,
  normalizeMobileCarrier,
  rocYear,
} from '../../shared/tw/einvoice.js'

describe('phone numbers', () => {
  it.each([
    ['0912-345-678', 'TW', '+886912345678'],
    ['+886 912 345 678', 'TW', '+886912345678'],
    ['02-2700-1234', 'TW', '+886227001234'],
    ['0812-3456-7890', 'ID', '+6281234567890'],
    ['6281234567890', 'ID', '+6281234567890'],
    ['+62 0812 3456 7890', 'ID', '+6281234567890'],
    ['012-345 6789', 'MY', '+60123456789'],
    ['011-2345 6789', 'MY', '+601123456789'],
    ['03-1234 5678', 'MY', '+60312345678'],
    ['8123 4567', 'SG', '+6581234567'],
    ['+65 9123 4567', 'SG', '+6591234567'],
    ['0065 6123 4567', 'SG', '+6561234567'],
    ['+44 20 7946 0958', 'SG', '+442079460958'],
    ['+81 90-1234-5678', 'ID', '+819012345678'],
  ] as const)('%s (%s) → %s', (input, country, e164) => {
    const result = parsePhone(input, country)
    expect(result.ok && result.e164).toBe(e164)
  })

  it('accepts a guest’s home number in any of our four countries, whichever branch they book', () => {
    const result = parsePhone('+886 912 345 678', 'SG')
    expect(result.ok && result.country).toBe('TW')
  })

  it.each([
    ['', 'SG', 'empty'],
    ['1234 5678', 'SG', 'invalid'],
    ['091234567', 'TW', 'invalid'],
    ['0812', 'ID', 'invalid'],
    ['phone me', 'MY', 'invalid'],
    ['+0123', 'MY', 'invalid'],
  ] as const)('rejects %j in %s', (input, country, error) => {
    expect(parsePhone(input, country)).toEqual({ ok: false, error })
  })

  it('formats in each country’s style', () => {
    expect(formatPhone('+886912345678')).toBe('0912-345-678')
    expect(formatPhone('+6281234567890')).toBe('0812-3456-7890')
    expect(formatPhone('+60123456789')).toBe('012-345 6789')
    expect(formatPhone('+6581234567')).toBe('8123 4567')
    expect(formatPhone('+6581234567', 'international')).toBe('+65 8123 4567')
    expect(formatPhone('+886912345678', 'international')).toBe('+886 912-345-678')
    expect(formatPhone('+442079460958')).toBe('+442079460958')
  })

  it('builds WhatsApp click-to-chat links', () => {
    expect(whatsAppLink('+6581234567', 'Hi Bara')).toBe('https://wa.me/6581234567?text=Hi%20Bara')
  })
})

describe('Taiwan e-invoice details', () => {
  it('checks the 統一編號 checksum', () => {
    expect(isValidUbn('22099131')).toBe(true)
    expect(isValidUbn('04595257')).toBe(true)
    expect(isValidUbn('10000078')).toBe(true) // 7th digit 7: sum + 1 rule
    expect(isValidUbn('12345678')).toBe(false)
    expect(isValidUbn('1234567')).toBe(false)
    expect(isValidUbn('2209913A')).toBe(false)
  })

  it('accepts numbers that only pass the 2023 divisible-by-5 rule', () => {
    expect(isValidUbn('12000000')).toBe(true)
    expect(isValidUbn('12000000', 'mod10')).toBe(false)
  })

  it('validates carriers and donation codes', () => {
    expect(isValidMobileCarrier('/ABC+123')).toBe(true)
    expect(isValidMobileCarrier(normalizeMobileCarrier(' /abc.12- '))).toBe(true)
    expect(isValidMobileCarrier('/ABC123')).toBe(false)
    expect(isValidMobileCarrier('ABC+1234')).toBe(false)
    expect(isValidCitizenCarrier('AB12345678901234')).toBe(true)
    expect(isValidDonationCode('8585')).toBe(true)
    expect(isValidDonationCode('12')).toBe(false)
  })

  it('knows the bimonthly invoice period and ROC year', () => {
    expect(invoicePeriod('2026-10-29')).toBe('2026-09/10')
    expect(invoicePeriod('2026-01-15')).toBe('2026-01/02')
    expect(invoicePeriod('2026-12-31')).toBe('2026-11/12')
    expect(rocYear(2026)).toBe(115)
  })
})

describe('numbering', () => {
  it('formats bill, takeaway and reservation numbers', () => {
    expect(billNumber('SIN', '2026-10-29', 42)).toBe('SIN-20261029-0042')
    expect(takeawayNumber('SIN', 17)).toBe('SIN-T-017')
    const fixed = [5, 20, 13, 0]
    expect(reservationCode('SIN', () => fixed.shift()!)).toBe('BARA-SIN-7PF2')
    expect(reservationCode('DPS', secureRandomInt)).toMatch(new RegExp(`^BARA-DPS-[${CODE_ALPHABET}]{4}$`))
  })

  it('draws unbiased random digits', () => {
    for (let i = 0; i < 500; i++) {
      const n = secureRandomInt(CODE_ALPHABET.length)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(CODE_ALPHABET.length)
    }
  })
})
