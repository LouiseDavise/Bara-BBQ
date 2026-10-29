// Firebase custom tokens for the staff screens' read-only onSnapshot listeners. The claims
// carry the user's role per branch, which firestore.rules checks; there are no client writes.
import type { BranchRole, GroupRole, UserAccess } from '../../shared/permissions.js'
import type { DeviceDoc, StaffDoc } from '../../shared/types/staff.js'
import { adminAuth } from '../db/admin.js'
import { toAccess } from './staff.js'

export interface RealtimeClaims {
  /** Role per branch the user can read in realtime. */
  br: Record<string, BranchRole>
  /** Group role; 'owner' reads every branch. */
  g: GroupRole | null
}

const RANK: Record<BranchRole, number> = { manager: 5, cashier: 4, host: 3, waiter: 2, kitchen: 1 }

export function realtimeClaims(access: UserAccess): RealtimeClaims {
  const br: Record<string, BranchRole> = { ...access.branchRoles }
  if (access.groupRole === 'area') {
    for (const branchId of access.areaBranches) {
      if (!br[branchId] || RANK[br[branchId]!] < RANK.manager) br[branchId] = 'manager'
    }
  }
  return { br, g: access.active ? access.groupRole : null }
}

export function mintStaffToken(staff: StaffDoc): Promise<string> {
  return adminAuth().createCustomToken(staff.id, { ...realtimeClaims(toAccess(staff)) })
}

/** An unattended kitchen screen reads its branch's tickets without anyone signed in. */
export function mintKitchenDeviceToken(device: DeviceDoc): Promise<string> {
  const claims: RealtimeClaims = { br: { [device.branchId]: 'kitchen' }, g: null }
  return adminAuth().createCustomToken(`device_${device.id}`, { ...claims })
}
