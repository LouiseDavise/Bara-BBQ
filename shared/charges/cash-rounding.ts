// Cash rounding applies only to the part of a bill paid in cash, shown as its own line:
// Malaysia rounds to the nearest 5 sen by law; Indonesia (Rp 100) and Singapore (5¢) can opt in.
import type { PricingRules } from '../country-profiles/types.js'
import { roundToIncrement, subtract, type Money } from '../money.js'

export interface CashDue {
  /** What the guest hands over in cash. */
  due: Money
  /** due − amount: the rounding line on the receipt (can be negative). */
  adjustment: Money
}

export function cashDue(amount: Money, rules: PricingRules['cashRounding']): CashDue {
  if (!rules.enabled || rules.increment <= 1) return { due: amount, adjustment: subtract(amount, amount) }
  const due = roundToIncrement(amount, rules.increment, rules.mode)
  return { due, adjustment: subtract(due, amount) }
}

/** Change to give back from cash handed over, or null if it isn't enough. */
export function changeFor(tendered: Money, due: Money): Money | null {
  const change = subtract(tendered, due)
  return change.amount < 0 ? null : change
}
