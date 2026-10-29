// Rules for what a branch may put on its menu. Used by the seed now and by the menu API later.
import type { Dietary } from './types/menu.js'

export type MenuRuleProblem = 'alcoholNotAllowed' | 'notHalalSuitable'

/** Why an item can't be sold in a branch, or null if it can. */
export function menuRuleProblem(item: { dietary: Dietary }, branch: { flags: { alcohol: boolean; halal: boolean } }): MenuRuleProblem | null {
  if (item.dietary.containsAlcohol && !branch.flags.alcohol) return 'alcoholNotAllowed'
  if (branch.flags.halal && !item.dietary.halalSuitable) return 'notHalalSuitable'
  return null
}

/** Maps a master item's default station onto the stations a branch actually has (KL: bar → drinks). */
export function stationFor(defaultStation: string, stationIds: readonly string[]): string {
  if (stationIds.includes(defaultStation)) return defaultStation
  if (defaultStation === 'bar' && stationIds.includes('drinks')) return 'drinks'
  return stationIds[0] ?? defaultStation
}
