// Public pages are prerendered at build time, so menu and branch changes reach Google's copy
// (and the JSON-LD) on the next deploy. Writes that change public content call
// markPublicContentChanged(); the nightly job calls the Vercel Deploy Hook if anything changed.
import { Timestamp } from 'firebase-admin/firestore'
import { groupCol } from '../db/paths.js'
import { deployHookUrl } from '../env.js'

const siteMeta = () => groupCol('meta').doc('site')

export async function markPublicContentChanged(now = new Date()): Promise<void> {
  await siteMeta().set({ changedAt: Timestamp.fromDate(now) }, { merge: true })
}

export type DeployHookResult = 'called' | 'unchanged' | 'notConfigured' | 'failed'

export async function triggerDeployHookIfChanged(now = new Date()): Promise<DeployHookResult> {
  const url = deployHookUrl()
  if (!url) return 'notConfigured'
  const snapshot = await siteMeta().get()
  const changedAt = snapshot.get('changedAt') as Timestamp | undefined
  const hookAt = snapshot.get('deployHookAt') as Timestamp | undefined
  if (!changedAt || (hookAt && hookAt.toMillis() >= changedAt.toMillis())) return 'unchanged'
  try {
    const response = await fetch(url, { method: 'POST' })
    if (!response.ok) return 'failed'
  } catch {
    return 'failed'
  }
  await siteMeta().set({ deployHookAt: Timestamp.fromDate(now) }, { merge: true })
  return 'called'
}
