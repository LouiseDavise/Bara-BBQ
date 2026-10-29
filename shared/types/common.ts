// Shapes shared by every Firestore document type.
import type { LocalizedText } from '../localized.js'

/**
 * A Firestore Timestamp as both SDKs return it (firebase-admin on the server, the client SDK in
 * staff screens). Pure logic takes Date or epoch ms instead.
 */
export interface TimestampLike {
  readonly seconds: number
  readonly nanoseconds: number
  toMillis(): number
  toDate(): Date
}

/**
 * Who created a document. The nightly demo reset deletes `app` documents (made by visitors)
 * and regenerates `seed` ones.
 */
export type Origin = 'seed' | 'app'

export interface ImageRef {
  src: string
  alt: LocalizedText
  /** Photographer credit, listed in CREDITS.md. */
  credit?: string
  width?: number
  height?: number
}
