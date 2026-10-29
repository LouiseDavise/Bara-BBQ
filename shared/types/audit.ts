// auditLog/{id}: append-only record of sensitive actions.
import type { Origin, TimestampLike } from './common.js'

export type AuditAction =
  | 'auth.login'
  | 'auth.loginFailed'
  | 'auth.pin'
  | 'branch.access'
  | 'device.register'
  | 'device.revoke'
  | 'line.void'
  | 'bill.discount'
  | 'bill.comp'
  | 'bill.reopen'
  | 'refund.issue'
  | 'payment.take'
  | 'invoice.issue'
  | 'invoice.void'
  | 'invoice.allowance'
  | 'price.change'
  | 'stock.adjust'
  | 'stock.waste'
  | 'stock.count'
  | 'cash.payOut'
  | 'settings.change'
  | 'staff.change'
  | 'staff.pinReset'
  | 'customer.export'
  | 'customer.delete'
  | 'demo.blocked'

export interface AuditActor {
  staffId: string
  name: string
  role: string | null
}

export interface AuditEntry {
  id: string
  at: TimestampLike
  branchId: string | null
  actor: AuditActor
  approver: AuditActor | null
  action: AuditAction
  target: { type: string; id: string } | null
  before: unknown
  after: unknown
  reason: string | null
  deviceId: string | null
  /** Truncated sha256 of the IP, so repeated abuse is visible without storing addresses. */
  ipHash: string | null
  origin: Origin
}
