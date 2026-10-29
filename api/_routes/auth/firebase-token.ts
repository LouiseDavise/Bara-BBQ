// POST /api/auth/firebase-token: a Firebase custom token for the staff screens' realtime
// listeners, with the user's branch roles as claims (checked by firestore.rules).
import { mintStaffToken } from '../../../lib/auth/firebase-token.js'
import { json } from '../../../lib/http/respond.js'
import { route } from '../../../lib/http/route.js'

export const POST = route({ auth: 'staff' }, async (ctx) => json({ token: await mintStaffToken(ctx.staff!) }))
