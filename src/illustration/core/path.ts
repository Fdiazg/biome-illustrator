// ---------------------------------------------------------------------------
// path — from points to "ink".
// The key to the hand-drawn look is not a filter: it is the stroke with variable
// width. That is why the outline is generated as a filled polygon, not as a
// `stroke`, so it can be thinned at the ends like a pen.
// ---------------------------------------------------------------------------

import { add, mul, normalize, normalsOf, num, perp, sub, type Pt } from './math'
import type { Noise1D } from './noise'

export interface BBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function polyline(points: Pt[], close = false): string {
  if (points.length === 0) return ''
  let d = `M${num(points[0].x)} ${num(points[0].y)}`
  for (let i = 1; i < points.length; i++) {
    d += `L${num(points[i].x)} ${num(points[i].y)}`
  }
  return close ? `${d}Z` : d
}

/** Coherent displacement perpendicular to the axis: the "pulse" of the stroke. */
export function wobble(
  points: Pt[],
  amplitude: number,
  noise: Noise1D,
  frequency = 0.12,
  phase = 0,
): Pt[] {
  if (points.length < 3) return points
  const normals = normalsOf(points)
  return points.map((p, i) => {
    const offset = noise(i * frequency + phase) * amplitude
    return { x: p.x + normals[i].x * offset, y: p.y + normals[i].y * offset }
  })
}

/**
 * Turns a polyline into a filled shape of variable width.
 * `widthAt` receives the normalized 0..1 position along the stroke.
 */
export function tapered(points: Pt[], widthAt: (t: number) => number): string {
  if (points.length < 2) return ''
  const normals = normalsOf(points)
  const left: Pt[] = []
  const right: Pt[] = []
  const last = points.length - 1

  for (let i = 0; i <= last; i++) {
    const t = i / last
    const half = Math.max(0.16, widthAt(t) / 2)
    left.push(add(points[i], mul(normals[i], half)))
    right.push(add(points[i], mul(normals[i], -half)))
  }

  return polyline([...left, ...right.reverse()], true)
}

export function bboxOf(points: Pt[], pad = 0): BBox {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of points) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }
}

/**
 * Pen overshoot: the line goes on a bit past the closing point and
 * crosses the start of the loop. It is what a pen does when it lifts, and it is
 * the mark of the papaver reference.
 */
export function withOvershoot(points: Pt[], amount: number, bend = 0.45): Pt[] {
  if (points.length < 3 || amount <= 0) return points
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  const dir = normalize(sub(last, prev))
  const nrm = perp(dir)
  const steps = 4
  const out = points.slice()
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    out.push({
      x: last.x + dir.x * amount * t + nrm.x * amount * bend * t * t,
      y: last.y + dir.y * amount * t + nrm.y * amount * bend * t * t,
    })
  }
  return out
}

/**
 * Family of parallel lines clipped by the leaf outline.
 * Emitted as a single `<path>` with several subpaths: one element, not forty.
 */
export function hatchPath(box: BBox, angleDeg: number, step: number, offset = 0): string {
  const a = (angleDeg * Math.PI) / 180
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const nx = -dy
  const ny = dx
  const cx = (box.x0 + box.x1) / 2
  const cy = (box.y0 + box.y1) / 2
  const radius = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) / 2 + 6

  let d = ''
  let k = 0
  for (let o = -radius + offset; o <= radius; o += step) {
    const px = cx + nx * o
    const py = cy + ny * o
    // small per-line variation so the hatching does not look printed
    const jitter = Math.sin(k * 2.7 + offset) * 0.6
    d += `M${num(px - dx * radius)} ${num(py - dy * radius + jitter)}L${num(px + dx * radius)} ${num(py + dy * radius - jitter)}`
    k++
  }
  return d
}
