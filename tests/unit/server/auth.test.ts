import { beforeAll, describe, expect, it } from 'vitest'
import { realtimeClaims } from '../../../lib/auth/firebase-token.js'
import { hashPin, hashSecret, pinProblem, verifySecret } from '../../../lib/auth/passwords.js'
import { readCookie, signDevice, signSession, verifyDeviceToken, verifySession } from '../../../lib/auth/session.js'
import { canonicalJson, idempotencyDocId } from '../../../lib/db/idempotency.js'

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-hmac-0123456789'
})

describe('session cookies', () => {
  const now = Date.parse('2026-10-29T08:00:00Z')
  const claims = { staffId: 'jkt-cashier', deviceId: null, expires: now / 1000 + 3600, version: 1 }

  it('round-trips signed claims', async () => {
    const token = await signSession(claims)
    expect(await verifySession(token, now)).toEqual(claims)
  })

  it('rejects tampering, expiry and garbage', async () => {
    const token = await signSession(claims)
    expect(await verifySession(token.replace('jkt-cashier', 'sin-manager'), now)).toBeNull()
    expect(await verifySession(token.replace('.1.', '.2.'), now)).toBeNull()
    expect(await verifySession(token, now + 7200_000)).toBeNull()
    expect(await verifySession('v1.a.b.c', now)).toBeNull()
    expect(await verifySession(null, now)).toBeNull()
  })

  it('binds PIN sessions to a device', async () => {
    const token = await signSession({ ...claims, deviceId: 'dev123' })
    expect((await verifySession(token, now))?.deviceId).toBe('dev123')
  })

  it('signs device cookies', async () => {
    const token = await signDevice({ deviceId: 'dev123', branchId: 'jkt', secret: 'abcDEF_123-xyz' })
    expect(await verifyDeviceToken(token)).toEqual({ deviceId: 'dev123', branchId: 'jkt', secret: 'abcDEF_123-xyz' })
    expect(await verifyDeviceToken(token.replace('.jkt.', '.sin.'))).toBeNull()
  })

  it('reads cookies from a header', () => {
    expect(readCookie('a=1; bara_s=v1.x%2Ey; b=2', 'bara_s')).toBe('v1.x.y')
    expect(readCookie('a=1', 'bara_s')).toBeNull()
    expect(readCookie('bara_s=%E0%A4%A', 'bara_s')).toBeNull()
  })
})

describe('passwords and PINs', () => {
  it('hashes and verifies with PBKDF2', async () => {
    const hash = await hashSecret('bara-demo-2026', 1000)
    expect(hash).toMatch(/^pbkdf2-sha256\$1000\$/)
    expect(await verifySecret('bara-demo-2026', hash)).toBe(true)
    expect(await verifySecret('wrong', hash)).toBe(false)
    expect(await verifySecret('bara-demo-2026', 'md5$nope')).toBe(false)
  })

  it('hashes PINs with their own cost', async () => {
    expect(await hashPin('2468')).toMatch(/^pbkdf2-sha256\$60000\$/)
  })

  it('refuses weak or malformed PINs', () => {
    expect(pinProblem('2468')).toBeNull()
    expect(pinProblem('135790')).toBeNull()
    expect(pinProblem('1111')).toBe('tooSimple')
    expect(pinProblem('1234')).toBe('tooSimple')
    expect(pinProblem('987654')).toBe('tooSimple')
    expect(pinProblem('123')).toBe('format')
    expect(pinProblem('12a4')).toBe('format')
  })
})

describe('realtime claims', () => {
  it('lists branch roles, with area branches as manager', () => {
    expect(realtimeClaims({ id: 'a', active: true, branchRoles: { jkt: 'cashier' }, groupRole: null, areaBranches: [] })).toEqual({ br: { jkt: 'cashier' }, g: null })
    expect(realtimeClaims({ id: 'a', active: true, branchRoles: { dps: 'kitchen' }, groupRole: 'area', areaBranches: ['jkt', 'dps'] })).toEqual({
      br: { jkt: 'manager', dps: 'manager' },
      g: 'area',
    })
  })
})

describe('idempotency', () => {
  it('hashes bodies independently of key order', () => {
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(canonicalJson({ a: [1, { c: 3, d: 2 }], b: 1 }))
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}')
    expect(idempotencyDocId('jkt:POST /orders', 'k1')).not.toBe(idempotencyDocId('sin:POST /orders', 'k1'))
  })
})
