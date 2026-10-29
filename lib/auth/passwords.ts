// Password and PIN hashing with PBKDF2-SHA256 through Web Crypto. The stored string records
// its own parameters ("pbkdf2-sha256$310000$salt$hash"), so iterations can rise later.
import { constantTimeEqual, fromBase64Url, toBase64Url } from './crypto.js'

/** OWASP's recommendation for PBKDF2-HMAC-SHA256. */
export const PASSWORD_ITERATIONS = 310_000
/**
 * PINs have only 10^4–10^6 values, so hashing can't protect them from someone with the
 * database; the real protection is server-side checking with a lockout. Fewer iterations keep
 * switching users at the POS instant.
 */
export const PIN_ITERATIONS = 60_000

const encoder = new TextEncoder()

async function derive(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

export async function hashSecret(secret: string, iterations = PASSWORD_ITERATIONS): Promise<string> {
  const salt = new Uint8Array(new ArrayBuffer(16))
  crypto.getRandomValues(salt)
  return `pbkdf2-sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(await derive(secret, salt, iterations))}`
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [scheme, rawIterations, rawSalt, rawHash] = stored.split('$')
  const iterations = Number(rawIterations)
  if (scheme !== 'pbkdf2-sha256' || !rawSalt || !rawHash || !Number.isSafeInteger(iterations) || iterations < 1000) return false
  const hash = await derive(secret, fromBase64Url(rawSalt), iterations)
  return constantTimeEqual(toBase64Url(hash), rawHash)
}

export const hashPin = (pin: string): Promise<string> => hashSecret(pin, PIN_ITERATIONS)

/** 4–6 digits, and not something like 0000 or 123456. */
export function pinProblem(pin: string): 'format' | 'tooSimple' | null {
  if (!/^\d{4,6}$/.test(pin)) return 'format'
  const digits = [...pin].map(Number)
  const allSame = digits.every((d) => d === digits[0])
  const step = digits[1]! - digits[0]!
  const sequence = Math.abs(step) === 1 && digits.every((d, i) => i === 0 || d - digits[i - 1]! === step)
  return allSame || sequence ? 'tooSimple' : null
}

let dummyHash: Promise<string> | null = null

/** Burns the same time as a real check when the username doesn't exist. */
export async function verifyAgainstNothing(secret: string): Promise<false> {
  dummyHash ??= hashSecret('not-a-real-password')
  await verifySecret(secret, await dummyHash)
  return false
}
