// ---------------------------------------------------------------------------
// dunes/marks — the texture of each band, made with the same stroke of the engine.
//
// A flat band is a paper cut-out; with marks inside it becomes
// land. Each family of marks is emitted as a single `<path>` with many
// subpaths, so the file does not grow per element.
//
//   crestLine ink line that follows the ridge, with pen lifts
//   furrows   dashes parallel to the crest (plowed field, contour lines)
//   stipple   dense dots under the crest that open downward (shadow)
//   ticks     loose slanted dashes (meadow seen from afar)
//   ripples   horizontal dashes on the water
//   tufts     two or three blades of grass together on the foreground
// ---------------------------------------------------------------------------

import { lerp, type Pt } from '../../core/math'
import type { Noise1D } from '../../core/noise'
import { tapered, wobble } from '../../core/path'
import type { Rng } from '../../core/prng'
import type { Crest } from './terrain'

/** Pen profile: enters thin, thickens and thins again. */
const lens = (w: number) => (t: number) => w * Math.pow(Math.sin(Math.PI * t), 0.55)

/**
 * Crest line with pen lifts: long stretches with short gaps.
 * Far away it is thin and almost continuous; near, thick and with more pulse.
 */
export function crestLine(
  c: Crest,
  width: number,
  rng: Rng,
  noise: Noise1D,
  phase: number,
): string {
  const pts = c.points
  let d = ''
  let i = 0
  while (i < pts.length - 2) {
    const run = rng.int(14, 46)
    const end = Math.min(pts.length - 1, i + run)
    const seg = wobble(pts.slice(i, end + 1), width * 0.35, noise, 0.21, phase + i * 0.37)
    if (seg.length >= 3) {
      const w = width * rng.range(0.75, 1.15)
      d += tapered(seg, (t) => w * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * t), 0.4)))
    }
    i = end + rng.int(1, 3)
  }
  return d
}

/** Dashes parallel to the crest, in rows that spread apart going down. */
export function furrows(
  c: Crest,
  W: number,
  rows: number,
  gap: number,
  width: number,
  rng: Rng,
  noise: Noise1D,
  phase: number,
): string {
  let d = ''
  for (let r = 0; r < rows; r++) {
    const off = gap * (r + 1) * (1 + r * 0.35)
    let x = rng.range(-30, 10)
    while (x < W + 10) {
      const L = rng.range(18, 64) * (1 + r * 0.15)
      const n = Math.max(3, Math.round(L / 12))
      const seg: Pt[] = []
      for (let k = 0; k <= n; k++) {
        const xx = x + (L * k) / n
        seg.push({ x: xx, y: c.y(xx) + off + noise(xx * 0.02 + phase + r) * gap * 0.25 })
      }
      d += tapered(seg, lens(width * rng.range(0.7, 1.2)))
      x += L + rng.range(8, 34) * (1 + r * 0.4)
    }
  }
  return d
}

/** Stipple: dense next to the crest, opens downward like a shadow. */
export function stipple(
  c: Crest,
  W: number,
  count: number,
  depth: number,
  size: number,
  rng: Rng,
): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const x = rng.range(-4, W + 4)
    const y = c.y(x) + Math.abs(rng.gauss(0, depth * 0.45)) + size
    const r = size * rng.range(0.55, 1.15)
    const a = rng.range(0, Math.PI)
    const ca = Math.cos(a) * r
    const sa = Math.sin(a) * r
    // dot: a skewed rhombus, not a perfect circle
    d +=
      `M${(x + ca).toFixed(1)} ${(y + sa).toFixed(1)}` +
      `L${(x - sa * 0.7).toFixed(1)} ${(y + ca * 0.7).toFixed(1)}` +
      `L${(x - ca).toFixed(1)} ${(y - sa).toFixed(1)}` +
      `L${(x + sa * 0.7).toFixed(1)} ${(y - ca * 0.7).toFixed(1)}Z`
  }
  return d
}

/** Loose slanted dashes: meadow, stubble. */
export function ticks(
  c: Crest,
  W: number,
  count: number,
  depth: number,
  len: number,
  width: number,
  lean: number,
  rng: Rng,
): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const x = rng.range(-4, W + 4)
    const y = c.y(x) + rng.range(len * 0.8, depth)
    const L = len * rng.range(0.6, 1.3)
    const a = lean + rng.range(-0.18, 0.18)
    const seg: Pt[] = [
      { x, y },
      { x: x + Math.sin(a) * L * 0.5, y: y - Math.cos(a) * L * 0.5 },
      { x: x + Math.sin(a) * L, y: y - Math.cos(a) * L },
    ]
    d += tapered(seg, (t) => width * (1 - 0.8 * t))
  }
  return d
}

/** Ripples: horizontal dashes, shorter and closer toward the bottom of the water. */
export function ripples(
  top: number,
  bottom: number,
  W: number,
  count: number,
  width: number,
  rng: Rng,
): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const v = Math.pow(rng.next(), 1.6)
    const y = lerp(top + 3, bottom, v)
    const L = lerp(8, 46, v) * rng.range(0.6, 1.3)
    const x = rng.range(-10, W + 10)
    const seg: Pt[] = [
      { x, y },
      { x: x + L * 0.5, y: y + rng.range(-0.6, 0.6) },
      { x: x + L, y },
    ]
    d += tapered(seg, lens(width * lerp(0.6, 1.3, v)))
  }
  return d
}

/** Tufts of grass on the crest of the foreground. */
export function tufts(c: Crest, W: number, count: number, h: number, rng: Rng): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, W)
    const y = c.y(x) + rng.range(0.5, 3)
    const blades = rng.int(2, 4)
    for (let b = 0; b < blades; b++) {
      const bx = x + rng.range(-3, 3)
      const hh = h * rng.range(0.55, 1.2)
      const lean = rng.range(-0.5, 0.5)
      const seg: Pt[] = [
        { x: bx, y },
        { x: bx + lean * hh * 0.3, y: y - hh * 0.55 },
        { x: bx + lean * hh * 0.75, y: y - hh },
      ]
      d += tapered(seg, (t) => Math.max(0.5, h * 0.17) * (1 - 0.85 * t))
    }
  }
  return d
}
