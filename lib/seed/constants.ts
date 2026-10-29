// Fixed demo credentials. In DEMO_MODE the login page shows one-tap buttons and the manager
// PIN, so visitors can try approvals; outside demo mode, change these after seeding.

/** PINs for seeded demo accounts, by role. */
export const DEMO_PINS = {
  manager: '2468',
  cashier: '1357',
  waiter: '1470',
  kitchen: '2580',
  host: '3690',
} as const

/** Password for every seeded account that has one (override with SEED_PASSWORD). */
export const seedPassword = (): string => process.env.SEED_PASSWORD || 'bara-demo-2026'
