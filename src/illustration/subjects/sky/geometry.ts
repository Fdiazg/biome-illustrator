// ---------------------------------------------------------------------------
// sky/geometry — shape utilities specific to the sky.
//
// They live here and not in `core/` because `core/path.ts` and `core/math.ts` are
// frozen with the botanical subjects. If another subject needs them, they are candidates to
// move up.
// ---------------------------------------------------------------------------

import { num, type Pt } from '../../core/math'

/** Circle arc sampled by length, not by number of steps. */
export function arcPts(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  stepLen = 3,
): Pt[] {
  const steps = Math.max(2, Math.ceil((Math.abs(a1 - a0) * Math.max(r, 1)) / stepLen))
  const out: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return out
}

/** Resamples a polyline at a constant step: the pulse noise stays even. */
export function resample(points: Pt[], step: number, closed = false): Pt[] {
  if (points.length < 2) return points.slice()
  const src = closed ? [...points, points[0]] : points
  const out: Pt[] = [src[0]]
  let carry = 0
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1]
    const b = src[i]
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (seg === 0) continue
    let d = step - carry
    while (d <= seg) {
      const t = d / seg
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      d += step
    }
    carry = seg - (d - step)
  }
  if (!closed) out.push(src[src.length - 1])
  else if (out.length > 1) {
    const last = out[out.length - 1]
    if (Math.hypot(last.x - src[0].x, last.y - src[0].y) < step * 0.5) out.pop()
  }
  return out
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t)
}

/**
 * Ramer–Douglas–Peucker: fewer points with the same shape. The file weighs
 * because of the numbers, not the elements.
 */
export function simplify(points: Pt[], eps: number): Pt[] {
  if (points.length < 3) return points.slice()
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [i0, i1] = stack.pop()!
    let best = -1
    let bestD = eps
    for (let i = i0 + 1; i < i1; i++) {
      const d = segDist(points[i], points[i0], points[i1])
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
    if (best >= 0) {
      keep[best] = 1
      stack.push([i0, best], [best, i1])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** Open polyline as a `M…L…` subpath, to join several into one `<path>`. */
export function openPath(points: Pt[]): string {
  if (points.length < 2) return ''
  let d = `M${num(points[0].x)} ${num(points[0].y)}`
  for (let i = 1; i < points.length; i++) d += `L${num(points[i].x)} ${num(points[i].y)}`
  return d
}

/** Horizontal mirror around a vertical axis. */
export function mirrorX(points: Pt[], axis: number): Pt[] {
  return points.map((p) => ({ x: 2 * axis - p.x, y: p.y }))
}
