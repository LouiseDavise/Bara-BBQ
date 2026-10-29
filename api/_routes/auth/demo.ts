// GET /api/auth/demo: the one-tap demo accounts. POST /api/auth/demo: sign in as one.
// Both answer 404 unless DEMO_MODE=true, so a real restaurant's system has no such door.
import { demoLoginBody } from '../../../shared/schemas/auth.js'
import { primaryRoleIn } from '../../../shared/permissions.js'
import type { StaffDoc } from '../../../shared/types/staff.js'
import { cookie, sessionMaxAge, SESSION_COOKIE, signSession } from '../../../lib/auth/session.js'
import { loadStaff, meDto, toAccess } from '../../../lib/auth/staff.js'
import { loadBranches } from '../../../lib/db/branches.js'
import { groupCol } from '../../../lib/db/paths.js'
import { allowRequest } from '../../../lib/db/rate-limit.js'
import { isDemoMode } from '../../../lib/env.js'
import { notFound, tooManyRequests } from '../../../lib/http/errors.js'
import { json } from '../../../lib/http/respond.js'
import { route } from '../../../lib/http/route.js'
import { DEMO_PINS } from '../../../lib/seed/constants.js'

export const GET = route({ auth: 'public' }, async () => {
  if (!isDemoMode()) throw notFound()
  const [snapshot, branches] = await Promise.all([groupCol<StaffDoc>('staff').where('demo', '==', true).get(), loadBranches()])
  const accounts = snapshot.docs
    .map((doc) => doc.data())
    .filter((staff) => staff.active)
    .map((staff) => {
      const branchId = staff.homeBranchId
      return {
        staffId: staff.id,
        name: staff.name,
        groupRole: staff.groupRole,
        branchId,
        role: branchId ? primaryRoleIn(toAccess(staff), branchId) : staff.groupRole,
      }
    })
  return json({
    managerPin: DEMO_PINS.manager,
    branches: branches.map((b) => ({ id: b.id, code: b.code, name: b.name, city: b.city })),
    accounts,
  })
})

export const POST = route({ auth: 'public', body: demoLoginBody }, async (ctx) => {
  if (!isDemoMode()) throw notFound()
  if (!(await allowRequest(`demo-login|${ctx.ip}`, 60, 15 * 60_000))) throw tooManyRequests()
  const staff = await loadStaff(ctx.body.staffId)
  if (!staff || !staff.demo || !staff.active) throw notFound('No such demo account.')
  const maxAge = sessionMaxAge(false)
  const token = await signSession({
    staffId: staff.id,
    deviceId: null,
    expires: Math.floor(ctx.now.getTime() / 1000) + maxAge,
    version: staff.sessionVersion,
  })
  return json({ user: meDto(staff, await loadBranches()) }, { cookies: [cookie(SESSION_COOKIE, token, maxAge)] })
})
