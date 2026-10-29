// POST /api/auth/pin: on a registered device, switch to another staff member with their PIN.
// The session it creates only works on this device and lasts a shift.
import { pinBody } from '../../../shared/schemas/auth.js'
import { hasBranchAccess } from '../../../shared/permissions.js'
import { checkPin } from '../../../lib/auth/approval.js'
import { cookie, sessionMaxAge, SESSION_COOKIE, signSession } from '../../../lib/auth/session.js'
import { loadStaff, meDto, toAccess } from '../../../lib/auth/staff.js'
import { loadBranches } from '../../../lib/db/branches.js'
import { forbidden } from '../../../lib/http/errors.js'
import { json } from '../../../lib/http/respond.js'
import { route } from '../../../lib/http/route.js'

export const POST = route({ auth: 'device', body: pinBody }, async (ctx) => {
  const device = ctx.device!
  const staff = await loadStaff(ctx.body.staffId)
  if (!staff || !staff.active || !hasBranchAccess(toAccess(staff), device.branchId)) throw forbidden('Wrong PIN.', 'pin_invalid')
  if (!(await checkPin(staff, ctx.body.pin, device.id))) throw forbidden('Wrong PIN.', 'pin_invalid')

  const maxAge = sessionMaxAge(true)
  const token = await signSession({
    staffId: staff.id,
    deviceId: device.id,
    expires: Math.floor(ctx.now.getTime() / 1000) + maxAge,
    version: staff.sessionVersion,
  })
  return json({ user: meDto(staff, await loadBranches()) }, { cookies: [cookie(SESSION_COOKIE, token, maxAge)] })
})
