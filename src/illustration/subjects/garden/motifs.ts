// ---------------------------------------------------------------------------
// garden/motifs — the small life of the garden ground and its far edge:
// daisy, stone, bush, a big foreground leaf, cypress and round tree far
// away, layered hills without sky and a trail seen from above.
//
// Ink and flat misregistered fill, like the rest of the engine; no soft
// shading.
//
// Same contract as `pieces.ts`: each function returns inner SVG markup in its
// own coordinates, takes a `Pen` (randomness + noise) and receives its colors
// as arguments. Standing motifs grow up from `base` (the foot).
// ---------------------------------------------------------------------------

import { add, clamp, cubicPoint, lerp, mul, num, type Pt } from '../../core/math'
import { leafGeometry, leafSpine, leafVeins, type LeafProfile } from '../../core/leaf'
import { makeNoise, type Noise1D } from '../../core/noise'
import { polyline, tapered, withOvershoot, wobble } from '../../core/path'
import { crest } from '../dunes/terrain'
import type { Pen } from './pieces'

/** Pen pressure: enters thin, settles, leaves thin; with a soft pulse. */
const pressure = (noise: Noise1D, phase: number, attack = 0.35) => (t: number) =>
  Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), attack) * (1 + 0.14 * noise(t * 5 + phase))

const fillPath = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`
const shift = (dx: number, dy: number) => ` transform="translate(${num(dx)} ${num(dy)})"`
const alpha = (o: number) => (o < 1 ? ` opacity="${Math.round(Math.max(0, o) * 100) / 100}"` : '')

/** A closed ring drawn with the pen: overshoot where it closes, pressure along it. */
function ring(p: Pen, pts: Pt[], weight: number, phase: number, overshoot: number): string {
  const line = withOvershoot(pts, overshoot, 0.5)
  const press = pressure(p.noise, phase, 0.3)
  return tapered(wobble(line, weight * 0.18, p.noise, 0.3, phase), (t) => weight * (0.3 + 0.7 * press(t)))
}

/** An open stroke with pressure. */
function stroke(p: Pen, pts: Pt[], weight: number, phase: number, attack = 0.35): string {
  const press = pressure(p.noise, phase, attack)
  return tapered(wobble(pts, weight * 0.2, p.noise, 0.3, phase), (t) => weight * (0.2 + 0.8 * press(t)))
}

/** A curve from a to b through a bend (perpendicular, as a fraction of the length). */
function bent(a: Pt, b: Pt, bend: number, n = 16): Pt[] {
  const d = { x: b.x - a.x, y: b.y - a.y }
  const c1 = { x: a.x + d.x * 0.33 - d.y * bend, y: a.y + d.y * 0.33 + d.x * bend }
  const c2 = { x: a.x + d.x * 0.7 - d.y * bend * 0.6, y: a.y + d.y * 0.7 + d.x * bend * 0.6 }
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) out.push(cubicPoint(a, c1, c2, b, i / n))
  return out
}

interface FlatLeaf {
  base: Pt
  tip: Pt
  bend: number
  halfWidth: number
  profile: LeafProfile
}

/** A leaf in flat fill, shifted off its line; with outline and midrib if `ink`. */
function flatLeaf(p: Pen, o: FlatLeaf, fill: string, ink: string | null, weight: number, reg: Pt, veins = 0, fillAlpha = 1): string {
  const phase = p.rng.next() * 12
  const spine = wobble(leafSpine(o.base, o.tip, o.bend, 30), weight * 0.25, p.noise, 0.3, phase)
  const geom = leafGeometry(spine, o.halfWidth, p.rng.range(-0.1, 0.1), o.profile)
  let out = fillPath(geom.d, fill, shift(reg.x, reg.y) + alpha(fillAlpha))
  if (!ink) return out
  if (veins > 0) {
    out += `<path d="${leafVeins(geom, veins, 0.3)}" fill="none" stroke="${ink}" stroke-width="${num(weight * 0.42)}" stroke-linecap="round"/>`
  }
  out += fillPath(tapered(geom.spine, (t) => weight * 0.7 * (1 - 0.6 * t)), ink)
  out += fillPath(ring(p, geom.outline, weight, phase, weight * 1.6), ink)
  return out
}

// ---------------------------------------------------------------------------
// Daisy: a thin stem, a leaf or two at the foot and a head of white petals
// seen a little from above, with a misregistered yellow center.
// ---------------------------------------------------------------------------

export interface DaisyColors {
  ink: string
  petal: string
  center: string
  leaf: string
}

export interface DaisyOptions {
  /** size of the head relative to the stem. Default 1; a low daisy in the grass is ~1.6 */
  head?: number
}

export function daisy(p: Pen, base: Pt, height: number, c: DaisyColors, o: DaisyOptions = {}): string {
  const { rng, noise } = p
  const k = height / 100
  const w = 1.5 * Math.sqrt(k)
  const lean = rng.range(-0.22, 0.22) * height
  const head = { x: base.x + lean, y: base.y - height }
  const reg = { x: 1.6 * k, y: 1.1 * k }
  let out = ''

  // leaves at the foot: one or two, low and narrow
  const nLeaves = rng.int(1, 2)
  for (let i = 0; i < nLeaves; i++) {
    const side = i === 0 ? (rng.chance(0.5) ? -1 : 1) : -1
    const len = height * rng.range(0.24, 0.36)
    const a = side * rng.range(0.55, 1.05)
    const tip = { x: base.x + Math.sin(a) * len, y: base.y - Math.cos(a) * len }
    out += flatLeaf(p, { base, tip, bend: side * 0.18, halfWidth: len * 0.17, profile: 'lanceolate' }, c.leaf, c.ink, w * 0.75, reg)
  }

  // stem: from the foot to the back of the head, a soft S
  const stem = bent(base, { x: head.x, y: head.y + height * 0.04 }, rng.range(-0.06, 0.06), 20)
  out += fillPath(tapered(wobble(stem, 0.5 * k, noise, 0.25, 3), (t) => w * (1.1 - 0.45 * t)), c.ink)

  // head: petals around an ellipse (the flower faces up, we see it tilted)
  const R = height * rng.range(0.19, 0.24) * (o.head ?? 1)
  const tilt = rng.range(0.5, 0.72)
  const roll = rng.range(-0.25, 0.25)
  const n = rng.int(12, 16)
  const at = (r: number, th: number): Pt => {
    const x = Math.cos(th) * r
    const y = Math.sin(th) * r * tilt
    return { x: head.x + x * Math.cos(roll) - y * Math.sin(roll), y: head.y + x * Math.sin(roll) + y * Math.cos(roll) }
  }
  const off = rng.range(0, Math.PI * 2)
  const petals: { th: number; body: string }[] = []
  for (let i = 0; i < n; i++) {
    const th = off + (i / n) * Math.PI * 2 + rng.range(-0.08, 0.08)
    const len = R * rng.range(0.85, 1.08)
    const half = (Math.PI / n) * rng.range(0.7, 0.9)
    const pts: Pt[] = []
    const m = 12
    for (let j = 0; j <= m; j++) {
      const u = j / m
      // a petal: narrow at the center, round at the end
      const r = lerp(R * 0.22, len, Math.sin((Math.PI / 2) * u))
      const spread = half * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.6)
      pts.push(at(r, th - spread))
    }
    for (let j = m; j >= 0; j--) {
      const u = j / m
      const r = lerp(R * 0.22, len, Math.sin((Math.PI / 2) * u))
      const spread = half * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.6)
      pts.push(at(r, th + spread))
    }
    const body =
      fillPath(polyline(pts, true), c.petal) +
      (rng.chance(0.82) ? fillPath(ring(p, pts.slice(2, pts.length - 2), w * 0.55, i * 1.7, 0), c.ink) : '')
    petals.push({ th, body })
  }
  // back petals first (the ones above the center, sin < 0), then the front ones
  petals.sort((a, b) => Math.sin(a.th) - Math.sin(b.th))
  out += petals.map((q) => q.body).join('')

  // center: a misregistered button with a loop of ink and a few dots
  const cr = R * 0.34
  const disc: Pt[] = []
  for (let i = 0; i <= 28; i++) {
    const th = (i / 28) * Math.PI * 2
    disc.push(at(cr * (1 + 0.06 * noise(th * 2 + 5)), th))
  }
  out += fillPath(polyline(disc, true), c.center, shift(reg.x * 0.7, reg.y * 0.7))
  out += fillPath(ring(p, disc, w * 0.7, 9, cr * 0.5), c.ink)
  for (let i = 0; i < 3; i++) {
    const d = at(cr * rng.range(0.1, 0.5), rng.range(0, Math.PI * 2))
    out += `<circle cx="${num(d.x)}" cy="${num(d.y)}" r="${num(w * 0.32)}" fill="${c.ink}"/>`
  }
  return out
}

// ---------------------------------------------------------------------------
// Stone: a low rounded dome sitting on the ground. Flat fill shifted off the
// line, the outline in two lifts (back and base), and a few short strokes on
// the shaded side that follow the curve.
// ---------------------------------------------------------------------------

export function stone(p: Pen, base: Pt, width: number, height: number, ink: string, fill: string, fillAlpha = 0.55): string {
  const { rng, noise } = p
  const k = Math.sqrt(width / 100)
  const w = 1.7 * k
  const rx = width / 2
  const sq = rng.range(1.7, 2.4) // squareness of the dome
  const lean = rng.range(-0.18, 0.18) // the top leans to one side
  const ph = rng.range(0, 9)
  const top: Pt[] = []
  const N = 40
  for (let i = 0; i <= N; i++) {
    const th = Math.PI + (i / N) * Math.PI // left → over the top → right
    const c = Math.cos(th)
    const s = Math.sin(th)
    const sx = Math.sign(c) * Math.pow(Math.abs(c), 2 / sq)
    const sy = Math.sign(s) * Math.pow(Math.abs(s), 2 / sq)
    const r = 1 + 0.05 * noise(i * 0.25 + ph)
    top.push({ x: base.x + sx * rx * r + lean * rx * -sy, y: base.y + sy * height * r })
  }
  // the base: almost straight, a little lower in the middle
  const bottom: Pt[] = []
  for (let i = 1; i < 12; i++) {
    const u = i / 12
    bottom.push({ x: lerp(top[N].x, top[0].x, u), y: base.y + Math.sin(Math.PI * u) * height * 0.06 })
  }
  const shape = [...top, ...bottom]
  const reg = { x: 2.2 * k, y: 1.4 * k }
  let out = fillPath(polyline(shape, true), fill, shift(reg.x, reg.y) + alpha(fillAlpha))
  // outline: the back in one go (with overshoot past the right end), the base apart
  out += fillPath(stroke(p, withOvershoot(top, rx * 0.12, 0.3), w, ph, 0.25), ink)
  out += fillPath(stroke(p, bottom.slice(1, -1), w * 0.6, ph + 3), ink)
  // shading: short arcs inside the shaded side (right), following the dome
  const marks = rng.int(2, 4)
  for (let i = 0; i < marks; i++) {
    const inset = 0.72 - i * 0.12 + rng.range(-0.03, 0.03)
    const a = rng.range(0.62, 0.72) * N
    const b = Math.min(N - 1, a + N * rng.range(0.14, 0.24))
    const pts: Pt[] = []
    for (let j = Math.round(a); j <= Math.round(b); j++) {
      const q = top[j]
      pts.push({ x: base.x + (q.x - base.x) * inset, y: base.y + (q.y - base.y) * inset })
    }
    if (pts.length > 2) out += fillPath(stroke(p, pts, w * 0.55, ph + i * 2), ink)
  }
  // a dash of ground at one side
  const sideX = rng.chance(0.5) ? -1 : 1
  const g0 = { x: base.x + sideX * rx * rng.range(1.05, 1.15), y: base.y + 0.5 }
  const g1 = { x: g0.x + sideX * rx * rng.range(0.3, 0.55), y: base.y + 0.2 }
  out += fillPath(stroke(p, [g0, { x: lerp(g0.x, g1.x, 0.5), y: base.y - 0.4 }, g1], w * 0.5, ph + 7), ink)
  return out
}

// ---------------------------------------------------------------------------
// Bush (mata): a low dome of leaves springing from one point. The back leaves
// are only a lighter blot; the front ones carry ink.
// ---------------------------------------------------------------------------

export function bush(p: Pen, base: Pt, width: number, height: number, ink: string, leaf: string, back: string): string {
  const { rng } = p
  const k = Math.sqrt(height / 100)
  const w = 1.5 * k
  const reg = { x: 1.8 * k, y: 1.2 * k }
  const n = rng.int(13, 19)
  const leaves: { a: number; body: string }[] = []
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1)
    const a = lerp(-1.25, 1.25, u) + rng.range(-0.12, 0.12) // angle from vertical
    // a dome: long in the middle, short at the sides; wider than tall
    const reach = Math.hypot(Math.sin(a) * width * 0.5, Math.cos(a) * height) * rng.range(0.62, 1)
    const foot = { x: base.x + rng.range(-0.06, 0.06) * width, y: base.y }
    const tip = { x: foot.x + Math.sin(a) * reach, y: foot.y - Math.cos(a) * reach }
    const isBack = i % 2 === 1 || rng.chance(0.2)
    const leafO = {
      base: foot,
      tip,
      bend: Math.sign(a || 1) * rng.range(0.08, 0.22),
      halfWidth: reach * rng.range(0.13, 0.18),
      profile: (rng.chance(0.6) ? 'lanceolate' : 'oval') as LeafProfile,
    }
    const body = isBack
      ? flatLeaf(p, leafO, back, null, w, reg, 0, 0.55)
      : flatLeaf(p, leafO, leaf, ink, w, reg)
    leaves.push({ a: isBack ? 9 : Math.abs(a), body })
  }
  // back blots first, then the front leaves from the sides inward
  leaves.sort((x, y) => (y.a === 9 ? 1 : 0) - (x.a === 9 ? 1 : 0) || y.a - x.a)
  return leaves.map((l) => l.body).join('')
}

// ---------------------------------------------------------------------------
// Big leaf: one to three broad leaves from a point, for the foreground. Drawn
// big, it is the frame of the scene (and the page blurs it).
// ---------------------------------------------------------------------------

export function bigLeaf(p: Pen, base: Pt, length: number, angle: number, count: number, ink: string, fill: string): string {
  const { rng } = p
  const k = length / 200
  const w = 2.6 * Math.sqrt(k)
  const reg = { x: 3 * k, y: 2 * k }
  let out = ''
  const n = Math.max(1, Math.min(3, count))
  const spread = 0.42
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2))
  for (const i of order) {
    const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread
    const a = angle + off + rng.range(-0.08, 0.08)
    const len = length * (1 - Math.abs(off) * 0.5) * rng.range(0.9, 1)
    const stalk = len * 0.12
    const foot = { x: base.x + Math.sin(a) * stalk, y: base.y - Math.cos(a) * stalk }
    const tip = { x: base.x + Math.sin(a) * len, y: base.y - Math.cos(a) * len }
    // stalk
    out += fillPath(tapered([base, { x: lerp(base.x, foot.x, 0.5), y: lerp(base.y, foot.y, 0.5) }, foot], () => w * 1.1), ink)
    out += flatLeaf(
      p,
      {
        base: foot,
        tip,
        bend: (off >= 0 ? 1 : -1) * rng.range(0.1, 0.22),
        halfWidth: len * rng.range(0.17, 0.22),
        profile: rng.chance(0.5) ? 'oval' : 'lanceolate',
      },
      fill,
      ink,
      w,
      reg,
      rng.int(5, 7),
    )
  }
  return out
}

// ---------------------------------------------------------------------------
// Far trees: a cypress (a narrow flame) and a round tree (trunk and a
// scalloped crown). Seen from far: few marks inside, a thin outline.
// ---------------------------------------------------------------------------

export function cypress(p: Pen, base: Pt, height: number, ink: string, fill: string): string {
  const { rng, noise } = p
  const k = Math.sqrt(height / 200)
  const w = 1.6 * k
  const half = height * rng.range(0.075, 0.1)
  const ph = rng.range(0, 9)
  const trunk = height * 0.06
  const bottom = base.y - trunk
  const lean = rng.range(-0.04, 0.04) * height
  const L: Pt[] = []
  const R: Pt[] = []
  const N = 34
  for (let i = 0; i <= N; i++) {
    const t = Math.pow(i / N, 1.5) // 0 bottom → 1 tip, denser at the round foot
    // round at the foot, widest low, a long point
    const prof = Math.pow(Math.sin((Math.PI / 2) * Math.min(1, t / 0.24)), 0.4) * Math.pow(1 - t, 0.7) * 1.18
    const y = lerp(bottom, base.y - height, t)
    const cx = base.x + lean * t * t
    const bumpL = 1 + 0.16 * noise(t * 9 + ph)
    const bumpR = 1 + 0.16 * noise(t * 9 + ph + 4)
    L.push({ x: cx - half * prof * bumpL, y })
    R.push({ x: cx + half * prof * bumpR, y })
  }
  const shape = [...L.slice().reverse(), ...R.slice(1)]
  const reg = { x: 1.6 * k, y: 1.1 * k }
  let out = fillPath(tapered([base, { x: base.x, y: bottom + 2 }], () => w * 1.3), ink)
  out += fillPath(polyline(shape, true), fill, shift(reg.x, reg.y))
  out += fillPath(ring(p, shape, w, ph, 0), ink)
  // foliage: a few short slanted strokes inside, more toward the shaded side
  const marks = rng.int(4, 7)
  for (let i = 0; i < marks; i++) {
    const t = rng.range(0.15, 0.75)
    const j = Math.round(t * N)
    const x = lerp(L[j].x, R[j].x, rng.range(0.45, 0.8))
    const y = L[j].y
    const l = height * rng.range(0.04, 0.07)
    out += fillPath(stroke(p, [{ x, y }, { x: x - l * 0.3, y: y - l * 0.5 }, { x: x - l * 0.45, y: y - l }], w * 0.55, ph + i), ink)
  }
  return out
}

export function roundTree(p: Pen, base: Pt, height: number, ink: string, fill: string): string {
  const { rng, noise } = p
  const k = Math.sqrt(height / 200)
  const w = 1.6 * k
  const ph = rng.range(0, 9)
  const R = height * rng.range(0.3, 0.36)
  const cy = base.y - height + R * 0.92
  const cx = base.x + rng.range(-0.06, 0.06) * height
  const sx = rng.range(1.05, 1.25) // wider than tall
  // trunk: tapered, maybe one fork that hides in the crown
  const top = { x: cx + rng.range(-0.05, 0.05) * height, y: cy + R * 0.2 }
  let out = fillPath(tapered(bent(base, top, rng.range(-0.08, 0.08), 12), (t) => w * (3.4 - 1.6 * t)), ink)
  if (rng.chance(0.7)) {
    const side = rng.chance(0.5) ? -1 : 1
    const from = { x: lerp(base.x, top.x, 0.55), y: lerp(base.y, top.y, 0.55) }
    const to = { x: from.x + side * R * 0.4, y: cy + R * 0.1 }
    out += fillPath(tapered(bent(from, to, side * 0.1, 8), (t) => w * (1.8 - 1 * t)), ink)
  }
  // crown: scallops, flatter underneath
  const lobes = rng.int(7, 10)
  const pts: Pt[] = []
  const N = lobes * 10
  const start = rng.range(0, Math.PI * 2)
  for (let i = 0; i <= N; i++) {
    const th = start + (i / N) * Math.PI * 2
    const lobe = Math.pow(Math.abs(Math.sin((i / N) * Math.PI * lobes)), 0.55)
    const r = R * (0.86 + 0.13 * lobe + 0.04 * noise(i * 0.2 + ph))
    const y = Math.sin(th) * r
    pts.push({ x: cx + Math.cos(th) * r * sx, y: cy + (y > 0 ? y * 0.72 : y) })
  }
  const reg = { x: 2 * k, y: 1.4 * k }
  out += fillPath(polyline(pts, true), fill, shift(reg.x, reg.y))
  out += fillPath(ring(p, pts, w, ph, R * 0.15), ink)
  // inside: a few small open loops, like the engraved clouds
  const loops = rng.int(3, 5)
  for (let i = 0; i < loops; i++) {
    const a = rng.range(0, Math.PI * 2)
    const d = R * rng.range(0.2, 0.6)
    const c = { x: cx + Math.cos(a) * d * sx, y: cy + Math.sin(a) * d * 0.7 }
    const r = R * rng.range(0.12, 0.2)
    const arc: Pt[] = []
    const a0 = rng.range(2.6, 3.4)
    for (let j = 0; j <= 10; j++) {
      const th = a0 + (j / 10) * Math.PI * 0.95
      arc.push({ x: c.x + Math.cos(th) * r, y: c.y + Math.sin(th) * r })
    }
    out += fillPath(stroke(p, arc, w * 0.6, ph + i * 3), ink)
  }
  return out
}

// ---------------------------------------------------------------------------
// Hills: the bands of `dunes` without sky, object or texture. Each layer
// further back is lower in contrast (atmospheric depth): the same color with
// less opacity, so the page can tint them by the hour with one role.
// ---------------------------------------------------------------------------

export interface HillsOptions {
  /** layers, back to front. Default 4 */
  layers?: number
  /** opacity of the farthest and the nearest layer. Default [0.16, 0.5] */
  alpha?: [number, number]
  /** opacity of the crest line, far and near. Default [0.18, 0.45] */
  line?: [number, number]
  /** ridges across the width, far and near layer. Default [9, 4] */
  ridges?: [number, number]
}

export function hills(p: Pen, width: number, height: number, ink: string, fill: string, o: HillsOptions = {}): string {
  const { rng, noise } = p
  const n = Math.max(1, o.layers ?? 4)
  const [a0, a1] = o.alpha ?? [0.16, 0.5]
  const [l0, l1] = o.line ?? [0.18, 0.45]
  const [r0, r1] = o.ridges ?? [9, 4]
  const k = Math.sqrt(height / 240)
  let out = ''
  for (let i = 0; i < n; i++) {
    const d = n === 1 ? 1 : i / (n - 1) // 0 = far, 1 = near
    // far: high and many small ridges; near: low and few broad ones
    const seat = height * lerp(0.3, 0.78, d) + rng.range(-0.04, 0.04) * height
    const c = crest(
      width,
      {
        seat,
        slope: rng.range(-0.18, 0.18) * height,
        amp: height * lerp(0.1, 0.17, d) * rng.range(0.8, 1.2),
        keys: Math.round(lerp(r0, r1, d)) + rng.int(0, 2),
      },
      noise,
      rng,
      i * 7.3,
    )
    const pts = c.points
    const band = [...pts, { x: pts[pts.length - 1].x, y: height + 2 }, { x: pts[0].x, y: height + 2 }]
    out += fillPath(polyline(band, true), fill, alpha(lerp(a0, a1, d)))
    // crest line in two or three strokes, where the hand lifted
    const cuts = [0, Math.floor(pts.length * rng.range(0.3, 0.45)), Math.floor(pts.length * rng.range(0.6, 0.8)), pts.length - 1]
    for (let s = 0; s < cuts.length - 1; s++) {
      if (rng.chance(0.25)) continue
      const part = pts.slice(cuts[s] + (s ? 2 : 0), cuts[s + 1] + 1)
      if (part.length < 3) continue
      out += fillPath(stroke(p, part, 1.6 * k * lerp(0.8, 1.2, d), i * 3 + s, 0.25), ink, alpha(lerp(l0, l1, d)))
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Trail: a dirt path seen from above, to lie on a ground plane. It enters at
// the bottom and meanders to the top. Broken edges, a flat fill shifted off
// them, a few ruts and pebbles.
// ---------------------------------------------------------------------------

export interface TrailOptions {
  /** half width at the top as a fraction of the one at the bottom. Default 1 (plan view) */
  taper?: number
  /** pen multiplier at height y: to keep the line even on a plane seen in perspective */
  penAt?: (y: number) => number
  /** opacity of the fill. Default 0.3 */
  fillAlpha?: number
  /** half width at the bottom, as a fraction of the canvas width. Default 0.1–0.13 */
  halfWidth?: number
  /** how much it winds: half turns along its length. Default 1.2–1.9 */
  turns?: number
}

export function trail(p: Pen, width: number, height: number, ink: string, fill: string, o: TrailOptions = {}): string {
  const { rng, noise } = p
  const n2 = makeNoise(rng.int(1, 9999))
  const penAt = o.penAt ?? (() => 1)
  const taper = o.taper ?? 1
  const W = width
  const H = height
  const k = Math.sqrt(W / 240)
  // axis: from the bottom (v = 0) to the top (v = 1)
  const startX = W * rng.range(0.4, 0.6)
  const endX = W * rng.range(0.35, 0.65)
  const turns = rng.range(1.2, 1.9) * ((o.turns ?? 1.55) / 1.55)
  const phase = rng.range(0, Math.PI * 2)
  const axis = (v: number): Pt => ({
    x: lerp(startX, endX, v) + Math.sin(v * Math.PI * turns + phase) * W * 0.2 * (1 - 0.4 * v) + n2(v * 3 + 1) * W * 0.03,
    y: H - v * H,
  })
  const N = 110
  const hw0 = W * rng.range(0.1, 0.13) * ((o.halfWidth ?? 0.115) / 0.115)
  const L: Pt[] = []
  const R: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const v = i / N
    const a = axis(Math.max(0, v - 0.004))
    const b = axis(Math.min(1, v + 0.004))
    const tx = b.x - a.x
    const ty = b.y - a.y
    const l = Math.hypot(tx, ty) || 1
    const nrm = { x: -ty / l, y: tx / l }
    const c = axis(v)
    const hw = hw0 * lerp(1, taper, v) * (1 + 0.12 * n2(v * 7 + 4))
    L.push(add(c, mul(nrm, hw * (1 + 0.08 * noise(v * 11)))))
    R.push(add(c, mul(nrm, -hw * (1 + 0.08 * noise(v * 11 + 3)))))
  }
  const reg = { x: 3 * k, y: 2 * k }
  let out = fillPath(polyline([...L, ...R.slice().reverse()], true), fill, shift(reg.x, reg.y) + alpha(o.fillAlpha ?? 0.3))
  const wAt = (pts: Pt[], base: number) => (t: number) => {
    const q = pts[Math.min(pts.length - 1, Math.round(t * (pts.length - 1)))]
    return base * penAt(q.y)
  }
  // edges: three or four strokes each, with gaps where the hand jumped
  for (const [bi, side] of [L, R].entries()) {
    const cuts = [0]
    let at = 0
    while (at < N - 12) {
      at += Math.floor(N * rng.range(0.18, 0.32))
      cuts.push(Math.min(N, at))
    }
    if (cuts[cuts.length - 1] !== N) cuts.push(N)
    for (let s = 0; s < cuts.length - 1; s++) {
      const part = side.slice(cuts[s] + (s ? rng.int(1, 3) : 0), cuts[s + 1] + 1)
      if (part.length < 3) continue
      const wb = wobble(part, 0.6 * k, noise, 0.3, bi * 5 + s * 2)
      const press = pressure(noise, bi * 4 + s, 0.35)
      const pw = wAt(part, 1.7 * k)
      out += fillPath(tapered(wb, (t) => pw(t) * (0.25 + 0.75 * press(t))), ink)
    }
  }
  // ruts: short dashes along the trail
  const ruts = rng.int(6, 10)
  for (let i = 0; i < ruts; i++) {
    const v = rng.range(0.05, 0.95)
    const j = Math.round(v * N)
    const side = rng.range(0.25, 0.75)
    const a = { x: lerp(L[j].x, R[j].x, side), y: lerp(L[j].y, R[j].y, side) }
    const j2 = Math.min(N, j + rng.int(3, 6))
    const b = { x: lerp(L[j2].x, R[j2].x, side), y: lerp(L[j2].y, R[j2].y, side) }
    const pts = [a, { x: lerp(a.x, b.x, 0.5) + rng.range(-1, 1), y: lerp(a.y, b.y, 0.5) }, b]
    out += fillPath(tapered(pts, (t) => 1.1 * k * penAt(a.y) * Math.sin(Math.PI * t)), ink, alpha(0.7))
  }
  // pebbles: small loops near the edges, on both sides
  const pebbles = rng.int(7, 12)
  for (let i = 0; i < pebbles; i++) {
    const v = rng.range(0.03, 0.97)
    const j = Math.round(v * N)
    const outer = rng.chance(0.5) ? L : R
    const inner = outer === L ? R : L
    const t = rng.range(-0.25, 0.12)
    const c = { x: lerp(outer[j].x, inner[j].x, t), y: lerp(outer[j].y, inner[j].y, t) }
    const r = W * rng.range(0.008, 0.016) * Math.sqrt(penAt(c.y))
    const pts: Pt[] = []
    for (let m = 0; m <= 12; m++) {
      const th = (m / 12) * Math.PI * 2
      pts.push({ x: c.x + Math.cos(th) * r * 1.3, y: c.y + Math.sin(th) * r })
    }
    out += fillPath(polyline(pts, true), fill, shift(r * 0.4, r * 0.3) + alpha(Math.min(1, (o.fillAlpha ?? 0.3) * 2.2)))
    out += fillPath(tapered(withOvershoot(pts.slice(0, 11), r * 0.4, 0.4), () => 0.8 * k * penAt(c.y)), ink)
  }
  return out
}

// ---------------------------------------------------------------------------
// Lantern: a garden light in three styles. `post` is a small lamp on a pole
// (a glass cage under a roof); `paper` is a round paper lantern hanging from a
// shepherd's hook; `stone` is a low stone lantern with a window in its
// firebox. The glass (the panes, the paper, the window) is its own fill, so a
// page can draw each layer apart (`layer`) and light the glass at night.
// ---------------------------------------------------------------------------

export type LanternStyle = 'post' | 'paper' | 'stone'
export const LANTERN_STYLES: readonly LanternStyle[] = ['post', 'paper', 'stone']

export interface LanternColors {
  ink: string
  /** pole, roof, caps and stone */
  body: string
  /** what lights up: the panes, the paper, the window */
  glass: string
}

export interface LanternOptions {
  /** Default: one of LANTERN_STYLES by seed */
  style?: LanternStyle
  /**
   * One layer only, same geometry for the same seed: `fill` (body fills),
   * `glass` (the glass fill) or `ink` (every line). Stacked fill → glass → ink
   * they give `all` (the default).
   */
  layer?: 'all' | 'fill' | 'glass' | 'ink'
}

export function lantern(p: Pen, base: Pt, height: number, c: LanternColors, o: LanternOptions = {}): string {
  const { rng } = p
  const style = o.style ?? LANTERN_STYLES[rng.int(0, LANTERN_STYLES.length - 1)]
  const H = height
  const k = H / 100
  const w = 1.25 * Math.sqrt(k)
  const reg = { x: 1.5 * k, y: 1 * k }
  const ph = rng.range(0, 9)
  const fills: string[] = []
  const glass: string[] = []
  const inks: string[] = []

  /** A closed outline with points along its edges (so the pen can wobble). */
  const along = (corners: Pt[], per = 6): Pt[] => {
    const out: Pt[] = []
    corners.forEach((a, i) => {
      const b = corners[(i + 1) % corners.length]
      for (let j = 0; j < per; j++) out.push({ x: lerp(a.x, b.x, j / per), y: lerp(a.y, b.y, j / per) })
    })
    return out
  }
  /** A body part: flat fill shifted off its outline, and the outline in ink. */
  const part = (pts: Pt[], weight = w, fill = c.body) => {
    fills.push(fillPath(polyline(pts, true), fill, shift(reg.x, reg.y)))
    inks.push(fillPath(ring(p, pts, weight, ph + fills.length, weight * 1.2), c.ink))
  }
  const pane = (pts: Pt[], weight = w * 0.8) => {
    glass.push(fillPath(polyline(pts, true), c.glass, shift(reg.x * 0.6, reg.y * 0.6)))
    inks.push(fillPath(ring(p, pts, weight, ph + glass.length * 3, weight), c.ink))
  }
  const line = (pts: Pt[], weight: number) => inks.push(fillPath(stroke(p, pts, weight, ph + inks.length), c.ink))
  // a dash of ground on each side of the foot
  const ground = (half: number) => {
    for (const s of [-1, 1]) {
      const g0 = { x: base.x + s * half * rng.range(1, 1.3), y: base.y + 0.4 }
      const g1 = { x: g0.x + s * H * rng.range(0.05, 0.1), y: base.y + 0.2 }
      line([g0, { x: lerp(g0.x, g1.x, 0.5), y: base.y - 0.3 * k }, g1], w * 0.5)
    }
  }

  if (style === 'post') {
    const lean = rng.range(-0.015, 0.015) * H
    const top = base.y - H * rng.range(0.56, 0.64)
    const half = H * 0.02
    const cx = base.x + lean
    // the pole and a small plate at its foot
    part(along([{ x: base.x - half, y: base.y }, { x: cx - half * 0.85, y: top }, { x: cx + half * 0.85, y: top }, { x: base.x + half, y: base.y }], 8))
    part(along([{ x: base.x - half * 3, y: base.y }, { x: base.x - half * 2.2, y: base.y - H * 0.035 }, { x: base.x + half * 2.2, y: base.y - H * 0.035 }, { x: base.x + half * 3, y: base.y }], 4))
    // the tray, the cage of glass and its mullion
    const hb = H * rng.range(0.085, 0.1)
    const ht = hb * rng.range(1.05, 1.18)
    const tray = H * 0.024
    part(along([{ x: cx - hb * 1.2, y: top }, { x: cx - hb * 1.15, y: top - tray }, { x: cx + hb * 1.15, y: top - tray }, { x: cx + hb * 1.2, y: top }], 5))
    const cb = top - tray
    const ch = H * rng.range(0.19, 0.24)
    pane(along([{ x: cx - hb, y: cb }, { x: cx - ht, y: cb - ch }, { x: cx + ht, y: cb - ch }, { x: cx + hb, y: cb }], 6))
    const m = rng.range(-0.3, 0.3)
    line([{ x: cx + hb * m, y: cb }, { x: cx + ht * m, y: cb - ch }], w * 0.7)
    if (rng.chance(0.5)) line([{ x: cx - (hb + ht) / 2, y: cb - ch * 0.5 }, { x: cx + (hb + ht) / 2, y: cb - ch * 0.5 }], w * 0.45)
    // the roof: concave sides, eaves past the cage; a knob on top
    const ey = cb - ch
    const rw = ht * rng.range(1.35, 1.6)
    const peak = { x: cx + rng.range(-0.02, 0.02) * H, y: ey - H * rng.range(0.1, 0.14) }
    const left = bent({ x: cx - rw, y: ey + H * 0.012 }, peak, -0.12, 10)
    const right = bent(peak, { x: cx + rw, y: ey + H * 0.012 }, -0.12, 10)
    part([...left, ...right.slice(1), { x: cx + rw * 0.9, y: ey + H * 0.02 }, { x: cx - rw * 0.9, y: ey + H * 0.02 }])
    const r = H * rng.range(0.016, 0.022)
    const knob: Pt[] = []
    for (let i = 0; i < 18; i++) knob.push({ x: peak.x + Math.cos((i / 18) * Math.PI * 2) * r, y: peak.y - r * 0.8 + Math.sin((i / 18) * Math.PI * 2) * r })
    part(knob, w * 0.7)
    ground(half * 3)
  } else if (style === 'paper') {
    // a thin hook: up from the foot, over, and the lantern hangs from its end
    const side = rng.chance(0.5) ? -1 : 1
    const top = { x: base.x + rng.range(-0.02, 0.02) * H, y: base.y - H * rng.range(0.9, 0.96) }
    const reach = H * rng.range(0.19, 0.24)
    const end = { x: base.x + side * reach, y: top.y + H * rng.range(0.03, 0.05) }
    const pole = bent(base, top, rng.range(-0.03, 0.03), 18)
    const hook: Pt[] = []
    const c1 = { x: top.x, y: top.y - H * 0.06 }
    const c2 = { x: end.x, y: top.y - H * 0.07 }
    for (let i = 1; i <= 14; i++) hook.push(cubicPoint(top, c1, c2, end, i / 14))
    inks.push(fillPath(tapered(wobble([...pole, ...hook], w * 0.15, p.noise, 0.3, ph), (t) => w * (1.5 - 0.8 * t)), c.ink))
    // the string, the top cap, the paper and the bottom cap
    const capY = end.y + H * rng.range(0.05, 0.09)
    line([end, { x: end.x + rng.range(-0.3, 0.3) * k, y: capY }], w * 0.4)
    const rx = H * rng.range(0.1, 0.125)
    const ry = rx * rng.range(1.0, 1.3)
    const capH = H * 0.022
    const cx = end.x
    const cy = capY + capH + ry * 0.94
    const paper: Pt[] = []
    for (let i = 0; i < 44; i++) {
      const th = (i / 44) * Math.PI * 2
      const b = 1 + 0.025 * p.noise(i * 0.3 + ph)
      paper.push({ x: cx + Math.cos(th) * rx * b, y: cy + Math.sin(th) * ry * b })
    }
    pane(paper, w * 0.9)
    // the ribs of the paper: shallow arcs across, seen a little from below
    const ribs = rng.int(3, 5)
    for (let i = 1; i <= ribs; i++) {
      const v = -0.82 + (1.64 * i) / (ribs + 1)
      const half = rx * Math.sqrt(1 - v * v) * 0.97
      const y = cy + v * ry
      const arc: Pt[] = []
      for (let j = 0; j <= 12; j++) {
        const u = j / 12
        arc.push({ x: cx - half + 2 * half * u, y: y + Math.sin(Math.PI * u) * ry * 0.08 })
      }
      line(arc, w * 0.4)
    }
    const cap = (y: number, hw: number) =>
      part(along([{ x: cx - hw, y }, { x: cx - hw, y: y + capH }, { x: cx + hw, y: y + capH }, { x: cx + hw, y }], 4), w * 0.7)
    cap(capY, rx * rng.range(0.5, 0.65))
    const bottom = cy + ry * 0.94
    cap(bottom, rx * rng.range(0.4, 0.55))
    // a short tassel
    const tl = H * rng.range(0.04, 0.07)
    for (let i = -1; i <= 1; i++) line([{ x: cx, y: bottom + capH }, { x: cx + i * tl * 0.12, y: bottom + capH + tl * (1 - Math.abs(i) * 0.2) }], w * 0.35)
    ground(w * 2)
  } else {
    // stone: slab, column, platform, firebox with its window, roof, knob
    const cx = base.x
    let y = base.y
    const s = rng.range(0.92, 1.08) // stockier or slimmer
    const block = (h: number, hb: number, ht: number) => {
      const pts = along([{ x: cx - hb, y }, { x: cx - ht, y: y - h }, { x: cx + ht, y: y - h }, { x: cx + hb, y }], 6)
      part(pts, w * 1.05)
      const b = y
      y -= h
      return b
    }
    const slab = H * rng.range(0.08, 0.11)
    block(slab, H * 0.25 * s, H * 0.23 * s)
    const colH = H * rng.range(0.24, 0.32)
    const colB = block(colH, H * 0.085 * s, H * 0.07 * s)
    block(H * 0.05, H * 0.15 * s, H * 0.19 * s)
    const boxH = H * rng.range(0.18, 0.22)
    const boxB = block(boxH, H * 0.145 * s, H * 0.14 * s)
    // the window (the glass) inside the firebox, arched on top
    const wh = boxH * rng.range(0.52, 0.62)
    const ww = H * 0.075 * s * rng.range(0.85, 1.1)
    const wb = boxB - boxH * 0.2
    pane(along([{ x: cx - ww, y: wb }, { x: cx - ww, y: wb - wh * 0.8 }, { x: cx, y: wb - wh }, { x: cx + ww, y: wb - wh * 0.8 }, { x: cx + ww, y: wb }], 5), w * 0.75)
    // the roof: wide, with its eaves curling up
    const rw = H * rng.range(0.28, 0.33) * s
    const rh = H * rng.range(0.12, 0.15)
    const ey = y
    const lift = H * rng.range(0.03, 0.05)
    const top = { x: cx, y: ey - rh }
    const leftEave = { x: cx - rw, y: ey - lift }
    const rightEave = { x: cx + rw, y: ey - lift }
    const roof = [
      ...bent(leftEave, { x: cx - rw * 0.32, y: top.y + rh * 0.08 }, -0.1, 8),
      { x: cx, y: top.y },
      ...bent({ x: cx + rw * 0.32, y: top.y + rh * 0.08 }, rightEave, -0.1, 8),
      { x: cx + rw * 0.8, y: ey + H * 0.005 },
      { x: cx - rw * 0.8, y: ey + H * 0.005 },
    ]
    part(roof, w * 1.05)
    const r = H * rng.range(0.035, 0.045)
    const knob: Pt[] = []
    for (let i = 0; i < 20; i++) {
      const th = (i / 20) * Math.PI * 2
      const up = Math.sin(th) < 0 ? 1.25 : 1 // a little onion
      knob.push({ x: cx + Math.cos(th) * r, y: top.y - r * 0.85 + Math.sin(th) * r * up })
    }
    part(knob, w * 0.8)
    // the stone's shade: short strokes on the right of the column and the slab
    const marks = rng.int(2, 4)
    for (let i = 0; i < marks; i++) {
      const yy = colB - colH * rng.range(0.2, 0.8)
      const x0 = cx + H * 0.035 * s
      line([{ x: x0, y: yy }, { x: x0 + H * 0.025 * s, y: yy - H * 0.02 }], w * 0.5)
    }
    line([{ x: cx + H * 0.12 * s, y: base.y - slab * 0.35 }, { x: cx + H * 0.2 * s, y: base.y - slab * 0.55 }], w * 0.5)
    ground(H * 0.25 * s)
  }

  const layer = o.layer ?? 'all'
  if (layer === 'fill') return fills.join('')
  if (layer === 'glass') return glass.join('')
  if (layer === 'ink') return inks.join('')
  return fills.join('') + glass.join('') + inks.join('')
}
