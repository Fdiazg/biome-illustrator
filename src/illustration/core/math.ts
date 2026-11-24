// ---------------------------------------------------------------------------
// math — points, curves and numeric utilities.
// ---------------------------------------------------------------------------

export interface Pt {
  x: number
  y: number
}

export const pt = (x: number, y: number): Pt => ({ x, y })
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k })
export const len = (a: Pt): number => Math.hypot(a.x, a.y)
export const perp = (a: Pt): Pt => ({ x: -a.y, y: a.x })

export function normalize(a: Pt): Pt {
  const l = len(a) || 1
  return { x: a.x / l, y: a.y / l }
}

export function rotate(a: Pt, angle: number): Pt {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1)
  return t * t * (3 - 2 * t)
}

export function cubicPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

export function sampleCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, segments: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= segments; i++) out.push(cubicPoint(p0, p1, p2, p3, i / segments))
  return out
}

/** Point and frame (tangent/normal) along a polyline. */
export function frameAt(points: Pt[], index: number): { p: Pt; tan: Pt; nrm: Pt } {
  const i = clamp(index, 0, points.length - 1)
  const prev = points[Math.max(0, i - 1)]
  const next = points[Math.min(points.length - 1, i + 1)]
  const tan = normalize(sub(next, prev))
  return { p: points[i], tan, nrm: perp(tan) }
}

/** Per-point normals, smoothed so the outline does not tremble too much. */
export function normalsOf(points: Pt[]): Pt[] {
  const raw = points.map((_, i) => frameAt(points, i).nrm)
  return raw.map((n, i) => {
    const a = raw[Math.max(0, i - 1)]
    const b = raw[Math.min(raw.length - 1, i + 1)]
    return normalize({ x: (n.x * 2 + a.x + b.x) / 4, y: (n.y * 2 + a.y + b.y) / 4 })
  })
}

export const rad = (deg: number) => (deg * Math.PI) / 180
export const round = (n: number, decimals = 2) => {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}
export const num = (n: number) => round(n, 1).toString()
