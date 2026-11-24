// ---------------------------------------------------------------------------
// leaf — leaf geometry.
//
// A leaf is not an ellipse: it is an axis (midrib) with a width profile that
// starts at 0, opens up around 60% and returns to 0 at the tip.
// Everything else (outline, veins, hatching, stripes) derives from that axis.
// ---------------------------------------------------------------------------

import { add, frameAt, mul, normalize, normalsOf, num, sampleCubic, sub, type Pt } from './math'
import { bboxOf, polyline, type BBox } from './path'

export interface LeafGeometry {
  /** central axis */
  spine: Pt[]
  /** closed outline, ready to fill */
  d: string
  /** the same outline as an open sequence, to draw it with the pen */
  outline: Pt[]
  bbox: BBox
  maxWidth: number
  /** asymmetry applied to the blade (one side wider than the other) */
  asym: number
  profile: LeafProfile
}

export function leafSpine(base: Pt, tip: Pt, bend: number, segments = 36): Pt[] {
  const dx = tip.x - base.x
  const dy = tip.y - base.y
  const c1 = { x: base.x + dx * 0.33 - dy * bend * 0.5, y: base.y + dy * 0.33 + dx * bend * 0.5 }
  const c2 = { x: base.x + dx * 0.72 - dy * bend * 0.28, y: base.y + dy * 0.72 + dx * bend * 0.28 }
  return sampleCubic(base, c1, c2, tip, segments)
}

/**
 * Blade profiles. All are the same beta distribution —base^p · tip^q—
 * with different parameters, so hatching and stripes work the same.
 *
 *   oval       broad leaf, short tip          (herbarium)
 *   lanceolate narrow base, long body        (papaver)
 *   cordate    broad base, almost heart-shaped (fruits, ivy)
 *   linear     almost parallel, long tip      (twig, grasses)
 */
export type LeafProfile = 'oval' | 'lanceolate' | 'cordate' | 'linear'

interface ProfileShape {
  a: number
  p: number
  q: number
  peak: number
}

function shape(a: number, p: number, q: number): ProfileShape {
  let peak = 0
  for (let i = 0; i <= 200; i++) {
    const s = i / 200
    peak = Math.max(peak, Math.pow(s + a, p) * Math.pow(1 - s, q))
  }
  return { a, p, q, peak }
}

const PROFILES: Record<LeafProfile, ProfileShape> = {
  oval: shape(0.08, 0.85, 1.15),
  lanceolate: shape(0.02, 0.72, 1),
  cordate: shape(0.3, 1, 1.35),
  linear: shape(0.03, 0.62, 1.5),
}

export function leafWidthAt(t: number, profile: LeafProfile = 'oval'): number {
  const s = Math.min(1, Math.max(0, t))
  const { a, p, q, peak } = PROFILES[profile] ?? PROFILES.oval
  return (Math.pow(s + a, p) * Math.pow(1 - s, q)) / peak
}

export function leafGeometry(
  spine: Pt[],
  maxWidth: number,
  asym = 0,
  profile: LeafProfile = 'oval',
): LeafGeometry {
  const normals = normalsOf(spine)
  const last = spine.length - 1
  const left: Pt[] = []
  const right: Pt[] = []

  for (let i = 0; i <= last; i++) {
    const half = maxWidth * leafWidthAt(i / last, profile)
    // the blade is not symmetric: one side always wins a few points
    left.push(add(spine[i], mul(normals[i], half * (1 + asym))))
    right.push(add(spine[i], mul(normals[i], -half * (1 - asym))))
  }

  // base notch: the blade joins the petiole with a small sinus, not with
  // a straight cut or a point
  const dir = sub(spine[1] ?? spine[0], spine[0])
  const notch = add(spine[0], mul(normalize(dir), maxWidth * 0.1))

  const ring = [...left, ...right.slice().reverse(), notch]
  return {
    spine,
    d: polyline(ring, true),
    outline: ring,
    bbox: bboxOf(ring, 2),
    maxWidth,
    asym,
    profile,
  }
}

/**
 * Lateral veins: they start at the axis and curve toward the tip.
 * With a high `count` they become the herringbone hatching of the herbarium.
 */
export function leafVeins(geometry: LeafGeometry, count: number, sweep = 0.34): string {
  const { spine, maxWidth } = geometry
  const last = spine.length - 1
  let d = ''

  for (let k = 0; k < count; k++) {
    const t = 0.14 + (0.7 * (k + 0.5)) / count
    const i = Math.round(t * last)
    const { p, nrm, tan } = frameAt(spine, i)
    const half = maxWidth * leafWidthAt(t, geometry.profile) * (0.92 + 0.06 * (k % 3))

    for (const side of [-1, 1]) {
      // the end follows the real edge of the blade (which is asymmetric)
      const edge = half * (side === 1 ? 1 + geometry.asym : 1 - geometry.asym)
      const end = add(p, mul(nrm, edge * side * 0.99))
      const ctrl = add(add(p, mul(nrm, half * side * 0.5)), mul(tan, half * sweep))
      d += `M${num(p.x)} ${num(p.y)}Q${num(ctrl.x)} ${num(ctrl.y)} ${num(end.x)} ${num(end.y)}`
    }
  }
  return d
}

/** Longitudinal stripes that converge on the tip, like an ink-only branch. */
export function leafStripes(geometry: LeafGeometry, fractions: number[]): string {
  const { spine, maxWidth } = geometry
  const normals = normalsOf(spine)
  const last = spine.length - 1
  let d = ''

  for (const fraction of fractions) {
    const points: Pt[] = []
    for (let i = 0; i <= last; i++) {
      const t = i / last
      const offset = maxWidth * leafWidthAt(t, geometry.profile) * fraction
      points.push(add(spine[i], mul(normals[i], offset)))
    }
    d += polyline(points)
  }
  return d
}

/** Central axis, from base to tip. */
export function midrib(spine: Pt[]): string {
  return polyline(spine)
}
