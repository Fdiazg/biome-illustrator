// ---------------------------------------------------------------------------
// prng — reproducible randomness.
// The whole composition derives from an integer seed, so an illustration
// can be named, saved and regenerated bit for bit.
// ---------------------------------------------------------------------------

export interface Rng {
  /** [0, 1) */
  next(): number
  range(a: number, b: number): number
  int(a: number, b: number): number
  pick<T>(items: readonly T[]): T
  chance(p: number): boolean
  gauss(mean?: number, sd?: number): number
  weighted<T>(items: readonly T[], weight: (item: T) => number): T
}

export function createRng(seed: number): Rng {
  let a = (seed >>> 0) || 0x9e3779b9

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const range = (lo: number, hi: number) => lo + (hi - lo) * next()
  const int = (lo: number, hi: number) => Math.floor(range(lo, hi + 1))

  const rng: Rng = {
    next,
    range,
    int,
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length) % items.length],
    chance: (p: number) => next() < p,
    gauss(mean = 0, sd = 1) {
      // Box-Muller with clipping: never returns absurd tails that would break the drawing.
      const u = Math.max(1e-6, next())
      const v = next()
      const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      return mean + Math.max(-3, Math.min(3, n)) * sd
    },
    weighted<T>(items: readonly T[], weight: (item: T) => number) {
      const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0)
      if (total <= 0) return items[0]
      let x = next() * total
      for (const item of items) {
        x -= Math.max(0, weight(item))
        if (x <= 0) return item
      }
      return items[items.length - 1]
    },
  }

  // Warm-up: the first outputs of mulberry32 correlate across neighboring seeds
  // (4821, 4822…), and that shows when the user presses "next".
  for (let i = 0; i < 6; i++) next()

  return rng
}

/** Stable seed from a text ("papaver-tremulum"). */
export function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
