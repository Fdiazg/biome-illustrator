// ---------------------------------------------------------------------------
// garden/pieces — loose garden pieces: horizon, grass tuft, stream,
// scribbled sun and crescent moon.
//
// They use the same stroke as the plants (`tapered`, `wobble`, the same noise),
// so the pen pulse is one and the same across the whole scene.
//
// Each function returns inner SVG markup (without `<svg>`) in its own
// coordinates and receives the colors as an argument: the `meadow` subject passes them the
// palette roles, and whoever uses them standalone can pass whatever they want.
// ---------------------------------------------------------------------------

import { clamp, cubicPoint, lerp, num, type Pt } from '../../core/math'
import { makeNoise, type Noise1D } from '../../core/noise'
import { polyline, tapered, withOvershoot, wobble } from '../../core/path'
import { createRng, type Rng } from '../../core/prng'
import { moonMaria } from './details'

/** Randomness + noise: the hand that draws a piece. */
export interface Pen {
  rng: Rng
  noise: Noise1D
}

export const pen = (seed: number): Pen => ({ rng: createRng(seed), noise: makeNoise(seed) })

/** Pen pressure: enters thin, settles, leaves thin; with a soft pulse. */
const pressure = (noise: Noise1D, phase: number, attack = 0.35) => (t: number) =>
  Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), attack) * (1 + 0.14 * noise(t * 5 + phase))

const fillPath = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`

// ---------------------------------------------------------------------------
// Horizon: a single long wavy line, in three strokes that overlap
// where the hand lifted the pen. `y(x)` answers where the ground is, to
// stand plants on top.
// ---------------------------------------------------------------------------

export interface Horizon {
  /** y of the ground at x */
  y(x: number): number
  /** markup of the line */
  body(ink: string, weight?: number): string
}

export function horizon(seed: number, width: number, baseY: number, amplitude = 1): Horizon {
  const { rng, noise } = pen(seed)
  const n2 = makeNoise(seed + 17)
  const k = width / 1600
  const y = (x: number) =>
    baseY +
    amplitude * (10 * n2(x / (560 * k) + 3.1) + 3.2 * n2(x / (150 * k) + 8.4) + 0.6 * n2(x / 37 + 1.7))

  // cuts where the pen lifts
  const cuts = [-12, width * rng.range(0.34, 0.4), width * rng.range(0.7, 0.76), width + 12]
  const spans: { pts: Pt[]; s: number }[] = []
  for (let s = 0; s < cuts.length - 1; s++) {
    const a = cuts[s] - (s > 0 ? rng.range(10, 18) : 0)
    const b = cuts[s + 1] + (s < cuts.length - 2 ? rng.range(4, 9) : 0)
    const lift = rng.range(-1.1, 1.1)
    const pts: Pt[] = []
    const n = Math.ceil((b - a) / 6)
    for (let i = 0; i <= n; i++) {
      const x = lerp(a, b, i / n)
      pts.push({ x, y: y(x) + lift * Math.sin((Math.PI * i) / n) })
    }
    spans.push({ pts: wobble(pts, 0.5, noise, 0.21, s * 9.1), s })
  }
  return {
    y,
    body: (ink, weight = 2.5) =>
      spans
        .map(({ pts, s }) => {
          const press = pressure(noise, s * 3.3, 0.22)
          return fillPath(tapered(pts, (t) => weight * (0.18 + 0.82 * press(t))), ink)
        })
        .join(''),
  }
}

// ---------------------------------------------------------------------------
// Grass: a tuft of thin leaves springing from a point.
// ---------------------------------------------------------------------------

export function tuft(p: Pen, base: Pt, height: number, blades: number, ink: string, tint?: string): string {
  const { rng, noise } = p
  let out = ''
  for (let i = 0; i < blades; i++) {
    const k = blades === 1 ? 0 : i / (blades - 1) - 0.5
    const lean = k * 1.25 + rng.range(-0.18, 0.18)
    const len = height * rng.range(0.55, 1) * (1 - Math.abs(k) * 0.35)
    const b = { x: base.x + k * 4 + rng.range(-1, 1), y: base.y + 0.6 }
    const tip = { x: b.x + Math.sin(lean) * len * 1.05, y: b.y - Math.cos(lean) * len }
    const c1 = { x: b.x + Math.sin(lean * 0.3) * len * 0.4, y: b.y - len * 0.45 }
    const c2 = { x: lerp(c1.x, tip.x, 0.6) + rng.range(-1.5, 1.5), y: lerp(c1.y, tip.y, 0.5) }
    const pts: Pt[] = []
    for (let j = 0; j <= 14; j++) pts.push(cubicPoint(b, c1, c2, tip, j / 14))
    const w = wobble(pts, 0.25, noise, 0.5, i * 4.7 + base.x)
    const d = tapered(w, (t) => (1.1 + height * 0.018) * Math.pow(1 - t, 0.85) + 0.1)
    out += fillPath(d, tint && rng.chance(0.3) ? tint : ink)
  }
  return out
}

// ---------------------------------------------------------------------------
// Stream: it starts at the horizon and goes down to one side, widening. Two
// thin banks, misregistered colored water and a few ripples. It fades
// downward with a mask: it has no edge.
// ---------------------------------------------------------------------------

export interface StreamOptions {
  /** unique id for the mask */
  id: string
  /** x where it starts, on the horizon */
  x0: number
  /** y where it ends (bottom edge) */
  bottom: number
  /** 1 goes down to the left, -1 to the right */
  dir?: 1 | -1
  /** horizontal scale of the curves (1 = that of the 1600 band) */
  spread?: number
  registration?: Pt
}

export function stream(
  p: Pen,
  hy: (x: number) => number,
  o: StreamOptions,
  ink: string,
  water: string,
): { defs: string; body: string } {
  const { rng, noise } = p
  const { x0, bottom } = o
  const top = hy(x0) + 3
  // the curves of the draft are ~120 tall and go down to the left
  const v = (bottom - top) / 120
  const sx = (o.dir ?? 1) * (o.spread ?? 1)
  const Q = (dx: number, dy: number): Pt => ({ x: x0 + dx * sx, y: top + dy * v })
  // each bank: two chained cubics, S-shaped, that open downward
  const bank = (a: Pt[], b: Pt[]) => {
    const out: Pt[] = []
    for (let i = 0; i <= 20; i++) out.push(cubicPoint(a[0], a[1], a[2], a[3], i / 20))
    for (let i = 1; i <= 20; i++) out.push(cubicPoint(b[0], b[1], b[2], b[3], i / 20))
    return out
  }
  const L = bank(
    [Q(-3, 0), Q(-9, 22), Q(8, 40), Q(-30, 58)],
    [Q(-30, 58), Q(-78, 80), Q(-150, 96), Q(-178, 114)],
  )
  const R = bank(
    [Q(4, 0), Q(7, 24), Q(38, 44), Q(6, 66)],
    [Q(6, 66), Q(-30, 92), Q(-70, 104), Q(-84, 122)],
  )

  const uid = o.id
  const defs =
    `<linearGradient id="${uid}-g" x1="0" y1="${num(top)}" x2="0" y2="${num(bottom)}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#fff"/><stop offset="0.62" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="${uid}-m" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="30000" height="30000"><rect x="-10000" y="-10000" width="30000" height="30000" fill="url(#${uid}-g)"/></mask>`

  const reg = o.registration ?? { x: 4, y: 2.5 }
  let body = `<g mask="url(#${uid}-m)">`
  // water: polygon between banks, slightly shifted (imperfect registration)
  body += `<path d="${polyline([...L, ...R.slice().reverse()], true)}" fill="${water}" opacity="0.32" transform="translate(${num(reg.x)} ${num(reg.y)})"/>`

  // banks: each in two strokes, with a gap where the hand skipped
  for (const [bi, side] of [L, R].entries()) {
    const cut = Math.floor(side.length * rng.range(0.42, 0.55))
    const parts = [side.slice(0, cut), side.slice(cut + 2)]
    for (const [pi, part] of parts.entries()) {
      if (part.length < 3) continue
      const w = wobble(part, 0.45, noise, 0.3, bi * 5 + pi * 2)
      const startW = pi === 0 ? 0.35 : 0.9
      body += fillPath(
        tapered(w, (t) => (startW + (1.7 - startW) * t) * Math.pow(Math.sin(Math.PI * clamp(t * 0.92 + 0.04, 0, 1)), 0.3)),
        ink,
      )
    }
  }

  // ripples: short dashes, shorter near the horizon
  const ripples = 5
  for (let i = 0; i < ripples; i++) {
    const t = 0.25 + (i / (ripples - 1)) * 0.68 + rng.range(-0.03, 0.03)
    const a = L[Math.round(t * 40)]
    const b = R[Math.round(t * 40)]
    const mid = lerp(0.3, 0.6, rng.next())
    const len = 0.28 + 0.2 * t
    const s = { x: lerp(a.x, b.x, mid - len / 2), y: lerp(a.y, b.y, mid - len / 2) }
    const e = { x: lerp(a.x, b.x, mid + len / 2), y: lerp(a.y, b.y, mid + len / 2) }
    const pts: Pt[] = []
    for (let j = 0; j <= 10; j++) {
      const u = j / 10
      pts.push({ x: lerp(s.x, e.x, u), y: lerp(s.y, e.y, u) + Math.sin(u * Math.PI * 2 + i) * (0.8 + t) })
    }
    body += fillPath(tapered(pts, (u) => (0.5 + 0.7 * t) * Math.sin(Math.PI * u)), ink)
  }
  body += '</g>'
  return { defs, body }
}

// ---------------------------------------------------------------------------
// Sun: a scribbled loop (more than one turn, with overshoot) over a disc
// of shifted color, and optional short rays.
// ---------------------------------------------------------------------------

function loop(p: Pen, c: Pt, R: number, turns: number, start: number): Pt[] {
  const { noise, rng } = p
  const pts: Pt[] = []
  const N = Math.round(90 * turns)
  const drift = { x: rng.range(-2, 2), y: rng.range(-2, 2) }
  for (let i = 0; i <= N; i++) {
    const u = i / N
    const th = start + u * Math.PI * 2 * turns
    const r = R * (1 + 0.07 * noise(th * 0.8 + 3) - 0.06 * u)
    pts.push({ x: c.x + Math.cos(th) * r + drift.x * u, y: c.y + Math.sin(th) * r * 0.97 + drift.y * u })
  }
  return pts
}

/** Sun centered at `c` with radius `R` (the disc; the rays go outside). */
export function sun(p: Pen, c: Pt, R: number, ink: string, fill: string, rays = true): string {
  const { rng, noise } = p
  const k = R / 41.6 // the draft drew a sun of 160 with R = 41.6
  const disc: Pt[] = []
  for (let i = 0; i <= 64; i++) {
    const th = (i / 64) * Math.PI * 2
    const r = R * 0.94 * (1 + 0.035 * noise(th * 1.3 + 11))
    disc.push({ x: c.x + 4 * k + Math.cos(th) * r, y: c.y + 3.5 * k + Math.sin(th) * r })
  }
  let out = `<path d="${polyline(disc, true)}" fill="${fill}"/>`
  const line = withOvershoot(loop(p, c, R, 1.18, rng.range(0, Math.PI * 2)), 6 * k, 0.6)
  const press = pressure(noise, 4.2, 0.25)
  out += fillPath(tapered(wobble(line, 0.4 * k, noise, 0.25, 2), (t) => 2.2 * Math.sqrt(k) * (0.25 + 0.75 * press(t))), ink)
  if (rays) {
    const n = 9
    const off = rng.range(0, 1)
    const size = R / 0.26
    for (let i = 0; i < n; i++) {
      if (rng.chance(0.12)) continue
      const th = ((i + off + rng.range(-0.15, 0.15)) / n) * Math.PI * 2
      const r0 = R + size * rng.range(0.07, 0.09)
      const r1 = r0 + size * rng.range(0.06, 0.1)
      const a = { x: c.x + Math.cos(th) * r0, y: c.y + Math.sin(th) * r0 }
      const b = { x: c.x + Math.cos(th + 0.04) * r1, y: c.y + Math.sin(th + 0.04) * r1 }
      const pts = [0, 0.25, 0.5, 0.75, 1].map((u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) }))
      out += fillPath(tapered(pts, (u) => 1.6 * Math.sqrt(k) * Math.sin(Math.PI * (0.1 + u * 0.8))), ink)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Moon: crescent in a single stroke (outer arc, inner arc) with the
// shifted fill.
// ---------------------------------------------------------------------------

/** A moon with a real phase instead of the fixed crescent (opt-in). */
export interface MoonOptions {
  /** lunar phase 0..1: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. Seen from the north: waxing is lit on the right */
  phase: number
  /** fill of the unlit disc. Default `fill` */
  dark?: string
  /** opacity of the unlit disc fill. Default 0.12 */
  darkOpacity?: number
  /** opacity of the thin ink rim along the unlit limb. Default 0.45 */
  rimOpacity?: number
  /** tilt of the moon, radians. Default -0.3 */
  tilt?: number
  /** a few flat patches (the maria) inside the lit part. Default false */
  maria?: boolean
  /** color of the maria. Default `ink` */
  mariaColor?: string
  /** opacity of the maria. Default 0.12 */
  mariaOpacity?: number
}

export function moon(p: Pen, c: Pt, R: number, ink: string, fill: string, opts?: MoonOptions): string {
  if (opts) return phasedMoon(p, c, R, ink, fill, opts)
  const { noise } = p
  const k = R / 40
  // inner circle: center (kk·R, 0), radius q·R
  const kk = 0.4
  const q = 0.88
  const ix = (1 + kk * kk - q * q) / (2 * kk)
  const iy = Math.sqrt(Math.max(0, 1 - ix * ix))
  const tOut = Math.atan2(iy, ix)
  const tIn = Math.atan2(iy, ix - kk)
  const rot = -0.45
  const at = (x: number, y: number): Pt => ({
    x: c.x + (x * Math.cos(rot) - y * Math.sin(rot)) * R,
    y: c.y + (x * Math.sin(rot) + y * Math.cos(rot)) * R,
  })
  const pts: Pt[] = []
  const N = 60
  for (let i = 0; i <= N; i++) {
    const th = tOut + (i / N) * (Math.PI * 2 - 2 * tOut)
    const r = 1 + 0.04 * noise(th + 2)
    pts.push(at(Math.cos(th) * r, Math.sin(th) * r))
  }
  for (let i = 0; i <= N; i++) {
    const th = Math.PI * 2 - tIn - (i / N) * (Math.PI * 2 - 2 * tIn)
    pts.push(at(kk + Math.cos(th) * q, Math.sin(th) * q))
  }
  let out = `<path d="${polyline(pts, true)}" fill="${fill}" transform="translate(${num(3.5 * k)} ${num(3 * k)})"/>`
  const line = withOvershoot(pts, 2.5 * k, 0.4)
  const press = pressure(noise, 1.7, 0.2)
  out += fillPath(tapered(wobble(line, 0.35 * k, noise, 0.25, 5), (t) => 2 * Math.sqrt(k) * (0.3 + 0.7 * press(t))), ink)
  return out
}

// ---------------------------------------------------------------------------
// Moon with a phase: the lit part is bounded by the limb (half circle) and
// the terminator (half ellipse of semi-axis |cos 2πφ|). The unlit disc stays
// a shape: a breath of fill and a thin, pale rim. The lit part gets the same
// shifted fill and single pen stroke as the crescent.
// ---------------------------------------------------------------------------

function phasedMoon(p: Pen, c: Pt, R: number, ink: string, fill: string, o: MoonOptions): string {
  const { noise } = p
  const k = R / 40
  const phase = ((o.phase % 1) + 1) % 1
  const side = phase <= 0.5 ? 1 : -1 // waxing: lit on the right
  const cosP = Math.cos(phase * Math.PI * 2)
  const lit = (1 - cosP) / 2 // illuminated fraction
  const tilt = o.tilt ?? -0.3
  const at = (x: number, y: number): Pt => ({
    x: c.x + (x * Math.cos(tilt) - y * Math.sin(tilt)) * R,
    y: c.y + (x * Math.sin(tilt) + y * Math.cos(tilt)) * R,
  })
  // a periodic hand-drawn radius, so the limb closes on itself
  const rr = (a: number) => 1 + 0.03 * noise(2 + 1.1 * Math.cos(a)) + 0.02 * noise(7 + 1.1 * Math.sin(a))
  const limb = (a: number): Pt => at(Math.cos(a) * rr(a), Math.sin(a) * rr(a))
  const N = 60
  const shift = `transform="translate(${num(3.5 * k)} ${num(3 * k)})"`
  const press = pressure(noise, 1.7, 0.2)

  // the whole disc, barely there
  const disc: Pt[] = []
  for (let i = 0; i <= 2 * N; i++) disc.push(limb((i / (2 * N)) * Math.PI * 2))
  let out = `<path d="${polyline(disc, true)}" fill="${o.dark ?? fill}" fill-opacity="${num(o.darkOpacity ?? 0.12)}" ${shift}/>`

  // lit outline: limb from the top tip to the bottom one, terminator back
  const a0 = side > 0 ? -Math.PI / 2 : Math.PI * 1.5
  const shape: Pt[] = []
  if (lit > 0.015) {
    for (let i = 0; i <= N; i++) shape.push(limb(a0 + side * (i / N) * Math.PI))
    for (let i = 0; i <= N; i++) {
      const th = Math.PI / 2 - (i / N) * Math.PI // +π/2 (bottom) → -π/2 (top)
      const a = side > 0 ? th : Math.PI - th
      const r = rr(a)
      shape.push(at(side * cosP * Math.cos(th) * r, Math.sin(th) * r))
    }
    out += `<path d="${polyline(shape, true)}" fill="${fill}" ${shift}/>`
    if (o.maria) out += moonMaria(p, c, R, shape, o.mariaColor ?? ink, o.mariaOpacity ?? 0.12, ` ${shift}`)
  }

  // the unlit limb: a thin pale line, the whole circle at new moon
  if (lit < 0.99) {
    const rim: Pt[] = []
    const from = lit > 0.015 ? a0 + side * Math.PI : 0
    const span = lit > 0.015 ? Math.PI : Math.PI * 2
    for (let i = 0; i <= N; i++) rim.push(limb(from + side * (i / N) * span))
    const rimLine = withOvershoot(rim, 1.5 * k, 0.3)
    out += fillPath(
      tapered(wobble(rimLine, 0.3 * k, noise, 0.25, 9), (t) => 1.1 * Math.sqrt(k) * (0.3 + 0.7 * press(t))),
      ink,
      ` opacity="${num(o.rimOpacity ?? 0.45)}"`,
    )
  }

  if (shape.length) {
    const line = withOvershoot(shape, 2.5 * k, 0.4)
    out += fillPath(tapered(wobble(line, 0.35 * k, noise, 0.25, 5), (t) => 2 * Math.sqrt(k) * (0.3 + 0.7 * press(t))), ink)
  }
  return out
}
