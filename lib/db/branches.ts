// Branch documents are read on almost every request, so each instance caches them briefly.
import type { BranchDoc } from '../../shared/types/branch.js'
import { groupCol, isBranchId } from './paths.js'

const TTL_MS = 15_000
const cache = new Map<string, { at: number; branch: BranchDoc | null }>()
let listCache: { at: number; branches: BranchDoc[] } | null = null

export async function loadBranch(branchId: string): Promise<BranchDoc | null> {
  if (!isBranchId(branchId)) return null
  const hit = cache.get(branchId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.branch
  const snapshot = await groupCol<BranchDoc>('branches').doc(branchId).get()
  const branch = snapshot.exists ? (snapshot.data() as BranchDoc) : null
  cache.set(branchId, { at: Date.now(), branch })
  return branch
}

/** Every branch, in display order. */
export async function loadBranches(): Promise<BranchDoc[]> {
  if (listCache && Date.now() - listCache.at < TTL_MS) return listCache.branches
  const snapshot = await groupCol<BranchDoc>('branches').orderBy('sort').get()
  const branches = snapshot.docs.map((doc) => doc.data())
  listCache = { at: Date.now(), branches }
  return branches
}

export function forgetBranches(): void {
  cache.clear()
  listCache = null
}
