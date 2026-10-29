// GET /api/b/:branch/context: what the staff shell needs to open a branch: the branch header,
// the user's role there and what that role may do. Refused (403) for anyone without access
// to the branch, which is how a Jakarta cashier is kept out of Singapore.
import { branchGrants, primaryRoleIn } from '../../../../shared/permissions.js'
import { businessDate } from '../../../../shared/time/business-day.js'
import { keepDemoAlive } from '../../../../lib/jobs/demo.js'
import { json } from '../../../../lib/http/respond.js'
import { route } from '../../../../lib/http/route.js'

export const GET = route({ auth: 'staff', branch: 'url' }, async (ctx) => {
  const branch = ctx.branch!
  // Demo only: extend generated history to now, so "today so far" has numbers.
  await keepDemoAlive([branch.id])
  return json({
    branch: {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      city: branch.city,
      country: branch.country,
      currency: branch.currency,
      timeZone: branch.timeZone,
      languages: branch.languages,
      flags: branch.flags,
      stations: branch.settings.stations,
      idleLockMin: branch.settings.idleLockMin,
    },
    role: primaryRoleIn(ctx.access!, branch.id),
    grants: branchGrants(ctx.access!, branch.id, branch.settings.permissions),
    businessDate: businessDate(ctx.now, branch.timeZone, branch.settings.businessDayCutoff),
    serverTime: ctx.now.toISOString(),
  })
})
