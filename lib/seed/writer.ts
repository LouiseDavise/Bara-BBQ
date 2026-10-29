// Writing and deleting seed documents in bulk.
import type { DocumentData, Query } from 'firebase-admin/firestore'
import { firestore } from '../db/admin.js'
import { GROUP_COLLECTIONS } from '../db/paths.js'
import type { SeedDoc } from './history.js'

/** Writes documents (full overwrite) with a BulkWriter; returns how many were written. */
export async function writeDocs(docs: readonly SeedDoc[]): Promise<number> {
  if (!docs.length) return 0
  const db = firestore()
  const writer = db.bulkWriter()
  writer.onWriteError((error) => error.failedAttempts < 5)
  for (const { path, data } of docs) void writer.set(db.doc(path), data)
  await writer.close()
  return docs.length
}

/** Deletes every document a query matches, up to `limit`; returns how many it deleted. */
export async function deleteMatching(query: Query<DocumentData>, limit = Infinity): Promise<number> {
  const db = firestore()
  let deleted = 0
  while (deleted < limit) {
    const page = await query.limit(Math.min(400, limit - deleted)).get()
    if (page.empty) break
    const batch = db.batch()
    page.docs.forEach((snapshot) => batch.delete(snapshot.ref))
    await batch.commit()
    deleted += page.size
    if (page.size < 400) break
  }
  return deleted
}

/** Wipes every collection (emulator only; the seed script checks before calling this). */
export async function wipeAll(): Promise<void> {
  const db = firestore()
  for (const name of GROUP_COLLECTIONS) await db.recursiveDelete(db.collection(name))
}
