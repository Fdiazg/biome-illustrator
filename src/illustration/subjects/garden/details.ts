// ---------------------------------------------------------------------------
// garden/details — the second set of garden pieces: a framed candle lantern,
// rounded boulders and their clusters, a fanned clump of grass, a bed of
// soil seen in perspective, a thin botanical sprig, and the far edge of a wood
// (a group of cypresses, a low shrub and a broad tree).
//
// Same language as `motifs.ts`: ink with variable width over a flat fill
// shifted off the line (misregistration), two flat tones at most, no
// gradients and no soft shading.
//
// Same contract too: each function returns inner SVG markup in its own
// coordinates, takes a `Pen` (randomness + noise) and receives its colors as
// arguments. Standing pieces grow up from `base` (the foot).
// ---------------------------------------------------------------------------

import { cubicPoint, lerp, num, type Pt } from '../../core/math'
import { leafGeometry, leafSpine, leafVeins, type LeafProfile } from '../../core/leaf'
import { polyline, tapered, wobble } from '../../core/path'
import { alpha, bent, cypress, daisy, fillPath, flatLeaf, ring, shift, stroke } from './motifs'
import type { Pen } from './pieces'

/** A closed, hand-drawn blob around `c`: periodic noise so it closes on itself. */
function blob(p: Pen, c: Pt, rx: number, ry: number, n: number, amp: number, ph: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2
    const r = 1 + amp * p.noise(ph + 1.3 * Math.cos(th)) + amp * 0.6 * p.noise(ph + 5 + 1.3 * Math.sin(th))
    out.push({ x: c.x + Math.cos(th) * rx * r, y: c.y + Math.sin(th) * ry * r })
  }
  return out
}

/** Even-odd test of a point against a closed polygon. */
function inside(pt: Pt, poly: Pt[]): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}

/**
 * The part of a closed outline (clockwise on screen, cut flat at `groundY`)
 * that stands above the ground: from the left contact, over the top, to the right one.
 */
function aboveRun(shape: Pt[], groundY: number): Pt[] {
  const n = shape.length
  const above = (q: Pt) => q.y < groundY - 0.5
  let start = shape.findIndex((q, i) => above(q) && !above(shape[(i - 1 + n) % n]))
  if (start < 0) start = 0
  const run: Pt[] = []
  for (let j = 0; j < n; j++) {
    const q = shape[(start + j) % n]
    if (!above(q)) {
      if (run.length) break
      continue
    }
    run.push(q)
  }
  return run
}

/** A short dash of ground from `x0` outward (`dir`), at `y`. */
function groundDash(p: Pen, x0: number, y: number, length: number, dir: number, weight: number, ph: number, ink: string): string {
  const x1 = x0 + dir * length
  return fillPath(stroke(p, [{ x: x0, y: y + 0.4 }, { x: lerp(x0, x1, 0.5), y: y - 0.3 }, { x: x1, y: y + 0.2 }], weight, ph), ink)
}

// ---------------------------------------------------------------------------
// Cage lantern: a framed candle lantern. Plinth, a cage of four panes seen at
// three quarters (two faces, three posts), an eave, a pointed roof, a finial
// and a ring to carry it. A candle stands in the wider pane.
//
// Layers, same geometry for the same seed: `halo` (flat discs of light and a
// pool on the ground, only when lit), `fill` (the metal body), `glass` (the
// panes, the candle and its flame: what lights up) and `ink` (every line).
// Stacked halo → fill → glass → ink they give `all`.
// ---------------------------------------------------------------------------

export type CageLanternLayer = 'all' | 'halo' | 'fill' | 'glass' | 'ink'

export interface CageLanternColors {
  ink: string
  /** the metal frame: plinth, posts, rails, eave, roof, finial */
  body: string
  /** the panes */
  glass: string
  /** the flame, and the halo unless `halo` is given */
  flame: string
  /** the candle wax and the glint on the glass */
  candle: string
  /** color of the halo. Default `flame` */
  halo?: string
}

export interface CageLanternOptions {
  /** candle burning: flame, warm panes and halo. Default true */
  lit?: boolean
  /** one layer only (see above). Default `all` */
  layer?: CageLanternLayer
}

export function cageLantern(p: Pen, base: Pt, height: number, c: CageLanternColors, o: CageLanternOptions = {}): string {
  const { rng } = p
  const lit = o.lit !== false
  const H = height
  const k = H / 100
  const w = 1.3 * Math.sqrt(k)
  const reg = { x: 1.3 * k, y: 0.9 * k }
  const ph = rng.range(0, 9)
  const halo: string[] = []
  const fills: string[] = []
  const glass: string[] = []
  const inks: string[] = []
  const Y = (v: number) => base.y - v * H
  const cx = base.x

  /** A closed outline with points along its edges (so the pen can wobble). */
  const along = (corners: Pt[], per = 5): Pt[] => {
    const out: Pt[] = []
    corners.forEach((a, i) => {
      const b = corners[(i + 1) % corners.length]
      for (let j = 0; j < per; j++) out.push({ x: lerp(a.x, b.x, j / per), y: lerp(a.y, b.y, j / per) })
    })
    return out
  }
  const quad = (x0: number, x1: number, v0: number, v1: number, top0 = x0, top1 = x1) =>
    along([{ x: x0, y: Y(v0) }, { x: top0, y: Y(v1) }, { x: top1, y: Y(v1) }, { x: x1, y: Y(v0) }])
  /** A piece of the metal body: flat fill off its outline, the outline in ink. */
  const metal = (pts: Pt[], weight = w) => {
    fills.push(fillPath(polyline(pts, true), c.body, shift(reg.x, reg.y)))
    inks.push(fillPath(ring(p, pts, weight, ph + fills.length * 1.7, weight * 0.6), c.ink))
  }
  const line = (pts: Pt[], weight: number) => inks.push(fillPath(stroke(p, pts, weight, ph + inks.length * 0.9), c.ink))

  // proportions by seed: stockier or slimmer, a taller or lower roof
  const s = rng.range(0.9, 1.08)
  const hw = H * 0.165 * s // half width of the cage
  const vCage0 = 0.085
  const vCage1 = rng.range(0.55, 0.6)
  const pw = H * 0.016 // half width of a post
  const rail = 0.022

  // the plinth in two steps, with the front corner running down it
  const f = (rng.chance(0.5) ? 1 : -1) * rng.range(0.22, 0.38) // front corner, as a fraction of hw
  const frontX = cx + hw * f
  metal(quad(cx - hw * 1.24, cx + hw * 1.24, 0, 0.05, cx - hw * 1.2, cx + hw * 1.2), w * 1.05)
  metal(quad(cx - hw * 1.08, cx + hw * 1.08, 0.05, vCage0, cx - hw * 1.04, cx + hw * 1.04))
  line([{ x: cx + hw * 1.24 * f, y: Y(0.004) }, { x: cx + hw * 1.2 * f, y: Y(0.046) }], w * 0.55)

  // the panes: the gaps between the posts and the rails
  const v0 = vCage0 + rail
  const v1 = vCage1 - rail
  const panes: [number, number][] = [
    [cx - hw + pw, frontX - pw * 1.1],
    [frontX + pw * 1.1, cx + hw - pw],
  ]
  for (const [x0, x1] of panes) {
    const pts = quad(x0, x1, v0, v1)
    glass.push(fillPath(polyline(pts, true), c.glass, shift(reg.x * 0.5, reg.y * 0.5) + (lit ? '' : alpha(0.45))))
  }
  // the candle stands in the wider pane, clear of the posts
  const wide = frontX - (cx - hw) > cx + hw - frontX ? panes[0] : panes[1]
  const candleX = (wide[0] + wide[1]) / 2 + rng.range(-0.08, 0.08) * (wide[1] - wide[0])
  const room = (wide[1] - wide[0]) / 2
  const chw = Math.min(H * 0.042, room * 0.5)
  const cTop = v0 + rng.range(0.11, 0.16)
  const flameV = cTop + 0.012
  const flameH = rng.range(0.11, 0.14)
  if (lit) {
    // a flat glow around the flame, inside its pane
    const gr = Math.min(H * 0.1, room * 0.92)
    const glow = blob(p, { x: candleX, y: Y(flameV + flameH * 0.42) }, gr, gr * 1.15, 28, 0.03, ph + 2)
    glass.push(fillPath(polyline(glow, true), c.flame, alpha(0.4)))
  }
  const candle = quad(candleX - chw, candleX + chw, v0, cTop)
  glass.push(fillPath(polyline(candle, true), c.candle))
  inks.push(fillPath(ring(p, candle, w * 0.6, ph + 4, 0), c.ink))
  // a drip of wax
  line([{ x: candleX + chw * 0.35, y: Y(cTop) }, { x: candleX + chw * 0.4, y: Y(cTop - 0.03) }], w * 0.45)
  // wick
  line([{ x: candleX, y: Y(cTop) }, { x: candleX + 0.2 * k, y: Y(cTop + 0.018) }], w * 0.5)
  if (lit) {
    // the flame: round at the bottom, pointed at the top, leaning a little
    const lean = rng.range(-0.25, 0.25) * H * 0.03
    const fw = Math.min(H * 0.034, chw * 0.85)
    const tear = (scale: number, lift: number): Pt[] => {
      const pts: Pt[] = []
      const n = 14
      const prof = (t: number) => (t < 0.35 ? Math.sqrt(Math.max(0, 1 - Math.pow((0.35 - t) / 0.35, 2))) : Math.pow(1 - (t - 0.35) / 0.65, 1.3))
      const at = (t: number, side: number): Pt => ({
        x: candleX + side * fw * scale * prof(t) + lean * t * t,
        y: Y(flameV + lift + t * flameH * scale),
      })
      for (let i = 0; i <= n; i++) pts.push(at(i / n, -1))
      for (let i = n - 1; i >= 1; i--) pts.push(at(i / n, 1))
      return pts
    }
    const outer = tear(1, 0)
    glass.push(fillPath(polyline(outer, true), c.flame))
    glass.push(fillPath(polyline(tear(0.48, 0.004), true), c.candle))
    inks.push(fillPath(ring(p, outer, w * 0.42, ph + 6, 0), c.ink, alpha(0.8)))
  }
  // a glint on the narrow pane
  const narrow = wide === panes[0] ? panes[1] : panes[0]
  const gx = lerp(narrow[0], narrow[1], 0.45)
  const gw = (narrow[1] - narrow[0]) * 0.35
  glass.push(
    fillPath(
      tapered(
        [
          { x: gx - gw * 0.5, y: Y(lerp(v0, v1, 0.42)) },
          { x: gx, y: Y(lerp(v0, v1, 0.55)) },
          { x: gx + gw * 0.5, y: Y(lerp(v0, v1, 0.68)) },
        ],
        (t) => w * 0.9 * Math.sin(Math.PI * t),
      ),
      c.candle,
      alpha(lit ? 0.75 : 0.55),
    ),
  )
  for (const [x0, x1] of panes) inks.push(fillPath(ring(p, quad(x0, x1, v0, v1), w * 0.45, ph + x0, 0), c.ink, alpha(0.7)))

  // the frame: rails across, three posts
  metal(quad(cx - hw, cx + hw, vCage0, v0), w * 0.85)
  metal(quad(cx - hw, cx + hw, v1, vCage1), w * 0.85)
  for (const [x, pwx] of [
    [cx - hw, pw],
    [frontX, pw * 1.15],
    [cx + hw, pw],
  ] as const) {
    metal(quad(x - pwx, x + pwx, v0, v1), w * 0.8)
  }

  // the eave, overhanging the cage
  const vEave = vCage1 + 0.035
  metal(quad(cx - hw * 1.2, cx + hw * 1.2, vCage1, vEave, cx - hw * 1.16, cx + hw * 1.16), w * 0.95)
  // the roof: slightly concave sides up to a cut point, a ridge to the front corner
  const vRoof = vEave + rng.range(0.13, 0.17)
  const apexHalf = H * 0.032
  const left = bent({ x: cx - hw * 1.1, y: Y(vEave) }, { x: cx - apexHalf, y: Y(vRoof) }, -0.06, 10)
  const right = bent({ x: cx + apexHalf, y: Y(vRoof) }, { x: cx + hw * 1.1, y: Y(vEave) }, -0.06, 10)
  metal([...left, ...right, { x: cx + hw * 0.4, y: Y(vEave) }, { x: cx - hw * 0.4, y: Y(vEave) }], w)
  line(bent({ x: cx + apexHalf * f * 1.2, y: Y(vRoof - 0.005) }, { x: frontX, y: Y(vEave + 0.004) }, 0.02, 8), w * 0.55)
  // the finial: a short collar and a cap
  const vFin = vRoof + 0.028
  metal(quad(cx - H * 0.045, cx + H * 0.045, vRoof, vFin, cx - H * 0.04, cx + H * 0.04), w * 0.8)
  const capR = H * 0.032
  const cap: Pt[] = []
  for (let i = 0; i <= 12; i++) {
    const th = Math.PI + (i / 12) * Math.PI
    cap.push({ x: cx + Math.cos(th) * capR, y: Y(vFin) + Math.sin(th) * capR * 0.7 })
  }
  metal(cap, w * 0.8)

  // the ring: a thick loop of wire standing on the cap
  const rr = { x: H * rng.range(0.065, 0.08), y: H * rng.range(0.08, 0.095) }
  const ringC = { x: cx, y: Y(vFin) - capR * 0.5 - rr.y * 0.92 }
  const loop: Pt[] = []
  const a0 = Math.PI * 0.62
  const a1 = Math.PI * 2.38
  for (let i = 0; i <= 30; i++) {
    const th = lerp(a0, a1, i / 30)
    loop.push({ x: ringC.x + Math.cos(th) * rr.x, y: ringC.y + Math.sin(th) * rr.y })
  }
  inks.push(fillPath(tapered(wobble(loop, w * 0.12, p.noise, 0.3, ph + 11), (t) => w * (1.5 + 0.2 * Math.sin(Math.PI * t))), c.ink))

  // a dash of ground on each side of the plinth
  for (const sd of [-1, 1]) {
    const x0 = cx + sd * hw * rng.range(1.32, 1.5)
    inks.push(groundDash(p, x0, base.y, H * rng.range(0.06, 0.11), sd, w * 0.5, ph + sd * 3, c.ink))
  }

  // the halo: flat discs of light around the flame and a pool on the ground
  if (lit) {
    const hc = c.halo ?? c.flame
    const fc = { x: candleX, y: Y(flameV + flameH * 0.4) }
    const maxR = base.y - fc.y
    for (const [r, a] of [
      [1, 0.07],
      [0.76, 0.08],
      [0.52, 0.1],
    ] as const) {
      const d = blob(p, fc, maxR * r * 1.05, maxR * r, 40, 0.025, ph + r * 7)
      halo.push(fillPath(polyline(d, true), hc, alpha(a)))
    }
    const pool = blob(p, { x: cx, y: base.y - H * 0.004 }, H * rng.range(0.42, 0.5), H * 0.04, 40, 0.04, ph + 13)
    halo.push(fillPath(polyline(pool, true), hc, alpha(0.22)))
  }

  const layer = o.layer ?? 'all'
  if (layer === 'halo') return halo.join('')
  if (layer === 'fill') return fills.join('')
  if (layer === 'glass') return glass.join('')
  if (layer === 'ink') return inks.join('')
  return halo.join('') + fills.join('') + glass.join('') + inks.join('')
}

// ---------------------------------------------------------------------------
// Boulder: a rounded stone half sunk in the ground. Flat fill with a lighter
// flat plane on top (two tones, no gradient), the outline in one stroke over
// the back, a short facet line, the foot hidden by ground dashes and grass.
// ---------------------------------------------------------------------------

export interface BoulderColors {
  ink: string
  /** the body of the stone */
  fill: string
  /** the lighter plane on top */
  top: string
  /** tint of some grass blades at the foot. Default `ink` only */
  grass?: string
}

export interface BoulderOptions {
  /** how much of the stone is under the ground, 0..0.45 of its full height. Default by seed, 0.12–0.24 */
  sink?: number
  /** grass blades over the foot. Default true */
  grass?: boolean
}

export function boulder(p: Pen, base: Pt, width: number, height: number, c: BoulderColors, o: BoulderOptions = {}): string {
  const { rng, noise } = p
  const k = Math.sqrt(width / 100)
  const w = 1.5 * k
  const ph = rng.range(0, 9)
  const sink = Math.max(0, Math.min(0.45, o.sink ?? rng.range(0.12, 0.24)))
  const full = height / (1 - sink)
  const rx = width / 2
  const ry = full / 2
  const cyy = base.y - height + ry
  const sq = rng.range(2, 2.45) // squareness: round pebble → block
  const lean = rng.range(-0.16, 0.16)
  const lump = rng.range(0.04, 0.08)
  const N = 72
  const shape: Pt[] = []
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2
    const cs = Math.cos(th)
    const sn = Math.sin(th)
    const sx = Math.sign(cs) * Math.pow(Math.abs(cs), 2 / sq)
    const sy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / sq)
    const r = 1 + lump * noise(ph + 1.2 * cs) + lump * 0.7 * noise(ph + 4 + 1.2 * sn)
    const y = cyy + sy * ry * r
    shape.push({ x: base.x + sx * rx * r + lean * rx * Math.min(0, sy) * -1, y: Math.min(base.y, y) })
  }
  // the visible outline: from the left contact over the top to the right one
  const arc = aboveRun(shape, base.y)
  const reg = { x: 2 * k, y: 1.3 * k }
  const xs = shape.map((q) => q.x)
  const xL = Math.min(...xs)
  const xR = Math.max(...xs)
  const footL = arc[0] ?? { x: xL, y: base.y }
  const footR = arc[arc.length - 1] ?? { x: xR, y: base.y }
  let out = fillPath(polyline(shape, true), c.fill, shift(reg.x, reg.y))

  // the top plane: the upper part of the outline, closed by a curve that bows down
  const iA = Math.round(arc.length * rng.range(0.1, 0.22))
  const iB = Math.round(arc.length * rng.range(0.72, 0.86))
  const rim = arc.slice(iA, iB + 1)
  if (rim.length > 4) {
    const a = rim[0]
    const b = rim[rim.length - 1]
    const depth = ry * rng.range(0.32, 0.5)
    const inner: Pt[] = []
    for (let j = 1; j < 16; j++) {
      const u = j / 16
      const x = lerp(b.x, a.x, u)
      const yy = lerp(b.y, a.y, u) + Math.sin(Math.PI * Math.pow(u, rng.range(0.8, 1.2))) * depth
      inner.push({ x, y: yy })
    }
    out += fillPath(polyline([...rim, ...inner], true), c.top, shift(reg.x, reg.y))
    // the facet: a short line along part of the plane's lower edge
    const from = Math.floor(inner.length * rng.range(0.05, 0.25))
    const to = Math.min(inner.length, from + Math.ceil(inner.length * rng.range(0.4, 0.6)))
    const facet = inner.slice(from, to)
    if (facet.length > 2) out += fillPath(stroke(p, facet, w * 0.5, ph + 2), c.ink)
  }
  // a small crack or dimple on the shaded side, sometimes
  if (rng.chance(0.6)) {
    const t = rng.range(0.7, 0.85)
    const q = arc[Math.round(arc.length * t)] ?? footR
    const cxp = lerp(q.x, base.x, 0.28)
    const cyp = lerp(q.y, base.y, 0.45)
    const l = width * rng.range(0.06, 0.1)
    out += fillPath(stroke(p, bent({ x: cxp, y: cyp }, { x: cxp - l * 0.4, y: cyp + l * 0.7 }, 0.2, 6), w * 0.45, ph + 5), c.ink)
  }
  // outline: one stroke over the back, leaving thin at both contacts
  out += fillPath(stroke(p, arc, w, ph, 0.25), c.ink)
  // the ground on both sides, and a short line under the front
  out += groundDash(p, footL.x + width * 0.04, base.y, width * rng.range(0.14, 0.24), -1, w * 0.6, ph + 7, c.ink)
  out += groundDash(p, footR.x - width * 0.04, base.y, width * rng.range(0.12, 0.22), 1, w * 0.6, ph + 8, c.ink)
  if (o.grass !== false) {
    // a few blades over the foot, at one or both contacts
    const spots = rng.chance(0.55) ? [footL, footR] : [rng.chance(0.5) ? footL : footR]
    for (const q of spots) {
      const n = rng.int(3, 5)
      const gx = q.x + (q === footL ? 1 : -1) * width * rng.range(0.02, 0.08)
      out += blades(p, { x: gx, y: base.y + 0.5 }, height * rng.range(0.3, 0.5), n, c.ink, c.grass, w * 0.75)
    }
  }
  return out
}

/** Thin grass blades from one point, as ink (a few tinted). */
function blades(p: Pen, at: Pt, height: number, n: number, ink: string, tint: string | undefined, weight: number): string {
  const { rng, noise } = p
  let out = ''
  for (let i = 0; i < n; i++) {
    const kk = n === 1 ? 0 : i / (n - 1) - 0.5
    const lean = kk * 1.3 + rng.range(-0.2, 0.2)
    const len = height * rng.range(0.55, 1) * (1 - Math.abs(kk) * 0.3)
    const b = { x: at.x + kk * weight * 2.5, y: at.y }
    const tip = { x: b.x + Math.sin(lean) * len * 1.1, y: b.y - Math.cos(lean) * len }
    const c1 = { x: b.x + Math.sin(lean * 0.3) * len * 0.4, y: b.y - len * 0.45 }
    const c2 = { x: lerp(c1.x, tip.x, 0.6), y: lerp(c1.y, tip.y, 0.5) }
    const pts: Pt[] = []
    for (let j = 0; j <= 12; j++) pts.push(cubicPoint(b, c1, c2, tip, j / 12))
    const d = tapered(wobble(pts, weight * 0.15, noise, 0.5, i * 3.1 + at.x), (t) => weight * 1.25 * Math.pow(1 - t, 0.8) + 0.1)
    out += fillPath(d, tint && rng.chance(0.35) ? tint : ink)
  }
  return out
}

// ---------------------------------------------------------------------------
// Grass clump: a fan of blades from one point, broad flat blades (fill and
// outline) mixed with thin ink ones, of different heights. Made to ring a
// flower or hide the foot of a stone.
// ---------------------------------------------------------------------------

export interface GrassClumpColors {
  ink: string
  /** fill of the broad blades */
  fill: string
}

export interface GrassClumpOptions {
  /** how many blades, as a multiplier (0.4 sparse … 2 thick). Default 1 */
  density?: number
  /** half angle of the fan, radians. Default 1.15 */
  spread?: number
}

export function grassClump(p: Pen, base: Pt, height: number, c: GrassClumpColors, o: GrassClumpOptions = {}): string {
  const { rng, noise } = p
  const density = Math.max(0.2, o.density ?? 1)
  const spread = o.spread ?? 1.15
  const k = Math.sqrt(height / 60)
  const w = 1.2 * k
  const reg = { x: 1.3 * k, y: 0.9 * k }
  const nBroad = Math.max(1, Math.round(rng.int(3, 5) * density))
  const nThin = Math.max(1, Math.round(rng.int(5, 8) * density))
  const items: { a: number; body: string }[] = []
  for (let i = 0; i < nBroad + nThin; i++) {
    const broad = i < nBroad
    const n = broad ? nBroad : nThin
    const idx = broad ? i : i - nBroad
    const u = n === 1 ? 0.5 : (idx + rng.range(0.15, 0.85)) / n
    const a = lerp(-spread, spread, u) * (broad ? 0.85 : 1)
    const len = height * rng.range(0.5, 1) * (1 - (Math.abs(a) / spread) * 0.42)
    const foot = { x: base.x + rng.range(-0.05, 0.05) * height, y: base.y + 0.5 }
    const droop = Math.sign(a || rng.range(-1, 1)) * rng.range(0.22, 0.5) * (0.35 + Math.abs(a))
    const tip = { x: foot.x + Math.sin(a + droop * 0.5) * len * 1.05, y: foot.y - Math.cos(a) * len * (1 - 0.3 * Math.abs(droop)) }
    let body: string
    if (broad) {
      body = flatLeaf(
        p,
        { base: foot, tip, bend: -droop * 0.9, halfWidth: len * rng.range(0.07, 0.1), profile: 'linear' as LeafProfile },
        c.fill,
        c.ink,
        w * 0.8,
        reg,
      )
    } else {
      const pts = bent(foot, tip, -droop * 0.6, 14)
      body = fillPath(tapered(wobble(pts, w * 0.15, noise, 0.4, i * 2.3), (t) => w * 1.15 * Math.pow(1 - t, 0.85) + 0.12), c.ink)
    }
    items.push({ a: Math.abs(a) + (broad ? 0 : 0.05), body })
  }
  // the tall center ones behind, the outer (lower) ones in front
  items.sort((x, y) => x.a - y.a)
  let out = items.map((q) => q.body).join('')
  for (const sd of [-1, 1]) {
    const x0 = base.x + sd * height * rng.range(0.18, 0.3)
    out += groundDash(p, x0, base.y, height * rng.range(0.12, 0.22), sd, w * 0.5, sd * 4, c.ink)
  }
  return out
}

// ---------------------------------------------------------------------------
// Stone cluster: two to four boulders of different sizes with clumps of grass
// behind them and between, and maybe a few daisies. The unit of ground detail
// a page sows in groups.
// ---------------------------------------------------------------------------

export interface StoneClusterColors extends BoulderColors {
  /** fill of the broad grass blades */
  leaf: string
  /** daisy petals */
  petal: string
  /** daisy centers */
  center: string
}

export interface StoneClusterOptions {
  /** 2..4. Default by seed */
  stones?: number
  /** 0..3 daisies. Default by seed */
  flowers?: number
  /** grass density multiplier. Default 1 */
  grass?: number
}

export function stoneCluster(p: Pen, base: Pt, width: number, c: StoneClusterColors, o: StoneClusterOptions = {}): string {
  const { rng } = p
  const n = Math.max(1, Math.min(4, Math.round(o.stones ?? rng.int(2, 4))))
  const nf = Math.max(0, Math.min(3, Math.round(o.flowers ?? rng.int(0, 3))))
  const density = o.grass ?? 1
  // the stones: the biggest near the middle, the rest alternating sides, smaller and a bit forward
  type S = { x: number; y: number; w: number; h: number }
  const stones: S[] = []
  const w0 = width * rng.range(0.36, 0.44) * (n === 1 ? 1.15 : 1)
  const first = { x: base.x + rng.range(-0.1, 0.1) * width, y: base.y, w: w0, h: w0 * rng.range(0.5, 0.66) }
  stones.push(first)
  let side = rng.chance(0.5) ? -1 : 1
  let prevW = w0
  const edge = { [-1]: first.x - w0 / 2, [1]: first.x + w0 / 2 } as Record<number, number>
  for (let i = 1; i < n; i++) {
    const sw = prevW * rng.range(0.52, 0.78)
    const x = edge[side] + side * sw * rng.range(0.12, 0.42)
    const s = { x, y: base.y + width * rng.range(0, 0.02), w: sw, h: sw * rng.range(0.48, 0.7) }
    stones.push(s)
    edge[side] = x + side * sw / 2
    prevW = Math.max(sw, w0 * 0.45)
    side = -side
  }
  // center the row on the foot
  const dx = base.x - (edge[-1] + edge[1]) / 2 + rng.range(-0.04, 0.04) * width
  for (const s of stones) s.x += dx
  edge[-1] += dx
  edge[1] += dx
  const big = stones[0]
  let out = ''
  // behind: a tall clump against the big stone, and one at an end
  const behind = [
    { x: big.x + rng.range(-0.3, 0.3) * big.w, h: big.h * rng.range(1.5, 2) },
    { x: (rng.chance(0.5) ? edge[-1] : edge[1]) + rng.range(-0.05, 0.05) * width, h: big.h * rng.range(1.05, 1.4) },
  ]
  for (const b of behind) out += grassClump(p, { x: b.x, y: base.y - big.h * 0.05 }, b.h, { ink: c.ink, fill: c.leaf }, { density: density * rng.range(0.7, 1) })
  // daisies behind the stones, near their sides
  for (let i = 0; i < nf; i++) {
    const s = stones[i % stones.length]
    const x = s.x + (rng.chance(0.5) ? -1 : 1) * s.w * rng.range(0.25, 0.55)
    out += daisy(p, { x, y: base.y - s.h * 0.1 }, big.h * rng.range(1.1, 1.7), { ink: c.ink, petal: c.petal, center: c.center, leaf: c.leaf }, { head: 1.15 })
  }
  // the stones, back to front
  const order = stones.slice().sort((a, b) => a.y - b.y || b.w - a.w)
  for (const s of order) out += boulder(p, { x: s.x, y: s.y }, s.w, s.h, c, { grass: false })
  // in front: small clumps at the feet
  const fronts = rng.int(1, 2)
  for (let i = 0; i < fronts; i++) {
    const s = stones[rng.int(0, stones.length - 1)]
    const x = s.x + (rng.chance(0.5) ? -1 : 1) * s.w * rng.range(0.3, 0.5)
    out += grassClump(p, { x, y: s.y + 1 }, s.h * rng.range(0.6, 0.9), { ink: c.ink, fill: c.leaf }, { density: density * 0.6, spread: 1.3 })
  }
  return out
}

// ---------------------------------------------------------------------------
// Bed: a patch of bare soil seen in perspective, the ground under a group of
// plants. An irregular ellipse, a broken ink edge (heavier in front), a flat
// fill of light earth, clods and pebbles, and maybe a rim of small stones.
// ---------------------------------------------------------------------------

export interface BedColors {
  ink: string
  /** the soil */
  fill: string
  /** pebbles and the rim stones */
  pebble: string
}

export interface BedOptions {
  /** height / width of the ellipse, 0.15..0.6. Default by seed, 0.28–0.42 */
  ratio?: number
  /** a rim of small stones along the edge. Default false */
  rim?: boolean
}

export function bed(p: Pen, center: Pt, width: number, c: BedColors, o: BedOptions = {}): string {
  const { rng, noise } = p
  const ratio = Math.max(0.15, Math.min(0.6, o.ratio ?? rng.range(0.28, 0.42)))
  const rx = width / 2
  const ry = rx * ratio
  const k = Math.sqrt(width / 300)
  const w = 1.6 * k
  const ph = rng.range(0, 9)
  const reg = { x: 2.4 * k, y: 1.4 * k }
  const N = 96
  const pts: Pt[] = []
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2
    const r = 1 + 0.08 * noise(ph + 1.1 * Math.cos(th)) + 0.05 * noise(ph + 6 + 2.3 * Math.sin(th)) + 0.025 * noise(ph + i * 0.4)
    // flatter at the back, fuller in front (the near half is seen larger)
    const yk = Math.sin(th) > 0 ? 1.06 : 0.94
    pts.push({ x: center.x + Math.cos(th) * rx * r, y: center.y + Math.sin(th) * ry * r * yk })
  }
  let out = fillPath(polyline(pts, true), c.fill, shift(reg.x, reg.y))

  // the edge: broken strokes, heavier in front, some missing at the back
  let i0 = rng.int(0, N - 1)
  let done = 0
  while (done < N) {
    const len = Math.min(N - done, Math.round(N * rng.range(0.14, 0.26)))
    const seg: Pt[] = []
    for (let j = 0; j <= len; j++) seg.push(pts[(i0 + j) % N])
    const mid = seg[Math.floor(seg.length / 2)]
    const front = mid.y > center.y
    if (front || rng.chance(0.72)) out += fillPath(stroke(p, seg, w * (front ? 1 : 0.6), ph + done * 0.3, 0.3), c.ink, front ? '' : alpha(0.8))
    const gap = rng.int(1, 3)
    i0 = (i0 + len + gap) % N
    done += len + gap
  }

  // inside: clods (little humps) and pebbles, thinner toward the back
  const inEllipse = (u: number, v: number): Pt => ({ x: center.x + u * rx * 0.78, y: center.y + v * ry * 0.7 })
  const clods = rng.int(6, 10)
  for (let i = 0; i < clods; i++) {
    let u = rng.range(-1, 1)
    let v = rng.range(-1, 1)
    if (u * u + v * v > 1) {
      u *= 0.7
      v *= 0.7
    }
    const q = inEllipse(u, v)
    const depthK = 0.75 + 0.25 * v
    const l = width * rng.range(0.025, 0.045) * depthK
    const hump = [
      { x: q.x - l / 2, y: q.y },
      { x: q.x - l * 0.2, y: q.y - l * 0.28 },
      { x: q.x + l * 0.2, y: q.y - l * 0.3 },
      { x: q.x + l / 2, y: q.y },
    ]
    out += fillPath(stroke(p, hump, w * 0.5 * depthK, ph + i * 1.7), c.ink, alpha(0.85))
  }
  const pebble = (q: Pt, r: number, weight: number, i: number) => {
    const d = blob(p, q, r * 1.35, r, 14, 0.08, ph + i * 2.1)
    return fillPath(polyline(d, true), c.pebble, shift(r * 0.25, r * 0.18)) + fillPath(ring(p, d, weight, ph + i, r * 0.3), c.ink)
  }
  const pebbles = rng.int(3, 6)
  for (let i = 0; i < pebbles; i++) {
    const q = inEllipse(rng.range(-0.85, 0.85), rng.range(-0.8, 0.8))
    out += pebble(q, width * rng.range(0.008, 0.014), w * 0.45, i)
  }
  // a few short furrows across, to lay the plane flat
  const furrows = rng.int(3, 5)
  for (let i = 0; i < furrows; i++) {
    const q = inEllipse(rng.range(-0.6, 0.6), rng.range(-0.6, 0.8))
    const l = width * rng.range(0.05, 0.1)
    out += fillPath(stroke(p, [{ x: q.x - l / 2, y: q.y }, { x: q.x, y: q.y + 0.4 * k }, { x: q.x + l / 2, y: q.y }], w * 0.4, ph + 20 + i), c.ink, alpha(0.55))
  }

  if (o.rim) {
    // small stones straddling the edge: close together in front, sparse at the back
    const rimStones: { q: Pt; r: number }[] = []
    let i = rng.int(0, N - 1)
    let walked = 0
    while (walked < N) {
      const q = pts[i % N]
      const front = q.y > center.y
      const r = width * rng.range(0.016, 0.026) * (front ? 1 : 0.8)
      if (front || rng.chance(0.55)) rimStones.push({ q: { x: q.x, y: q.y + r * 0.2 }, r })
      const step = Math.max(2, Math.round((front ? rng.range(2.4, 3.6) : rng.range(4, 6)) * (r / (width * 0.02)) * (96 / N) * 1.4))
      i += step
      walked += step
    }
    rimStones.sort((a, b) => a.q.y - b.q.y)
    rimStones.forEach((s, j) => (out += pebble(s.q, s.r, w * 0.55, 40 + j)))
  }
  return out
}

// ---------------------------------------------------------------------------
// Sprig: a thin botanical branch in line only, to sit beside a name. A soft
// curve, five to nine alternate lanceolate leaves and one at the tip; each
// leaf a closed outline with a midrib and a few veins. One color; the fill is
// optional. Made to read at 60–90 px tall: `displayHeight` keeps the pen
// above a minimum width at that size.
// ---------------------------------------------------------------------------

export interface SprigOptions {
  /** leaves, tip included: 5..9. Default by seed */
  leaves?: number
  /** fill of the leaves. Default none (line only) */
  fill?: string
  /** opacity of that fill. Default 1 */
  fillOpacity?: number
  /** 1 leans right, -1 leans left. Default 1 */
  side?: 1 | -1
  /** lateral veins on each leaf. Default true */
  veins?: boolean
  /** height in px it will be shown at: thickens the pen to stay legible */
  displayHeight?: number
}

export function sprig(p: Pen, base: Pt, height: number, color: string, o: SprigOptions = {}): string {
  const { rng, noise } = p
  const side = o.side ?? 1
  const nLeaves = Math.max(3, Math.min(11, Math.round(o.leaves ?? rng.int(5, 9))))
  const k = height / 100
  let w = 1.35 * Math.sqrt(k)
  if (o.displayHeight && o.displayHeight > 0) w = Math.max(w, 1.15 / (o.displayHeight / height))
  const ph = rng.range(0, 9)
  // the stem: up and to one side, a soft bow
  const tip = { x: base.x + side * height * rng.range(0.32, 0.46), y: base.y - height * rng.range(0.86, 0.94) }
  const bow = rng.range(0.1, 0.2) * side
  const stem = bent(base, tip, -bow, 40)
  let out = ''
  const leaves: string[] = []
  const leafAt = (i: number, foot: Pt, dir: Pt, len: number, angle: number, bend: number) => {
    const a = Math.atan2(dir.y, dir.x) + angle
    const stalk = len * 0.1
    const lb = { x: foot.x + Math.cos(a) * stalk, y: foot.y + Math.sin(a) * stalk }
    const lt = { x: foot.x + Math.cos(a) * len, y: foot.y + Math.sin(a) * len }
    const spine = wobble(leafSpine(lb, lt, bend, 26), w * 0.12, noise, 0.3, ph + i * 3)
    const geom = leafGeometry(spine, len * rng.range(0.2, 0.26), rng.range(-0.08, 0.08), rng.chance(0.7) ? 'lanceolate' : 'oval')
    let s = ''
    if (o.fill) s += fillPath(geom.d, o.fill, shift(w * 0.9, w * 0.6) + alpha(o.fillOpacity ?? 1))
    s += fillPath(tapered([foot, lb], () => w * 0.75), color)
    if (o.veins !== false && len > 6) {
      s += `<path d="${leafVeins(geom, rng.int(2, 3), 0.45)}" fill="none" stroke="${color}" stroke-width="${num(w * 0.38)}" stroke-linecap="round"/>`
    }
    s += fillPath(tapered(geom.spine, (t) => w * 0.55 * (1 - 0.7 * t)), color)
    s += fillPath(ring(p, geom.outline, w * 0.85, ph + i * 1.9, w * 1.2), color)
    leaves.push(s)
  }
  // alternate leaves along the stem, bigger below
  const lateral = nLeaves - 1
  const t0 = rng.range(0.18, 0.28)
  for (let i = 0; i < lateral; i++) {
    const t = lerp(t0, 0.86, lateral === 1 ? 0.5 : i / (lateral - 1)) + rng.range(-0.025, 0.025)
    const j = Math.round(t * (stem.length - 1))
    const foot = stem[j]
    const nx = stem[Math.min(stem.length - 1, j + 1)]
    const pv = stem[Math.max(0, j - 1)]
    const dir = { x: nx.x - pv.x, y: nx.y - pv.y }
    const s = i % 2 === 0 ? -1 : 1 // alternate
    const len = height * rng.range(0.27, 0.34) * (1 - 0.38 * t)
    leafAt(i, foot, dir, len, s * rng.range(0.6, 0.95), s * rng.range(0.08, 0.2))
  }
  // the tip leaf continues the stem
  const end = stem[stem.length - 1]
  const prev = stem[stem.length - 4]
  leafAt(nLeaves, end, { x: end.x - prev.x, y: end.y - prev.y }, height * rng.range(0.2, 0.26), rng.range(-0.12, 0.12), -bow * 0.6)
  out += fillPath(tapered(wobble(stem, w * 0.12, noise, 0.25, ph), (t) => w * (1.35 - 0.75 * t)), color)
  out += leaves.join('')
  return out
}

// ---------------------------------------------------------------------------
// Fan sprig: the same signature branch, fuller. A curved stem with broad,
// pointed leaves on both sides that fan out from it: wide open low down,
// closing up toward the tip leaf. Each leaf is a closed outline; most carry a
// midrib and some a few short veins. One color, line only. `displayHeight`
// keeps the pen legible from ~45 px (phone) to ~90 px, and drops the lateral
// veins when the branch is shown very small.
// ---------------------------------------------------------------------------

export interface FanSprigOptions {
  /** leaves, tip included: 4..11. Default by seed (5..7) */
  leaves?: number
  /** 1 leans and opens to the right, -1 to the left. Default 1 */
  side?: 1 | -1
  /** how wide the leaves fan out from the stem, 0..1. Default by seed */
  spread?: number
  /** short lateral veins on some leaves. Default true (off below ~56 px) */
  veins?: boolean
  /** fill of the leaves, each one covering the ones under it. Default none (line only) */
  fill?: string
  /** opacity of that fill. Default 1 */
  fillOpacity?: number
  /** height in px it will be shown at: thickens the pen to stay legible */
  displayHeight?: number
}

/** Half width of the fan sprig's blade along its axis (0 base .. 1 tip): widest a little under the middle, a drawn-out point. */
const BLADE_PEAK = (() => {
  let m = 0
  for (let i = 0; i <= 200; i++) m = Math.max(m, Math.pow(i / 200 + 0.02, 0.9) * Math.pow(1 - i / 200, 1.25))
  return m
})()
const bladeWidth = (s: number) => (Math.pow(Math.max(0, s) + 0.02, 0.9) * Math.pow(Math.max(0, 1 - s), 1.25)) / BLADE_PEAK

/** Closed outline of a pointed blade around `spine`, one side a little wider. */
function blade(spine: Pt[], half: number, asym: number): Pt[] {
  const last = spine.length - 1
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= last; i++) {
    const a = spine[Math.max(0, i - 1)]
    const b = spine[Math.min(last, i + 1)]
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const n = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }
    const h = half * bladeWidth(i / last)
    left.push({ x: spine[i].x + n.x * h * (1 + asym), y: spine[i].y + n.y * h * (1 + asym) })
    right.push({ x: spine[i].x - n.x * h * (1 - asym), y: spine[i].y - n.y * h * (1 - asym) })
  }
  return [...left, ...right.reverse().slice(1)]
}

export function fanSprig(p: Pen, base: Pt, height: number, color: string, o: FanSprigOptions = {}): string {
  const { rng, noise } = p
  const side = o.side ?? 1
  const nLeaves = Math.max(4, Math.min(11, Math.round(o.leaves ?? rng.int(5, 7))))
  const spread = Math.max(0, Math.min(1, o.spread ?? rng.range(0.25, 0.85)))
  const shown = o.displayHeight && o.displayHeight > 0 ? o.displayHeight : undefined
  const k = height / 100
  let w = 1.2 * Math.sqrt(k)
  // px per unit at the size it is shown: at least ~1.05 px of line, a touch less when tiny
  if (shown) w = Math.max(w, (shown < 60 ? 0.95 : 1.05) / (shown / height))
  const veins = o.veins !== false && !(shown && shown < 56)
  const ph = rng.range(0, 9)

  // the stem: leaves the foot on a diagonal and straightens toward the tip;
  // it stops short of `height` so the tip leaf ends near the top
  const sh = height * 0.8
  const lean = rng.range(0.3, 0.44)
  const tip = { x: base.x + side * sh * lean, y: base.y - sh * rng.range(0.93, 0.99) }
  const c1 = { x: base.x + side * sh * lean * rng.range(0.45, 0.7), y: base.y - sh * rng.range(0.22, 0.32) }
  const c2 = { x: tip.x - side * sh * rng.range(-0.02, 0.06), y: tip.y + sh * rng.range(0.3, 0.4) }
  const stem: Pt[] = []
  for (let i = 0; i <= 48; i++) stem.push(cubicPoint(base, c1, c2, tip, i / 48))
  const last = stem.length - 1
  const tangentAt = (j: number) => {
    const a = stem[Math.max(0, j - 1)]
    const b = stem[Math.min(last, j + 1)]
    return Math.atan2(b.y - a.y, b.x - a.x)
  }

  // one leaf: short petiole, blade, maybe a midrib and veins; outline last
  const leaf = (i: number, foot: Pt, angle: number, len: number, bend: number, half: number, rib: boolean, withVeins: boolean) => {
    const stalk = len * 0.07
    const lb = { x: foot.x + Math.cos(angle) * stalk, y: foot.y + Math.sin(angle) * stalk }
    const lt = { x: foot.x + Math.cos(angle) * len, y: foot.y + Math.sin(angle) * len }
    const spine = wobble(leafSpine(lb, lt, bend, 28), w * 0.1, noise, 0.3, ph + i * 3)
    const outline = blade(spine, half, rng.range(-0.08, 0.08))
    const sl = spine.length - 1
    let s = ''
    if (o.fill) s += fillPath(polyline(outline, true), o.fill, alpha(o.fillOpacity ?? 1))
    s += fillPath(tapered([foot, lb], () => w * 0.7), color)
    if (rib) {
      // from the base, fading before the tip
      s += fillPath(tapered(spine.slice(0, Math.round(sl * rng.range(0.76, 0.88))), (t) => w * 0.48 * (1 - 0.65 * t)), color)
      if (withVeins) {
        const pairs = rng.int(2, 3)
        let d = ''
        for (let v = 0; v < pairs; v++) {
          const t = 0.24 + (0.46 * (v + 0.5)) / pairs
          const j = Math.round(t * sl)
          const q = spine[j]
          const a = spine[Math.max(0, j - 1)]
          const b = spine[Math.min(sl, j + 1)]
          const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1
          const tx = (b.x - a.x) / tl
          const ty = (b.y - a.y) / tl
          const hw = half * bladeWidth(t)
          for (const sd of [-1, 1]) {
            if (rng.chance(0.3)) continue // a vein missing here and there
            const reach = hw * rng.range(0.5, 0.72)
            const end = { x: q.x - ty * sd * reach + tx * reach * 1.1, y: q.y + tx * sd * reach + ty * reach * 1.1 }
            d += `M${num(q.x)} ${num(q.y)}L${num(end.x)} ${num(end.y)}`
          }
        }
        if (d) s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${num(w * 0.34)}" stroke-linecap="round"/>`
      }
    }
    s += fillPath(ring(p, outline, w * 0.82, ph + i * 1.9, w * 1.1), color)
    return s
  }

  // lateral leaves, alternate on both sides; the lowest open widest
  const lateral = nLeaves - 1
  const t0 = rng.range(0.15, 0.23)
  const t1 = rng.range(0.72, 0.8)
  const first = rng.chance(0.5) ? 1 : -1
  const parts: { y: number; s: string }[] = []
  for (let i = 0; i < lateral; i++) {
    const u = lateral === 1 ? 0.5 : i / (lateral - 1)
    const t = lerp(t0, t1, u) + rng.range(-0.025, 0.025)
    const j = Math.max(1, Math.min(last - 1, Math.round(t * last)))
    const foot = stem[j]
    const screen = (i % 2 === 0 ? 1 : -1) * first // which side of the stem, on screen
    // angle from straight up: wide at the foot, closing toward the tip, half following the stem
    const up = -Math.PI / 2
    const lift = (tangentAt(j) - up) * 0.5
    const open = lerp(lerp(1.0, 1.35, spread), lerp(0.5, 0.75, spread), t) + rng.range(-0.1, 0.1)
    let a = up + lift + screen * open
    a = Math.max(up - 1.4, Math.min(up + 1.4, a)) // never droops below level
    // biggest a little under the middle, smaller at the foot and near the tip
    const size = 0.8 + 0.3 * Math.sin(Math.PI * Math.min(1, (t - 0.05) / 0.85))
    const len = sh * rng.range(0.34, 0.41) * size
    const half = len * rng.range(0.19, 0.23)
    // the blade arches a little, its tip turning up
    const bend = -screen * rng.range(0.04, 0.14)
    const rib = rng.chance(0.75)
    parts.push({ y: foot.y, s: leaf(i, foot, a, len, bend, half, rib, veins && rng.chance(0.6)) })
  }
  // the tip leaf continues the stem
  const end = stem[last]
  const tipLen = sh * rng.range(0.2, 0.25)
  const tipLeaf = leaf(lateral, end, tangentAt(last - 1) + rng.range(-0.12, 0.12), tipLen, side * rng.range(-0.08, 0.08), tipLen * rng.range(0.19, 0.22), true, veins && rng.chance(0.4))

  let out = fillPath(tapered(wobble(stem, w * 0.1, noise, 0.25, ph), (t) => w * (1.3 - 0.7 * t)), color)
  // with a fill, the lower leaves go under the upper ones
  parts.sort((a, b) => b.y - a.y)
  out += parts.map((q) => q.s).join('')
  out += tipLeaf
  return out
}

// ---------------------------------------------------------------------------
// The edge of a wood, for the horizon: a group of cypresses of different
// heights, a low round shrub, and a broad tree whose crown is a cloud of
// clumps. Seen from far: a clear silhouette, few marks inside.
// ---------------------------------------------------------------------------

export interface CypressGroupOptions {
  /** 2..5 trees. Default by seed */
  count?: number
}

export function cypressGroup(p: Pen, base: Pt, width: number, height: number, ink: string, fill: string, o: CypressGroupOptions = {}): string {
  const { rng } = p
  const n = Math.max(1, Math.min(5, Math.round(o.count ?? rng.int(2, 5))))
  const trees: { x: number; y: number; h: number }[] = []
  const tallest = rng.int(0, n - 1)
  const step = width / n
  for (let i = 0; i < n; i++) {
    const h = i === tallest ? height : height * rng.range(0.5, 0.88)
    const x = base.x - width / 2 + (i + 0.5) * step + rng.range(-0.22, 0.22) * step
    trees.push({ x, y: base.y + rng.range(0, 0.015) * height, h })
  }
  // tallest at the back, the shorter ones overlap in front
  trees.sort((a, b) => b.h - a.h)
  return trees.map((t) => cypress(p, { x: t.x, y: t.y }, t.h, ink, fill)).join('')
}

/** Union of circles as seen from `c`: the farthest crossing along each ray. */
function cloudOutline(c: Pt, circles: { x: number; y: number; r: number }[], n: number, squashBelow = 1): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2
    const u = { x: Math.cos(th), y: Math.sin(th) }
    let best = 0
    for (const q of circles) {
      const d = { x: q.x - c.x, y: q.y - c.y }
      const b = d.x * u.x + d.y * u.y
      const disc = b * b - (d.x * d.x + d.y * d.y - q.r * q.r)
      if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc))
    }
    const y = u.y * best
    out.push({ x: c.x + u.x * best, y: c.y + (y > 0 ? y * squashBelow : y) })
  }
  return out
}

/** Short arcs on the lower edge of inner clumps, where they sit inside the silhouette. */
function clumpMarks(p: Pen, circles: { x: number; y: number; r: number }[], shape: Pt[], weight: number, ph: number, ink: string): string {
  let out = ''
  circles.forEach((q, i) => {
    const a0 = p.rng.range(0.25, 0.55) * Math.PI
    const span = p.rng.range(0.35, 0.55) * Math.PI
    const arc: Pt[] = []
    for (let j = 0; j <= 10; j++) {
      const th = a0 + (j / 10) * span
      const pt = { x: q.x + Math.cos(th) * q.r * 0.96, y: q.y + Math.sin(th) * q.r * 0.96 }
      if (!inside(pt, shape)) {
        if (arc.length > 2) break
        arc.length = 0
        continue
      }
      arc.push(pt)
    }
    // keep only marks well inside (not hugging the outline)
    if (arc.length > 3) out += fillPath(stroke(p, arc, weight, ph + i * 2.3), ink)
  })
  return out
}

export function shrub(p: Pen, base: Pt, width: number, height: number, ink: string, fill: string): string {
  const { rng } = p
  const k = Math.sqrt(height / 100)
  const w = 1.5 * k
  const ph = rng.range(0, 9)
  const reg = { x: 1.8 * k, y: 1.2 * k }
  // clumps along a low dome: the middle ones higher and bigger
  const n = rng.int(4, 6)
  const circles: { x: number; y: number; r: number }[] = []
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1)
    const mid = Math.sin(Math.PI * u)
    const r = height * lerp(0.3, 0.48, mid) * rng.range(0.88, 1.08)
    const x = base.x + lerp(-0.5, 0.5, u) * (width - 2 * height * 0.32) + rng.range(-0.04, 0.04) * width
    const top = base.y - height * lerp(0.55, 1, mid) * rng.range(0.94, 1)
    circles.push({ x, y: Math.max(top + r, base.y - r * 0.6), r })
  }
  // silhouette: the clumps' union, cut flat at the ground
  // the upper envelope of the clumps, from the left foot to the right one
  const x0 = Math.min(...circles.map((q) => q.x - q.r))
  const x1 = Math.max(...circles.map((q) => q.x + q.r))
  const run: Pt[] = []
  const M = 90
  for (let i = 0; i <= M; i++) {
    const x = lerp(x0, x1, i / M)
    let y = base.y
    for (const q of circles) {
      const dx = x - q.x
      if (Math.abs(dx) < q.r) y = Math.min(y, q.y - Math.sqrt(q.r * q.r - dx * dx))
    }
    run.push({ x, y: Math.min(base.y, y) })
  }
  const shape = [...run, { x: x1, y: base.y }, { x: x0, y: base.y }]
  let out = fillPath(polyline(shape, true), fill, shift(reg.x, reg.y))
  // outline: over the top in one stroke
  out += fillPath(stroke(p, run, w, ph, 0.25), ink)
  out += clumpMarks(p, circles, shape, w * 0.55, ph + 3, ink)
  // a few leaf ticks
  const ticks = rng.int(3, 6)
  for (let i = 0; i < ticks; i++) {
    const q = { x: base.x + rng.range(-0.35, 0.35) * width, y: base.y - height * rng.range(0.25, 0.75) }
    if (!inside(q, shape)) continue
    const l = height * rng.range(0.06, 0.1)
    out += fillPath(stroke(p, [q, { x: q.x + l * 0.4, y: q.y - l * 0.3 }, { x: q.x + l, y: q.y - l * 0.35 }], w * 0.45, ph + 9 + i), ink)
  }
  const xs = shape.map((q) => q.x)
  out += groundDash(p, Math.min(...xs) + width * 0.02, base.y, width * rng.range(0.08, 0.14), -1, w * 0.5, ph + 1, ink)
  out += groundDash(p, Math.max(...xs) - width * 0.02, base.y, width * rng.range(0.08, 0.14), 1, w * 0.5, ph + 2, ink)
  return out
}

export function broadTree(p: Pen, base: Pt, height: number, ink: string, fill: string): string {
  const { rng } = p
  const k = Math.sqrt(height / 200)
  const w = 1.6 * k
  const ph = rng.range(0, 9)
  const reg = { x: 2 * k, y: 1.4 * k }
  // the crown: a broad cloud of clumps, wider than tall, sitting on the trunk
  const crownH = height * rng.range(0.66, 0.74)
  const crownW = crownH * rng.range(1.15, 1.45)
  const cc = { x: base.x + rng.range(-0.05, 0.05) * height, y: base.y - height + crownH * 0.5 }
  const n = rng.int(5, 8)
  const circles: { x: number; y: number; r: number }[] = [{ x: cc.x, y: cc.y + crownH * 0.04, r: crownH * 0.34 }]
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI + rng.range(-0.15, 0.15) // over the top, left to right
    const r = crownH * rng.range(0.17, 0.26)
    const dx = Math.cos(a) * (crownW / 2 - r)
    const dy = Math.sin(a) * (crownH / 2 - r)
    circles.push({ x: cc.x + dx, y: cc.y + dy * 1.02 + (Math.abs(Math.cos(a)) > 0.8 ? crownH * 0.08 : 0), r })
  }
  // trunk: from the foot into the crown, with two limbs that vanish inside it
  const top = { x: cc.x + rng.range(-0.04, 0.04) * height, y: cc.y + crownH * 0.05 }
  let out = fillPath(tapered(bent(base, top, rng.range(-0.06, 0.06), 14), (t) => w * (3.6 - 1.8 * t)), ink)
  for (const sd of [-1, 1]) {
    const from = { x: lerp(base.x, top.x, 0.6), y: lerp(base.y, top.y, 0.6) }
    const to = { x: from.x + sd * crownW * rng.range(0.14, 0.24), y: cc.y + crownH * rng.range(0, 0.12) }
    out += fillPath(tapered(bent(from, to, sd * 0.12, 8), (t) => w * (2 - 1.2 * t)), ink)
  }
  // a root flare and the ground
  out += groundDash(p, base.x - w * 2.2, base.y, height * rng.range(0.07, 0.12), -1, w * 0.6, ph + 4, ink)
  out += groundDash(p, base.x + w * 2.2, base.y, height * rng.range(0.07, 0.12), 1, w * 0.6, ph + 5, ink)
  const shape = cloudOutline(cc, circles, 160, 0.82)
  out += fillPath(polyline(shape, true), fill, shift(reg.x, reg.y))
  out += fillPath(ring(p, shape, w, ph, crownH * 0.06), ink)
  out += clumpMarks(p, circles.slice(1), shape, w * 0.6, ph + 7, ink)
  return out
}

// ---------------------------------------------------------------------------
// Maria for a phased moon: a few flat patches in a barely different tone,
// kept wholly inside the lit part.
// ---------------------------------------------------------------------------

/** Flat patches inside `lit` (a closed outline), around a disc at `c` of radius `R`. */
export function moonMaria(p: Pen, c: Pt, R: number, lit: Pt[], color: string, opacity: number, shiftBy: string): string {
  const { rng } = p
  // the classic face: a broad band from the upper left to the right, two small seas lower down
  const seeds: [number, number, number][] = [
    [-0.28, -0.3, 0.3],
    [0.12, -0.38, 0.22],
    [0.3, -0.05, 0.24],
    [-0.1, 0.05, 0.2],
    [0.05, 0.42, 0.14],
    [-0.42, 0.25, 0.12],
  ]
  let out = ''
  const count = 4 + (rng.chance(0.5) ? 1 : 0)
  seeds.slice(0, count).forEach(([x, y, r], i) => {
    const q = { x: c.x + (x + rng.range(-0.06, 0.06)) * R, y: c.y + (y + rng.range(-0.06, 0.06)) * R }
    const rr = r * R * rng.range(0.8, 1.15)
    const pts = blob(p, q, rr * rng.range(1, 1.35), rr, 20, 0.12, i * 3.7 + rng.range(0, 5))
    if (pts.every((pt) => inside(pt, lit))) out += fillPath(polyline(pts, true), color)
  })
  return out ? `<g opacity="${Math.round(opacity * 100) / 100}"${shiftBy}>${out}</g>` : ''
}
