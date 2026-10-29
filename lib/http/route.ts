// Every API handler is wrapped in route(), which does the same checks in the same order:
//   1. who is calling (staff session, registered device, cron secret, or nobody)
//   2. which branch (from the URL or the device); a device can only act in its own branch
//   3. may this user act in this branch: can(user, permission, branch) from shared/permissions
//   4. body validation (strict: unknown fields are refused) and the idempotency key
// Handlers then only deal with their own logic.
import type { ZodType } from 'zod'
import { businessDate } from '../../shared/time/business-day.js'
import { can, canRead, hasBranchAccess, isCrossBranchAccess, isGroupPermission, primaryRoleIn, type Decision, type Permission, type UserAccess } from '../../shared/permissions.js'
import type { BranchDoc } from '../../shared/types/branch.js'
import type { DeviceDoc, StaffDoc } from '../../shared/types/staff.js'
import { deviceSecretMatches, loadDevice, loadStaff, toAccess } from '../auth/staff.js'
import { DEVICE_COOKIE, readCookie, SESSION_COOKIE, verifyDeviceToken, verifySession, type SessionClaims } from '../auth/session.js'
import { constantTimeEqual } from '../auth/crypto.js'
import { appendAudit, appendAuditOnce, type AuditInput } from '../db/audit.js'
import { loadBranch } from '../db/branches.js'
import { IDEMPOTENCY_KEY } from '../db/idempotency.js'
import { isBranchId } from '../db/paths.js'
import { clientIp } from '../db/rate-limit.js'
import { cronSecret, isDemoMode } from '../env.js'
import { badRequest, forbidden, notFound, unauthorized } from './errors.js'
import { errorResponse } from './respond.js'
import type { RouteHandler } from './router.js'

export interface RouteOptions<Body> {
  /**
   * public: anyone (rate-limit inside the handler) · staff: signed-in staff · device: a
   * registered device, signed in or not · cron: Vercel Cron with CRON_SECRET · webhook:
   * anyone; the handler verifies the provider's signature.
   */
  auth: 'public' | 'staff' | 'device' | 'cron' | 'webhook'
  /** Where the branch comes from: the :branch URL segment, or the registered device. */
  branch?: 'url' | 'device'
  permission?: Permission
  /** Read-only grants are enough for 'read'. Defaults to 'read' for GET, 'write' otherwise. */
  access?: 'read' | 'write'
  /** Strict zod schema for the JSON body. */
  body?: ZodType<Body>
  /** Requires an Idempotency-Key header. */
  idempotent?: boolean
  /** Refused in DEMO_MODE (destructive settings). */
  demoBlocked?: boolean
}

export interface RouteContext<Body = undefined> {
  request: Request
  url: URL
  params: Record<string, string>
  body: Body
  session: SessionClaims | null
  staff: StaffDoc | null
  access: UserAccess | null
  device: DeviceDoc | null
  branchId: string | null
  branch: BranchDoc | null
  /** Result of the permission check. 'approval' means the handler must verify a manager PIN. */
  grant: Decision | null
  idempotencyKey: string | null
  ip: string
  now: Date
}

/** Swappable in tests so the wrapper can be exercised without Firestore. */
export const routeDeps = {
  loadStaff,
  loadDevice,
  loadBranch,
  deviceSecretMatches,
  audit: (input: AuditInput) => appendAudit(input).then(() => undefined),
  auditOnce: appendAuditOnce,
}

const MAX_BODY_BYTES = 256 * 1024

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text()
  if (!text) return undefined
  if (text.length > MAX_BODY_BYTES) throw badRequest('Request body is too large.')
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) throw badRequest('Send the body as JSON.')
  try {
    return JSON.parse(text)
  } catch {
    throw badRequest('The body is not valid JSON.')
  }
}

async function resolveDevice(cookieHeader: string | null): Promise<DeviceDoc | null> {
  const claims = await verifyDeviceToken(readCookie(cookieHeader, DEVICE_COOKIE))
  if (!claims) return null
  const device = await routeDeps.loadDevice(claims.deviceId)
  if (!device || device.revokedAt || device.branchId !== claims.branchId) return null
  return (await routeDeps.deviceSecretMatches(device, claims.secret)) ? device : null
}

async function resolveStaff(cookieHeader: string | null, device: DeviceDoc | null) {
  const session = await verifySession(readCookie(cookieHeader, SESSION_COOKIE))
  if (!session) return null
  // A PIN session only works on the device it was started on.
  if (session.deviceId && session.deviceId !== device?.id) return null
  const staff = await routeDeps.loadStaff(session.staffId)
  if (!staff || !staff.active || staff.sessionVersion !== session.version) return null
  return { session, staff, access: toAccess(staff) }
}

function auditActor(staff: StaffDoc, branchId: string | null) {
  const role = branchId ? primaryRoleIn(toAccess(staff), branchId) : staff.groupRole
  return { staffId: staff.id, name: staff.name, role }
}

export function route<Body = undefined>(options: RouteOptions<Body>, handler: (ctx: RouteContext<Body>) => Promise<Response> | Response): RouteHandler {
  return async (request, params = {}) => {
    try {
      const url = new URL(request.url)
      url.searchParams.delete('__path')
      const cookieHeader = request.headers.get('cookie')
      const now = new Date()

      let session: SessionClaims | null = null
      let staff: StaffDoc | null = null
      let access: UserAccess | null = null
      let device: DeviceDoc | null = null

      if (options.auth === 'cron') {
        const secret = cronSecret()
        const given = request.headers.get('authorization') ?? ''
        if (!secret || !constantTimeEqual(given, `Bearer ${secret}`)) throw unauthorized('Cron secret missing or wrong.')
      } else if (options.auth === 'staff' || options.auth === 'device') {
        device = await resolveDevice(cookieHeader)
        const signedIn = await resolveStaff(cookieHeader, device)
        if (signedIn) ({ session, staff, access } = signedIn)
        if (options.auth === 'staff' && !staff) throw unauthorized('Your session has ended. Please sign in again.')
        if (options.auth === 'device' && !device) throw forbidden('Register this device first.', 'device_required')
      }

      // Branch scoping
      let branchId: string | null = null
      if (options.branch === 'url') {
        if (!isBranchId(params.branch)) throw notFound('Branch not found.')
        branchId = params.branch
      } else if (options.branch === 'device') {
        if (!device) throw forbidden('This needs a registered device.', 'device_required')
        branchId = device.branchId
      }
      let branch: BranchDoc | null = null
      if (branchId) {
        if (device && device.branchId !== branchId) throw forbidden('This device is registered to another branch.', 'device_branch_mismatch')
        if (access && !hasBranchAccess(access, branchId)) throw forbidden('You don’t have access to this branch.', 'branch_forbidden')
        branch = await routeDeps.loadBranch(branchId)
        if (!branch) throw notFound('Branch not found.')
      }

      // Permission
      let grant: Decision | null = null
      if (options.permission) {
        if (!access) throw unauthorized()
        const scope = isGroupPermission(options.permission) ? null : branchId
        const settings = branch?.settings.permissions
        const mode = options.access ?? (request.method === 'GET' ? 'read' : 'write')
        if (mode === 'read') {
          grant = canRead(access, options.permission, scope, settings) ? 'allow' : 'deny'
        } else {
          grant = can(access, options.permission, scope, settings)
        }
        if (grant === 'deny') throw forbidden('Your role can’t do this here.', 'permission_denied')
      }

      // Group users entering a branch they don't belong to are logged once per day.
      if (staff && access && branch && isCrossBranchAccess(access, branch.id)) {
        const day = businessDate(now, branch.timeZone, branch.settings.businessDayCutoff)
        await routeDeps.auditOnce(`access-${staff.id}-${branch.id}-${day}`, {
          branchId: branch.id,
          actor: auditActor(staff, branch.id),
          action: 'branch.access',
          target: { type: 'branch', id: branch.id },
          deviceId: device?.id ?? null,
          ip: clientIp(request),
        })
      }

      if (options.demoBlocked && isDemoMode()) {
        if (staff) {
          await routeDeps.audit({
            branchId,
            actor: auditActor(staff, branchId),
            action: 'demo.blocked',
            target: { type: 'route', id: `${request.method} ${url.pathname}` },
            ip: clientIp(request),
          })
        }
        throw forbidden('This setting is locked in the demo so the next visitor finds everything in place.', 'demo_blocked')
      }

      // Body and idempotency key
      let body = undefined as Body
      if (options.body) {
        const parsed = options.body.safeParse(request.method === 'GET' ? undefined : await readJson(request))
        if (!parsed.success) {
          throw badRequest('Some fields are missing or not allowed.', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
        }
        body = parsed.data
      }
      let idempotencyKey: string | null = null
      if (options.idempotent) {
        idempotencyKey = request.headers.get('idempotency-key')
        if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) throw badRequest('An Idempotency-Key header (16–64 letters, digits, - or _) is required.')
      }

      return await handler({
        request,
        url,
        params,
        body,
        session,
        staff,
        access,
        device,
        branchId,
        branch,
        grant,
        idempotencyKey,
        ip: clientIp(request),
        now,
      })
    } catch (error) {
      return errorResponse(error)
    }
  }
}
