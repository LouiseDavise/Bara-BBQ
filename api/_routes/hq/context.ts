// GET /api/hq/context: the head-office shell. Group roles only; branch staff get 403.
import { accessibleBranches, groupGrants } from '../../../shared/permissions.js'
import { loadBranches } from '../../../lib/db/branches.js'
import { keepDemoAlive } from '../../../lib/jobs/demo.js'
import { json } from '../../../lib/http/respond.js'
import { route } from '../../../lib/http/route.js'

export const GET = route({ auth: 'staff', permission: 'hq.open' }, async (ctx) => {
  const branches = await loadBranches()
  const ids = accessibleBranches(ctx.access!, branches.map((b) => b.id))
  await keepDemoAlive(ids)
  return json({
    groupRole: ctx.staff!.groupRole,
    grants: groupGrants(ctx.access!),
    branches: branches
      .filter((b) => ids.includes(b.id))
      .map((b) => ({ id: b.id, code: b.code, name: b.name, city: b.city, country: b.country, currency: b.currency, timeZone: b.timeZone })),
  })
})
