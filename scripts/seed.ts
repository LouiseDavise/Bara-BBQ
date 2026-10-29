// npm run seed: fills the Firebase emulator with the whole demo world:
//   brand, 5 branches with settings and floor plans, master + branch menus in 7 languages,
//   ingredients, stock, suppliers, staff for every role, guests, FX months, and history:
//   60 days of raw operations, a year of daily summaries and expenses, today so far, and a
//   week of upcoming reservations.
// Refuses to run against a real project unless you pass --allow-production.
import { existsSync } from 'node:fs'
import { businessDate, businessDayRange } from '../shared/time/business-day.js'
import { addDays } from '../shared/time/zoned.js'
import { usingEmulators } from '../lib/db/admin.js'
import { groupCol } from '../lib/db/paths.js'
import { RAW_DAYS, SUMMARY_DAYS } from '../lib/jobs/demo.js'
import { addVisits, configDocs, customerDocs, fxDocs, staffDocs, type GuestStats } from '../lib/seed/build.js'
import { DEMO_PINS, seedPassword } from '../lib/seed/constants.js'
import { forgetPlans, futureReservations, generateDay, type SeedDoc } from '../lib/seed/history.js'
import { wipeAll, writeDocs } from '../lib/seed/writer.js'
import { buildWorld } from '../lib/seed/world.js'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
if (!process.env.FIRESTORE_EMULATOR_HOST && process.env.USE_FIREBASE_EMULATORS !== 'false') process.env.USE_FIREBASE_EMULATORS = 'true'

const allowProduction = process.argv.includes('--allow-production')
if (!usingEmulators() && !allowProduction) {
  console.error('Refusing to seed a real Firebase project. Use the emulators (npm run emulators), or pass --allow-production if you really mean it.')
  process.exit(1)
}

async function emulatorRunning(): Promise<boolean> {
  try {
    await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}/`)
    return true
  } catch {
    return false
  }
}

const started = Date.now()
const now = new Date()
const log = (message: string) => console.log(`${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s  ${message}`)

async function main() {
  if (usingEmulators() && !(await emulatorRunning())) {
    console.error('The Firestore emulator isn’t running. Start it with `npm run emulators` in another terminal.')
    process.exit(1)
  }
  const world = buildWorld()
  let total = 0

  log('Clearing the database…')
  await wipeAll()

  const today0 = businessDate(now, 'Asia/Taipei')
  total += await writeDocs([...configDocs(world, now), ...fxDocs(today0)])
  log(`Brand, ${world.branchIds.length} branches, ${world.masterItems.length} master items, menus, floor plans, stock and FX months`)
  total += await writeDocs(await staffDocs(world, now))
  log(`${world.staffSeeds.length + world.groupUsers.length} staff (hashing passwords and PINs)`)

  const stats = new Map<string, GuestStats>()
  const generatedUntil: Record<string, number> = {}
  let historyStart = today0
  for (const branchId of world.branchIds) {
    const bw = world.branches[branchId]!
    const { timeZone: tz } = bw.branch
    const cutoff = bw.branch.settings.businessDayCutoff
    const today = businessDate(now, tz, cutoff)
    let written = 0
    let pending: SeedDoc[] = []
    const flush = async () => {
      written += await writeDocs(pending)
      pending = []
    }

    // A year of summaries and expenses (for 12-month charts), raw documents for the last 60 days.
    for (let back = SUMMARY_DAYS; back >= 1; back--) {
      const date = addDays(today, -back)
      const result = generateDay(world, branchId, date)
      addVisits(stats, result.visits, world)
      pending.push(...(back > RAW_DAYS ? result.docs.filter((d) => d.path.includes('/dailySummaries/') || d.path.includes('/expenses/')) : result.docs))
      if (pending.length > 2_000) await flush()
      forgetPlans()
    }
    // Today so far, and the next week of bookings.
    const todayResult = generateDay(world, branchId, today, { until: now.getTime() })
    addVisits(stats, todayResult.visits, world)
    pending.push(...todayResult.docs)
    for (let ahead = 1; ahead <= 7; ahead++) pending.push(...futureReservations(world, branchId, addDays(today, ahead)))
    pending.push({ path: `branches/${branchId}/counters/bill-${today.replaceAll('-', '')}`, data: { next: todayResult.plannedBills + 1 } })
    pending.push({ path: `branches/${branchId}/counters/takeaway-${today.replaceAll('-', '')}`, data: { next: todayResult.plannedTakeaways + 1 } })
    await flush()
    forgetPlans()
    generatedUntil[branchId] = now.getTime()
    total += written
    const first = addDays(today, -SUMMARY_DAYS)
    if (first < historyStart) historyStart = first
    log(`${bw.branch.code}: ${written.toLocaleString('en')} documents (business day ${today}, ${businessDayRange(today, tz, cutoff).start.toISOString().slice(11, 16)} UTC start)`)
  }

  total += await writeDocs(customerDocs(world, stats, historyStart))
  log(`${world.branchIds.reduce((acc, id) => acc + world.branches[id]!.guests.length, 0)} guest profiles with lifetime stats`)

  await groupCol('meta').doc('demo').set({ generatedUntil, seededAt: now.getTime(), rawDays: RAW_DAYS, summaryDays: SUMMARY_DAYS })
  await groupCol('meta').doc('site').set({ changedAt: now, deployHookAt: null })
  total += 2

  log(`Done: ${total.toLocaleString('en')} documents.`)
  console.log(`
Demo sign-in: every seeded account uses the password "${seedPassword()}".
  Group:    owner · area.id (Jakarta + Bali) · area.mysg (KL + Singapore) · finance · menu
  Branches: <branch>.<role>, e.g. jkt.cashier, sin.host, tpe.manager (branches: tpe jkt dps kul sin)
  PINs:     manager ${DEMO_PINS.manager} · cashier ${DEMO_PINS.cashier} · waiter ${DEMO_PINS.waiter} · kitchen ${DEMO_PINS.kitchen} · host ${DEMO_PINS.host}
With DEMO_MODE=true the login page also has one-tap buttons for all of these.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
