// Manager PIN approval for sensitive actions (void, refund, discount over the limit, reopening
// a bill, voiding an invoice, cash payout, price change). The request carries
// `approval: { staffId, pin }`; the approver must be allowed to do the action outright.
import { z } from 'zod'
import { can, primaryRoleIn, type BranchPermission } from '../../shared/permissions.js'
import type { StaffDoc } from '../../shared/types/staff.js'
import { forbidden } from '../http/errors.js'
import type { RouteContext } from '../http/route.js'
import { checkLockout, clearFailures, registerFailure } from '../db/rate-limit.js'
import { verifySecret } from './passwords.js'
import { loadStaff, toAccess } from './staff.js'

export const approvalSchema = z.strictObject({
  staffId: z.string().min(1).max(64),
  pin: z.string().regex(/^\d{4,6}$/),
})
export type Approval = z.infer<typeof approvalSchema>

export const PIN_MAX_FAILURES = 5
export const PIN_WINDOW_MS = 15 * 60_000
export const PIN_LOCK_MS = 5 * 60_000

/** Lockout key for a staff member's PIN on one device (or one IP when not on a device). */
export const pinLockKey = (staffId: string, where: string): string => `pin|${staffId}|${where}`

/** Checks a PIN with lockout; returns false for a wrong PIN, throws 429 when locked out. */
export async function checkPin(staff: StaffDoc, pin: string, where: string): Promise<boolean> {
  const key = pinLockKey(staff.id, where)
  const lock = await checkLockout(key)
  if (lock.locked) throw forbidden(`Too many wrong PINs. Try again in ${Math.ceil((lock.until! - Date.now()) / 60_000)} min.`, 'pin_locked')
  if (staff.pinHash && (await verifySecret(pin, staff.pinHash))) {
    await clearFailures(key)
    return true
  }
  await registerFailure(key, PIN_MAX_FAILURES, PIN_WINDOW_MS, PIN_LOCK_MS)
  return false
}

/**
 * Returns the approving manager, or null when the signed-in user may act without one.
 * Throws 403 `approval_required` (the UI then shows the PIN pad) or `approval_invalid`.
 */
export async function requireApproval(
  ctx: RouteContext<{ approval?: Approval | undefined }>,
  permission: BranchPermission,
): Promise<StaffDoc | null> {
  if (ctx.grant === 'allow') return null
  const approval = ctx.body?.approval
  if (!approval) throw forbidden('A manager PIN is needed for this.', 'approval_required')
  const approver = await loadStaff(approval.staffId)
  const branchId = ctx.branchId
  if (!approver || !approver.active || !branchId || can(toAccess(approver), permission, branchId, ctx.branch?.settings.permissions) !== 'allow') {
    throw forbidden('That person can’t approve this.', 'approval_invalid')
  }
  if (!(await checkPin(approver, approval.pin, ctx.device?.id ?? ctx.ip))) throw forbidden('Wrong manager PIN.', 'approval_invalid')
  return approver
}

export function approverActor(approver: StaffDoc | null, branchId: string) {
  return approver ? { staffId: approver.id, name: approver.name, role: primaryRoleIn(toAccess(approver), branchId) } : null
}
