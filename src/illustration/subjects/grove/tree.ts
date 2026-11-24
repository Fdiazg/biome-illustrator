// ---------------------------------------------------------------------------
// grove/tree — a tree in two stages: first it is planned, then it is drawn.
//
// The plan is pure geometry (branches, leaves, roots). Only once it is known
// how much room it takes is it fitted into place (the plate or a gap in the band)
// and drawn with the final line width. That way a tree that has to be
// shrunk does not end up with thin-outlined leaves or wire branches.
//
// The crown reads through three things, in this order:
//   1. Each leaf covers what is behind it (fill or paper): no crossed hatching.
//   2. Leaves do not overlap more than they should: gaps remain and through the gaps
//      the branches show.
//   3. Clusters behind and in front of the skeleton: the silhouette comes from occlusion.
// ---------------------------------------------------------------------------

import { branchStroke, growTree, type Branch } from '../../core/branch'
import { pickFill, type LeafFill } from '../../core/fill'
import { drawLeaf, taperedLite } from '../../core/leafDraw'
import { add, clamp, frameAt, mul, normalize, sub, type Pt } from '../../core/math'
import { polyline } from '../../core/path'
import type { ComposeCtx } from '../types'
import { GROVE, type GroveSpecies } from './config'

interface Limb {
  spine: Pt[]
  w0: number
  w1: number
  /** 0 = tip; the trunk has the maximum depth */
  depth: number
  trunk: boolean
}

interface LeafPlan {
  /** point of the branch where the petiole starts */
  attach: Pt
  base: Pt
  tip: Pt
  bend: number
  halfWidth: number
  back: boolean
  /** cluster it belongs to: one animation piece */
  group: number
}

export interface TreePlan {
  species: GroveSpecies
  base: Pt
  limbs: Limb[]
  roots: { pts: Pt[]; w: number }[]
  leaves: LeafPlan[]
  /** line scale: 1 for a 560 px tree */
  unit: number
}

export interface Room {
  x0: number
  x1: number
  y0: number
}

const UP = -Math.PI / 2

/** Straightens an angle upward without losing the side. */
function upright(angle: number, amount: number): number {
  // normalize to (-3π/2, π/2] so the blend does not take the long way around
  let a = angle
  while (a > Math.PI / 2) a -= Math.PI * 2
  while (a <= -Math.PI * 1.5) a += Math.PI * 2
  return a + (UP - a) * amount
}

const dirOf = (a: number): Pt => ({ x: Math.cos(a), y: Math.sin(a) })

export function planTree(
  ctx: ComposeCtx,
  species: GroveSpecies,
  base: Pt,
  treeH: number,
  /** larger leaves (and therefore fewer) for small trees */
  leafScale = 1,
  /** fork levels that get removed: a small tree is drawn with less detail */
  prune = 0,
): TreePlan {
  const { rng, noise } = ctx
  const depth = Math.max(2, species.branch.depth - prune)
  // without one level, each branch is longer: the tree keeps its height
  const sp: GroveSpecies =
    depth === species.branch.depth
      ? species
      : {
          ...species,
          branch: {
            ...species.branch,
            depth,
            length: [species.branch.length[0] * 1.12, species.branch.length[1] * 1.12],
          },
        }
  const unit = treeH / 560

  const root = growTree(
    {
      from: base,
      angle: UP + rng.range(-sp.trunk.lean, sp.trunk.lean),
      length: treeH * sp.trunk.share,
      width: sp.trunk.width * unit,
      depth: sp.branch.depth,
      bend: rng.range(-sp.branch.bend, sp.branch.bend),
      spread: sp.branch.spread,
      rootSpread: sp.branch.rootSpread,
      children: sp.branch.children,
      rootChildren: sp.branch.rootChildren,
      lengthFalloff: sp.branch.length,
      widthFalloff: sp.branch.widthFalloff,
      upward: sp.branch.upward,
      wind: sp.branch.wind * (rng.chance(0.5) ? 1 : -1),
      bias: sp.branch.bias * (rng.chance(0.5) ? 1 : -1),
      wobble: sp.trunk.wobble,
      segments: 22,
    },
    rng,
    noise,
  )

  const limbs: Limb[] = []
  const leaves: LeafPlan[] = []
  const placed: { c: Pt; r: number; back: boolean }[] = []
  let group = 0

  const leafLen = () => rng.range(sp.leaf.size[0], sp.leaf.size[1]) * treeH * leafScale

  /**
   * Tries to place a leaf. If it overlaps another too much, it tries rotating it and
   * shrinking it; if it still does not fit, it is left out. The gaps are part of the drawing.
   */
  const place = (attach: Pt, angle: number, length: number, back: boolean, g: number, crowd = sp.crowd) => {
    const tries: [number, number][] = [
      [0, 1],
      [0.32, 0.92],
      [-0.32, 0.92],
      [0.6, 0.8],
      [-0.6, 0.8],
    ]
    for (const [turn, k] of tries) {
      const a = angle + turn
      const len = length * k
      const d = dirOf(a)
      const b = add(attach, mul(d, len * GROVE.leaf.petiole))
      const tip = add(b, mul(d, len))
      const c = add(b, mul(d, len * 0.5))
      const r = len * 0.36
      const clash = placed.some((p) => {
        const min = (p.r + r) * (p.back === back ? crowd : crowd * 0.55)
        return Math.hypot(p.c.x - c.x, p.c.y - c.y) < min
      })
      if (clash) continue
      placed.push({ c, r, back })
      leaves.push({
        attach,
        base: b,
        tip,
        bend: rng.range(-0.18, 0.18),
        halfWidth: (len * sp.leaf.aspect) / 2,
        back,
        group: g,
      })
      return true
    }
    return false
  }

  /** Cluster: a fan of leaves that opens from a point. */
  const cluster = (at: Pt, angle: number, count: number, spread: number, back: boolean, scale = 1) => {
    const g = group++
    const base = upright(angle + rng.range(-0.25, 0.25), 0.18)
    // the order alternates from the center: the tip leaf first
    const slots = Array.from({ length: count }, (_, i) => (count === 1 ? 0 : i / (count - 1) - 0.5))
    slots.sort((a, b) => Math.abs(a) - Math.abs(b))
    for (const s of slots) {
      const a = upright(base + s * 2 * spread + rng.range(-0.1, 0.1), 0.12)
      place(at, a, leafLen() * scale, back, g)
    }
  }

  const visit = (b: Branch) => {
    const trunk = b.depth === sp.branch.depth
    // the child branch starts a bit inside the mother and the knot is closed with
    // a disc: without this a paper notch is left between the straight cut of the
    // mother and the rotated base of the child
    let spine = b.spine
    if (!trunk && spine.length > 1) {
      const d = normalize(sub(spine[1], spine[0]))
      spine = [sub(spine[0], mul(d, b.width0 * 0.3)), ...spine]
    }
    limbs.push({ spine, w0: b.width0, w1: b.width1, depth: b.depth, trunk })

    // alternate leaves along the branch: the tree is not an umbrella
    if (!trunk && b.depth >= 1 && b.depth <= sp.along.maxDepth) {
      const g = group++
      const total = b.spine.length - 1
      const branchLen = Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y)
      const step = (sp.along.step * sp.leaf.size[0] * treeH * leafScale) / Math.max(1, branchLen)
      let side = rng.chance(0.5) ? 1 : -1
      const back = rng.chance(0.45)
      for (let t = rng.range(0.3, 0.45); t < 0.9; t += step * rng.range(0.85, 1.2)) {
        side = -side
        if (!rng.chance(sp.along.density)) continue
        const { p, tan } = frameAt(b.spine, Math.round(t * total))
        const a = upright(Math.atan2(tan.y, tan.x) + side * sp.along.angle * rng.range(0.8, 1.15), 0.22)
        place(p, a, leafLen() * 0.88, back, g)
      }
    }

    // rosette on an intermediate branch: crown mass, not just tips
    if (!trunk && b.depth >= 1 && b.depth <= 2 && sp.extra > 0 && rng.chance(sp.extra)) {
      const p = b.spine[Math.floor(b.spine.length * rng.range(0.55, 0.85))]
      cluster(p, b.angle + rng.range(-0.8, 0.8), rng.int(3, 5), 1.9, rng.chance(0.7), 0.9)
    }

    for (const child of b.children) visit(child)

    if (b.terminal) {
      const n = rng.int(sp.cluster.leaves[0], sp.cluster.leaves[1])
      cluster(b.to, b.angle, n, sp.cluster.spread, rng.chance(sp.backShare))
    }
  }
  visit(root)

  // short roots: the trunk rests, it is not driven in
  const roots: { pts: Pt[]; w: number }[] = []
  const nRoots = rng.int(sp.roots[0], sp.roots[1])
  const tw = sp.trunk.width * unit
  for (let i = 0; i < nRoots; i++) {
    const side = nRoots === 3 && i === 2 ? (rng.chance(0.5) ? 0.35 : -0.35) : i % 2 === 0 ? -1 : 1
    const reach = tw * rng.range(1.8, 2.8)
    roots.push({
      pts: [
        { x: base.x + side * tw * 0.12, y: base.y - tw * 0.6 },
        { x: base.x + side * reach * 0.45, y: base.y - 1 },
        { x: base.x + side * reach, y: base.y + 1.5 },
      ],
      w: tw * 0.66,
    })
  }

  return { species, base: { ...base }, limbs, roots, leaves, unit }
}

/** Box of the plan, with branch and leaf width included. */
export function planBox(plan: TreePlan) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const grow = (p: Pt, pad: number) => {
    x0 = Math.min(x0, p.x - pad)
    x1 = Math.max(x1, p.x + pad)
    y0 = Math.min(y0, p.y - pad)
    y1 = Math.max(y1, p.y + pad)
  }
  for (const l of plan.limbs) for (const p of l.spine) grow(p, l.w0 / 2)
  for (const leaf of plan.leaves) {
    grow(leaf.tip, leaf.halfWidth * 0.4)
    grow(leaf.base, leaf.halfWidth)
    grow(
      { x: (leaf.base.x + leaf.tip.x) / 2, y: (leaf.base.y + leaf.tip.y) / 2 },
      leaf.halfWidth,
    )
  }
  for (const r of plan.roots) for (const p of r.pts) grow(p, 2)
  return { x0, y0, x1, y1 }
}

/**
 * Fits the plan into its place: it shifts it (if allowed) to center the crown and
 * scales it around the base so it does not overflow. If the width rules and
 * there is spare height, it first closes the crown a little (up to `squeeze`): a more
 * upright tree fills a vertical plate better than a squat one. Returns the scale.
 */
export function fitPlan(
  plan: TreePlan,
  room: Room,
  opts: { maxScale: number; center?: number; maxShift?: number; squeeze?: number },
): number {
  let box = planBox(plan)
  if (opts.center !== undefined) {
    const shift = clamp(opts.center - (box.x0 + box.x1) / 2, -(opts.maxShift ?? 0), opts.maxShift ?? 0)
    transformPlan(plan, (p) => ({ x: p.x + shift, y: p.y }), 1)
    box = planBox(plan)
  }
  const { x, y } = plan.base
  let fx = Infinity
  if (box.x0 < x) fx = Math.min(fx, (x - room.x0) / (x - box.x0))
  if (box.x1 > x) fx = Math.min(fx, (room.x1 - x) / (box.x1 - x))
  const fy = box.y0 < y ? (y - room.y0) / (y - box.y0) : Infinity
  const squeeze = opts.squeeze ?? 1
  const f = Math.max(0.2, Math.min(opts.maxScale, fy, fx / squeeze))
  const sx = Math.min(1, fx / f)
  if (Math.abs(f - 1) > 1e-3 || sx < 0.999) {
    transformPlan(plan, (p) => ({ x: x + (p.x - x) * f * sx, y: y + (p.y - y) * f }), f)
  }
  return f
}

function transformPlan(plan: TreePlan, map: (p: Pt) => Pt, k: number) {
  plan.base = map(plan.base)
  for (const l of plan.limbs) {
    l.spine = l.spine.map(map)
    l.w0 *= k
    l.w1 *= k
  }
  for (const r of plan.roots) {
    r.pts = r.pts.map(map)
    r.w *= k
  }
  for (const leaf of plan.leaves) {
    leaf.attach = map(leaf.attach)
    leaf.base = map(leaf.base)
    leaf.tip = map(leaf.tip)
    leaf.halfWidth *= k
  }
  plan.unit *= k
}

export interface Foliage {
  fills: LeafFill[]
  /** color of the vein on a shadow blot */
  veinOnShade: string
}

export interface TreeSvg {
  back: string
  trunk: string
  front: string
}

/** Draws the already fitted plan. Each cluster is an animatable piece. */
export function drawTree(plan: TreePlan, ctx: ComposeCtx, foliage: Foliage, tol = GROVE.tolerance): TreeSvg {
  const { rng, noise, pal } = ctx
  const u = clamp(plan.unit, 0.55, 1.2)
  const outline = GROVE.leaf.outline * clamp(Math.sqrt(plan.unit), 0.68, 1.12)
  const weight = clamp(Math.sqrt(plan.unit), 0.7, 1.05)
  const sp = plan.species

  // no ink blot at the back: it would melt into the branches
  const backFills = foliage.fills.filter((f) => !(f.pattern === 'solid' && f.color === 'ink'))
  // on a small leaf the hatching clogs: there only blot or paper
  const plain = (f: LeafFill) => f.pattern === 'solid' || f.pattern === 'none'
  const pools = {
    front: { big: foliage.fills, small: foliage.fills.filter(plain) },
    back: { big: backFills, small: backFills.filter(plain) },
  }

  const layer = (back: boolean): string => {
    const pool = back ? pools.back : pools.front
    let prev: LeafFill | undefined
    let out = ''
    let current = -1
    let buf = ''
    const flush = () => {
      if (buf) out += `<g class="bi-cluster bi-piece" style="--i:${ctx.nextPiece()}">${buf}</g>`
      buf = ''
    }
    for (const leaf of plan.leaves) {
      if (leaf.back !== back) continue
      if (leaf.group !== current) {
        flush()
        current = leaf.group
      }
      const len = Math.hypot(leaf.tip.x - leaf.base.x, leaf.tip.y - leaf.base.y)
      const fill = pickFill(rng, len > 44 ? pool.big : pool.small, prev)
      prev = fill

      // petiole: the leaf hangs from the branch, it does not float beside it
      const stem = [leaf.attach, leaf.base]
      buf += `<path d="${taperedLite(
        [stem[0], { x: (stem[0].x + stem[1].x) / 2, y: (stem[0].y + stem[1].y) / 2 }, stem[1]],
        (t) => 1.5 * u * (1 - 0.4 * t),
        0,
      )}" fill="${pal.ink}"/>`

      buf += drawLeaf(
        {
          base: leaf.base,
          tip: leaf.tip,
          bend: leaf.bend,
          halfWidth: leaf.halfWidth,
          profile: sp.leaf.profile,
          fill,
          outline: outline * (back ? 0.85 : 1),
          veins: len > 52 ? 4 : len > 30 ? 3 : 2,
          roughness: GROVE.leaf.roughness,
          overshoot: GROVE.leaf.overshoot * clamp(len / 50, 0.5, 1.2),
          registration: ctx.registration * clamp(len / 45, 0.5, 1),
          segments: len > 60 ? 22 : 16,
          hatchStep: 5.4 * weight,
          // at the back, a shifted blot only shows paper: no need to cover
          underlay: back && fill.pattern === 'solid' ? undefined : pal.paper,
          veinColor: foliage.veinOnShade,
          weight,
          tolerance: tol,
          veinSweep: 0.3,
        },
        ctx,
      )
    }
    flush()
    return out
  }

  const back = layer(true)

  let trunk = ''
  let knots = ''
  for (const l of plan.limbs) {
    const d = branchStroke(l.spine, l.w0, l.w1, noise, rng.next() * 12, l.trunk ? 0.26 : 0.14, tol)
    trunk += `<path d="${d}" fill="${pal.ink}"/>`
    if (!l.trunk && l.w0 > 1.6) {
      // knot: slightly oval disc where the branch starts
      const c = l.spine[1]
      const r = l.w0 * 0.62
      const ring: Pt[] = []
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        ring.push({ x: c.x + Math.cos(a) * r * 1.05, y: c.y + Math.sin(a) * r * 0.95 })
      }
      knots += polyline(ring, true)
    }
  }
  if (knots) trunk += `<path d="${knots}" fill="${pal.ink}"/>`
  for (const r of plan.roots) {
    trunk += `<path d="${branchStroke(r.pts, r.w, 0.9, noise, rng.next() * 8, 0.1, tol)}" fill="${pal.ink}"/>`
  }
  trunk = `<g class="bi-trunk bi-piece" style="--i:${ctx.nextPiece()}">${trunk}</g>`

  const front = layer(false)
  return { back, trunk, front }
}
