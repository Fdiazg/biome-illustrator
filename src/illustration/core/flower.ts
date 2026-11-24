// ---------------------------------------------------------------------------
// flower — petals as closed loops.
//
// The petal is defined with Bézier curves, but it is sampled to be drawn:
// that way the outline can have variable width and "overshoot" a little, which is
// exactly what a pen does when it closes the loop.
// ---------------------------------------------------------------------------

import { add, cubicPoint, mul, num, type Pt } from './math'
import type { Noise1D } from './noise'
import { wobble } from './path'

export interface PetalGeometry {
  /** closed fill */
  d: string
  /** sampled outline, for the pen */
  outline: Pt[]
  angle: number
  length: number
}

export function petalGeometry(
  center: Pt,
  angle: number,
  length: number,
  width: number,
): PetalGeometry {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) }
  const nrm = { x: -dir.y, y: dir.x }
  const tip = add(center, mul(dir, length))

  // side A: center → tip
  const a1 = add(add(center, mul(dir, length * 0.3)), mul(nrm, width))
  const a2 = add(add(tip, mul(dir, -length * 0.04)), mul(nrm, width * 0.56))
  // side B: tip → center
  const b1 = add(add(tip, mul(dir, -length * 0.04)), mul(nrm, -width * 0.56))
  const b2 = add(add(center, mul(dir, length * 0.3)), mul(nrm, -width))

  const d = [
    `M${num(center.x)} ${num(center.y)}`,
    `C${num(a1.x)} ${num(a1.y)} ${num(a2.x)} ${num(a2.y)} ${num(tip.x)} ${num(tip.y)}`,
    `C${num(b1.x)} ${num(b1.y)} ${num(b2.x)} ${num(b2.y)} ${num(center.x)} ${num(center.y)}`,
    'Z',
  ].join('')

  const outline: Pt[] = []
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    outline.push(cubicPoint(center, a1, a2, tip, i / steps))
  }
  for (let i = 1; i <= steps; i++) {
    outline.push(cubicPoint(tip, b1, b2, center, i / steps))
  }

  return { d, outline, angle, length }
}

/** Loop with pulse: thinner where the pen enters and leaves, thicker along the run. */
export function petalOutline(petal: PetalGeometry, noise: Noise1D, phase: number): Pt[] {
  return wobble(petal.outline, 0.5, noise, 0.55, phase)
}
