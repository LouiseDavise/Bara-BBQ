// GET /api/auth/me: the signed-in user, their branches and this device.
// PATCH /api/auth/me: change the user's own staff-app language.
import { FieldValue } from 'firebase-admin/firestore'
import { meUpdateBody } from '../../../shared/schemas/auth.js'
import { forgetStaff, meDto } from '../../../lib/auth/staff.js'
import { loadBranches } from '../../../lib/db/branches.js'
import { groupCol } from '../../../lib/db/paths.js'
import { json } from '../../../lib/http/respond.js'
import { route } from '../../../lib/http/route.js'

export const GET = route({ auth: 'staff' }, async (ctx) => {
  const device = ctx.device ? { id: ctx.device.id, name: ctx.device.name, kind: ctx.device.kind, station: ctx.device.station, branchId: ctx.device.branchId } : null
  return json({ user: meDto(ctx.staff!, await loadBranches()), device, pinSession: Boolean(ctx.session?.deviceId) })
})

export const PATCH = route({ auth: 'staff', body: meUpdateBody }, async (ctx) => {
  await groupCol('staff').doc(ctx.staff!.id).update({ language: ctx.body.language, updatedAt: FieldValue.serverTimestamp() })
  forgetStaff(ctx.staff!.id)
  return json({ ok: true, language: ctx.body.language })
})
