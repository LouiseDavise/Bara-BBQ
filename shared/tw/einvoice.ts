// Validators for the details a guest gives when a Taiwan e-invoice (電子發票) is issued.

/**
 * 統一編號 (Unified Business Number) checksum. Weights 1,2,1,2,1,2,4,1; add the digits of each
 * product. Valid if the sum is divisible by 5 (the 2023 rule; older numbers also pass, since
 * divisible by 10 implies divisible by 5). When the 7th digit is 7, its product 28 counts as
 * either 1 or 0, so sum + 1 may also be divisible.
 */
export function isValidUbn(value: string, rule: 'mod5' | 'mod10' = 'mod5'): boolean {
  if (!/^\d{8}$/.test(value)) return false
  const weights = [1, 2, 1, 2, 1, 2, 4, 1]
  const digits = [...value].map(Number)
  let total = 0
  digits.forEach((digit, i) => {
    const product = digit * weights[i]!
    total += Math.floor(product / 10) + (product % 10)
  })
  const divisor = rule === 'mod5' ? 5 : 10
  return total % divisor === 0 || (digits[6] === 7 && (total + 1) % divisor === 0)
}

/** 手機條碼 mobile barcode carrier: "/" then 7 of 0-9, A-Z, ".", "+", "-". */
export function isValidMobileCarrier(value: string): boolean {
  return /^\/[0-9A-Z.+-]{7}$/.test(value)
}

/** Normalises what a guest typed into the mobile carrier format (uppercase, no spaces). */
export const normalizeMobileCarrier = (value: string): string => value.trim().replace(/\s/g, '').toUpperCase()

/** 自然人憑證 citizen digital certificate carrier: 2 uppercase letters + 14 digits. */
export function isValidCitizenCarrier(value: string): boolean {
  return /^[A-Z]{2}\d{14}$/.test(value)
}

/** 愛心碼 donation code: 3 to 7 digits. */
export function isValidDonationCode(value: string): boolean {
  return /^\d{3,7}$/.test(value)
}

/**
 * E-invoices are issued in two-month periods (Jan–Feb, Mar–Apr, …), which is also the 401
 * filing period: '2026-10-29' → '2026-09/10'.
 */
export function invoicePeriod(date: string): string {
  const [year, month] = date.split('-').map(Number)
  const first = month! % 2 === 1 ? month! : month! - 1
  return `${year}-${String(first).padStart(2, '0')}/${String(first + 1).padStart(2, '0')}`
}

/** Taiwan's ROC calendar year, printed on the 證明聯: 2026 → 115. */
export const rocYear = (year: number): number => year - 1911
