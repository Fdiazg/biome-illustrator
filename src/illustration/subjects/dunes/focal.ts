// ---------------------------------------------------------------------------
// dunes/focal — what gives scale.
//
// A landscape of bands with nothing on top is an area chart. A small
// object, resting on a middle hill, is enough for the bands to turn into
// distance: the house is 20 px and that is why the hill behind it is huge.
//
// Everything is drawn like the rest of the engine: flat fill shifted by the
// registration, and on top the ink line with variable width.
// ---------------------------------------------------------------------------

import { lerp, num, type Pt } from '../../core/math'
import type { Noise1D } from '../../core/noise'
import { polyline, tapered, withOvershoot, wobble } from '../../core/path'
import type { Rng } from '../../core/prng'

export interface Ink {
  /** ink of the lines */
  line: string
  /** offset of the fill relative to the line */
  reg: number
  noise: Noise1D
}

const shift = (reg: number) =>
  reg ? ` transform="translate(${num(reg)} ${num(reg * 0.6)})"` : ''

/** Flat fill, shifted by the registration. */
export const flat = (d: string, fill: string, reg: number) =>
  `<path d="${d}" fill="${fill}"${shift(reg)}/>`

/** Ink outline of a closed polygon, with pen overshoot. */
export function outline(poly: Pt[], width: number, ink: Ink, phase: number): string {
  const loop = [...poly, poly[0]]
  // densify: the pulse needs points to be noticeable
  const dense: Pt[] = []
  for (let i = 0; i < loop.length - 1; i++) {
    const a = loop[i]
    const b = loop[i + 1]
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4))
    for (let k = 0; k < n; k++) dense.push({ x: lerp(a.x, b.x, k / n), y: lerp(a.y, b.y, k / n) })
  }
  dense.push(loop[loop.length - 1])
  const pts = withOvershoot(wobble(dense, width * 0.3, ink.noise, 0.3, phase), width * 2.2, 0.3)
  return tapered(pts, (t) => width * (0.45 + 0.55 * Math.pow(Math.sin(Math.PI * t), 0.3)))
}

/** Disc with pulse: sun, moon, tree crown. */
export function blob(c: Pt, rx: number, ry: number, ink: Ink, phase: number, lobes = 0): Pt[] {
  const n = 48
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const k =
      1 +
      0.035 * ink.noise(i * 0.35 + phase) +
      (lobes ? 0.07 * Math.max(0, Math.sin(a * lobes + phase)) : 0)
    return { x: c.x + Math.cos(a) * rx * k, y: c.y + Math.sin(a) * ry * k }
  })
}

// --- sky -----------------------------------------------------------------

export function sun(
  c: Pt,
  r: number,
  fill: string,
  ink: Ink,
  rng: Rng,
  rim: boolean,
  marks: string,
): string {
  const disc = blob(c, r, r, ink, 5)
  let out = flat(polyline(disc, true), fill, ink.reg)
  if (rim) {
    // loose ring: the pen goes all the way around and overshoots a little
    const start = rng.int(0, disc.length - 1)
    const ring = [...disc.slice(start), ...disc.slice(0, start)]
    out += `<path d="${outline(ring.slice(0, -1), Math.max(1, r * 0.04), ink, 3)}" fill="${ink.line}"/>`
  }
  // lunar maria: three or four soft blots, never aligned
  if (marks) {
    let d = ''
    const n = rng.int(3, 4)
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2)
      const rr = r * rng.range(0.1, 0.55)
      const m = r * rng.range(0.07, 0.15)
      const spot = blob(
        { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr },
        m * rng.range(1, 1.5),
        m,
        ink,
        11 + i * 3,
        3,
      )
      d += polyline(spot, true)
    }
    out += `<path d="${d}" fill="${marks}"/>`
  }
  return out
}

/** Flock: each bird is a single brushstroke shaped like a gull. */
export function birds(c: Pt, count: number, size: number, fill: string, rng: Rng): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const s = size * rng.range(0.6, 1.15)
    const x = c.x + rng.gauss(0, size * 3.2)
    const y = c.y + rng.gauss(0, size * 1.4)
    const lift = rng.range(0.25, 0.55)
    const pts: Pt[] = [
      { x: x - s, y: y - s * lift },
      { x: x - s * 0.45, y: y - s * lift * 0.9 },
      { x, y },
      { x: x + s * 0.5, y: y - s * lift * 1.05 },
      { x: x + s * 1.05, y: y - s * lift * 0.95 },
    ]
    d += tapered(pts, (t) => Math.max(0.7, s * 0.16) * (0.25 + 0.75 * (1 - Math.abs(2 * t - 1))))
  }
  return `<path d="${d}" fill="${fill}"/>`
}

/** Stars for the night palette: minimal crosses. */
export function stars(W: number, top: number, bottom: number, count: number, fill: string, rng: Rng): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const x = rng.range(8, W - 8)
    const y = rng.range(top, bottom)
    const s = rng.range(1.2, 2.8)
    d += tapered([{ x: x - s, y }, { x, y }, { x: x + s, y }], (t) => 0.9 * Math.sin(Math.PI * t))
    d += tapered([{ x, y: y - s }, { x, y }, { x, y: y + s }], (t) => 0.9 * Math.sin(Math.PI * t))
  }
  return `<path d="${d}" fill="${fill}"/>`
}

/** Strata: long, thin brushstrokes, the sky of a Japanese print. */
export function streaks(
  W: number,
  top: number,
  bottom: number,
  count: number,
  fill: string,
  rng: Rng,
  noise: Noise1D,
): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const L = W * rng.range(0.14, 0.34)
    const x0 = rng.range(-L * 0.2, W - L * 0.8)
    const y0 = lerp(top, bottom, (i + rng.range(0.1, 0.9)) / count)
    const pair = rng.chance(0.55) ? 2 : 1
    for (let p = 0; p < pair; p++) {
      const LL = L * (p ? rng.range(0.4, 0.7) : 1)
      const xx = x0 + (p ? rng.range(0.1, 0.4) * L : 0)
      const yy = y0 + p * rng.range(5, 9)
      const n = Math.max(4, Math.round(LL / 14))
      const pts: Pt[] = Array.from({ length: n + 1 }, (_, k) => ({
        x: xx + (LL * k) / n,
        y: yy + noise(k * 0.4 + i * 3 + p) * 1.6,
      }))
      const w = rng.range(1.6, 3.4) * (p ? 0.7 : 1)
      d += tapered(pts, (t) => w * Math.pow(Math.sin(Math.PI * t), 0.7))
    }
  }
  return `<path d="${d}" fill="${fill}"/>`
}

// --- objects resting on a hill ---------------------------------------------

export interface HouseTones {
  face: string
  side: string
  roof: string
  hole: string
}

/** Gabled house seen from three quarters: front, side and roof. */
export function house(base: Pt, h: number, tones: HouseTones, ink: Ink, rng: Rng): string {
  const flip = rng.chance(0.5) ? -1 : 1
  const w1 = h * rng.range(0.62, 0.78)
  const w2 = h * rng.range(0.8, 1.25)
  const wh = h * rng.range(0.5, 0.6)
  const eave = h * 0.08
  const total = w1 + w2
  const X = (x: number) => base.x + flip * (x - total / 2)
  const by = base.y

  const face: Pt[] = [
    { x: X(0), y: by },
    { x: X(0), y: by - wh },
    { x: X(w1 / 2), y: by - h },
    { x: X(w1), y: by - wh },
    { x: X(w1), y: by },
  ]
  const side: Pt[] = [
    { x: X(w1), y: by - wh },
    { x: X(w1 + w2), y: by - wh },
    { x: X(w1 + w2), y: by },
    { x: X(w1), y: by },
  ]
  const roof: Pt[] = [
    { x: X(w1 / 2), y: by - h },
    { x: X(w1 / 2 + w2), y: by - h },
    { x: X(w1 + w2 + eave), y: by - wh + eave * 0.5 },
    { x: X(w1 + eave * 0.4), y: by - wh + eave * 0.5 },
  ]
  const door: Pt[] = [
    { x: X(w1 * 0.36), y: by },
    { x: X(w1 * 0.36), y: by - wh * 0.62 },
    { x: X(w1 * 0.64), y: by - wh * 0.62 },
    { x: X(w1 * 0.64), y: by },
  ]
  const wx = w1 + w2 * rng.range(0.3, 0.55)
  const ws = Math.max(2.2, h * 0.14)
  const win: Pt[] = [
    { x: X(wx), y: by - wh * 0.68 },
    { x: X(wx + ws), y: by - wh * 0.68 },
    { x: X(wx + ws), y: by - wh * 0.68 + ws },
    { x: X(wx), y: by - wh * 0.68 + ws },
  ]

  const lw = Math.max(0.7, h * 0.045)
  return (
    flat(polyline(side, true), tones.side, ink.reg) +
    flat(polyline(face, true), tones.face, ink.reg) +
    flat(polyline(roof, true), tones.roof, ink.reg) +
    `<path d="${polyline(door, true)}${polyline(win, true)}" fill="${tones.hole}"/>` +
    `<path d="${outline(face, lw, ink, 1)}${outline(roof, lw, ink, 2)}${outline(side, lw * 0.8, ink, 4)}" fill="${ink.line}"/>`
  )
}

/** Single tree: round crown or cypress, with a trunk and a few light marks. */
export function tree(
  base: Pt,
  h: number,
  crown: string,
  light: string,
  ink: Ink,
  rng: Rng,
  phase: number,
): string {
  const cypress = rng.chance(0.4)
  const trunkH = h * (cypress ? 0.18 : 0.42)
  const lean = rng.range(-0.06, 0.06) * h
  const trunk: Pt[] = [
    base,
    { x: base.x + lean * 0.4, y: base.y - trunkH * 0.5 },
    { x: base.x + lean, y: base.y - trunkH },
  ]
  const top = { x: base.x + lean, y: base.y - trunkH }
  const rx = h * (cypress ? 0.17 : rng.range(0.28, 0.36))
  const ry = (h - trunkH) * (cypress ? 0.55 : 0.52)
  const c = { x: top.x, y: top.y - ry * (cypress ? 0.95 : 0.8) }

  let shape: Pt[]
  if (cypress) {
    // flame: wide at the bottom, point at the top
    shape = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * Math.PI * 2
      const s = Math.sin(a)
      const taper = s < 0 ? 1 + s * 0.55 : 1
      const k = 1 + 0.05 * ink.noise(i * 0.5 + phase)
      return { x: c.x + Math.cos(a) * rx * taper * k, y: c.y + s * ry * k }
    })
  } else {
    shape = blob(c, rx, ry, ink, phase, rng.int(4, 7))
  }

  const lw = Math.max(0.8, h * 0.035)
  let marks = ''
  const n = Math.round(h / 4)
  for (let i = 0; i < n; i++) {
    const a = rng.range(Math.PI * 1.05, Math.PI * 1.75)
    const rr = rng.range(0.3, 0.8)
    const x = c.x + Math.cos(a) * rx * rr
    const y = c.y + Math.sin(a) * ry * rr
    const L = h * rng.range(0.05, 0.1)
    marks += tapered(
      [
        { x, y },
        { x: x + L * 0.5, y: y - L * 0.25 },
        { x: x + L, y: y - L * 0.15 },
      ],
      (t) => lw * 0.9 * Math.sin(Math.PI * t),
    )
  }
  return (
    `<path d="${tapered(trunk, (t) => lw * 2.2 * (1 - 0.55 * t))}" fill="${ink.line}"/>` +
    flat(polyline(shape, true), crown, ink.reg) +
    `<path d="${marks}" fill="${light}"/>` +
    `<path d="${outline(shape, lw, ink, phase)}" fill="${ink.line}"/>`
  )
}

/** Boat with a sail, resting on the water, and its reflection in dashes. */
export function boat(base: Pt, h: number, hull: string, sail: string, ink: Ink, rng: Rng): string {
  const flip = rng.chance(0.5) ? -1 : 1
  const L = h * rng.range(1.1, 1.4)
  const d = h * 0.2
  const X = (x: number) => base.x + flip * x
  const by = base.y
  const hullPts: Pt[] = [
    { x: X(-L / 2), y: by - d },
    { x: X(L / 2 + h * 0.08), y: by - d * 1.15 },
    { x: X(L * 0.32), y: by },
    { x: X(-L * 0.38), y: by },
  ]
  const mx = X(-L * 0.05)
  const mastTop = { x: mx, y: by - d - h * 0.95 }
  const sailPts: Pt[] = [
    { x: mx + flip * h * 0.04, y: mastTop.y + h * 0.06 },
    { x: mx + flip * L * 0.42, y: by - d - h * 0.1 },
    { x: mx + flip * h * 0.04, y: by - d - h * 0.1 },
  ]
  const jib: Pt[] = [
    { x: mx - flip * h * 0.04, y: mastTop.y + h * 0.2 },
    { x: mx - flip * h * 0.04, y: by - d - h * 0.12 },
    { x: mx - flip * L * 0.3, y: by - d - h * 0.12 },
  ]
  const lw = Math.max(0.7, h * 0.04)
  let refl = ''
  for (let i = 0; i < 4; i++) {
    const y = by + 2 + i * h * 0.1
    const ww = L * (0.75 - i * 0.14) * rng.range(0.8, 1.1)
    const x = base.x + rng.range(-2, 2)
    refl += tapered(
      [
        { x: x - ww / 2, y },
        { x, y: y + 0.4 },
        { x: x + ww / 2, y },
      ],
      (t) => lw * 1.1 * Math.sin(Math.PI * t),
    )
  }
  return (
    flat(polyline(sailPts, true), sail, ink.reg) +
    flat(polyline(jib, true), sail, ink.reg) +
    flat(polyline(hullPts, true), hull, ink.reg) +
    `<path d="${tapered([{ x: mx, y: by - d }, mastTop], (t) => lw * 1.5 * (1 - 0.5 * t))}${outline(hullPts, lw, ink, 7)}${outline(sailPts, lw * 0.8, ink, 8)}${refl}" fill="${ink.line}"/>`
  )
}

/**
 * Stretch of road: a ribbon that climbs the face of a hill and narrows
 * with distance. Each stretch lives in its band, so the hill in front
 * covers it and the road disappears and reappears.
 */
export function pathRibbon(a: Pt, wa: number, b: Pt, wb: number): { body: Pt[]; left: Pt[]; right: Pt[] } {
  const n = 14
  const h = b.y - a.y
  const left: Pt[] = []
  const right: Pt[] = []
  const center: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = t * t * (3 - 2 * t)
    // it climbs straight and turns at the top: the road follows the slope
    center.push({ x: lerp(a.x, b.x, u), y: a.y + h * t })
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const w = lerp(wa, wb, t) / 2
    const p = center[i]
    const q = center[Math.min(n, i + 1)]
    const o = center[Math.max(0, i - 1)]
    const dx = q.x - o.x
    const dy = q.y - o.y
    const l = Math.hypot(dx, dy) || 1
    left.push({ x: p.x - (dy / l) * w, y: p.y + (dx / l) * w })
    right.push({ x: p.x + (dy / l) * w, y: p.y - (dx / l) * w })
  }
  return { body: [...left, ...right.slice().reverse()], left, right }
}
