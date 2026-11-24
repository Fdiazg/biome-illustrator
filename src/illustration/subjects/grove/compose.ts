// ---------------------------------------------------------------------------
// grove/compose — a herbarium tree, or a little grove in the band.
//
// A tree is an axis that opens up: a trunk that forks and a crown that is a
// cluster of clusters. The silhouette appears by occlusion (clusters behind the
// skeleton, clusters in front) and not through a smoothed mass. That is what
// separates it from a lollipop.
//
// In the plate and the square there is a single tree, of one of the species of the
// reference. In the band a lone tree gets lost (it took up 11% of the canvas),
// so the band composes several of different species and sizes, with shrubs in
// the gaps and a continuous ground line.
// ---------------------------------------------------------------------------

import type { LeafFill } from '../../core/fill'
import { taperedLite } from '../../core/leafDraw'
import { clamp, type Pt } from '../../core/math'
import { polyline, wobble } from '../../core/path'
import type { Palette } from '../../core/palette'
import type { ComposeCtx, ComposeResult } from '../types'
import { GROVE, GROVE_SPECIES, type GroveSpecies, type GroveSpeciesId } from './config'
import { drawTree, fitPlan, planBox, planTree, type Foliage, type TreePlan } from './tree'

const margin = 34

/** Relative luminance of a palette color (#rrggbb). */
function luma(hex: string): number {
  const v = hex.replace('#', '')
  const ch = (i: number) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4)
}

/**
 * On the shadow blot the vein is cut out in paper, as in the
 * reference; unless the paper and the shadow are almost the same value (mono,
 * night), in which case it goes in ink so it can be seen.
 */
function veinOnShade(pal: Palette): string {
  return Math.abs(luma(pal.shade) - luma(pal.paper)) > 0.22 ? pal.paper : pal.ink
}

function foliageFor(ctx: ComposeCtx): Foliage {
  const fills: LeafFill[] = [...GROVE.leaf.fills]
  // autumn: if the accent is the ink (mono), it adds nothing
  if (ctx.pal.accent !== ctx.pal.ink && ctx.rng.chance(GROVE.leaf.autumn.chance)) {
    fills.push(GROVE.leaf.autumn.fill)
  }
  return { fills, veinOnShade: veinOnShade(ctx.pal) }
}

function pickSpecies(ctx: ComposeCtx, avoid?: GroveSpeciesId): GroveSpecies {
  const pool = Object.values(GROVE_SPECIES).filter((s) => s.weight > 0 && s.id !== avoid)
  return ctx.rng.weighted(pool, (s) => s.weight)
}

/** Wobbly ellipse: the shadow is not a compass circle. */
function blob(cx: number, cy: number, rx: number, ry: number, ctx: ComposeCtx, phase: number): string {
  const points: Pt[] = []
  const steps = 24
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const k = 1 + 0.08 * ctx.noise(i * 0.9 + phase)
    points.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k })
  }
  return polyline(points, true)
}

/** Grass tuft: several thin blades that spring from the same point. */
function tuft(x: number, y: number, height: number, blades: number, ctx: ComposeCtx): string {
  const { rng, noise, pal } = ctx
  const w = clamp(height / 36, 0.6, 1.1)
  let d = ''
  for (let i = 0; i < blades; i++) {
    const t = blades === 1 ? 0.5 : i / (blades - 1)
    const off = (t - 0.5) * height * 0.9
    const h = height * rng.range(0.55, 1)
    const bend = off * rng.range(0.5, 1.1) + rng.range(-5, 5) * w
    const base = { x: x + off * 0.22, y }
    const mid = { x: base.x + bend * 0.35, y: y - h * 0.58 }
    const tip = { x: base.x + off + bend, y: y - h }
    const spine = wobble([base, mid, tip], 0.35, noise, 0.5, i * 3.1 + x * 0.01)
    d += taperedLite(
      spine,
      (u) => 2.2 * w * (1 - 0.82 * u) * (0.55 + 0.45 * Math.pow(Math.sin(Math.PI * u), 0.3)),
      0,
    )
  }
  // a single stroke with several subpaths: the tuft is one piece
  return `<path d="${d}" fill="${pal.ink}"/>`
}

/** Ground line with pulse, from x0 to x1. */
function groundLine(x0: number, x1: number, y: number, ctx: ComposeCtx, weight: number): string {
  const steps = Math.max(8, Math.round((x1 - x0) / 14))
  const pts: Pt[] = []
  const phase = ctx.rng.next() * 9
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push({ x: x0 + (x1 - x0) * t, y: y + ctx.noise(t * (x1 - x0) * 0.012 + phase) * 1.1 })
  }
  const d = taperedLite(pts, (t) => weight * (0.18 + 0.82 * Math.pow(Math.sin(Math.PI * t), 0.4)), GROVE.tolerance)
  return `<path d="${d}" fill="${ctx.pal.ink}"/>`
}

function shadowUnder(plan: TreePlan, ctx: ComposeCtx): string {
  const box = planBox(plan)
  const rx = clamp((box.x1 - box.x0) * 0.32, 18, 260)
  const ry = clamp(rx * 0.09, 3, 16)
  const d = blob(plan.base.x + ctx.rng.range(-6, 6), plan.base.y + ry * 0.3, rx, ry, ctx, ctx.rng.next() * 8)
  return `<path d="${d}" fill="${ctx.pal.shade}" opacity="${GROVE.ground.shadow}"/>`
}

function treeMarkup(plan: TreePlan, ctx: ComposeCtx, foliage: Foliage, tol?: number): string {
  const { back, trunk, front } = drawTree(plan, ctx, foliage, tol)
  return `<g class="bi-tree">${back}${trunk}${front}</g>`
}

function tuftsAround(plan: TreePlan, ctx: ComposeCtx, count: number, spread: number): string {
  const { rng } = ctx
  let out = ''
  const h = plan.unit * 560
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const x = plan.base.x + side * rng.range(h * 0.04, h * spread)
    out += tuft(x, plan.base.y + rng.range(-1.5, 2.5), h * rng.range(0.045, 0.075), rng.int(5, 8), ctx)
  }
  return out
}

/** Plate or square: a single tree, centered by its crown. */
function composeSingle(ctx: ComposeCtx): ComposeResult {
  const { rng, width: W, height: H } = ctx
  const fraction = ctx.format === 'square' ? GROVE.height.square : GROVE.height.plate
  const baseY = H - H * 0.1
  const treeH = H * fraction
  const species = pickSpecies(ctx)
  const foliage = foliageFor(ctx)

  const plan = planTree(ctx, species, { x: W / 2 + rng.range(-W * 0.012, W * 0.012), y: baseY }, treeH)
  fitPlan(plan, { x0: margin, x1: W - margin, y0: margin }, { maxScale: 1.5, center: W / 2, maxShift: W * 0.08, squeeze: 0.8 })

  const ground =
    shadowUnder(plan, ctx) +
    groundLine(plan.base.x - treeH * rng.range(0.2, 0.28), plan.base.x + treeH * rng.range(0.2, 0.28), baseY + 4, ctx, 2)

  const tree = treeMarkup(plan, ctx, foliage)
  const grass = tuftsAround(plan, ctx, rng.int(GROVE.ground.tufts[0], GROVE.ground.tufts[1]), 0.2)

  // without ground (loose motif) it is composed the same and not emitted: same randomness
  const groundG = `<g class="bi-ground bi-piece" style="--i:${ctx.nextPiece()}">${ground}</g>`
  const body =
    (ctx.ground === false ? '' : groundG) +
    tree +
    `<g class="bi-grass bi-piece" style="--i:${ctx.nextPiece()}">${grass}</g>`

  return { body, origin: { ...plan.base }, sway: true }
}

/**
 * Band: a little grove. The trees are spread over gaps with jitter, each
 * of a different species than its neighbor and of a different height; the tufts go in the
 * spaces between trunks and in front.
 */
function composeBand(ctx: ComposeCtx): ComposeResult {
  const { rng, width: W, height: H } = ctx
  const band = GROVE.band
  const baseY = H - 30
  const top = 14
  const foliage = foliageFor(ctx)

  const n = rng.int(band.trees[0], band.trees[1])
  const left = 70
  const right = W - 70
  const slot = (right - left) / n

  // one protagonist tree, the rest accompany
  const hero = rng.int(0, n - 1)
  const trees: { plan: TreePlan; h: number }[] = []
  let prev: GroveSpeciesId | undefined
  for (let i = 0; i < n; i++) {
    const species = pickSpecies(ctx, prev)
    prev = species.id
    const cx = left + slot * (i + 0.5) + rng.range(-0.16, 0.16) * slot
    const h = H * (i === hero ? band.height[1] : rng.range(band.height[0], band.height[1] * 0.9))
    const plan = planTree(ctx, species, { x: cx, y: baseY }, h, band.leafScale * (i === hero ? 0.9 : 1), 1)
    const reach = slot * (i === hero ? 0.78 : 0.66)
    fitPlan(plan, { x0: Math.max(16, cx - reach), x1: Math.min(W - 16, cx + reach), y0: top }, { maxScale: 1.35, squeeze: 0.85 })
    trees.push({ plan, h })
  }

  // shrubs between trees: they fill the base without covering trunks
  const shrubs: TreePlan[] = []
  const m = rng.int(band.shrubs[0], band.shrubs[1])
  const gaps = Array.from({ length: n + 1 }, (_, i) => i).sort(() => rng.next() - 0.5)
  for (let k = 0; k < m; k++) {
    const g = gaps[k % gaps.length]
    const x = clamp(left + slot * g + rng.range(-0.18, 0.18) * slot, 95, W - 95)
    const h = H * rng.range(band.shrubHeight[0], band.shrubHeight[1])
    const plan = planTree(ctx, GROVE_SPECIES.shrub, { x, y: baseY }, h, band.leafScale)
    fitPlan(plan, { x0: 12, x1: W - 12, y0: top }, { maxScale: 1 })
    shrubs.push(plan)
  }

  // ground: one continuous line, cut into two or three stretches as if by hand
  let ground = ''
  for (const t of trees) ground += shadowUnder(t.plan, ctx)
  const cuts = rng.int(1, 2)
  const edges = [28]
  for (let c = 1; c <= cuts; c++) edges.push(28 + ((W - 56) * c) / (cuts + 1) + rng.range(-60, 60))
  edges.push(W - 28)
  for (let i = 0; i < edges.length - 1; i++) {
    const gap = i === 0 ? 0 : rng.range(10, 26)
    ground += groundLine(edges[i] + gap, edges[i + 1], baseY + 4 + rng.range(-1, 1), ctx, 1.7)
  }

  // tallest to shortest: the small ones stay in front, like in a frieze
  const order = trees.slice().sort((a, b) => b.h - a.h)
  let body = `<g class="bi-ground bi-piece" style="--i:${ctx.nextPiece()}">${ground}</g>`
  if (ctx.ground === false) body = ''
  for (const t of order) body += treeMarkup(t.plan, ctx, foliage, band.tolerance)
  for (const s of shrubs) body += treeMarkup(s, ctx, foliage, band.tolerance)

  let grass = ''
  for (const t of trees) grass += tuftsAround(t.plan, ctx, rng.int(1, 3), 0.18)
  const loose = rng.int(4, 7)
  for (let i = 0; i < loose; i++) {
    const x = rng.range(40, W - 40)
    grass += tuft(x, baseY + rng.range(-1, 2.5), H * rng.range(0.05, 0.08), rng.int(4, 7), ctx)
  }
  body += `<g class="bi-grass bi-piece" style="--i:${ctx.nextPiece()}">${grass}</g>`

  return { body, origin: { x: W / 2, y: baseY }, sway: true }
}

export function composeGrove(ctx: ComposeCtx): ComposeResult {
  return ctx.format === 'wide' ? composeBand(ctx) : composeSingle(ctx)
}
