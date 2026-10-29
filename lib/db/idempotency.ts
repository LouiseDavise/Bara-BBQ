// Idempotency keys for create-order, add-items, fire, payment, refund and invoice requests.
// The stored response is written in the same transaction as the business change, so a retry
// either finds the finished result or runs the change for the first time; never twice.
import { createHash } from 'node:crypto'
import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import { unprocessable } from '../http/errors.js'
import { firestore } from './admin.js'
import { groupCol } from './paths.js'

export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,64}$/
const KEEP_DAYS = 7

/** JSON with sorted keys, so the same body always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

export function idempotencyDocId(scope: string, key: string): string {
  return sha256(`${scope}|${key}`).slice(0, 40)
}

export interface StoredResponse<T> {
  status: number
  body: T
}

/**
 * Runs `work` once per (scope, key). `scope` is the branch and route, e.g. "jkt:POST /orders".
 * The same key with a different body is refused with 422.
 */
export async function idempotent<T>(
  scope: string,
  key: string,
  requestBody: unknown,
  work: (tx: Transaction) => Promise<StoredResponse<T>>,
): Promise<StoredResponse<T> & { replayed: boolean }> {
  const ref = groupCol('idempotencyKeys').doc(idempotencyDocId(scope, key))
  const requestHash = sha256(canonicalJson(requestBody))
  return firestore().runTransaction(async (tx) => {
    const existing = await tx.get(ref)
    if (existing.exists) {
      if (existing.get('requestHash') !== requestHash) {
        throw unprocessable('This idempotency key was already used for a different request.', 'idempotency_mismatch')
      }
      return { status: existing.get('status') as number, body: existing.get('body') as T, replayed: true }
    }
    const result = await work(tx)
    tx.set(ref, {
      scope,
      requestHash,
      status: result.status,
      body: result.body,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + KEEP_DAYS * 86_400_000),
    })
    return { ...result, replayed: false }
  })
}
