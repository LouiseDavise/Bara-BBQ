// Loading staff and devices, and the user details the API sends to the staff app.
import type { BranchDoc } from '../../shared/types/branch.js'
import type { DeviceDoc, StaffDoc } from '../../shared/types/staff.js'
import { accessibleBranches, primaryRoleIn, type UserAccess } from '../../shared/permissions.js'
import { groupCol, isDocId } from '../db/paths.js'
import { constantTimeEqual, sha256Hex } from './crypto.js'

const STAFF_TTL_MS = 10_000
const DEVICE_TTL_MS = 30_000
const staffCache = new Map<string, { at: number; staff: StaffDoc | null }>()
const deviceCache = new Map<string, { at: number; device: DeviceDoc | null }>()

export async function loadStaff(staffId: string): Promise<StaffDoc | null> {
  if (!isDocId(staffId)) return null
  const hit = staffCache.get(staffId)
  if (hit && Date.now() - hit.at < STAFF_TTL_MS) return hit.staff
  const snapshot = await groupCol<StaffDoc>('staff').doc(staffId).get()
  const staff = snapshot.exists ? snapshot.data()! : null
  staffCache.set(staffId, { at: Date.now(), staff })
  return staff
}

export async function loadDevice(deviceId: string): Promise<DeviceDoc | null> {
  if (!isDocId(deviceId)) return null
  const hit = deviceCache.get(deviceId)
  if (hit && Date.now() - hit.at < DEVICE_TTL_MS) return hit.device
  const snapshot = await groupCol<DeviceDoc>('devices').doc(deviceId).get()
  const device = snapshot.exists ? snapshot.data()! : null
  deviceCache.set(deviceId, { at: Date.now(), device })
  return device
}

export function forgetStaff(staffId: string): void {
  staffCache.delete(staffId)
}

export async function findStaffByUsername(username: string): Promise<StaffDoc | null> {
  const snapshot = await groupCol<StaffDoc>('staff').where('username', '==', username.trim().toLowerCase()).limit(1).get()
  return snapshot.empty ? null : snapshot.docs[0]!.data()
}

export const deviceSecretHash = (secret: string): Promise<string> => sha256Hex(`bara-device|${secret}`)

export async function deviceSecretMatches(device: DeviceDoc, secret: string): Promise<boolean> {
  return constantTimeEqual(await deviceSecretHash(secret), device.secretHash)
}

export function toAccess(staff: StaffDoc): UserAccess {
  return {
    id: staff.id,
    active: staff.active,
    branchRoles: staff.branchRoles,
    groupRole: staff.groupRole,
    areaBranches: staff.areaBranches,
  }
}

export interface MeBranch {
  id: string
  code: string
  name: BranchDoc['name']
  city: BranchDoc['city']
  timeZone: string
  role: string | null
}

/** What /api/auth/me returns: no hashes, only what the staff app needs. */
export function meDto(staff: StaffDoc, branches: readonly BranchDoc[]) {
  const access = toAccess(staff)
  const ids = accessibleBranches(access, branches.map((b) => b.id))
  return {
    id: staff.id,
    name: staff.name,
    username: staff.username,
    language: staff.language,
    groupRole: staff.groupRole,
    demo: staff.demo,
    branches: branches
      .filter((b) => ids.includes(b.id))
      .map<MeBranch>((b) => ({ id: b.id, code: b.code, name: b.name, city: b.city, timeZone: b.timeZone, role: primaryRoleIn(access, b.id) })),
  }
}
