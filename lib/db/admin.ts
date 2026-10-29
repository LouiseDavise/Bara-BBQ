// firebase-admin, initialised lazily so importing a module never opens a connection.
// With USE_FIREBASE_EMULATORS=true (local dev, tests, seed) it talks to the emulators and
// needs no cloud account; the "demo-" project ID keeps the emulators fully offline.
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getStorage, type Storage } from 'firebase-admin/storage'

export const DEMO_PROJECT_ID = 'demo-bara'

export function usingEmulators(): boolean {
  return process.env.USE_FIREBASE_EMULATORS === 'true' || Boolean(process.env.FIRESTORE_EMULATOR_HOST)
}

export function projectId(): string {
  return process.env.FIREBASE_PROJECT_ID || DEMO_PROJECT_ID
}

function app(): App {
  const existing = getApps()[0]
  if (existing) return existing
  const id = projectId()
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${id}.appspot.com`
  if (usingEmulators()) {
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199'
    process.env.STORAGE_EMULATOR_HOST ||= `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
    return initializeApp({ projectId: id, storageBucket })
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!clientEmail || !privateKey) {
    throw new Error('Firebase credentials are missing. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or USE_FIREBASE_EMULATORS=true.')
  }
  return initializeApp({ credential: cert({ projectId: id, clientEmail, privateKey }), projectId: id, storageBucket })
}

let db: Firestore | null = null

export function firestore(): Firestore {
  if (!db) {
    db = getFirestore(app())
    db.settings({ ignoreUndefinedProperties: true })
  }
  return db
}

export const adminAuth = (): Auth => getAuth(app())
export const adminStorage = (): Storage => getStorage(app())
