// POST /api/auth/login: username + password → signed HttpOnly session cookie.
import { loginBody } from '../../../shared/schemas/auth.js'
import { verifyAgainstNothing, verifySecret } from '../../../lib/auth/passwords.js'
import { cookie, sessionMaxAge, SESSION_COOKIE, signSession } from '../../../lib/auth/session.js'
import { findStaffByUsername, meDto } from '../../../lib/auth/staff.js'
import { appendAudit } from '../../../lib/db/audit.js'
import { loadBranches } from '../../../lib/db/branches.js'
import { allowRequest } from '../../../lib/db/rate-limit.js'
import { tooManyRequests, unauthorized } from '../../../lib/http/errors.js'
import { json } from '../../../lib/http/respond.js'
import { route } from '../../../lib/http/route.js'

const WINDOW_MS = 15 * 60_000

export const POST = route({ auth: 'public', body: loginBody }, async (ctx) => {
  const username = ctx.body.username.toLowerCase()
  const allowed = (await allowRequest(`login-ip|${ctx.ip}`, 10, WINDOW_MS)) && (await allowRequest(`login-user|${username}`, 5, WINDOW_MS))
  if (!allowed) throw tooManyRequests()

  const staff = await findStaffByUsername(username)
  const ok = staff?.active && staff.passwordHash ? await verifySecret(ctx.body.password, staff.passwordHash) : await verifyAgainstNothing(ctx.body.password)
  if (!ok || !staff) throw unauthorized('Wrong username or password.')

  const maxAge = sessionMaxAge(false)
  const token = await signSession({
    staffId: staff.id,
    deviceId: null,
    expires: Math.floor(ctx.now.getTime() / 1000) + maxAge,
    version: staff.sessionVersion,
  })
  await appendAudit({
    branchId: staff.homeBranchId,
    actor: { staffId: staff.id, name: staff.name, role: staff.groupRole },
    action: 'auth.login',
    ip: ctx.ip,
  })
  return json({ user: meDto(staff, await loadBranches()) }, { cookies: [cookie(SESSION_COOKIE, token, maxAge)] })
})
