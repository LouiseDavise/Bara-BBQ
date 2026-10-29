// GET /api/devices/me: this registered device, its branch and who can sign in on it with a
// PIN (names only), for the lock screen.
import { pickText } from '../../../shared/localized.js'
import { hasBranchAccess, primaryRoleIn } from '../../../shared/permissions.js'
import type { StaffDoc } from '../../../shared/types/staff.js'
import { toAccess } from '../../../lib/auth/staff.js'
import { loadBranch } from '../../../lib/db/branches.js'
import { groupCol } from '../../../lib/db/paths.js'
import { notFound } from '../../../lib/http/errors.js'
import { json } from '../../../lib/http/respond.js'
import { route } from '../../../lib/http/route.js'

export const GET = route({ auth: 'device' }, async (ctx) => {
  const device = ctx.device!
  const branch = await loadBranch(device.branchId)
  if (!branch) throw notFound('Branch not found.')
  const [members, area] = await Promise.all([
    groupCol<StaffDoc>('staff').where(`branchRoles.${device.branchId}`, 'in', ['manager', 'cashier', 'waiter', 'kitchen', 'host']).get(),
    groupCol<StaffDoc>('staff').where('areaBranches', 'array-contains', device.branchId).get(),
  ])
  const byId = new Map<string, StaffDoc>()
  for (const doc of [...members.docs, ...area.docs]) byId.set(doc.id, doc.data())
  const staff = [...byId.values()]
    .filter((s) => s.active && s.pinHash && hasBranchAccess(toAccess(s), device.branchId))
    .map((s) => ({ id: s.id, name: s.name, role: primaryRoleIn(toAccess(s), device.branchId) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return json({
    device: { id: device.id, name: device.name, kind: device.kind, station: device.station, language: device.language },
    branch: { id: branch.id, code: branch.code, name: pickText(branch.name, branch.languages.default), timeZone: branch.timeZone },
    staff,
    signedIn: ctx.staff ? { id: ctx.staff.id, name: ctx.staff.name } : null,
  })
})
