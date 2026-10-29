// Append-only audit log. There is no update or delete anywhere in the code, and Firestore
// rules deny all client access. (The nightly demo reset is the one exception: in DEMO_MODE it
// clears entries visitors created.)
import { createHash } from 'node:crypto'
import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import type { AuditAction, AuditActor, AuditEntry } from '../../shared/types/audit.js'
import { groupCol } from './paths.js'

export interface AuditInput {
  branchId: string | null
  actor: AuditActor
  approver?: AuditActor | null
  action: AuditAction
  target?: { type: string; id: string } | null
  before?: unknown
  after?: unknown
  reason?: string | null
  deviceId?: string | null
  ip?: string | null
}

export const hashIp = (ip: string): string => createHash('sha256').update(`bara-audit|${ip}`).digest('hex').slice(0, 16)

export function auditEntry(id: string, input: AuditInput, now: Date): AuditEntry {
  return {
    id,
    at: Timestamp.fromDate(now),
    branchId: input.branchId,
    actor: input.actor,
    approver: input.approver ?? null,
    action: input.action,
    target: input.target ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
    deviceId: input.deviceId ?? null,
    ipHash: input.ip && input.ip !== 'unknown' ? hashIp(input.ip) : null,
    origin: 'app',
  }
}

/** Appends an entry, inside a transaction when the action is part of one. */
export async function appendAudit(input: AuditInput, tx?: Transaction, now = new Date()): Promise<string> {
  const ref = groupCol('auditLog').doc()
  const entry = auditEntry(ref.id, input, now)
  if (tx) tx.create(ref, entry)
  else await ref.create(entry)
  return ref.id
}

/** Appends an entry with a fixed ID once; later calls with the same ID do nothing. */
export async function appendAuditOnce(id: string, input: AuditInput, now = new Date()): Promise<void> {
  try {
    await groupCol('auditLog').doc(id).create(auditEntry(id, input, now))
  } catch (error) {
    if ((error as { code?: number }).code !== 6) throw error // 6 = ALREADY_EXISTS
  }
}
