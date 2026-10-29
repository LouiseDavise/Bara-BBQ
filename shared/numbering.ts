// Per-branch document numbers. The sequence itself comes from a Firestore counter inside the
// same transaction that creates the document (lib/db/counters.ts), so bill numbers have no gaps.
import { compactDate } from './time/business-day.js'

/** SIN-20261029-0042 */
export function billNumber(branchCode: string, businessDate: string, sequence: number): string {
  return `${branchCode}-${compactDate(businessDate)}-${String(sequence).padStart(4, '0')}`
}

/** SIN-T-017 (restarts every business day) */
export function takeawayNumber(branchCode: string, sequence: number): string {
  return `${branchCode}-T-${String(sequence).padStart(3, '0')}`
}

/** No 0/O, 1/I/L, so a code read out over the phone can't be misheard. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** BARA-SIN-7KQ2. `random` returns integers in [0, alphabet length). */
export function reservationCode(branchCode: string, random: (size: number) => number): string {
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += CODE_ALPHABET[random(CODE_ALPHABET.length)]
  return `BARA-${branchCode}-${suffix}`
}

/** A cryptographically random integer in [0, size), for reservationCode(). */
export function secureRandomInt(size: number): number {
  const limit = Math.floor(0x1_0000_0000 / size) * size
  const buffer = new Uint32Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buffer)
    if (buffer[0]! < limit) return buffer[0]! % size
  }
}

export const billSeries = (businessDate: string): string => `bill-${compactDate(businessDate)}`
export const takeawaySeries = (businessDate: string): string => `takeaway-${compactDate(businessDate)}`
