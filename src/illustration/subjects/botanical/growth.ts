// ---------------------------------------------------------------------------
// botanical/growth — the same plant, younger.
//
// `growth` is not another species: it is how much of the whole plant has already sprouted. The stem
// grows from the base, the nodes appear from bottom to top and the leaves at
// the tip are the smallest. The flower goes through a bud before opening.
//
// Everything is a factor on the whole plant, which is composed the same (same randomness):
// so seed 4821 at 0.3 is the sprout of 4821 at 1, not another plant.
// ---------------------------------------------------------------------------

import { clamp, lerp, smoothstep } from '../../core/math'

export interface GrowthPlan {
  growth: number
  /** normalized height of the stem up to where there are visible nodes */
  reach: number
  /** normalized height the stem reaches (a bit more than reach) */
  top: number
  /** factor of the stem width */
  stem: number
  /** size factor of a leaf according to the height of its node */
  leaf(t: number): number
  /** 0 = flower closed or absent, 0..1 = how far it has opened */
  bloom: number
  /** size factor of the open flower */
  flowerSize: number
  /** 0 = no bud, 0..1 = size of the bud */
  bud: number
}

/** From here on the flower opens. */
export const BLOOM_AT = 0.72
/** From here on there is a bud (if the species has a flower). */
export const BUD_AT = 0.45

/** `null` if the plant is whole: the composer follows its usual path. */
export function growthPlan(growth: number | undefined): GrowthPlan | null {
  if (growth === undefined || !(growth < 1)) return null
  const g = clamp(growth, 0, 1)
  const reach = 0.03 + 0.97 * Math.pow(g, 1.2)
  const top = Math.min(1, reach + 0.07)
  const base = lerp(0.36, 1, g)
  const bloom = g > BLOOM_AT ? smoothstep(BLOOM_AT, 1, g) : 0
  return {
    growth: g,
    reach,
    top,
    stem: lerp(0.55, 1, g),
    leaf: (t) => base * (1 - 0.4 * (1 - g) * smoothstep(0, reach, t)),
    bloom,
    flowerSize: lerp(0.5, 1, bloom),
    bud: g >= BUD_AT && g <= BLOOM_AT ? lerp(0.5, 1, (g - BUD_AT) / (BLOOM_AT - BUD_AT)) : 0,
  }
}
