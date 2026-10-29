// Rate limits and PIN lockouts stored in Firestore, so they hold across serverless instances.
// Keys are hashed before storage; documents expire through a TTL policy on `expiresAt`.
import { createHash } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { firestore } from './admin.js'
import { groupCol } from './paths.js'

const docId = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 32)

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

/** Fixed-window limiter. Returns true when the request is allowed. */
export async function allowRequest(key: string, limit: number, windowMs: number): Promise<boolean> {
  const ref = groupCol('rateLimits').doc(docId(`limit|${key}`))
  const now = Date.now()
  return firestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    const data = snapshot.data() as { count: number; windowStart: number } | undefined
    if (!data || now - data.windowStart >= windowMs) {
      tx.set(ref, { count: 1, windowStart: now, expiresAt: Timestamp.fromMillis(now + windowMs) })
      return true
    }
    if (data.count >= limit) return false
    tx.update(ref, { count: data.count + 1 })
    return true
  })
}

export interface Lockout {
  locked: boolean
  /** When the lock lifts (epoch ms), if locked. */
  until: number | null
}

/** Counts only failures: after `maxFailures` within `windowMs` the key is locked for `lockMs`. */
export async function checkLockout(key: string): Promise<Lockout> {
  const snapshot = await groupCol('rateLimits').doc(docId(`lock|${key}`)).get()
  const until = snapshot.get('lockedUntil') as number | undefined
  return until && until > Date.now() ? { locked: true, until } : { locked: false, until: null }
}

export async function registerFailure(key: string, maxFailures: number, windowMs: number, lockMs: number): Promise<Lockout> {
  const ref = groupCol('rateLimits').doc(docId(`lock|${key}`))
  const now = Date.now()
  return firestore().runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data() as { failures: number; windowStart: number } | undefined
    const fresh = !data || now - data.windowStart >= windowMs
    const failures = fresh ? 1 : data.failures + 1
    const lockedUntil = failures >= maxFailures ? now + lockMs : null
    tx.set(ref, {
      failures: lockedUntil ? 0 : failures,
      windowStart: fresh || lockedUntil ? now : data!.windowStart,
      lockedUntil,
      expiresAt: Timestamp.fromMillis(now + Math.max(windowMs, lockMs)),
    })
    return { locked: Boolean(lockedUntil), until: lockedUntil }
  })
}

export async function clearFailures(key: string): Promise<void> {
  await groupCol('rateLimits').doc(docId(`lock|${key}`)).delete()
}
