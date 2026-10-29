// The route() wrapper with fake staff, devices and branches: no Firestore needed.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { DEVICE_COOKIE, SESSION_COOKIE, signDevice, signSession } from '../../../lib/auth/session.js'
import { json } from '../../../lib/http/respond.js'
import { route, routeDeps } from '../../../lib/http/route.js'
import type { BranchDoc } from '../../../shared/types/branch.js'
import type { DeviceDoc, StaffDoc } from '../../../shared/types/staff.js'

const staff = (id: string, extra: Partial<StaffDoc>): StaffDoc =>
  ({ id, name: id, active: true, sessionVersion: 1, branchRoles: {}, groupRole: null, areaBranches: [], language: 'en', ...extra }) as StaffDoc

const people: Record<string, StaffDoc> = {
  'jkt-cashier': staff('jkt-cashier', { branchRoles: { jkt: 'cashier' } }),
  'jkt-manager': staff('jkt-manager', { branchRoles: { jkt: 'manager' } }),
  owner: staff('owner', { groupRole: 'owner' }),
  finance: staff('finance', { groupRole: 'finance' }),
  gone: staff('gone', { active: false, branchRoles: { jkt: 'manager' } }),
}
const branch = (id: string): BranchDoc =>
  ({ id, code: id.toUpperCase(), timeZone: 'Asia/Jakarta', settings: { businessDayCutoff: '04:00', permissions: { managersCanChangePrice: false, waitersTakePayment: false } } }) as BranchDoc
const devices: Record<string, DeviceDoc> = {
  pos1: { id: 'pos1', branchId: 'jkt', revokedAt: null, secretHash: 'secret1' } as DeviceDoc,
}

const audited: unknown[] = []
const original = { ...routeDeps }

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-hmac-0123456789'
  Object.assign(routeDeps, {
    loadStaff: async (id: string) => people[id] ?? null,
    loadDevice: async (id: string) => devices[id] ?? null,
    loadBranch: async (id: string) => (['jkt', 'sin', 'dps'].includes(id) ? branch(id) : null),
    deviceSecretMatches: async (device: DeviceDoc, secret: string) => device.secretHash === secret,
    audit: async (entry: unknown) => void audited.push(entry),
    auditOnce: async (id: string, entry: unknown) => void audited.push({ id, entry }),
  })
})

afterEach(() => {
  audited.length = 0
  delete process.env.DEMO_MODE
})

async function cookieFor(staffId: string, options: { deviceId?: string; version?: number; device?: string } = {}) {
  const session = await signSession({ staffId, deviceId: options.deviceId ?? null, expires: Math.floor(Date.now() / 1000) + 3600, version: options.version ?? 1 })
  const cookies = [`${SESSION_COOKIE}=${encodeURIComponent(session)}`]
  if (options.device) {
    const device = devices[options.device]!
    cookies.push(`${DEVICE_COOKIE}=${encodeURIComponent(await signDevice({ deviceId: device.id, branchId: device.branchId, secret: device.secretHash }))}`)
  }
  return cookies.join('; ')
}

const context = route({ auth: 'staff', branch: 'url' }, (ctx) => json({ branch: ctx.branchId, user: ctx.staff!.id }))
const call = (handler: typeof context, branchId: string, cookie: string, init: RequestInit = {}) =>
  handler(new Request(`http://localhost/api/b/${branchId}/x`, { ...init, headers: { cookie, ...(init.headers as Record<string, string>) } }), { branch: branchId })
const errorCode = async (response: Response) => ((await response.json()) as { error: { code: string } }).error.code

describe('branch scoping in route()', () => {
  it('lets a Jakarta cashier into Jakarta', async () => {
    const response = await call(context, 'jkt', await cookieFor('jkt-cashier'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ branch: 'jkt', user: 'jkt-cashier' })
  })

  it('refuses a Jakarta cashier in Singapore', async () => {
    const response = await call(context, 'sin', await cookieFor('jkt-cashier'))
    expect(response.status).toBe(403)
    expect(await errorCode(response)).toBe('branch_forbidden')
  })

  it('needs a valid, current session', async () => {
    expect((await call(context, 'jkt', '')).status).toBe(401)
    expect((await call(context, 'jkt', await cookieFor('gone'))).status).toBe(401)
    expect((await call(context, 'jkt', await cookieFor('jkt-cashier', { version: 2 }))).status).toBe(401)
  })

  it('keeps a registered device in its own branch, even for the owner', async () => {
    const response = await call(context, 'sin', await cookieFor('owner', { device: 'pos1' }))
    expect(response.status).toBe(403)
    expect(await errorCode(response)).toBe('device_branch_mismatch')
  })

  it('only accepts a PIN session on the device it was made on', async () => {
    expect((await call(context, 'jkt', await cookieFor('jkt-cashier', { deviceId: 'pos1', device: 'pos1' }))).status).toBe(200)
    expect((await call(context, 'jkt', await cookieFor('jkt-cashier', { deviceId: 'pos1' }))).status).toBe(401)
  })

  it('answers 404 for a branch that doesn’t exist', async () => {
    expect((await call(context, 'xyz', await cookieFor('owner'))).status).toBe(404)
    expect((await call(context, '../etc', await cookieFor('owner'))).status).toBe(404)
  })

  it('logs the owner entering a branch once per day', async () => {
    await call(context, 'sin', await cookieFor('owner'))
    expect(audited).toHaveLength(1)
    expect(audited[0]).toMatchObject({ id: expect.stringMatching(/^access-owner-sin-\d{4}-\d{2}-\d{2}$/) })
  })
})

describe('permissions in route()', () => {
  const reports = route({ auth: 'staff', branch: 'url', permission: 'reports.branch' }, () => json({ ok: true }))

  it('allows read-only grants on GET only', async () => {
    expect((await call(reports, 'sin', await cookieFor('finance'))).status).toBe(200)
    expect((await call(reports, 'sin', await cookieFor('finance'), { method: 'POST' })).status).toBe(403)
  })

  it('passes "approval" on for the handler to check a manager PIN', async () => {
    const voidLine = route({ auth: 'staff', branch: 'url', permission: 'line.void' }, (ctx) => json({ grant: ctx.grant }))
    const response = await call(voidLine, 'jkt', await cookieFor('jkt-cashier'), { method: 'POST' })
    expect(await response.json()).toEqual({ grant: 'approval' })
  })

  it('keeps branch staff out of HQ', async () => {
    const hq = route({ auth: 'staff', permission: 'hq.open' }, () => json({ ok: true }))
    const request = async (id: string) => hq(new Request('http://localhost/api/hq/context', { headers: { cookie: await cookieFor(id) } }), {})
    expect((await request('jkt-manager')).status).toBe(403)
    expect((await request('owner')).status).toBe(200)
  })
})

describe('bodies, idempotency and demo locks', () => {
  const create = route(
    { auth: 'staff', branch: 'url', permission: 'order.take', body: z.strictObject({ qty: z.number().int() }), idempotent: true },
    (ctx) => json({ qty: ctx.body.qty, key: ctx.idempotencyKey }),
  )
  const post = async (body: unknown, headers: Record<string, string> = {}) =>
    call(create, 'jkt', await cookieFor('jkt-cashier'), { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } })

  it('refuses unknown fields', async () => {
    const response = await post({ qty: 1, total: 0 }, { 'idempotency-key': 'k'.repeat(20) })
    expect(response.status).toBe(400)
  })

  it('requires an idempotency key', async () => {
    expect((await post({ qty: 1 })).status).toBe(400)
    const response = await post({ qty: 2 }, { 'idempotency-key': 'abcdefghijklmnop1234' })
    expect(await response.json()).toEqual({ qty: 2, key: 'abcdefghijklmnop1234' })
  })

  it('locks destructive settings in demo mode', async () => {
    process.env.DEMO_MODE = 'true'
    const destroy = route({ auth: 'staff', branch: 'url', permission: 'settings.branch', demoBlocked: true }, () => json({ ok: true }))
    const response = await call(destroy, 'jkt', await cookieFor('jkt-manager'), { method: 'POST' })
    expect(response.status).toBe(403)
    expect(await errorCode(response)).toBe('demo_blocked')
    expect(audited).toHaveLength(1)
  })

  it('turns unexpected errors into a 500 without leaking details', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = route({ auth: 'public' }, () => {
      throw new Error('secret internals')
    })
    const response = await broken(new Request('http://localhost/api/x'), {})
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('secret internals')
    spy.mockRestore()
  })
})

describe('restoring deps', () => {
  it('keeps the real dependencies available', () => {
    expect(typeof original.loadStaff).toBe('function')
  })
})
