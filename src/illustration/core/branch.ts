// ---------------------------------------------------------------------------
// branch — a tree is an axis that opens up.
//
// The crown is not drawn as a mass: it is drawn as a skeleton of branches that
// fork and end in clusters of leaves. The silhouette appears on its own, by
// occlusion, and that is why it reads as a tree and not as a lollipop.
//
// Width is conserved when forking (r_child ≈ r_parent / √children): the trunk is
// thick because it holds up everything above, not because it is a rectangle.
// ---------------------------------------------------------------------------

import {
  add,
  mul,
  normalize,
  num,
  perp,
  sampleCubic,
  type Pt,
} from './math'
import type { Noise1D } from './noise'
import { simplifyPolyline } from './leafDraw'
import { wobble } from './path'
import type { Rng } from './prng'

export interface Branch {
  /** sampled axis of the branch, from base to tip */
  spine: Pt[]
  from: Pt
  to: Pt
  /** absolute angle, in radians (-π/2 is vertical, pointing up) */
  angle: number
  width0: number
  width1: number
  depth: number
  children: Branch[]
  /** true if it is a tip: that is where a cluster of leaves goes */
  terminal: boolean
}

export interface GrowOptions {
  from: Pt
  /** absolute starting angle; -π/2 is vertical */
  angle: number
  length: number
  width: number
  depth: number
  /** lateral belly of the branch, relative to its length (0 = straight) */
  bend: number
  /** opening of the children relative to the mother, in radians */
  spread: [number, number]
  /** how many children per fork */
  children: [number, number]
  /** length of the child relative to the mother */
  lengthFalloff: [number, number]
  /** width of the child relative to the mother */
  widthFalloff: number
  /** how much each level straightens toward the vertical (0..1) */
  upward: number
  segments?: number
  wobble?: number
  /** shared belly: all branches lean a little to the same side */
  wind?: number
  /** asymmetry: branches on one side grow longer */
  bias?: number
  /** opening of the first fork, if it differs from the rest (double crown) */
  rootSpread?: [number, number]
  /** how many children in the first fork, if it differs from the rest */
  rootChildren?: [number, number]
  /** level of the branch; set by the recursion */
  level?: number
}

/** Straightens an angle toward the vertical without losing the side. */
function upright(angle: number, amount: number): number {
  const up = -Math.PI / 2
  return angle + (up - angle) * amount
}

export function growTree(o: GrowOptions, rng: Rng, noise: Noise1D): Branch {
  const segments = o.segments ?? 22
  const dir: Pt = { x: Math.cos(o.angle), y: Math.sin(o.angle) }
  const nrm = perp(dir)
  const to = add(o.from, mul(dir, o.length))

  const bend = o.bend * o.length
  const c1 = add(add(o.from, mul(dir, o.length * 0.3)), mul(nrm, bend))
  const c2 = add(add(to, mul(dir, -o.length * 0.3)), mul(nrm, bend * 0.45))

  let spine = sampleCubic(o.from, c1, c2, to, segments)
  if (o.wobble) spine = wobble(spine, o.wobble, noise, 0.36, rng.range(0, 12))

  const width1 = o.width * o.widthFalloff
  const children: Branch[] = []

  if (o.depth > 0) {
    const first = (o.level ?? 0) === 0
    const kids = first && o.rootChildren ? o.rootChildren : o.children
    const open0 = first && o.rootSpread ? o.rootSpread : o.spread
    const count = rng.int(kids[0], kids[1])
    const spread = rng.range(open0[0], open0[1])
    for (let i = 0; i < count; i++) {
      // Without a guide: the children open in a fan. If one goes straight, the tree
      // grows like a mast and the crown stays narrow.
      const t = count === 1 ? rng.range(-0.5, 0.5) : i / (count - 1) - 0.5
      const open = t * 2 * spread + rng.range(-0.06, 0.06)
      const childAngle = upright(o.angle + open, o.upward)
      const childLen =
        o.length * rng.range(o.lengthFalloff[0], o.lengthFalloff[1]) * (1 + (o.bias ?? 0) * t * 2)

      // two branches never leave from the exact same point
      const birth = 0.82 + 0.18 * (count === 1 ? 1 : i / (count - 1))
      const idx = Math.round(birth * segments)
      const origin = spine[Math.min(idx, spine.length - 1)]

      children.push(
        growTree(
          {
            ...o,
            from: origin,
            angle: childAngle,
            length: childLen,
            width: width1,
            depth: o.depth - 1,
            level: (o.level ?? 0) + 1,
            bend: (o.bend + (o.wind ?? 0)) * rng.range(0.55, 1.15) + Math.sign(t) * rng.range(0.02, 0.08),
          },
          rng,
          noise,
        ),
      )
    }
  }

  return {
    spine,
    from: o.from,
    to,
    angle: o.angle,
    width0: o.width,
    width1,
    depth: o.depth,
    children,
    terminal: o.depth === 0,
  }
}

/** Walks the tree depth-first. */
export function eachBranch(root: Branch, visit: (b: Branch) => void): void {
  visit(root)
  for (const child of root.children) eachBranch(child, visit)
}

/**
 * Pen stroke of a branch: filled polygon, thinner at the tip and with a
 * root flare where it springs from its mother.
 */
export function branchStroke(
  points: Pt[],
  w0: number,
  w1: number,
  noise: Noise1D,
  phase: number,
  flare = 0.16,
  /** edge simplification, in px (0 = no simplification) */
  tolerance = 0,
): string {
  if (points.length < 2) return ''
  const normals = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(points.length - 1, i + 1)]
    const t = normalize({ x: b.x - a.x, y: b.y - a.y })
    return perp(t)
  })
  const last = points.length - 1
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= last; i++) {
    const t = i / last
    const body = w0 + (w1 - w0) * Math.pow(t, 1.25)
    const hand = 1 + 0.07 * noise(t * 5.2 + phase)
    const root = 1 + flare * Math.pow(1 - t, 3)
    const half = Math.max(0.18, (body * hand * root) / 2)
    left.push(add(points[i], mul(normals[i], half)))
    right.push(add(points[i], mul(normals[i], -half)))
  }
  const l = simplifyPolyline(left, tolerance)
  const r = simplifyPolyline(right, tolerance)
  let d = `M${num(l[0].x)} ${num(l[0].y)}`
  for (let i = 1; i < l.length; i++) d += `L${num(l[i].x)} ${num(l[i].y)}`
  for (let i = r.length - 1; i >= 0; i--) d += `L${num(r[i].x)} ${num(r[i].y)}`
  return `${d}Z`
}
