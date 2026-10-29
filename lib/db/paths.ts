// Typed references to every collection. Branch data is only reachable through branchDb(),
// which builds paths under branches/{branchId} from a validated ID, so no handler ever puts
// raw request input into a Firestore path.
import type { CollectionReference, DocumentData, DocumentReference } from 'firebase-admin/firestore'
import { firestore } from './admin.js'

export const GROUP_COLLECTIONS = [
  'brand',
  'branches',
  'staff',
  'devices',
  'masterCategories',
  'masterItems',
  'modifierGroups',
  'allergens',
  'ingredients',
  'customers',
  'customerKeys',
  'fxRates',
  'groupPromotions',
  'auditLog',
  'rateLimits',
  'idempotencyKeys',
  'jobRuns',
  'meta',
] as const
export type GroupCollection = (typeof GROUP_COLLECTIONS)[number]

export const BRANCH_COLLECTIONS = [
  'areas',
  'tables',
  'tableSessions',
  'calls',
  'menuItems',
  'recipeOverrides',
  'stock',
  'stockMovements',
  'suppliers',
  'purchaseOrders',
  'stockCounts',
  'orders',
  'kdsTickets',
  'payments',
  'invoices',
  'refunds',
  'shifts',
  'cashMovements',
  'reservations',
  'waitlist',
  'enquiries',
  'expenses',
  'timeEntries',
  'feedback',
  'counters',
  'dailySummaries',
] as const
export type BranchCollection = (typeof BRANCH_COLLECTIONS)[number]

const BRANCH_ID = /^[a-z][a-z0-9]{1,7}$/
const DOC_ID = /^[A-Za-z0-9_.~-]{1,128}$/

export const isBranchId = (value: unknown): value is string => typeof value === 'string' && BRANCH_ID.test(value)
export const isDocId = (value: unknown): value is string => typeof value === 'string' && DOC_ID.test(value) && value !== '.' && value !== '..'

export function groupCol<T extends DocumentData = DocumentData>(name: GroupCollection): CollectionReference<T> {
  return firestore().collection(name) as CollectionReference<T>
}

export function branchDb(branchId: string) {
  if (!isBranchId(branchId)) throw new RangeError(`Bad branch ID "${branchId}".`)
  const base = `branches/${branchId}`
  return {
    id: branchId,
    ref: firestore().doc(base) as DocumentReference<DocumentData>,
    col<T extends DocumentData = DocumentData>(name: BranchCollection): CollectionReference<T> {
      return firestore().collection(`${base}/${name}`) as CollectionReference<T>
    },
  }
}

export type BranchDb = ReturnType<typeof branchDb>
