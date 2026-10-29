// Deterministic randomness for the seed: the same branch and date always produce the same day,
// so the nightly reset can regenerate or extend history without drifting. (Floats here only
// drive choices like "how many guests"; no money is ever computed with them.)

/** FNV-1a 32-bit hash of a string. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export class Rng {
  private state: number

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
  }

  /** Mulberry32: uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  pick<T>(items: readonly T[]): T {
    if (!items.length) throw new RangeError('pick() from an empty list.')
    return items[Math.floor(this.next() * items.length)]!
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((acc, [, weight]) => acc + weight, 0)
    let roll = this.next() * total
    for (const [value, weight] of entries) {
      roll -= weight
      if (roll < 0) return value
    }
    return entries[entries.length - 1]![0]
  }

  /** Poisson-distributed count (Knuth), fine for the small rates used here. */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0
    const limit = Math.exp(-lambda)
    let k = 0
    let p = 1
    do {
      k += 1
      p *= this.next()
    } while (p > limit)
    return k - 1
  }

  /** A string of `length` characters from `alphabet`. */
  chars(alphabet: string, length: number): string {
    let out = ''
    for (let i = 0; i < length; i++) out += alphabet[Math.floor(this.next() * alphabet.length)]
    return out
  }
}
