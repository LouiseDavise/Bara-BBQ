// GET /api/cron/:job: Vercel Cron, authenticated with CRON_SECRET.
//   nightly: demo rolling reset (DEMO_MODE) and the deploy-hook check.
import { runNightly } from '../../../lib/jobs/demo.js'
import { notFound } from '../../../lib/http/errors.js'
import { json } from '../../../lib/http/respond.js'
import { route } from '../../../lib/http/route.js'

export const GET = route({ auth: 'cron' }, async (ctx) => {
  if (ctx.params.job === 'nightly') return json(await runNightly(ctx.now))
  throw notFound('Unknown cron job.')
})
