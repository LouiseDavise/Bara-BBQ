// staff/{staffId} and devices/{deviceId}: group-level, because one person can work in several
// branches with a different role in each.
import type { StaffLocale } from '../locales.js'
import type { Money } from '../money.js'
import type { BranchRole, GroupRole } from '../permissions.js'
import type { Origin, TimestampLike } from './common.js'

export interface StaffDoc {
  id: string
  /** Null for PIN-only staff who only ever use registered devices. */
  username: string | null
  name: string
  passwordHash: string | null
  pinHash: string | null
  language: StaffLocale
  branchRoles: Record<string, BranchRole>
  groupRole: GroupRole | null
  areaBranches: string[]
  homeBranchId: string | null
  /** Hourly rate per branch in that branch's currency, for labour cost. */
  hourlyRate: Record<string, Money>
  email: string | null
  phoneE164: string | null
  active: boolean
  /** Bumped on password change or deactivation; older sessions stop working. */
  sessionVersion: number
  /** Offered as a one-tap login when DEMO_MODE is on. */
  demo: boolean
  createdAt: TimestampLike
  origin: Origin
}

export type DeviceKind = 'pos' | 'kds' | 'host' | 'waiter'

export interface DeviceDoc {
  id: string
  branchId: string
  kind: DeviceKind
  name: string
  /** KDS station, or null for the expo screen. */
  station: string | null
  language: StaffLocale
  /** sha256 of the secret held in the device's cookie. */
  secretHash: string
  registeredBy: string
  registeredAt: TimestampLike
  lastSeenAt: TimestampLike | null
  revokedAt: TimestampLike | null
  origin: Origin
}
