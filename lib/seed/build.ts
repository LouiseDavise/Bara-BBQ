// The non-history seed documents: brand, branches, catalogue, menus, floor plans, stock,
// suppliers, staff, FX months and guests. Also used by the nightly demo reset as the baseline
// to restore.
import { Timestamp } from 'firebase-admin/firestore'
import { REPORTING_CURRENCIES, HINT_CURRENCIES, type CurrencyCode, type LocalCurrency } from '../../shared/currencies.js'
import type { FxMonth } from '../../shared/fx.js'
import { money } from '../../shared/money.js'
import type { CustomerDoc } from '../../shared/types/guests.js'
import type { StockDoc } from '../../shared/types/inventory.js'
import type { IngredientDoc } from '../../shared/types/menu.js'
import type { StaffDoc } from '../../shared/types/staff.js'
import { hashPin, hashSecret, pinProblem } from '../auth/passwords.js'
import { DEMO_PINS, seedPassword } from './constants.js'
import { recipeOverrides } from './data/branch-menus.js'
import { allergens } from './data/catalog.js'
import { brand } from './data/brand.js'
import { averageUsage, type SeedDoc, type Visit } from './history.js'
import { Rng } from './prng.js'
import { hourlyRateFor, type World } from './world.js'

const doc = (path: string, data: object): SeedDoc => ({ path, data: data as Record<string, unknown> })

/** Everything except staff, guests and history. Deterministic, so the nightly reset can compare. */
export function configDocs(world: World, now: Date): SeedDoc[] {
  const docs: SeedDoc[] = [doc('brand/main', brand)]
  for (const a of allergens) docs.push(doc(`allergens/${a.id}`, a))
  for (const c of world.categories) docs.push(doc(`masterCategories/${c.id}`, c))
  for (const m of world.masterItems) docs.push(doc(`masterItems/${m.id}`, m))
  for (const g of world.modifierGroups.values()) docs.push(doc(`modifierGroups/${g.id}`, g))
  for (const i of world.ingredients) {
    const ingredient: IngredientDoc = { id: i.id, name: i.name, unit: i.unit, category: i.category, allergenIds: i.allergenIds }
    docs.push(doc(`ingredients/${i.id}`, ingredient))
  }
  for (const branchId of world.branchIds) {
    const bw = world.branches[branchId]!
    const base = `branches/${branchId}`
    docs.push(doc(base, bw.branch))
    for (const area of bw.areas) docs.push(doc(`${base}/areas/${area.id}`, area))
    for (const table of bw.tables) docs.push(doc(`${base}/tables/${table.id}`, table))
    for (const item of bw.menu) docs.push(doc(`${base}/menuItems/${item.id}`, item))
    for (const [itemId, override] of Object.entries(recipeOverrides[branchId] ?? {})) docs.push(doc(`${base}/recipeOverrides/${itemId}`, { ...override, origin: 'seed' }))
    for (const supplier of bw.suppliers) docs.push(doc(`${base}/suppliers/${supplier.id}`, supplier))
    const rng = new Rng(`stock|${branchId}`)
    const usage = averageUsage(world, branchId)
    for (const ingredientId of bw.usedIngredients) {
      const daily = usage.get(ingredientId) ?? 1
      const par = Math.max(1, Math.ceil(daily * 3))
      const stock: StockDoc = {
        ingredientId,
        onHand: Math.round(par * (0.7 + rng.next() * 0.9)),
        par,
        reorderQty: par,
        supplierId: bw.supplierFor[ingredientId] ?? null,
        unitCostMicro: bw.ingredientCostMicro[ingredientId] ?? 0,
        currency: bw.currency,
        updatedAt: Timestamp.fromDate(now),
        origin: 'seed',
      }
      docs.push(doc(`${base}/stock/${ingredientId}`, stock))
    }
  }
  return docs
}

/** USD-based monthly rates for the last 13 months; past months are locked. */
export function fxDocs(today: string): SeedDoc[] {
  const base: Record<string, number> = { TWD: 32.2, IDR: 16_300, MYR: 4.45, SGD: 1.32, JPY: 150.5, KRW: 1_390, CNY: 7.18, AUD: 1.52 }
  const currencies = [...new Set<CurrencyCode>([...REPORTING_CURRENCIES, ...HINT_CURRENCIES])].filter((c) => c !== 'USD')
  const docs: SeedDoc[] = []
  const [year, month] = today.split('-').map(Number) as [number, number]
  for (let back = 12; back >= 0; back--) {
    const d = new Date(Date.UTC(year, month - 1 - back, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const rates: FxMonth['rates'] = {}
    currencies.forEach((currency, i) => {
      const drift = 1 + 0.012 * Math.sin(back / 2 + i)
      const value = base[currency]! * drift
      rates[currency] = value >= 1000 ? value.toFixed(2) : value.toFixed(4)
    })
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    docs.push(
      doc(`fxRates/${key}`, {
        month: key,
        base: 'USD',
        rates,
        source: 'manual',
        lockedAt: back > 0 ? Timestamp.fromDate(next) : null,
        enteredBy: 'hq-finance',
        origin: 'seed',
      }),
    )
  }
  return docs
}

function pinFor(rng: Rng): string {
  for (;;) {
    const pin = rng.chars('0123456789', 4)
    if (!pinProblem(pin)) return pin
  }
}

/** Staff documents with password and PIN hashes (the slow part of seeding). */
export async function staffDocs(world: World, now: Date): Promise<SeedDoc[]> {
  const rng = new Rng('pins')
  const created = Timestamp.fromDate(now)
  const firstOfRole = new Set<string>()
  const jobs: (() => Promise<SeedDoc>)[] = []
  const password = seedPassword()

  for (const person of world.staffSeeds) {
    const role = person.roles[person.homeBranchId]!
    const demoKey = `${person.homeBranchId}.${role}`
    const demo = !firstOfRole.has(demoKey)
    firstOfRole.add(demoKey)
    const pin = demo ? DEMO_PINS[role] : pinFor(rng)
    const hourlyRate = Object.fromEntries(Object.entries(person.roles).map(([branchId, r]) => [branchId, money(hourlyRateFor(branchId, r), world.branches[branchId]!.currency)]))
    jobs.push(async () => {
      const staff: StaffDoc = {
        id: person.id,
        username: demo ? demoKey : null,
        name: person.name,
        passwordHash: demo ? await hashSecret(password) : null,
        pinHash: await hashPin(pin),
        language: person.language,
        branchRoles: person.roles,
        groupRole: null,
        areaBranches: [],
        homeBranchId: person.homeBranchId,
        hourlyRate,
        email: null,
        phoneE164: null,
        active: true,
        sessionVersion: 1,
        demo,
        createdAt: created,
        origin: 'seed',
      }
      return doc(`staff/${person.id}`, staff)
    })
  }
  for (const user of world.groupUsers) {
    jobs.push(async () => {
      const staff: StaffDoc = {
        id: user.id,
        username: user.username,
        name: user.name,
        passwordHash: await hashSecret(password),
        pinHash: await hashPin(DEMO_PINS.manager),
        language: user.language,
        branchRoles: {},
        groupRole: user.groupRole,
        areaBranches: user.areaBranches,
        homeBranchId: user.homeBranchId,
        hourlyRate: {},
        email: null,
        phoneE164: null,
        active: true,
        sessionVersion: 1,
        demo: true,
        createdAt: created,
        origin: 'seed',
      }
      return doc(`staff/${user.id}`, staff)
    })
  }
  const out: SeedDoc[] = []
  for (let i = 0; i < jobs.length; i += 8) out.push(...(await Promise.all(jobs.slice(i, i + 8).map((job) => job()))))
  return out
}

export interface GuestStats {
  visits: Record<string, number>
  noShows: number
  spend: Partial<Record<LocalCurrency, number>>
  first: number | null
  last: number | null
}

export function addVisits(stats: Map<string, GuestStats>, visits: readonly Visit[], world: World): void {
  for (const visit of visits) {
    const entry = stats.get(visit.customerId) ?? { visits: {}, noShows: 0, spend: {}, first: null, last: null }
    if (visit.noShow) entry.noShows += 1
    else {
      const currency = world.branches[visit.branchId]!.currency
      entry.visits[visit.branchId] = (entry.visits[visit.branchId] ?? 0) + 1
      entry.spend[currency] = (entry.spend[currency] ?? 0) + visit.spend
      entry.first = entry.first === null ? visit.at : Math.min(entry.first, visit.at)
      entry.last = entry.last === null ? visit.at : Math.max(entry.last, visit.at)
    }
    stats.set(visit.customerId, entry)
  }
}

/** Guest profiles (group-wide) with lifetime stats, plus the phone index used to find them. */
export function customerDocs(world: World, stats: Map<string, GuestStats>, historyStart: string): SeedDoc[] {
  const docs: SeedDoc[] = []
  for (const branchId of world.branchIds) {
    const bw = world.branches[branchId]!
    for (const guest of bw.guests) {
      const s = stats.get(guest.id)
      const visits = Object.values(s?.visits ?? {}).reduce((a, b) => a + b, 0)
      const tags: CustomerDoc['tags'] = []
      if (guest.tourist) tags.push('tourist')
      if (visits >= 6) tags.push('regular')
      if (visits >= 10) tags.push('vip')
      const created = Timestamp.fromMillis(s?.first ?? Date.parse(`${historyStart}T00:00:00Z`))
      const customer: CustomerDoc = {
        id: guest.id,
        name: guest.name,
        phoneE164: guest.phoneE164,
        email: guest.email,
        language: guest.language,
        allergies: null,
        dietary: [],
        notes: null,
        tags,
        consent: {
          [bw.branch.country]: { marketing: guest.marketingConsent, noticeVersion: '2026-01', at: created, source: 'reservation' },
        },
        stats: {
          visits: s?.visits ?? {},
          noShows: s?.noShows ?? 0,
          spend: s?.spend ?? {},
          firstVisitAt: s?.first ? Timestamp.fromMillis(s.first) : null,
          lastVisitAt: s?.last ? Timestamp.fromMillis(s.last) : null,
        },
        createdAt: created,
        origin: 'seed',
      }
      docs.push(doc(`customers/${guest.id}`, customer))
      docs.push(doc(`customerKeys/phone:${guest.phoneE164}`, { customerId: guest.id, origin: 'seed' }))
    }
  }
  return docs
}
