// ---------------------------------------------------------------------------
// sky/compose — the same engraving, another subject.
//
// A cloud is a chain of domes cut by a scalloped base, with tails
// that leave the sides and taper to a point. The line does not just
// outline the union: each dome carries hatching that follows its edge, some
// valleys continue the scallop inward and the belly carries loops ("∩", "C",
// "@") with their own shadow. That is what makes it an engraving and not an icon.
//
// The plate is a sheet of clouds: different sizes,
// air between them, none cut off by the edge.
// ---------------------------------------------------------------------------

import { num, type Pt } from '../../core/math'
import { polyline, tapered, wobble, type BBox } from '../../core/path'
import type { Rng } from '../../core/prng'
import type { ComposeCtx, ComposeResult } from '../types'
import { SKY } from './config'
import { arcPts, mirrorX, openPath, resample, simplify } from './geometry'

const TAU = Math.PI * 2

interface Dome {
  x: number
  y: number
  r: number
}

interface Tail {
  /** -1 left, 1 right */
  side: -1 | 1
  /** height of the axis of the tail (the base is at y=0) */
  y: number
  /** x where it starts, hidden inside the body */
  root: number
  /** x of the tip */
  tip: number
  thick: number
  /** how much the tip rises (negative) or drops */
  bend: number
}

type CurlKind = 'hook' | 'arc' | 'spiral'

interface Curl {
  x: number
  y: number
  r: number
  kind: CurlKind
  /** mirror: the hook falls to the left */
  flip: boolean
}

interface Scallop {
  a: number
  b: number
  sag: number
}

/** Rounded lower corner: the base rises in a quarter ellipse up to the end. */
interface Corner {
  x: number
  side: -1 | 1
  reach: number
  lift: number
}

interface CloudPlan {
  domes: Dome[]
  corners: Corner[]
  tails: Tail[]
  curls: Curl[]
  scallops: Scallop[]
  /** y of the base */
  base: number
  x0: number
  x1: number
  w: number
  h: number
  /** box including tails */
  box: BBox
}

// --- envelopes --------------------------------------------------------------

/** Upper edge of the union of domes at x. */
function topAt(x: number, domes: Dome[]): number {
  let top = Infinity
  for (const d of domes) {
    const dx = x - d.x
    if (Math.abs(dx) >= d.r) continue
    const y = d.y - Math.sqrt(d.r * d.r - dx * dx)
    if (y < top) top = y
  }
  return top
}

/** Lower edge of the union of domes at x (before the cut of the base). */
function lowAt(x: number, domes: Dome[]): number {
  let low = -Infinity
  for (const d of domes) {
    const dx = x - d.x
    if (Math.abs(dx) >= d.r) continue
    const y = d.y + Math.sqrt(d.r * d.r - dx * dx)
    if (y > low) low = y
  }
  return low
}

/** Scallop of the base: small bellies pointing down, joined at peaks. */
function baseAt(x: number, plan: CloudPlan): number {
  for (const s of plan.scallops) {
    if (x < s.a || x > s.b) continue
    const u = (x - s.a) / (s.b - s.a)
    return cornerAt(x, plan, plan.base + s.sag * Math.pow(Math.sin(Math.PI * u), 0.5))
  }
  return cornerAt(x, plan, plan.base)
}

function cornerAt(x: number, plan: CloudPlan, y: number): number {
  for (const c of plan.corners) {
    // u = 0 at the end, 1 where the corner is already base
    const u = ((x - c.x) * -c.side) / c.reach
    if (u < 0 || u > 1) continue
    const v = 1 - u
    y = Math.min(y, plan.base - c.lift + c.lift * Math.sqrt(Math.max(0, 1 - v * v)))
  }
  return y
}

function bottomAt(x: number, plan: CloudPlan): number {
  return Math.min(baseAt(x, plan), lowAt(x, plan.domes))
}

/**
 * Samples a function y(x) with an adaptive step: fine where the slope is
 * vertical (the sides of the domes), coarse where it is flat.
 */
function sampleEdge(f: (x: number) => number, xa: number, xb: number): Pt[] {
  const dir = Math.sign(xb - xa) || 1
  const out: Pt[] = []
  let x = xa
  let prev = f(x)
  out.push({ x, y: prev })
  let step = 0.05
  let guard = 0
  while ((xb - x) * dir > 0 && guard++ < 20000) {
    x += step * dir
    if ((xb - x) * dir < 0) x = xb
    const y = f(x)
    const slope = Math.abs(y - prev) / step
    out.push({ x, y })
    prev = y
    step = Math.min(1.5, Math.max(0.02, 1.2 / (1 + slope)))
  }
  return out
}

// --- plan of a cloud ------------------------------------------------------

function planCloud(rng: Rng, w: number): CloudPlan {
  const cfg = SKY
  const n = rng.int(cfg.domes[0], cfg.domes[1])
  const peak = rng.range(0.28, 0.72)

  // domes in free units; later they are scaled to the requested width
  const raw: Dome[] = []
  const hfs: number[] = []
  let x = 0
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const hf = Math.exp(-(((t - peak) / 0.3) ** 2))
    const r = (0.38 + 0.62 * hf) * rng.range(0.85, 1.12)
    if (i > 0) x += (raw[i - 1].r + r) * rng.range(cfg.spacing[0], cfg.spacing[1])
    raw.push({ x, y: 0, r })
    hfs.push(hf)
  }
  // the height comes from the width: the reference is around 2.2 to 3 widths per height
  const span = raw[n - 1].x + raw[n - 1].r - (raw[0].x - raw[0].r)
  const tall = span * rng.range(cfg.aspect[0], cfg.aspect[1])
  for (let i = 0; i < n; i++) {
    const d = raw[i]
    const topH = tall * (0.36 + 0.64 * hfs[i]) * rng.range(0.92, 1.06)
    // a dome does not float: its center stays less than one radius above the base
    if (topH > d.r * 1.9) d.r = topH / 1.9
    d.y = d.r - topH
    // the ones at the ends stay above the base: the corner is rounded
    if (i === 0 || i === n - 1) d.y = Math.min(d.y, -d.r * rng.range(0.22, 0.42))
  }
  const left = raw[0].x - raw[0].r
  const right = raw[n - 1].x + raw[n - 1].r
  const s = w / (right - left)
  const domes = raw.map((d) => ({ x: (d.x - left) * s, y: d.y * s, r: d.r * s }))

  // small domes in the valleys: the back turns into cauliflower
  for (let i = 0; i < n - 1; i++) {
    if (!rng.chance(cfg.valleyBumps)) continue
    const a = domes[i]
    const b = domes[i + 1]
    let vx = (a.x + b.x) / 2
    let vy = -Infinity
    for (let k = 0; k <= 24; k++) {
      const px = a.x + ((b.x - a.x) * k) / 24
      const py = topAt(px, [a, b])
      if (py > vy) {
        vy = py
        vx = px
      }
    }
    const r = Math.min(a.r, b.r) * rng.range(0.3, 0.46)
    domes.push({ x: vx + rng.range(-r, r) * 0.3, y: vy + r * rng.range(0.3, 0.55), r })
  }

  const x0 = Math.min(...domes.map((d) => d.x - d.r))
  const x1 = Math.max(...domes.map((d) => d.x + d.r))
  // the dome that defines each end has to stay above the base; otherwise,
  // its arc drops almost vertical onto the line and the cloud looks cut with a knife
  const extremes = [
    domes.reduce((m, d) => (d.x - d.r < m.x - m.r ? d : m)),
    domes.reduce((m, d) => (d.x + d.r > m.x + m.r ? d : m)),
  ]
  for (const d of extremes) d.y = Math.min(d.y, -d.r * rng.range(0.3, 0.42))
  const h = -Math.min(...domes.map((d) => d.y - d.r))

  // --- scalloped base -------------------------------------------------------
  const scallops: Scallop[] = []
  const sa = x0 + w * 0.05
  const sb = x1 - w * 0.05
  let a = sa
  while (a < sb - 1) {
    let b = a + w * rng.range(0.13, 0.24)
    if (sb - b < w * 0.07) b = sb
    scallops.push({ a, b, sag: (b - a) * rng.range(0.07, 0.12) })
    a = b
  }

  const plan: CloudPlan = {
    domes,
    corners: [],
    tails: [],
    curls: [],
    scallops,
    base: 0,
    x0,
    x1,
    w: x1 - x0,
    h,
    box: { x0, y0: -h, x1, y1: 0 },
  }

  // corners: the base rises to the outermost point of each end dome
  for (const [i, side] of [[0, -1], [1, 1]] as const) {
    const d = extremes[i]
    const lift = -d.y
    plan.corners.push({ x: d.x + d.r * side, side, lift, reach: Math.max(lift * 1.5, w * 0.06) })
  }

  // --- tails ----------------------------------------------------------------
  let sides: (-1 | 1)[] = []
  if (rng.chance(cfg.tailChance)) sides.push(-1)
  if (rng.chance(cfg.tailChance)) sides.push(1)
  if (sides.length === 0) sides = [rng.chance(0.5) ? -1 : 1]
  for (const side of sides) {
    const len = w * rng.range(cfg.tailLength[0], cfg.tailLength[1])
    const thick = h * rng.range(cfg.tailThick[0], cfg.tailThick[1])
    const double = rng.chance(cfg.tailDouble)
    // `y` is the belly of the tail: almost straight, it extends the base
    const y = -h * (double ? rng.range(0.14, 0.26) : rng.range(0.0, 0.16))
    const root = side < 0 ? x0 + w * 0.1 : x1 - w * 0.1
    const tip = side < 0 ? x0 - len : x1 + len
    plan.tails.push({ side, y, root, tip, thick, bend: -thick * rng.range(0.0, 0.45) })
    // second tail, thinner, below: the reference stacks them
    if (double) {
      const len2 = len * rng.range(0.5, 1.1)
      const thick2 = thick * rng.range(0.5, 0.7)
      const y2 = Math.min(y + thick2 * rng.range(0.9, 1.3), h * 0.02)
      const root2 = side < 0 ? x0 + w * 0.12 : x1 - w * 0.12
      const tip2 = side < 0 ? x0 - len2 : x1 + len2
      plan.tails.push({ side, y: y2, root: root2, tip: tip2, thick: thick2, bend: -thick2 * rng.range(0.0, 0.4) })
    }
  }

  // --- interior loops -------------------------------------------------------
  const count = Math.max(1, Math.min(4, Math.round((w / cfg.curlEvery) * rng.range(0.75, 1.2))))
  const ia = x0 + w * 0.16
  const ib = x1 - w * 0.16
  for (let i = 0; i < count; i++) {
    const cx = ia + ((ib - ia) * (i + 0.5)) / count + rng.range(-0.25, 0.25) * ((ib - ia) / count)
    let r = h * rng.range(0.15, 0.25) * (count === 1 ? 1.2 : 1)
    const roof = topAt(cx, domes)
    if (!Number.isFinite(roof)) continue
    const margin = Math.max(5, h * 0.1)
    // the center drops between the base and the roof of the dome that contains it
    const highest = roof + margin + r
    const lowest = -r * 0.5
    if (highest > lowest) r *= 0.7
    const cy = Math.max(roof + margin + r, lowest - (lowest - (roof + margin + r)) * rng.range(0, 0.55))
    if (r < 5) continue
    const kind = rng.weighted<CurlKind>(['hook', 'arc', 'spiral'], (k) =>
      k === 'hook' ? 0.55 : k === 'arc' ? 0.25 : 0.2,
    )
    plan.curls.push({ x: cx, y: cy, r, kind, flip: rng.chance(0.5) })
  }

  // --- box ------------------------------------------------------------------
  const box = plan.box
  for (const t of plan.tails) {
    box.x0 = Math.min(box.x0, t.tip)
    box.x1 = Math.max(box.x1, t.tip)
    box.y1 = Math.max(box.y1, t.y + t.thick * 0.1)
    box.y0 = Math.min(box.y0, t.y - t.thick)
  }
  for (const sc of scallops) box.y1 = Math.max(box.y1, sc.sag)
  box.x0 -= 3
  box.x1 += 3
  box.y0 -= 3
  box.y1 += 3
  return plan
}

function movePlan(p: CloudPlan, dx: number, dy: number): CloudPlan {
  return {
    domes: p.domes.map((d) => ({ ...d, x: d.x + dx, y: d.y + dy })),
    corners: p.corners.map((c) => ({ ...c, x: c.x + dx })),
    tails: p.tails.map((t) => ({ ...t, y: t.y + dy, root: t.root + dx, tip: t.tip + dx })),
    curls: p.curls.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy })),
    scallops: p.scallops.map((s) => ({ ...s, a: s.a + dx, b: s.b + dx })),
    base: p.base + dy,
    x0: p.x0 + dx,
    x1: p.x1 + dx,
    w: p.w,
    h: p.h,
    box: { x0: p.box.x0 + dx, y0: p.box.y0 + dy, x1: p.box.x1 + dx, y1: p.box.y1 + dy },
  }
}

// --- hatching -------------------------------------------------------------

/**
 * An engraving line is not continuous: it is short stretches with small gaps.
 * Returns `M…L…` subpaths over an arc.
 */
function dashedArc(
  rng: Rng,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  dash: [number, number],
): string {
  if (r <= 1 || a1 - a0 <= 0) return ''
  let d = ''
  let a = a0
  while (a < a1) {
    const da = rng.range(dash[0], dash[1]) / r
    const b = Math.min(a1, a + da)
    if ((b - a) * r > 2.5) {
      const rr = r + rng.range(-0.25, 0.25)
      d += openPath(arcPts(cx, cy, rr, a, b, 5))
    }
    a = b + rng.range(1.6, 4.2) / r
  }
  return d
}

function dashedLine(rng: Rng, f: (x: number) => number, xa: number, xb: number, dash: [number, number]): string {
  let d = ''
  let x = xa
  while (x < xb) {
    const e = Math.min(xb, x + rng.range(dash[0], dash[1]))
    if (e - x > 2.5) {
      const pts: Pt[] = []
      const steps = Math.max(2, Math.ceil((e - x) / 7))
      const jitter = rng.range(-0.25, 0.25)
      for (let k = 0; k <= steps; k++) {
        const px = x + ((e - x) * k) / steps
        pts.push({ x: px, y: f(px) + jitter })
      }
      d += openPath(pts)
    }
    x = e + rng.range(1.6, 4.2)
  }
  return d
}

/** Angle stretches where the edge of the dome is silhouette (not covered by another). */
function visibleRuns(dome: Dome, plan: CloudPlan): { a: number; b: number; hiddenA: boolean; hiddenB: boolean }[] {
  const lo = Math.PI - 0.5
  const hi = TAU + 0.5
  const step = Math.min(0.04, 2 / dome.r)
  const runs: { a: number; b: number; hiddenA: boolean; hiddenB: boolean }[] = []
  const coveredBy = (a: number) => {
    const px = dome.x + Math.cos(a) * dome.r
    const py = dome.y + Math.sin(a) * dome.r
    for (const o of plan.domes) {
      if (o === dome) continue
      if (Math.hypot(px - o.x, py - o.y) < o.r - 0.6) return 'dome'
    }
    if (py > baseAt(px, plan) - 0.6) return 'base'
    return ''
  }
  let start = -1
  let startHidden = false
  let prev = ''
  for (let a = lo; a <= hi + 1e-9; a += step) {
    const c = coveredBy(a)
    if (!c && start < 0) {
      start = a
      startHidden = prev === 'dome'
    }
    if (c && start >= 0) {
      runs.push({ a: start, b: a - step, hiddenA: startHidden, hiddenB: c === 'dome' })
      start = -1
    }
    prev = c
  }
  if (start >= 0) runs.push({ a: start, b: hi, hiddenA: startHidden, hiddenB: false })
  return runs
}

// --- loops ----------------------------------------------------------------

/** Axis of the loop in absolute coordinates. */
function curlAxis(c: Curl, rng: Rng): Pt[] {
  let pts: Pt[]
  if (c.kind === 'arc') {
    pts = arcPts(c.x, c.y, c.r, Math.PI * rng.range(1.0, 1.08), Math.PI * rng.range(1.92, 2.0), 3.5)
  } else {
    // "∩" that ends in a hook turned inward; the spiral goes all the way around
    const a0 = Math.PI * (c.kind === 'spiral' ? rng.range(0.85, 0.95) : rng.range(0.96, 1.08))
    const bend = TAU - 0.12
    const a1 = c.kind === 'spiral' ? TAU + Math.PI * rng.range(0.8, 0.95) : TAU + Math.PI * rng.range(0.45, 0.75)
    const inner = c.kind === 'spiral' ? rng.range(0.3, 0.4) : rng.range(0.36, 0.5)
    const steps = Math.max(12, Math.ceil(((a1 - a0) * c.r) / 3.5))
    pts = []
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps
      const u = a <= bend ? 0 : (a - bend) / (a1 - bend)
      const rr = c.r * (1 - (1 - inner) * Math.pow(u, 0.85))
      // the spiral closes over its own shifted center: "@"
      const cx = c.x + (c.kind === 'spiral' ? c.r * 0.12 * u : 0)
      pts.push({ x: cx + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr })
    }
  }
  return c.flip ? mirrorX(pts, c.x) : pts
}

// --- drawing a cloud --------------------------------------------------------

type Tone = 'mid' | 'shade'

function drawCloud(plan: CloudPlan, tone: Tone, index: number, ctx: ComposeCtx, drift: number, dur: number): string {
  const { rng, noise, pal } = ctx
  const cfg = SKY
  const ink = pal.ink
  const fill = tone === 'shade' ? pal.shade : pal.mid
  const reg = ctx.registration
  const shift = reg ? ` transform="translate(${num(reg)} ${num(reg * 0.6)})"` : ''
  const gap = rng.range(cfg.hatchGap[0], cfg.hatchGap[1])
  // small clouds use a slightly finer stroke, as in the plate
  const weight = Math.max(0.75, Math.min(1.1, plan.w / 260))
  const outlineW = cfg.outline * weight

  let out = ''

  // --- tails (behind the body) ----------------------------------------------
  let tailFill = ''
  let tailLine = ''
  let tailHatch = ''
  for (const t of plan.tails) {
    const N = Math.max(18, Math.ceil(Math.abs(t.tip - t.root) / 7))
    const upper: Pt[] = []
    const lower: Pt[] = []
    // almost straight belly (it extends the base), back that drops in a curve to the
    // tip: an asymmetric lens, not a wedge
    const belly = (s: number) => t.y + t.bend * s * s + t.thick * 0.08 * Math.sin(Math.PI * s) * (1 - s)
    const depth = (s: number) => t.thick * Math.pow(1 - s, 0.55) * (1 - 0.2 * s)
    // the profile is measured from the edge of the body: inside the tail is even and
    // gets covered; outside it has its full thickness and tapers to the tip
    const edge = t.side < 0 ? plan.x0 : plan.x1
    const sOf = (x: number) => Math.max(0, Math.min(1, (x - edge) / (t.tip - edge)))
    for (let i = 0; i <= N; i++) {
      const x = t.root + ((t.tip - t.root) * i) / N
      const s = sOf(x)
      upper.push({ x, y: belly(s) - depth(s) })
      if (i < N) lower.push({ x, y: belly(s) })
    }
    const ring = [...upper, ...lower.reverse()]
    const wobbly = wobble(ring, 0.35, noise, 0.15, rng.next() * 9)
    tailFill += polyline(wobbly, true)
    tailLine += tapered(wobbly, (u) => outlineW * (0.2 + 0.8 * Math.pow(Math.abs(2 * u - 1), 0.8)))
    // engraving lines along it: one next to the belly, another under the back
    const lines = t.thick > 9 ? 2 : 1
    for (let k = 0; k < lines; k++) {
      const off = k === 0 ? 0.24 : 0.7
      const sEnd = rng.range(0.55, 0.8) - k * 0.2
      tailHatch += dashedLine(
        rng,
        (x) => {
          const s = sOf(x)
          return belly(s) - depth(s) * off
        },
        Math.min(t.root, t.root + (t.tip - t.root) * sEnd),
        Math.max(t.root, t.root + (t.tip - t.root) * sEnd),
        [10, 28],
      )
    }
  }
  if (tailFill) {
    out +=
      `<path d="${tailFill}" fill="${fill}"${shift}/>` +
      `<path d="${tailHatch}" fill="none" stroke="${ink}" stroke-width="${num(cfg.hatchWidth)}" stroke-linecap="round" opacity="0.75"/>` +
      `<path d="${tailLine}" fill="${ink}"/>`
  }

  // --- silhouette -----------------------------------------------------------
  // what has no body at the ends is trimmed (roof below the floor)
  let xa = plan.x0
  let xb = plan.x1
  while (xa < xb && !(topAt(xa + 0.01, plan.domes) < bottomAt(xa + 0.01, plan) - 0.2)) xa += 0.05
  while (xb > xa && !(topAt(xb - 0.01, plan.domes) < bottomAt(xb - 0.01, plan) - 0.2)) xb -= 0.05
  xa += 0.01
  xb -= 0.01
  const top = sampleEdge((x) => topAt(x, plan.domes), xa, xb)
  const bottom = sampleEdge((x) => bottomAt(x, plan), xb, xa)
  const rawRing = resample([...top, ...bottom.slice(1, -1)], 2, true)
  const ring = simplify(wobble(rawRing, 0.5, noise, 0.07, rng.next() * 8), 0.3)
  const bodyD = polyline(ring, true)
  const clip = ctx.clip(bodyD)

  out += `<path d="${bodyD}" fill="${fill}"${shift}/>`

  // --- hatching that follows the edge --------------------------------------
  let hatch = ''
  let festoon = ''
  for (const dome of plan.domes) {
    for (const run of visibleRuns(dome, plan)) {
      const L = run.b - run.a
      if (L * dome.r < 10) continue
      const bands = Math.max(2, Math.min(8, Math.round(dome.r / 6)))
      // light comes from the top left: the shadow leans to the right
      const c = run.a + L * rng.range(0.55, 0.72)
      for (let k = 1; k <= bands; k++) {
        const frac = 0.98 * Math.pow(1 - (k - 1) / bands, 1.25)
        const half = (frac * L) / 2
        const a0 = Math.max(run.a + 0.02, c - half * rng.range(0.85, 1.15))
        const a1 = Math.min(run.b - 0.02, c + half * rng.range(0.85, 1.15))
        const rr = dome.r - outlineW * 0.5 - k * gap
        hatch += dashedArc(rng, dome.x, dome.y, rr, a0, a1, [8, 26 - k * 2])
      }
      // the scallop continues a bit inward where another dome covers it
      for (const end of ['a', 'b'] as const) {
        const hidden = end === 'a' ? run.hiddenA : run.hiddenB
        if (!hidden || !rng.chance(0.5) || dome.r < 10) continue
        const ext = rng.range(0.22, 0.5)
        const from = end === 'a' ? run.a : run.b
        const to = end === 'a' ? from - ext : from + ext
        const pts = arcPts(dome.x, dome.y, dome.r, from, to, 3.5)
        festoon += tapered(pts, (u) => outlineW * 0.8 * Math.pow(1 - u, 0.8))
      }
    }
  }

  // base bellies: the hatching runs parallel to the lower scallop
  for (const sc of plan.scallops) {
    if (sc.b - sc.a < 12) continue
    for (let k = 1; k <= 3; k++) {
      const span = (sc.b - sc.a) * (1 - (k - 1) * 0.26) * rng.range(0.7, 0.92)
      const mid = sc.a + (sc.b - sc.a) * rng.range(0.45, 0.62)
      const off = outlineW * 0.5 + k * gap
      hatch += dashedLine(
        rng,
        (x) => {
          const u = Math.max(0, Math.min(1, (x - sc.a) / (sc.b - sc.a)))
          return plan.base + sc.sag * Math.pow(Math.sin(Math.PI * u), 0.5) - off
        },
        Math.max(sc.a, mid - span / 2),
        Math.min(sc.b, mid + span / 2),
        [8, 22],
      )
    }
  }

  // --- interior loops and their shadow -------------------------------------
  let curls = ''
  for (const c of plan.curls) {
    const axis = wobble(curlAxis(c, rng), 0.3, noise, 0.4, rng.next() * 9)
    const cw = Math.max(1.1, Math.min(1.9, c.r * 0.075)) * weight
    curls += tapered(axis, (u) => cw * (0.2 + 0.8 * Math.pow(Math.sin(Math.PI * u), 0.55)))
    // shadow under the shoulder of the loop, on the side opposite the light
    for (let k = 1; k <= 3; k++) {
      const rr = c.r - cw * 0.5 - k * gap
      if (rr < 3) break
      let a0 = Math.PI * (1.32 + 0.06 * k)
      let a1 = Math.PI * (1.96 - 0.04 * k)
      if (c.flip) {
        // mirror of the angle: θ → π − θ
        const m0 = 3 * Math.PI - a1
        const m1 = 3 * Math.PI - a0
        a0 = m0
        a1 = m1
      }
      hatch += dashedArc(rng, c.x, c.y, rr, a0, a1, [6, 16])
    }
  }

  out +=
    `<g clip-path="${clip}">` +
    `<path d="${hatch}" fill="none" stroke="${ink}" stroke-width="${num(cfg.hatchWidth * weight)}" stroke-linecap="round" opacity="0.8"/>` +
    (festoon ? `<path d="${festoon}" fill="${ink}"/>` : '') +
    (curls ? `<path d="${curls}" fill="${ink}"/>` : '') +
    `</g>`

  // --- outline --------------------------------------------------------------
  const closed = [...ring, ring[0]]
  const phase = index * 1.7
  const outline = tapered(closed, (t) => {
    const pulse = Math.pow(Math.sin(Math.PI * t), 0.3)
    const grain = 0.88 + 0.2 * noise(t * 6.2 + phase)
    return outlineW * (0.55 + 0.45 * pulse) * grain
  })
  out += `<path d="${outline}" fill="${ink}"/>`

  // Drift and entrance live in different groups: if they share a node, the
  // animation of one overrides the transform of the other.
  return (
    `<g class="bi-cloud bi-piece" style="--i:${index}">` +
    `<g class="bi-drift" style="--drift:${num(drift)}px;--dur:${num(dur)}s">${out}</g>` +
    `</g>`
  )
}

// --- sun --------------------------------------------------------------------

function drawSun(ctx: ComposeCtx, x: number, y: number, r: number): string {
  const { pal, noise, rng } = ctx
  const ring = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * TAU
    const rr = r * (1 + 0.03 * noise(i * 0.22 + 3))
    return { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr }
  })
  // in mono the accent is the ink: a black disc weighs too much
  const fill = pal.accent === pal.ink ? pal.shade : pal.accent
  const off = ctx.registration * 1.1
  let hatch = ''
  for (let k = 1; k <= 5; k++) {
    const rr = r - 1.2 - k * 2.2
    const span = 0.9 * Math.pow(1 - (k - 1) / 5, 1.2)
    hatch += dashedArc(rng, x, y, rr, Math.PI * (0.25 - span * 0.5), Math.PI * (0.25 + span * 0.5), [10, 24])
  }
  return (
    `<g class="bi-sun bi-piece" style="--i:${ctx.nextPiece()}">` +
    `<path d="${polyline(ring, true)}" fill="${fill}" transform="translate(${num(off)} ${num(off * 0.6)})"/>` +
    `<path d="${hatch}" fill="none" stroke="${pal.ink}" stroke-width="0.7" stroke-linecap="round" opacity="0.7"/>` +
    `<path d="${tapered([...ring, ring[0]], (t) => 2.2 * (0.6 + 0.4 * Math.pow(Math.sin(Math.PI * t), 0.3)))}" fill="${pal.ink}"/>` +
    `</g>`
  )
}

// --- composition ------------------------------------------------------------

function overlap(a: BBox, b: BBox): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  return w > 0 && h > 0 ? w * h : 0
}

export function composeSky(ctx: ComposeCtx): ComposeResult {
  const { rng, width: W, height: H, format } = ctx
  const layout = SKY.layouts[format]
  const mx = W * layout.margin[0]
  const my = H * layout.margin[1]
  const gapPx = Math.min(W, H) * 0.025

  // --- sun: reserved first, never covered by a cloud --------------------------
  const reserved: BBox[] = []
  let sun = ''
  if (layout.sun > 0) {
    const r = W * layout.sun * rng.range(0.9, 1.1)
    const right = rng.chance(0.6)
    const sx = W * (right ? rng.range(0.74, 0.84) : rng.range(0.16, 0.26))
    const sy = Math.max(my + r + 8, H * rng.range(0.11, 0.17))
    reserved.push({ x0: sx - r * 1.3, y0: sy - r * 1.3, x1: sx + r * 1.3, y1: sy + r * 1.3 })
    sun = drawSun(ctx, sx, sy, r)
  }

  // --- sheet of clouds: biggest first, each one looks for its air -----------
  const count = layout.sizes.length - rng.int(0, layout.optional)
  const placed: { plan: CloudPlan; area: number }[] = []
  const boxes: BBox[] = []
  for (let i = 0; i < count; i++) {
    let w = W * layout.sizes[i] * rng.range(0.9, 1.1)
    let plan = planCloud(rng, w)
    // if it does not fit with tails, it is shrunk and planned again
    for (let tries = 0; tries < 3; tries++) {
      const bw = plan.box.x1 - plan.box.x0
      const bh = plan.box.y1 - plan.box.y0
      const fit = Math.min((W - 2 * mx) / bw, (H - 2 * my) / bh, 1)
      if (fit >= 1) break
      w *= fit * 0.97
      plan = planCloud(rng, w)
    }
    const bw = plan.box.x1 - plan.box.x0
    const bh = plan.box.y1 - plan.box.y0
    let best: BBox | null = null
    let bestScore = Infinity
    for (let k = 0; k < 120; k++) {
      const x = mx + rng.next() * Math.max(0, W - 2 * mx - bw)
      const y = my + rng.next() * Math.max(0, H - 2 * my - bh)
      const box = { x0: x, y0: y, x1: x + bw, y1: y + bh }
      const grown = { x0: x - gapPx, y0: y - gapPx, x1: x + bw + gapPx, y1: y + bh + gapPx }
      let hit = 0
      for (const b of boxes) hit += overlap(grown, b)
      for (const b of reserved) hit += overlap(grown, b) * 4
      // at equal overlap, the one farthest from the others wins
      let near = Infinity
      const cx = x + bw / 2
      const cy = y + bh / 2
      for (const b of [...boxes, ...reserved]) {
        const d = Math.hypot(cx - (b.x0 + b.x1) / 2, cy - (b.y0 + b.y1) / 2)
        if (d < near) near = d
      }
      const spread = Number.isFinite(near) ? Math.min(1, near / Math.hypot(W, H)) : 0
      const score = (hit / (bw * bh)) * 10 - spread
      if (score < bestScore) {
        bestScore = score
        best = box
      }
    }
    const at = best!
    const moved = movePlan(plan, at.x0 - plan.box.x0, at.y0 - plan.box.y0)
    boxes.push(moved.box)
    placed.push({ plan: moved, area: bw * bh })
  }

  // tones: almost all in the light tone, one or two in shade
  const tones: Tone[] = placed.map(() => 'mid')
  const shades = Math.min(placed.length - 1, rng.int(1, 2))
  const order = placed.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (let i = 0; i < shades; i++) tones[order[i]] = 'shade'

  // the small ones at the back, the big ones in front
  const drawOrder = placed.map((_, i) => i).sort((a, b) => placed[a].area - placed[b].area)
  let clouds = ''
  for (const i of drawOrder) {
    const drift = rng.range(6, 14) * (rng.chance(0.5) ? -1 : 1)
    clouds += drawCloud(placed[i].plan, tones[i], ctx.nextPiece(), ctx, drift, rng.range(70, 120))
  }

  return {
    body: sun + clouds,
    sway: false,
    ambient: true,
  }
}
