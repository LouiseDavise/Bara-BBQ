// Gap-free per-branch numbering: the counter is read and bumped inside the same transaction
// that creates the bill, so two cashiers can never get the same number and none is skipped.
// Firestore transactions need every read before any write: call this first.
import { FieldValue, type Transaction } from 'firebase-admin/firestore'
import { branchDb } from './paths.js'

export async function nextSequence(tx: Transaction, branchId: string, series: string): Promise<number> {
  const ref = branchDb(branchId).col('counters').doc(series)
  const snapshot = await tx.get(ref)
  const next = snapshot.exists ? Number(snapshot.get('next')) : 1
  tx.set(ref, { next: next + 1, updatedAt: FieldValue.serverTimestamp() })
  return next
}
