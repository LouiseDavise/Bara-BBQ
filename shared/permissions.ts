// The one permission matrix, used by the API (to allow or refuse a request) and the UI (to
// hide what a user can't do). See docs/PLAN.md §5 for the same table in prose.
//
//   allow     the role can do it
//   approval  the role can do it with a manager PIN entered on the spot
//   read      the role can see it but not change it
export const BRANCH_ROLES = ['manager', 'cashier', 'waiter', 'kitchen', 'host'] as const
export type BranchRole = (typeof BRANCH_ROLES)[number]

export const GROUP_ROLES = ['owner', 'area', 'finance', 'menuEditor'] as const
export type GroupRole = (typeof GROUP_ROLES)[number]

export type Role = BranchRole | GroupRole
export type Grant = 'allow' | 'approval' | 'read'
export type Decision = 'allow' | 'approval' | 'deny'

type Row = Partial<Record<Role, Grant>>

const A = 'allow' as const
const P = 'approval' as const
const R = 'read' as const

/** Permissions checked inside one branch. */
const BRANCH_MATRIX = {
  'floor.view': { owner: A, area: A, manager: A, cashier: A, waiter: A, host: A },
  'table.open': { owner: A, area: A, manager: A, cashier: A, waiter: A, host: A },
  'order.take': { owner: A, area: A, manager: A, cashier: A, waiter: A },
  'order.confirmQr': { owner: A, area: A, manager: A, cashier: A, waiter: A },
  'line.void': { owner: A, area: A, manager: A, cashier: P, waiter: P },
  'item.soldOut': { owner: A, area: A, manager: A, cashier: A, waiter: A, kitchen: A },
  'kds.use': { owner: A, area: A, manager: A, waiter: R, kitchen: A },
  'reservation.manage': { owner: A, area: A, manager: A, cashier: R, waiter: R, host: A },
  'waitlist.manage': { owner: A, area: A, manager: A, waiter: R, host: A },
  'takeaway.manage': { owner: A, area: A, manager: A, cashier: A, waiter: A },
  'bill.view': { owner: A, area: A, finance: R, manager: A, cashier: A, waiter: A },
  'bill.discount': { owner: A, area: A, manager: A, cashier: A, waiter: P },
  'bill.discountOverLimit': { owner: A, area: A, manager: A, cashier: P },
  'bill.comp': { owner: A, area: A, manager: A, cashier: P },
  'bill.split': { owner: A, area: A, manager: A, cashier: A, waiter: A },
  'payment.take': { owner: A, area: A, manager: A, cashier: A },
  'bill.reopen': { owner: A, area: A, manager: A, cashier: P },
  'refund.issue': { owner: A, area: A, manager: A, cashier: P },
  'invoice.issue': { owner: A, area: A, manager: A, cashier: A },
  'invoice.void': { owner: A, area: A, manager: A, cashier: P },
  'shift.manage': { owner: A, area: A, finance: R, manager: A, cashier: A },
  'cash.payIn': { owner: A, area: A, manager: A, cashier: A },
  'cash.payOut': { owner: A, area: A, manager: A, cashier: P },
  'timeclock.self': { owner: A, area: A, manager: A, cashier: A, waiter: A, kitchen: A, host: A },
  'menu.branch.availability': { owner: A, area: A, manager: A },
  'menu.branch.select': { owner: A, area: A, manager: A },
  'menu.branch.price': { owner: A, area: A },
  'inventory.view': { owner: A, area: A, finance: R, manager: A, kitchen: R },
  'stock.count': { owner: A, area: A, manager: A, kitchen: A },
  'stock.adjust': { owner: A, area: A, manager: A },
  'purchasing.manage': { owner: A, area: A, manager: A },
  'purchasing.receive': { owner: A, area: A, manager: A, kitchen: A },
  'reports.branch': { owner: A, area: A, finance: R, manager: A },
  'expenses.create': { owner: A, area: A, finance: A, manager: A },
  'settings.branch': { owner: A, area: A, manager: A },
  'settings.tax': { owner: A, area: A },
  'devices.manage': { owner: A, area: A, manager: A },
  'staff.branch': { owner: A, area: A, manager: A },
  'customers.view': { owner: A, area: A, manager: A, cashier: R, waiter: R, host: R },
  'customers.export': { owner: A, area: A },
  'customers.delete': { owner: A, area: A },
  'feedback.view': { owner: A, area: A, finance: R, manager: A },
  'audit.view': { owner: A, area: A, finance: R, manager: A },
} satisfies Record<string, Row>

/** Permissions checked at group level (no branch). */
const GROUP_MATRIX = {
  'hq.open': { owner: A, area: A, finance: A, menuEditor: A },
  'hq.reports': { owner: A, area: A, finance: A },
  'fx.manage': { owner: A, finance: A },
  'menu.master.edit': { owner: A, menuEditor: A },
  'content.edit': { owner: A, menuEditor: A },
  'promotions.group': { owner: A },
  'branch.create': { owner: A },
  'staff.group': { owner: A },
} satisfies Record<string, Row>

export type BranchPermission = keyof typeof BRANCH_MATRIX
export type GroupPermission = keyof typeof GROUP_MATRIX
export type Permission = BranchPermission | GroupPermission

export const BRANCH_PERMISSIONS = Object.keys(BRANCH_MATRIX) as BranchPermission[]
export const GROUP_PERMISSIONS = Object.keys(GROUP_MATRIX) as GroupPermission[]

export function isGroupPermission(permission: Permission): permission is GroupPermission {
  return Object.hasOwn(GROUP_MATRIX, permission)
}

/** What the permission checks need to know about a user. */
export interface UserAccess {
  id: string
  active: boolean
  branchRoles: Readonly<Record<string, BranchRole>>
  groupRole: GroupRole | null
  /** Branches an area manager looks after. */
  areaBranches: readonly string[]
}

/** Branch settings that change the matrix. */
export interface PermissionSettings {
  managersCanChangePrice: boolean
  waitersTakePayment: boolean
}

/** The roles a user holds inside one branch: their branch role plus any group role that reaches it. */
export function rolesIn(user: UserAccess, branchId: string): Role[] {
  if (!user.active) return []
  const roles: Role[] = []
  const branchRole = user.branchRoles[branchId]
  if (branchRole) roles.push(branchRole)
  if (user.groupRole === 'owner' || user.groupRole === 'finance') roles.push(user.groupRole)
  if (user.groupRole === 'area' && user.areaBranches.includes(branchId)) roles.push('area')
  return roles
}

const RANK: Record<Grant | 'deny', number> = { deny: 0, read: 1, approval: 2, allow: 3 }

function bestGrant(row: Row, roles: readonly Role[]): Grant | 'deny' {
  let best: Grant | 'deny' = 'deny'
  for (const role of roles) {
    const grant = row[role]
    if (grant && RANK[grant] > RANK[best]) best = grant
  }
  return best
}

function rowFor(permission: BranchPermission, settings?: PermissionSettings): Row {
  const row: Row = { ...BRANCH_MATRIX[permission] }
  if (permission === 'menu.branch.price' && settings?.managersCanChangePrice) row.manager = 'approval'
  if (permission === 'payment.take' && settings?.waitersTakePayment) row.waiter = 'allow'
  return row
}

/** The strongest grant a user has for a permission (in a branch, or at group level). */
export function grantFor(
  user: UserAccess,
  permission: Permission,
  branchId: string | null,
  settings?: PermissionSettings,
): Grant | 'deny' {
  if (!user.active) return 'deny'
  if (isGroupPermission(permission)) {
    return user.groupRole ? bestGrant(GROUP_MATRIX[permission], [user.groupRole]) : 'deny'
  }
  if (!branchId) return 'deny'
  return bestGrant(rowFor(permission, settings), rolesIn(user, branchId))
}

/** Can the user perform the action? `read` grants don't count. */
export function can(user: UserAccess, permission: Permission, branchId: string | null, settings?: PermissionSettings): Decision {
  const grant = grantFor(user, permission, branchId, settings)
  return grant === 'allow' || grant === 'approval' ? grant : 'deny'
}

/** Can the user see it? Any grant, including `read`, counts. */
export function canRead(user: UserAccess, permission: Permission, branchId: string | null, settings?: PermissionSettings): boolean {
  return grantFor(user, permission, branchId, settings) !== 'deny'
}

/** Whether the user may work in a branch at all. */
export const hasBranchAccess = (user: UserAccess, branchId: string): boolean => rolesIn(user, branchId).length > 0

/** The branches a user can enter, in the order given. */
export function accessibleBranches(user: UserAccess, branchIds: readonly string[]): string[] {
  return branchIds.filter((id) => hasBranchAccess(user, id))
}

/** True when the user reaches this branch only through a group role (logged as cross-branch access). */
export function isCrossBranchAccess(user: UserAccess, branchId: string): boolean {
  return !user.branchRoles[branchId] && hasBranchAccess(user, branchId)
}

/** Every branch permission's grant for one user in one branch, for the UI. */
export function branchGrants(user: UserAccess, branchId: string, settings?: PermissionSettings): Record<BranchPermission, Grant | 'deny'> {
  return Object.fromEntries(BRANCH_PERMISSIONS.map((p) => [p, grantFor(user, p, branchId, settings)])) as Record<BranchPermission, Grant | 'deny'>
}

export function groupGrants(user: UserAccess): Record<GroupPermission, Grant | 'deny'> {
  return Object.fromEntries(GROUP_PERMISSIONS.map((p) => [p, grantFor(user, p, null)])) as Record<GroupPermission, Grant | 'deny'>
}

/** The role used for Firestore custom claims and UI labels in a branch (strongest first). */
export function primaryRoleIn(user: UserAccess, branchId: string): Role | null {
  const roles = rolesIn(user, branchId)
  const order: Role[] = ['owner', 'area', 'manager', 'finance', 'cashier', 'host', 'waiter', 'kitchen', 'menuEditor']
  return order.find((role) => roles.includes(role)) ?? null
}
