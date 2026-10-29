// Master menu (group level) and branch menus (branches/{branchId}/menuItems).
import type { LocalCurrency } from '../currencies.js'
import type { LocalizedText } from '../localized.js'
import type { Money } from '../money.js'
import type { DayKey } from '../time/opening-hours.js'
import type { ImageRef, Origin } from './common.js'

export interface AllergenDoc {
  id: string
  name: LocalizedText
  /** Key of the icon the UI draws. */
  icon: string
  sort: number
}

export interface MasterCategoryDoc {
  id: string
  name: LocalizedText
  description: LocalizedText
  kind: 'food' | 'dessert' | 'drinks'
  sort: number
}

/** Quantity of an ingredient in its base unit (g, ml or whole pieces). */
export interface RecipeLine {
  ingredientId: string
  qty: number
}

export interface ModifierOption {
  id: string
  name: LocalizedText
  /** Extra price per unit in each currency's minor unit; missing means free. */
  priceDelta: Partial<Record<LocalCurrency, number>>
  /** Extra ingredients the option uses, e.g. an extra skewer. */
  recipe?: RecipeLine[]
  /** Allergens the option adds to the dish (e.g. shrimp paste in sambal terasi). */
  allergenIds?: string[]
  containsAlcohol?: boolean
}

export interface ModifierGroupDoc {
  id: string
  kind: 'spice' | 'doneness' | 'sauce' | 'addon' | 'portion' | 'sweetness'
  name: LocalizedText
  required: boolean
  min: number
  max: number
  options: ModifierOption[]
}

export interface Dietary {
  halalSuitable: boolean
  vegetarian: boolean
  vegan: boolean
  containsAlcohol: boolean
}

export interface MasterItemDoc {
  id: string
  categoryId: string
  name: LocalizedText
  description: LocalizedText
  photo: ImageRef | null
  allergenIds: string[]
  dietary: Dietary
  /** 0 (none) to 3 (Bara hot); null when the dish has no heat. */
  spice: { adjustable: boolean; default: number } | null
  modifierGroupIds: string[]
  recipe: RecipeLine[]
  suggestedPrices: Record<LocalCurrency, number>
  defaultStation: string
  signature: boolean
  sort: number
  version: number
  origin: Origin
}

export interface IngredientDoc {
  id: string
  name: LocalizedText
  unit: 'g' | 'ml' | 'pcs'
  category: 'meat' | 'seafood' | 'produce' | 'dry' | 'dairy' | 'beverage' | 'alcohol'
  allergenIds: string[]
}

/** A dish as a branch sells it: the master content copied in, plus local price and rules. */
export interface MenuItemDoc {
  id: string
  /** null for a local special that only this branch sells. */
  masterItemId: string | null
  categoryId: string
  name: LocalizedText
  description: LocalizedText
  photo: ImageRef | null
  allergenIds: string[]
  dietary: Dietary
  spice: { adjustable: boolean; default: number } | null
  modifierGroupIds: string[]
  /** Only for local specials; master items use the master recipe plus recipeOverrides. */
  recipe: RecipeLine[] | null
  price: Money
  station: string
  channels: { dineIn: boolean; qr: boolean; takeaway: boolean }
  /** When it can be ordered, e.g. lunch only; empty means whenever the branch is open. */
  availability: { days: DayKey[]; from: string; to: string }[]
  soldOut: boolean
  badges: { chefsPick: boolean; onlyHere: boolean }
  sort: number
  active: boolean
  masterVersion: number | null
  origin: Origin
}
