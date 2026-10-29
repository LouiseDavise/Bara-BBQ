// Firestore security rules against the emulator: npm run test:rules
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bara-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    for (const branch of ['jkt', 'sin', 'dps']) {
      await setDoc(doc(db, `branches/${branch}`), { code: branch.toUpperCase() })
      await setDoc(doc(db, `branches/${branch}/orders/o1`), { status: 'open', total: { amount: 100, currency: 'IDR' } })
      await setDoc(doc(db, `branches/${branch}/kdsTickets/t1`), { status: 'open' })
      await setDoc(doc(db, `branches/${branch}/payments/p1`), { amount: { amount: 100, currency: 'IDR' } })
      await setDoc(doc(db, `branches/${branch}/menuItems/m1`), { soldOut: false })
    }
    await setDoc(doc(db, 'customers/c1'), { name: 'Guest' })
    await setDoc(doc(db, 'staff/s1'), { name: 'Staff' })
    await setDoc(doc(db, 'auditLog/a1'), { action: 'line.void' })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

const as = (uid: string, claims: Record<string, unknown>) => env.authenticatedContext(uid, claims).firestore()

describe('a Jakarta cashier', () => {
  const db = () => as('jkt-cashier', { br: { jkt: 'cashier' }, g: null })

  it('reads Jakarta bills', async () => {
    await assertSucceeds(getDoc(doc(db(), 'branches/jkt/orders/o1')))
    await assertSucceeds(getDocs(collection(db(), 'branches/jkt/orders')))
  })

  it('cannot read Singapore data', async () => {
    await assertFails(getDoc(doc(db(), 'branches/sin/orders/o1')))
    await assertFails(getDocs(collection(db(), 'branches/sin/orders')))
    await assertFails(getDoc(doc(db(), 'branches/sin/menuItems/m1')))
    await assertFails(getDoc(doc(db(), 'branches/sin')))
  })

  it('cannot read what the role doesn’t need, even in Jakarta', async () => {
    await assertFails(getDoc(doc(db(), 'branches/jkt/kdsTickets/t1')))
    await assertFails(getDoc(doc(db(), 'branches/jkt/payments/p1')))
  })

  it('cannot write anything', async () => {
    await assertFails(setDoc(doc(db(), 'branches/jkt/orders/o2'), { status: 'open' }))
    await assertFails(setDoc(doc(db(), 'branches/jkt/orders/o1'), { status: 'closed' }))
  })
})

describe('kitchen staff', () => {
  const db = () => as('jkt-kitchen', { br: { jkt: 'kitchen' }, g: null })

  it('read tickets and sold-out status, not bills', async () => {
    await assertSucceeds(getDocs(collection(db(), 'branches/jkt/kdsTickets')))
    await assertSucceeds(getDoc(doc(db(), 'branches/jkt/menuItems/m1')))
    await assertFails(getDoc(doc(db(), 'branches/jkt/orders/o1')))
  })
})

describe('group roles', () => {
  it('lets the owner read every branch', async () => {
    const db = as('owner', { br: {}, g: 'owner' })
    await assertSucceeds(getDoc(doc(db, 'branches/sin/orders/o1')))
    await assertSucceeds(getDoc(doc(db, 'branches/jkt/kdsTickets/t1')))
  })

  it('limits an area manager to their branches', async () => {
    const db = as('area', { br: { jkt: 'manager', dps: 'manager' }, g: 'area' })
    await assertSucceeds(getDoc(doc(db, 'branches/dps/orders/o1')))
    await assertFails(getDoc(doc(db, 'branches/sin/orders/o1')))
  })

  it('gives HQ Finance no realtime access (reports come from the API)', async () => {
    const db = as('finance', { br: {}, g: 'finance' })
    await assertFails(getDoc(doc(db, 'branches/jkt/orders/o1')))
  })
})

describe('everyone else', () => {
  it('guests and signed-out visitors read nothing', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'branches/jkt/menuItems/m1')))
    await assertFails(getDoc(doc(db, 'branches/jkt/orders/o1')))
  })

  it('nobody reads group data from the client', async () => {
    const db = as('owner', { br: {}, g: 'owner' })
    await assertFails(getDoc(doc(db, 'customers/c1')))
    await assertFails(getDoc(doc(db, 'staff/s1')))
    await assertFails(getDoc(doc(db, 'auditLog/a1')))
  })

  it('a token without claims gets nothing', async () => {
    const db = as('stranger', {})
    await assertFails(getDoc(doc(db, 'branches/jkt/orders/o1')))
  })
})
