// Signed cookies for staff sessions and registered devices. Web Crypto only, so middleware.ts
// can check them too. Signature and expiry are checked here; whether the staff member or
// device is still active is checked against Firestore by lib/http/route.ts.
import { isProduction, sessionDays, sessionSecret } from '../env.js'
import { constantTimeEqual, hmacHex } from './crypto.js'

export const SESSION_COOKIE = 'bara_s'
export const DEVICE_COOKIE = 'bara_d'
/** A PIN session on a shared device lasts at most a shift; the screen also locks when idle. */
export const PIN_SESSION_HOURS = 12
export const DEVICE_COOKIE_DAYS = 400

const ID = /^[A-Za-z0-9_-]{1,64}$/

export interface SessionClaims {
  staffId: string
  /** Set for PIN sessions: the session only works on that device. */
  deviceId: string | null
  /** Seconds since the epoch. */
  expires: number
  /** Must match staff.sessionVersion. */
  version: number
}

export async function signSession(claims: SessionClaims): Promise<string> {
  if (!ID.test(claims.staffId) || (claims.deviceId && !ID.test(claims.deviceId))) throw new RangeError('Bad session IDs.')
  const payload = `v1.${claims.staffId}.${claims.deviceId ?? '-'}.${claims.expires}.${claims.version}`
  return `${payload}.${await hmacHex(sessionSecret(), `session|${payload}`)}`
}

export async function verifySession(token: string | null | undefined, now = Date.now()): Promise<SessionClaims | null> {
  const parts = token?.split('.') ?? []
  if (parts.length !== 6 || parts[0] !== 'v1') return null
  const [, staffId, deviceId, rawExpires, rawVersion, signature] = parts as [string, string, string, string, string, string]
  if (!ID.test(staffId) || (deviceId !== '-' && !ID.test(deviceId))) return null
  const expected = await hmacHex(sessionSecret(), `session|${parts.slice(0, 5).join('.')}`)
  if (!constantTimeEqual(signature, expected)) return null
  const expires = Number(rawExpires)
  const version = Number(rawVersion)
  if (!Number.isSafeInteger(expires) || expires * 1000 <= now || !Number.isSafeInteger(version)) return null
  return { staffId, deviceId: deviceId === '-' ? null : deviceId, expires, version }
}

export interface DeviceClaims {
  deviceId: string
  branchId: string
  /** Random secret whose sha256 is stored on the device document. */
  secret: string
}

export async function signDevice(claims: DeviceClaims): Promise<string> {
  if (![claims.deviceId, claims.branchId, claims.secret].every((part) => ID.test(part))) throw new RangeError('Bad device claims.')
  const payload = `d1.${claims.deviceId}.${claims.branchId}.${claims.secret}`
  return `${payload}.${await hmacHex(sessionSecret(), `device|${payload}`)}`
}

export async function verifyDeviceToken(token: string | null | undefined): Promise<DeviceClaims | null> {
  const parts = token?.split('.') ?? []
  if (parts.length !== 5 || parts[0] !== 'd1') return null
  const [, deviceId, branchId, secret, signature] = parts as [string, string, string, string, string]
  if (![deviceId, branchId, secret].every((part) => ID.test(part))) return null
  const expected = await hmacHex(sessionSecret(), `device|${parts.slice(0, 4).join('.')}`)
  return constantTimeEqual(signature, expected) ? { deviceId, branchId, secret } : null
}

export function readCookie(header: string | null | undefined, name: string): string | null {
  const match = header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  if (!match) return null
  try {
    return decodeURIComponent(match.slice(name.length + 1))
  } catch {
    return null
  }
}

const secure = () => (isProduction() ? '; Secure' : '')

export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure()}`
}

export const clearCookie = (name: string): string => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure()}`

/** Seconds a new session lasts: the configured days for passwords, a shift for PINs. */
export const sessionMaxAge = (pin: boolean): number => (pin ? PIN_SESSION_HOURS * 3600 : sessionDays() * 86_400)

export const deviceMaxAge = (): number => DEVICE_COOKIE_DAYS * 86_400
