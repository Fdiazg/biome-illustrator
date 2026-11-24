// ---------------------------------------------------------------------------
// leafDraw — one leaf, drawn.
//
// It is the same vocabulary as the botanical plate (axis, width profile,
// outline with pulse, cut-out veins, clipped hatching), but isolated from the
// subject so the tree can use leaves without copying half of compose.
//
// Two things the botanical subjects do not need and the tree does:
//   - `underlay`: a leaf with no fill still covers what is behind it. In a
//     crown the leaves overlap; if they are transparent, the hatching of one
//     crosses the other and the crown turns into a tangle.
//   - `tolerance`: outlines are simplified (Douglas-Peucker) after
//     computing the width. A crown has a hundred leaves; every point counts.
// ---------------------------------------------------------------------------

import {
  leafGeometry,
  leafSpine,
  leafStripes,
  leafVeins,
  type LeafProfile,
} from './leaf'
import { colorOf, type LeafFill } from './fill'
import { add, mul, normalsOf, num, type Pt } from './math'
import type { Noise1D } from './noise'
import { bboxOf, hatchPath, polyline, tapered, withOvershoot, wobble } from './path'
import type { Palette } from './palette'
import type { Rng } from './prng'

export interface DrawLeafOptions {
  base: Pt
  tip: Pt
  bend: number
  halfWidth: number
  profile: LeafProfile
  fill: LeafFill
  outline: number
  veins: number
  /** multiplier of the outline tremor */
  roughness: number
  /** pen overshoot when closing the outline, in px */
  overshoot: number
  /** offset between fill and line */
  registration: number
  /** samples of the leaf axis; fewer is lighter and barely noticeable */
  segments?: number
  /** hatching spacing, in px */
  hatchStep?: number
  /** color that covers what is behind in leaves without fill (normally the paper) */
  underlay?: string
  /** color of veins on a colored blade (default: ink) */
  veinColor?: string
  /** multiplier of the width of veins, hatching and midrib */
  weight?: number
  /** outline simplification tolerance, in px (0 = no simplification) */
  tolerance?: number
  /** how much the veins curve toward the tip (default 0.12) */
  veinSweep?: number
}

export interface LeafDrawCtx {
  rng: Rng
  noise: Noise1D
  pal: Palette
  /** registers a clipPath and returns `url(#id)` */
  clip: (d: string) => string
}

// ---------------------------------------------------------------------------
// Simplification. Lives here and not in path.ts because path.ts is shared with
// the botanical plates, which are frozen: touching it would change their files.
// When they are unfrozen, these two functions move up to path.ts.
// ---------------------------------------------------------------------------

/** Iterative Douglas-Peucker: drops points that deviate less than `tol` px. */
export function simplifyPolyline(points: Pt[], tol: number): Pt[] {
  if (tol <= 0 || points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  const tol2 = tol * tol
  while (stack.length) {
    const [a, b] = stack.pop()!
    const pa = points[a]
    const pb = points[b]
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const l2 = dx * dx + dy * dy
    let worst = -1
    let worstD = tol2
    for (let i = a + 1; i < b; i++) {
      const p = points[i]
      let d2: number
      if (l2 === 0) {
        d2 = (p.x - pa.x) ** 2 + (p.y - pa.y) ** 2
      } else {
        const cross = (p.x - pa.x) * dy - (p.y - pa.y) * dx
        d2 = (cross * cross) / l2
      }
      if (d2 > worstD) {
        worstD = d2
        worst = i
      }
    }
    if (worst > 0) {
      keep[worst] = 1
      stack.push([a, worst], [worst, b])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/**
 * Same as `tapered()` in path.ts, but each edge is simplified after
 * computing the width: the pen pulse is already in the edges and the
 * simplification does not flatten it.
 */
export function taperedLite(points: Pt[], widthAt: (t: number) => number, tol: number): string {
  if (tol <= 0) return tapered(points, widthAt)
  if (points.length < 2) return ''
  const normals = normalsOf(points)
  const left: Pt[] = []
  const right: Pt[] = []
  const last = points.length - 1
  for (let i = 0; i <= last; i++) {
    const half = Math.max(0.16, widthAt(i / last) / 2)
    left.push(add(points[i], mul(normals[i], half)))
    right.push(add(points[i], mul(normals[i], -half)))
  }
  return polyline([...simplifyPolyline(left, tol), ...simplifyPolyline(right, tol).reverse()], true)
}

export function drawLeaf(o: DrawLeafOptions, ctx: LeafDrawCtx): string {
  const { rng, noise, pal } = ctx
  const tol = o.tolerance ?? 0
  const w = o.weight ?? 1
  const phase = rng.next() * 12
  const raw = leafSpine(o.base, o.tip, o.bend, o.segments ?? 34)
  const sp = wobble(raw, 0.55 * o.roughness, noise, 0.32, phase)
  const geom = leafGeometry(sp, o.halfWidth, rng.range(-0.1, 0.1), o.profile)
  const shape = tol > 0 ? polyline(simplifyPolyline(geom.outline, tol * 0.75), true) : geom.d
  const color = colorOf(pal, o.fill.color)
  // on an ink blade the veins are cut out in paper
  const line =
    o.fill.color === 'ink' ? pal.paper : o.fill.pattern === 'solid' && o.veinColor ? o.veinColor : pal.ink
  const offset = o.registration

  let out = ''

  if (o.underlay && !(o.fill.pattern === 'solid' && color)) {
    // the "empty" leaf is paper: it covers, it does not show through
    out += `<path d="${shape}" fill="${o.underlay}"/>`
  }

  if (o.fill.pattern === 'solid' && color) {
    if (o.underlay && offset) {
      // with misregistration, the paper covers the gap left by the shifted blot
      out += `<path d="${shape}" fill="${o.underlay}"/>`
    }
    const shift = offset ? ` transform="translate(${num(offset)} ${num(offset * 0.7)})"` : ''
    out += `<path d="${shape}" fill="${color}"${shift}/>`
  }

  if (o.fill.pattern === 'herringbone') {
    out += `<path d="${leafVeins(geom, 13, 0.1)}" fill="none" stroke="${line}" stroke-width="${num(1.2 * w)}" stroke-linecap="round"/>`
  }

  if (o.fill.pattern === 'hatch') {
    const hatch = hatchPath(bboxOf(geom.outline, 2), -38, o.hatchStep ?? 5.8, rng.range(0, 6))
    out += `<g clip-path="${ctx.clip(shape)}"><path d="${hatch}" fill="none" stroke="${line}" stroke-width="${num(1.15 * w)}"/></g>`
  }

  if (o.fill.pattern === 'stripes') {
    out += `<path d="${leafStripes(geom, [-0.66, -0.34, 0, 0.34, 0.66])}" fill="none" stroke="${line}" stroke-width="${num(1.2 * w)}" stroke-linecap="round"/>`
  }

  if (o.fill.pattern !== 'stripes') {
    const veins = o.fill.pattern === 'herringbone' ? '' : leafVeins(geom, o.veins, o.veinSweep ?? 0.12)
    if (veins) {
      out += `<path d="${veins}" fill="none" stroke="${line}" stroke-width="${num(0.95 * w)}" stroke-linecap="round"/>`
    }
    const ribWidth = (o.fill.pattern === 'herringbone' ? 1.9 : 1.4) * w
    out += `<path d="${taperedLite(geom.spine, (t) => ribWidth * (1 - 0.55 * t), tol)}" fill="${line}"/>`
  }

  const penPath = withOvershoot(geom.outline, o.overshoot)
  const outline = taperedLite(
    penPath,
    (t) => {
      const pulse = Math.pow(Math.sin(Math.PI * t), 0.45)
      const grain = 0.92 + 0.16 * noise(t * 6.5 + phase * 3)
      const tail = 1 - Math.pow(t, 8) * 0.72
      return o.outline * (0.46 + 0.54 * pulse) * grain * tail
    },
    tol,
  )
  out += `<path d="${outline}" fill="${pal.ink}"/>`

  return `<g class="bi-leaf">${out}</g>`
}
