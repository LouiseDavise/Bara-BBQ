// POST /api/auth/logout: ends the staff session. A registered device keeps its own cookie, so
// it goes back to the PIN screen rather than the login page.
import { clearCookie, SESSION_COOKIE } from '../../../lib/auth/session.js'
import { json } from '../../../lib/http/respond.js'
import { route } from '../../../lib/http/route.js'

export const POST = route({ auth: 'public' }, () => json({ ok: true }, { cookies: [clearCookie(SESSION_COOKIE)] }))
