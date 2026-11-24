// ---------------------------------------------------------------------------
// dunes/terrain — crests.
//
// The key is neither the wave nor the slope: it is the humps. A flag has
// straight bands; a hill has a back that rises, flattens and falls again.
// Each band goes through several random heights and is interpolated with smoothstep,
// which is exactly what flattens the back.
//
// Depth: far away there are many low ridges, near there are few and wide. One band
// per plate can be a diagonal field, almost straight: the crossing band.
// ---------------------------------------------------------------------------

import { lerp, type Pt } from '../../core/math'
import type { Noise1D } from '../../core/noise'
import type { Rng } from '../../core/prng'

/** margin on each side: the bands drift and must not show the edge */
export const BLEED = 90

export interface CrestSpec {
  /** mean height in px */
  seat: number
  /** drop from end to end in px (sign = which way it goes down) */
  slope: number
  /** amplitude of the ridges in px */
  amp: number
  /** how many ridges */
  keys: number
  /** flat band (water): no ridges or noise */
  flat?: boolean
}

export interface Crest {
  points: Pt[]
  /** height of the crest at x (interpolated) */
  y(x: number): number
}

export function crest(W: number, spec: CrestSpec, noise: Noise1D, rng: Rng, phase: number): Crest {
  const K = Math.max(2, spec.keys)
  const keys: number[] = []
  for (let k = 0; k < K; k++) {
    const t = k / (K - 1)
    const bump = spec.flat ? 0 : rng.range(-1, 1) * spec.amp
    keys.push(spec.seat + (t - 0.5) * spec.slope + bump)
  }

  const steps = Math.round((W + BLEED * 2) / 11)
  const points: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const s = i / steps
    const pos = s * (K - 1)
    const k = Math.min(K - 2, Math.floor(pos))
    const f = pos - k
    const u = f * f * (3 - 2 * f)
    // fine noise: the edge of a cut paper, not a textbook curve
    const grain = spec.flat ? 0 : noise(s * 9 + phase) * Math.max(1, spec.amp * 0.07)
    points.push({ x: lerp(-BLEED, W + BLEED, s), y: lerp(keys[k], keys[k + 1], u) + grain })
  }

  const x0 = -BLEED
  const span = W + BLEED * 2
  return {
    points,
    y(x: number) {
      const p = ((x - x0) / span) * steps
      const i = Math.max(0, Math.min(steps - 1, Math.floor(p)))
      const f = Math.max(0, Math.min(1, p - i))
      return lerp(points[i].y, points[i + 1].y, f)
    },
  }
}

/** Stretch of crest between two x, for objects that rest on it or strokes that follow it. */
export function slice(c: Crest, xa: number, xb: number, step = 6): Pt[] {
  const out: Pt[] = []
  const n = Math.max(2, Math.round(Math.abs(xb - xa) / step))
  for (let i = 0; i <= n; i++) {
    const x = lerp(xa, xb, i / n)
    out.push({ x, y: c.y(x) })
  }
  return out
}
