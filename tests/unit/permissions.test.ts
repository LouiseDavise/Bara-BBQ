import { describe, expect, it } from 'vitest'
import {
  accessibleBranches,
  BRANCH_PERMISSIONS,
  can,
  canRead,
  grantFor,
  hasBranchAccess,
  isCrossBranchAccess,
  primaryRoleIn,
  type UserAccess,
} from '../../shared/permissions.js'

const user = (overrides: Partial<UserAccess>): UserAccess => ({
  id: 'u',
  active: true,
  branchRoles: {},
  groupRole: null,
  areaBranches: [],
  ...overrides,
})

const jktCashier = user({ id: 'jkt-cashier', branchRoles: { jkt: 'cashier' } })
const owner = user({ id: 'owner', groupRole: 'owner' })
const areaIndonesia = user({ id: 'area', groupRole: 'area', areaBranches: ['jkt', 'dps'] })
const finance = user({ id: 'finance', groupRole: 'finance' })
const menuEditor = user({ id: 'menu', groupRole: 'menuEditor' })
const branches = ['tpe', 'jkt', 'dps', 'kul', 'sin']

describe('branch scoping', () => {
  it('keeps a Jakarta cashier inside Jakarta', () => {
    expect(can(jktCashier, 'payment.take', 'jkt')).toBe('allow')
    expect(can(jktCashier, 'payment.take', 'sin')).toBe('deny')
    expect(canRead(jktCashier, 'bill.view', 'sin')).toBe(false)
    expect(accessibleBranches(jktCashier, branches)).toEqual(['jkt'])
  })

  it('gives area managers manager rights in their branches only', () => {
    expect(can(areaIndonesia, 'line.void', 'dps')).toBe('allow')
    expect(can(areaIndonesia, 'menu.branch.price', 'jkt')).toBe('allow')
    expect(can(areaIndonesia, 'line.void', 'sin')).toBe('deny')
    expect(accessibleBranches(areaIndonesia, branches)).toEqual(['jkt', 'dps'])
    expect(isCrossBranchAccess(areaIndonesia, 'jkt')).toBe(true)
  })

  it('lets the owner into every branch', () => {
    expect(accessibleBranches(owner, branches)).toEqual(branches)
    expect(BRANCH_PERMISSIONS.every((p) => can(owner, p, 'kul') === 'allow')).toBe(true)
  })

  it('gives HQ Finance read-only finance everywhere and expenses entry', () => {
    expect(canRead(finance, 'reports.branch', 'tpe')).toBe(true)
    expect(can(finance, 'reports.branch', 'tpe')).toBe('deny')
    expect(can(finance, 'expenses.create', 'sin')).toBe('allow')
    expect(can(finance, 'payment.take', 'sin')).toBe('deny')
  })

  it('keeps the menu editor out of branch operations', () => {
    expect(hasBranchAccess(menuEditor, 'tpe')).toBe(false)
    expect(can(menuEditor, 'menu.master.edit', null)).toBe('allow')
    expect(can(menuEditor, 'hq.reports', null)).toBe('deny')
  })
})

describe('manager PIN approvals', () => {
  it('asks for a manager PIN when a cashier voids a fired item or pays out cash', () => {
    expect(can(jktCashier, 'line.void', 'jkt')).toBe('approval')
    expect(can(jktCashier, 'cash.payOut', 'jkt')).toBe('approval')
    expect(can(jktCashier, 'refund.issue', 'jkt')).toBe('approval')
    expect(can(jktCashier, 'bill.discountOverLimit', 'jkt')).toBe('approval')
    expect(can(jktCashier, 'bill.discount', 'jkt')).toBe('allow')
  })

  it('treats read grants as no for actions', () => {
    expect(grantFor(jktCashier, 'reservation.manage', 'jkt')).toBe('read')
    expect(can(jktCashier, 'reservation.manage', 'jkt')).toBe('deny')
    expect(canRead(jktCashier, 'reservation.manage', 'jkt')).toBe(true)
  })
})

describe('branch settings that change the matrix', () => {
  const manager = user({ branchRoles: { kul: 'manager' } })
  const waiter = user({ branchRoles: { kul: 'waiter' } })

  it('keeps price changes away from branch managers by default', () => {
    expect(can(manager, 'menu.branch.price', 'kul')).toBe('deny')
    expect(can(manager, 'menu.branch.price', 'kul', { managersCanChangePrice: true, waitersTakePayment: false })).toBe('approval')
  })

  it('lets waiters take payment only when the branch allows it', () => {
    expect(can(waiter, 'payment.take', 'kul')).toBe('deny')
    expect(can(waiter, 'payment.take', 'kul', { managersCanChangePrice: false, waitersTakePayment: true })).toBe('allow')
  })
})

describe('group permissions', () => {
  it('opens HQ to group roles only', () => {
    expect(can(owner, 'hq.open', null)).toBe('allow')
    expect(can(areaIndonesia, 'hq.reports', null)).toBe('allow')
    expect(can(areaIndonesia, 'fx.manage', null)).toBe('deny')
    expect(can(finance, 'fx.manage', null)).toBe('allow')
    expect(can(user({ branchRoles: { jkt: 'manager' } }), 'hq.open', null)).toBe('deny')
  })
})

describe('roles', () => {
  it('denies everything to deactivated staff', () => {
    expect(can(user({ active: false, branchRoles: { jkt: 'manager' } }), 'floor.view', 'jkt')).toBe('deny')
    expect(can(user({ active: false, groupRole: 'owner' }), 'hq.open', null)).toBe('deny')
  })

  it('supports a different role in each branch', () => {
    const relief = user({ branchRoles: { dps: 'kitchen', jkt: 'waiter' } })
    expect(can(relief, 'kds.use', 'dps')).toBe('allow')
    expect(can(relief, 'order.take', 'jkt')).toBe('allow')
    expect(can(relief, 'order.take', 'dps')).toBe('deny')
    expect(primaryRoleIn(relief, 'jkt')).toBe('waiter')
    expect(primaryRoleIn(owner, 'jkt')).toBe('owner')
  })
})
