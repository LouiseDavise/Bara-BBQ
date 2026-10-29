// branches/{branchId}/areas and /tables: the floor plan.
import type { LocalizedText } from '../localized.js'
import type { Origin, TimestampLike } from './common.js'

export interface AreaDoc {
  id: string
  name: LocalizedText
  kind: 'indoor' | 'terrace' | 'garden' | 'counter' | 'private' | 'bar'
  sort: number
  origin: Origin
}

export type TableStatus = 'free' | 'seated' | 'ordered' | 'foodOut' | 'billRequested' | 'attention'

export interface TableDoc {
  id: string
  label: string
  areaId: string
  shape: 'round' | 'square' | 'rect' | 'counter' | 'booth'
  seats: { min: number; max: number }
  /** Position on the floor-plan grid, in grid cells. */
  layout: { x: number; y: number; w: number; h: number; rotation: number }
  combinableWith: string[]
  onlineBookable: boolean
  /** Bumped to invalidate printed QR codes. */
  qrVersion: number
  /** Denormalised for the live floor plan. */
  live: { status: TableStatus; sessionId: string | null; since: TimestampLike | null }
  origin: Origin
}
