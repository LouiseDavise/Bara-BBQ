// Everything static the seed writes (and the history generator reads), assembled in memory:
// branches, floor plans, menus with local prices, effective recipes and costs, suppliers,
// staff and the guest pool.
import { countryProfile, type CountryProfile } from '../../shared/country-profiles/index.js'
import type { LocalCurrency } from '../../shared/currencies.js'
import type { Locale } from '../../shared/locales.js'
import { menuRuleProblem, stationFor } from '../../shared/menu-rules.js'
import { money } from '../../shared/money.js'
import type { BranchRole } from '../../shared/permissions.js'
import type { BranchDoc } from '../../shared/types/branch.js'
import type { AreaDoc, TableDoc } from '../../shared/types/floor.js'
import { MICRO, type SupplierDoc } from '../../shared/types/inventory.js'
import type { MasterCategoryDoc, MasterItemDoc, MenuItemDoc, ModifierGroupDoc, RecipeLine } from '../../shared/types/menu.js'
import { availability, chefsPicks, excluded, localPrice, recipeOverrides, specials } from './data/branch-menus.js'
import { branches } from './data/branches.js'
import { categories, ingredients, modifierGroups, type IngredientSeed } from './data/catalog.js'
import { floorFor } from './data/floors.js'
import { masterItems } from './data/master-items.js'
import { groupUsers, guestMix, guestPools, hourlyRates, staffSeeds, suppliers as supplierSeeds, type GroupUserSeed, type StaffSeed, type SupplierSeed } from './data/people.js'
import { Rng } from './prng.js'

export interface GuestSeed {
  id: string
  branchId: string
  name: string
  phoneE164: string
  email: string
  language: Locale
  country: string
  tourist: boolean
  marketingConsent: boolean
}

export interface BranchWorld {
  branch: BranchDoc
  profile: CountryProfile
  currency: LocalCurrency
  areas: AreaDoc[]
  tables: TableDoc[]
  menu: MenuItemDoc[]
  menuById: Map<string, MenuItemDoc>
  /** Effective recipe per menu item: special, branch override, or master. */
  recipes: Map<string, RecipeLine[]>
  /** Recipe cost per menu item in micro-minor units (base recipe, no modifiers). */
  unitCostMicro: Record<string, number>
  /** Cost per base unit (g, ml, pc) in micro-minor units. */
  ingredientCostMicro: Record<string, number>
  usedIngredients: string[]
  suppliers: SupplierDoc[]
  supplierSeeds: SupplierSeed[]
  /** Who supplies each ingredient. */
  supplierFor: Record<string, string>
  staff: StaffSeed[]
  staffByRole: Record<BranchRole, StaffSeed[]>
  guests: GuestSeed[]
}

export interface World {
  branchIds: string[]
  branches: Record<string, BranchWorld>
  categories: MasterCategoryDoc[]
  masterItems: MasterItemDoc[]
  modifierGroups: Map<string, ModifierGroupDoc>
  ingredients: IngredientSeed[]
  groupUsers: GroupUserSeed[]
  staffSeeds: StaffSeed[]
}

const GUESTS_PER_BRANCH: Record<string, number> = { tpe: 110, jkt: 130, dps: 130, kul: 120, sin: 110 }

function ingredientMicro(seed: IngredientSeed, currency: LocalCurrency): number | null {
  const cost = seed.cost[currency]
  if (cost === null) return null
  // Costs are per kg / litre (g, ml) or per piece.
  return seed.unit === 'pcs' ? cost * MICRO : (cost * MICRO) / 1000
}

function guestsFor(branch: BranchDoc): GuestSeed[] {
  const rng = new Rng(`guests|${branch.id}`)
  const phones = new Set<string>()
  const count = GUESTS_PER_BRANCH[branch.id] ?? 100
  const guests: GuestSeed[] = []
  for (let i = 0; i < count; i++) {
    const poolKey = rng.weighted(guestMix[branch.id]!)
    const pool = guestPools[poolKey]!
    const name = rng.pick(pool.names)
    let phone: string
    do phone = pool.phone[0] + rng.chars('0123456789', pool.phone[1])
    while (phones.has(phone))
    phones.add(phone)
    const local = poolKey === 'my' ? rng.weighted<Locale>([['en', 55], ['ms', 30], ['zh-CN', 15]]) : poolKey === 'sg' ? rng.weighted<Locale>([['en', 82], ['zh-CN', 18]]) : pool.language
    const language = branch.languages.enabled.includes(local) ? local : branch.languages.default
    const slug = name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z]+/g, '.')
      .replace(/^\.|\.$/g, '')
    guests.push({
      id: `c-${branch.id}-${String(i + 1).padStart(3, '0')}`,
      branchId: branch.id,
      name,
      phoneE164: phone,
      email: `${slug || 'guest'}.${branch.id}${i + 1}@example.com`,
      language,
      country: pool.country,
      tourist: pool.tourist,
      marketingConsent: rng.chance(0.4),
    })
  }
  return guests
}

function buildBranch(branch: BranchDoc, world: Pick<World, 'masterItems' | 'modifierGroups'>): BranchWorld {
  const profile = countryProfile(branch.country)
  const currency = profile.currency
  const stationIds = branch.settings.stations.map((s) => s.id)
  const skip = new Set(excluded[branch.id] ?? [])
  const overrides = recipeOverrides[branch.id] ?? {}
  const picks = new Set(chefsPicks[branch.id] ?? [])
  const times = availability[branch.id] ?? {}

  const menu: MenuItemDoc[] = []
  const recipes = new Map<string, RecipeLine[]>()
  for (const master of world.masterItems) {
    if (skip.has(master.id) || menuRuleProblem(master, branch)) continue
    menu.push({
      id: master.id,
      masterItemId: master.id,
      categoryId: master.categoryId,
      name: master.name,
      description: master.description,
      photo: master.photo,
      allergenIds: master.allergenIds,
      dietary: master.dietary,
      spice: master.spice,
      modifierGroupIds: master.modifierGroupIds,
      recipe: null,
      price: money(localPrice(branch.id, master.suggestedPrices[currency]), currency),
      station: stationFor(master.defaultStation, stationIds),
      channels: { dineIn: true, qr: true, takeaway: !master.dietary.containsAlcohol },
      availability: times[master.id] ?? [],
      soldOut: false,
      badges: { chefsPick: picks.has(master.id), onlyHere: false },
      sort: master.sort,
      active: true,
      masterVersion: master.version,
      origin: 'seed',
    })
    recipes.set(master.id, overrides[master.id]?.lines ?? master.recipe)
  }
  specials
    .filter((s) => s.branchId === branch.id)
    .forEach((special, index) => {
      menu.push({
        id: special.id,
        masterItemId: null,
        categoryId: special.categoryId,
        name: special.name,
        description: special.description,
        photo: null,
        allergenIds: special.allergenIds,
        dietary: special.dietary,
        spice: special.spice,
        modifierGroupIds: special.modifierGroupIds,
        recipe: special.recipe,
        price: money(special.price, currency),
        station: stationFor(special.station, stationIds),
        channels: { dineIn: true, qr: true, takeaway: !special.dietary.containsAlcohol },
        availability: [],
        soldOut: false,
        badges: { chefsPick: false, onlyHere: true },
        sort: 100 + index,
        active: true,
        masterVersion: null,
        origin: 'seed',
      })
      recipes.set(special.id, special.recipe)
    })

  const ingredientCostMicro: Record<string, number> = {}
  for (const seed of ingredients) {
    const micro = ingredientMicro(seed, currency)
    if (micro !== null) ingredientCostMicro[seed.id] = Math.round(micro)
  }

  const used = new Set<string>()
  const unitCostMicro: Record<string, number> = {}
  for (const item of menu) {
    const recipe = recipes.get(item.id) ?? []
    unitCostMicro[item.id] = recipe.reduce((acc, line) => {
      used.add(line.ingredientId)
      return acc + line.qty * (ingredientCostMicro[line.ingredientId] ?? 0)
    }, 0)
    for (const groupId of item.modifierGroupIds) {
      for (const option of world.modifierGroups.get(groupId)?.options ?? []) option.recipe?.forEach((line) => used.add(line.ingredientId))
    }
  }

  const seeds = supplierSeeds[branch.id] ?? []
  const supplierFor: Record<string, string> = {}
  const supplierDocs: SupplierDoc[] = seeds.map((seed) => {
    const covered = ingredients.filter((i) => used.has(i.id) && seed.covers.includes(i.category)).map((i) => i.id)
    covered.forEach((id) => (supplierFor[id] = seed.id))
    return { id: seed.id, name: seed.name, contact: seed.contact, phoneE164: seed.phoneE164, email: null, taxId: null, terms: '30 days', ingredientIds: covered, origin: 'seed' }
  })

  const staff = staffSeeds.filter((s) => s.roles[branch.id])
  const byRole = { manager: [], cashier: [], waiter: [], kitchen: [], host: [] } as Record<BranchRole, StaffSeed[]>
  for (const person of staff) byRole[person.roles[branch.id]!].push(person)

  const { areas, tables } = floorFor(branch.id)
  return {
    branch,
    profile,
    currency,
    areas,
    tables,
    menu,
    menuById: new Map(menu.map((item) => [item.id, item])),
    recipes,
    unitCostMicro,
    ingredientCostMicro,
    usedIngredients: [...used].sort(),
    suppliers: supplierDocs,
    supplierSeeds: seeds,
    supplierFor,
    staff,
    staffByRole: byRole,
    guests: guestsFor(branch),
  }
}

let cached: World | null = null

export function buildWorld(): World {
  if (cached) return cached
  const base = { masterItems, modifierGroups: new Map(modifierGroups.map((g) => [g.id, g])) }
  const built: Record<string, BranchWorld> = {}
  for (const branch of branches) built[branch.id] = buildBranch(branch, base)
  cached = {
    branchIds: branches.map((b) => b.id),
    branches: built,
    categories,
    masterItems,
    modifierGroups: base.modifierGroups,
    ingredients,
    groupUsers,
    staffSeeds,
  }
  return cached
}

export const hourlyRateFor = (branchId: string, role: BranchRole) => hourlyRates[branchId]![role]
