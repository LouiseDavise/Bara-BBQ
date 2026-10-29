// Keeping the STOEDIO demo alive.
//  - catchUpBranch(): writes the generated history between the branch's watermark and now, so
//    "today so far" always has numbers (called from the staff/HQ context routes, throttled).
//  - runNightly(): deletes what visitors created, completes yesterday, drops the oldest day so
//    exactly 60 days of raw history remain, books reservations a week ahead, restores the
//    baseline configuration where it changed, and calls the deploy hook. Under ~5k writes.
import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore'
import { businessDate, businessDayRange, compactDate } from '../../shared/time/business-day.js'
import { addDays } from '../../shared/time/zoned.js'
import type { StaffDoc } from '../../shared/types/staff.js'
import { firestore } from '../db/admin.js'
import { forgetBranches } from '../db/branches.js'
import { BRANCH_COLLECTIONS, branchDb, groupCol, type GroupCollection } from '../db/paths.js'
import { isDemoMode } from '../env.js'
import { configDocs } from '../seed/build.js'
import { forgetPlans, futureReservations, generateDay, type SeedDoc, type Visit } from '../seed/history.js'
import { deleteMatching, writeDocs } from '../seed/writer.js'
import { buildWorld, type World } from '../seed/world.js'
import { markPublicContentChanged, triggerDeployHookIfChanged, type DeployHookResult } from './deploy-hook.js'

export const RAW_DAYS = 60
export const SUMMARY_DAYS = 365
const CATCH_UP_EVERY_MS = 10 * 60_000
const VISITOR_DELETE_CAP = 1_500
const RAW_COLLECTIONS = ['orders', 'payments', 'invoices', 'reservations', 'shifts', 'cashMovements', 'timeEntries', 'stockMovements', 'purchaseOrders', 'feedback'] as const
const VISITOR_GROUP_COLLECTIONS: GroupCollection[] = ['devices', 'auditLog', 'customers', 'customerKeys', 'staff']

const demoMeta = () => groupCol('meta').doc('demo')

/** Bumps guests' lifetime visit and spend counters for visits that were just written. */
async function applyVisits(world: World, visits: readonly Visit[]): Promise<number> {
  if (!visits.length) return 0
  const byGuest = new Map<string, Record<string, unknown>>()
  for (const visit of visits) {
    const update = byGuest.get(visit.customerId) ?? {}
    if (visit.noShow) update['stats.noShows'] = FieldValue.increment(1)
    else {
      const currency = world.branches[visit.branchId]!.currency
      update[`stats.visits.${visit.branchId}`] = FieldValue.increment(1)
      update[`stats.spend.${currency}`] = FieldValue.increment(visit.spend)
      update['stats.lastVisitAt'] = Timestamp.fromMillis(visit.at)
    }
    byGuest.set(visit.customerId, update)
  }
  const db = firestore()
  const writer = db.bulkWriter()
  writer.onWriteError(() => false)
  for (const [id, update] of byGuest) void writer.update(groupCol('customers').doc(id), update).catch(() => undefined)
  await writer.close()
  return byGuest.size
}

/** Keeps live bill numbers after the numbers the generated day uses. */
async function raiseCounters(branchId: string, date: string, bills: number, takeaways: number): Promise<void> {
  const db = firestore()
  const counters = branchDb(branchId).col('counters')
  await db.runTransaction(async (tx) => {
    const refs: [DocumentReference, number][] = [
      [counters.doc(`bill-${compactDate(date)}`), bills + 1],
      [counters.doc(`takeaway-${compactDate(date)}`), takeaways + 1],
    ]
    const snapshots = await Promise.all(refs.map(([ref]) => tx.get(ref)))
    snapshots.forEach((snapshot, i) => {
      const [ref, next] = refs[i]!
      if (!snapshot.exists || Number(snapshot.get('next')) < next) tx.set(ref, { next, updatedAt: FieldValue.serverTimestamp() })
    })
  })
}

export interface CatchUp {
  branchId: string
  written: number
  guests: number
}

/** Writes generated history up to `now` for one branch. Returns null if it ran recently. */
export async function catchUpBranch(branchId: string, now = Date.now(), options: { force?: boolean } = {}): Promise<CatchUp | null> {
  const world = buildWorld()
  const bw = world.branches[branchId]
  if (!bw) return null
  const db = firestore()
  const from = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(demoMeta())
    const until = Number(snapshot.get(`generatedUntil.${branchId}`) ?? 0)
    if (!until) return null // not a seeded demo database
    if (!options.force && now - until < CATCH_UP_EVERY_MS) return null
    tx.set(demoMeta(), { generatedUntil: { [branchId]: now } }, { merge: true })
    return until
  })
  if (from === null) return null

  const { timeZone: tz } = bw.branch
  const cutoff = bw.branch.settings.businessDayCutoff
  const today = businessDate(now, tz, cutoff)
  let date = businessDate(from, tz, cutoff)
  if (date < addDays(today, -7)) date = addDays(today, -7)
  let written = 0
  let guests = 0
  for (; date <= today; date = addDays(date, 1)) {
    const range = businessDayRange(date, tz, cutoff)
    const window = { from: Math.max(from, range.start.getTime()), until: Math.min(now, range.end.getTime()) }
    if (window.from >= window.until) continue
    const result = generateDay(world, branchId, date, window)
    written += await writeDocs(result.docs)
    guests += await applyVisits(world, result.visits)
    if (date === today) await raiseCounters(branchId, date, result.plannedBills, result.plannedTakeaways)
  }
  forgetPlans()
  return { branchId, written, guests }
}

/** In demo mode, extends a branch's history to now at most every 10 minutes. Never throws. */
export async function keepDemoAlive(branchIds: readonly string[]): Promise<void> {
  if (!isDemoMode()) return
  try {
    for (const branchId of branchIds) await catchUpBranch(branchId)
  } catch (error) {
    console.error('Demo catch-up failed', error)
  }
}

const plainData = (value: unknown): unknown => {
  if (value instanceof Timestamp) return null
  if (value && typeof value === 'object' && 'toMillis' in value) return null
  if (Array.isArray(value)) return value.map(plainData)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'updatedAt')
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, plainData(v)]),
    )
  }
  return value
}

/** Rewrites configuration documents that differ from the seed baseline; returns how many. */
async function restoreBaseline(world: World, now: Date): Promise<{ restored: number; publicChanged: boolean }> {
  const db = firestore()
  const baseline = configDocs(world, now)
  const changed: SeedDoc[] = []
  for (let i = 0; i < baseline.length; i += 300) {
    const chunk = baseline.slice(i, i + 300)
    const snapshots = await db.getAll(...chunk.map((d) => db.doc(d.path)))
    snapshots.forEach((snapshot, j) => {
      const wanted = chunk[j]!
      if (!snapshot.exists || JSON.stringify(plainData(snapshot.data())) !== JSON.stringify(plainData(wanted.data))) changed.push(wanted)
    })
  }
  await writeDocs(changed)
  const publicChanged = changed.some((d) => /^branches\/[^/]+(\/menuItems\/|$)/.test(d.path) || d.path.startsWith('masterItems/'))

  // Staff: restore names, roles and status, never the password or PIN hashes.
  const staff = await groupCol<StaffDoc>('staff').where('origin', '==', 'seed').get()
  const seeds = new Map(world.staffSeeds.map((s) => [s.id, s]))
  const groups = new Map(world.groupUsers.map((g) => [g.id, g]))
  let staffFixed = 0
  for (const snapshot of staff.docs) {
    const doc = snapshot.data()
    const seed = seeds.get(doc.id)
    const group = groups.get(doc.id)
    const wanted = seed
      ? { name: seed.name, branchRoles: seed.roles, groupRole: null, areaBranches: [], language: seed.language, active: true }
      : group
        ? { name: group.name, branchRoles: {}, groupRole: group.groupRole, areaBranches: group.areaBranches, language: group.language, active: true }
        : null
    if (!wanted) continue
    const current = { name: doc.name, branchRoles: doc.branchRoles, groupRole: doc.groupRole, areaBranches: doc.areaBranches, language: doc.language, active: doc.active }
    if (JSON.stringify(plainData(current)) !== JSON.stringify(plainData(wanted))) {
      await snapshot.ref.update({ ...wanted, sessionVersion: FieldValue.increment(1) })
      staffFixed += 1
    }
  }
  if (changed.length || staffFixed) forgetBranches()
  return { restored: changed.length + staffFixed, publicChanged }
}

export interface NightlyReport {
  demo: boolean
  visitorDocsDeleted: number
  historyWritten: number
  rawDocsDropped: number
  summariesDropped: number
  futureReservations: number
  restored: number
  deployHook: DeployHookResult
}

export async function runNightly(now = new Date()): Promise<NightlyReport> {
  const report: NightlyReport = {
    demo: isDemoMode(),
    visitorDocsDeleted: 0,
    historyWritten: 0,
    rawDocsDropped: 0,
    summariesDropped: 0,
    futureReservations: 0,
    restored: 0,
    deployHook: 'unchanged',
  }
  if (report.demo) {
    const world = buildWorld()

    // 1. Whatever visitors created.
    let budget = VISITOR_DELETE_CAP
    for (const branchId of world.branchIds) {
      for (const name of BRANCH_COLLECTIONS) {
        if (budget <= 0) break
        const deleted = await deleteMatching(branchDb(branchId).col(name).where('origin', '==', 'app'), budget)
        report.visitorDocsDeleted += deleted
        budget -= deleted
      }
    }
    for (const name of VISITOR_GROUP_COLLECTIONS) {
      if (budget <= 0) break
      const deleted = await deleteMatching(groupCol(name).where('origin', '==', 'app'), budget)
      report.visitorDocsDeleted += deleted
      budget -= deleted
    }

    for (const branchId of world.branchIds) {
      const bw = world.branches[branchId]!
      const { timeZone: tz } = bw.branch
      const today = businessDate(now, tz, bw.branch.settings.businessDayCutoff)

      // 2. Complete yesterday (and today so far).
      const caughtUp = await catchUpBranch(branchId, now.getTime(), { force: true })
      report.historyWritten += caughtUp?.written ?? 0

      // 3. Keep exactly RAW_DAYS of raw history; summaries and expenses for a year.
      const rawCutoff = addDays(today, -RAW_DAYS)
      for (const name of RAW_COLLECTIONS) {
        report.rawDocsDropped += await deleteMatching(branchDb(branchId).col(name).where('businessDate', '<', rawCutoff))
      }
      const summaryCutoff = addDays(today, -SUMMARY_DAYS)
      report.summariesDropped += await deleteMatching(branchDb(branchId).col('dailySummaries').where('businessDate', '<', summaryCutoff))
      report.summariesDropped += await deleteMatching(branchDb(branchId).col('expenses').where('businessDate', '<', summaryCutoff))
      const counters = await branchDb(branchId).col('counters').select().get()
      const oldCounter = `${compactDate(addDays(today, -2))}`
      const stale = counters.docs.filter((d) => /-(\d{8})$/.test(d.id) && d.id.slice(-8) < oldCounter)
      await Promise.all(stale.map((d) => d.ref.delete()))

      // 4. A week ahead of bookings.
      const ahead = futureReservations(world, branchId, addDays(today, 7))
      report.futureReservations += await writeDocs(ahead)
    }
    forgetPlans()

    // 5. Baseline settings, menus, floor plans, stock and staff.
    const restored = await restoreBaseline(world, now)
    report.restored = restored.restored
    if (restored.publicChanged) await markPublicContentChanged(now)
  }

  // 6. Prerendered pages: redeploy if menus or branch info changed today.
  report.deployHook = await triggerDeployHookIfChanged(now)
  return report
}
