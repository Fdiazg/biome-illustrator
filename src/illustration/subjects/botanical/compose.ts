// ---------------------------------------------------------------------------
// botanical/compose — the botanical plate.
//
// Everything derives from an axis (the stem), which is populated with nodes. Each node can
// carry a leaf on one side, on both, or none. Flowers go last.
//
// Frozen: its drawing must not change. It reads two options from the
// context without changing the randomness:
// - `ground: false` does not emit the ground line (loose motifs);
// - `growth < 1` draws the young plant: the randomness of the whole plant is
//   consumed and only what has already grown is emitted. With `growth` = 1 or without the
//   option, no new branch runs.
// ---------------------------------------------------------------------------

import {
  add,
  clamp,
  frameAt,
  lerp,
  mul,
  num,
  perp,
  rad,
  smoothstep,
  type Pt,
} from '../../core/math'
import { hatchPath, tapered, withOvershoot, wobble } from '../../core/path'
import {
  leafGeometry,
  leafSpine,
  leafStripes,
  leafVeins,
  type LeafGeometry,
} from '../../core/leaf'
import { petalGeometry, petalOutline } from '../../core/flower'
import { growthPlan, type GrowthPlan } from './growth'
import type { ComposeCtx, ComposeResult } from '../types'
import { SPECIMENS, type LeafColor, type SpeciesConfig, type SpeciesId } from './species'

interface BotanicalCtx extends ComposeCtx {
  cfg: SpeciesConfig
  /** the fills of the last two leaves, newest first */
  lastFills?: { pattern: string; color: string }[]
}

const colorOf = (ctx: BotanicalCtx, color: LeafColor): string | null => {
  if (color === 'ink') return ctx.pal.ink
  if (color === 'accent') return ctx.pal.accent
  if (color === 'accentAlt') return ctx.pal.accentAlt
  if (color === 'shade') return ctx.pal.shade
  return null
}

/** Point of the axis at a normalized height. */
function spineAt(spine: Pt[], t: number) {
  const idx = clamp(t, 0, 1) * (spine.length - 1)
  const i = Math.floor(idx)
  const f = idx - i
  const a = spine[Math.min(i, spine.length - 1)]
  const b = spine[Math.min(i + 1, spine.length - 1)]
  return { ...frameAt(spine, i), p: { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) } }
}

function buildLeafSvg(
  base: Pt,
  tip: Pt,
  bend: number,
  width: number,
  index: number,
  ctx: BotanicalCtx,
): string {
  const { rng, noise, pal, cfg } = ctx
  const phase = rng.next() * 12
  const raw = leafSpine(base, tip, bend, 34)
  const sp = wobble(raw, 0.55 * cfg.leaf.roughness, noise, 0.32, phase)
  const geom: LeafGeometry = leafGeometry(sp, width, rng.range(-0.1, 0.1), cfg.leaf.profile)

  // Each leaf draws its own fill. Two ink blades in a row would merge into one
  // black blot, and three leaves alike lose the rhythm, so those draw again.
  // Never "two consecutive leaves differ": with two fills and alternate leaves
  // that puts every filled leaf on the same side.
  let fill = rng.weighted(cfg.leaf.fills, (f) => f.weight)
  const same = (a: { pattern: string; color: string }, b?: { pattern: string; color: string }) =>
    !!b && a.pattern === b.pattern && a.color === b.color
  const [prev, before] = ctx.lastFills ?? []
  if (same(fill, prev) && (fill.color === 'ink' || same(fill, before))) {
    const pool = cfg.leaf.fills.filter((f) => !same(f, fill))
    if (pool.length) fill = rng.weighted(pool, (f) => f.weight)
  }
  ctx.lastFills = [{ pattern: fill.pattern, color: fill.color }, ...(ctx.lastFills ?? []).slice(0, 1)]
  const color = colorOf(ctx, fill.color)
  const offset = ctx.registration
  // On an ink blade, the veins are cut out in paper color: drawing them
  // in black made them disappear.
  const line = fill.color === 'ink' ? pal.paper : pal.ink

  let out = ''

  if (fill.pattern === 'solid' && color) {
    const shift = offset ? ` transform="translate(${num(offset)} ${num(offset * 0.7)})"` : ''
    out += `<path d="${geom.d}" fill="${color}"${shift}/>`
  }

  if (fill.pattern === 'herringbone') {
    out += `<path d="${leafVeins(geom, 13, 0.1)}" fill="none" stroke="${line}" stroke-width="1.2" stroke-linecap="round"/>`
  }

  if (fill.pattern === 'hatch') {
    const hatch = hatchPath(geom.bbox, -38, 5.8, rng.range(0, 6))
    out += `<g clip-path="${ctx.clip(geom.d)}"><path d="${hatch}" fill="none" stroke="${line}" stroke-width="1.15"/></g>`
  }

  if (fill.pattern === 'stripes') {
    out += `<path d="${leafStripes(geom, [-0.66, -0.34, 0, 0.34, 0.66])}" fill="none" stroke="${line}" stroke-width="1.2" stroke-linecap="round"/>`
  }

  if (fill.pattern !== 'stripes') {
    const veins = fill.pattern === 'herringbone' ? '' : leafVeins(geom, cfg.leaf.veins, 0.12)
    if (veins) {
      out += `<path d="${veins}" fill="none" stroke="${line}" stroke-width="0.95" stroke-linecap="round"/>`
    }
    const ribWidth = fill.pattern === 'herringbone' ? 1.9 : 1.4
    out += `<path d="${tapered(geom.spine, (t) => ribWidth * (1 - 0.55 * t))}" fill="${line}"/>`
  }

  // The outline is drawn as an open loop: it enters and leaves through the base, and the
  // width breathes. At the end the pen goes a little past the mark.
  const penPath = withOvershoot(geom.outline, cfg.leaf.overshoot)
  const outline = tapered(penPath, (t) => {
    const pulse = Math.pow(Math.sin(Math.PI * t), 0.45)
    const grain = 0.92 + 0.16 * noise(t * 6.5 + phase * 3)
    const tail = 1 - smoothstep(0.9, 1, t) * 0.72
    return cfg.leaf.outline * (0.46 + 0.54 * pulse) * grain * tail
  })
  out += `<path d="${outline}" fill="${pal.ink}"/>`

  return `<g class="bi-leaf bi-piece" style="--i:${index}">${out}</g>`
}

function buildFlowerSvg(center: Pt, size: number, petals: number, ctx: BotanicalCtx): string {
  const { rng, noise, pal, cfg } = ctx
  const spec = cfg.flower!
  const baseAngle = rng.range(0, Math.PI * 2)
  const items = []

  for (let i = 0; i < petals; i++) {
    const angle = baseAngle + (i * Math.PI * 2) / petals + rng.range(-0.17, 0.17)
    const length = size * rng.range(0.82, 1.12)
    items.push(
      petalGeometry(center, angle, length, length * rng.range(spec.petalWidth[0], spec.petalWidth[1])),
    )
  }

  // the corolla uses its own role if the palette defines it
  const fillColor = spec.fill === 'accent' ? (pal.flower ?? pal.accent) : pal.accentAlt
  const shift = ctx.registration
    ? ` transform="translate(${num(ctx.registration)} ${num(ctx.registration * 0.8)})"`
    : ''
  const wash = `<g${shift} opacity="0.94">${items
    .map((p) => `<path d="${p.d}" fill="${fillColor}"/>`)
    .join('')}</g>`

  const ink = items
    .map((p, i) => {
      const points = withOvershoot(petalOutline(p, noise, i * 3.7 + 1.2), 6, 0.6)
      const d = tapered(points, (t) => {
        const pulse = Math.pow(Math.sin(Math.PI * t), 0.4)
        return spec.outline * (0.3 + 0.7 * pulse)
      })
      return `<path d="${d}" fill="${pal.ink}"/>`
    })
    .join('')

  const dot =
    spec.center > 0
      ? `<circle cx="${num(center.x)}" cy="${num(center.y)}" r="${num(size * spec.center)}" fill="${pal.ink}"/>`
      : ''

  return `<g class="bi-flower" transform="rotate(${num(rng.range(-26, 26))} ${num(center.x)} ${num(center.y)})">${wash}${ink}${dot}</g>`
}

/**
 * Bud: a closed petal, in the color of the flower, on the tip of the stem.
 * It is geometry without randomness: it does not move the plant's sequence.
 */
function buildBud(top: Pt, size: number, ctx: BotanicalCtx): string {
  const { noise, pal, cfg } = ctx
  const spec = cfg.flower!
  const length = 40 * size
  const petal = petalGeometry({ x: top.x, y: top.y + 2 }, -Math.PI / 2 + 0.12, length, length * 0.42)
  const color = spec.fill === 'accent' ? (pal.flower ?? pal.accent) : pal.accentAlt
  const shift = ctx.registration
    ? ` transform="translate(${num(ctx.registration * 0.6)} ${num(ctx.registration * 0.5)})"`
    : ''
  const line = tapered(withOvershoot(petalOutline(petal, noise, 4.1), 3, 0.5), (t) => {
    return spec.outline * 0.8 * (0.3 + 0.7 * Math.pow(Math.sin(Math.PI * t), 0.4))
  })
  return `<g class="bi-bud"><path d="${petal.d}" fill="${color}"${shift}/><path d="${line}" fill="${pal.ink}"/></g>`
}

export function composeBotanical(id: SpeciesId, base: ComposeCtx): ComposeResult {
  const cfg = SPECIMENS[id] ?? SPECIMENS.flat
  const ctx: BotanicalCtx = { ...base, cfg }
  const { rng, noise, pal } = ctx
  // young plant: null if it is whole (the usual branch)
  const young: GrowthPlan | null = growthPlan(ctx.growth)
  const W = ctx.width
  const H = ctx.height

  const margin = 58
  const baseY = H - 86
  const baseX = W / 2 + rng.range(-14, 14)
  const stemLen = (baseY - margin) * cfg.stem.length

  // --- stem axis ----------------------------------------------------------
  const SN = 72
  const spine: Pt[] = []
  for (let i = 0; i <= SN; i++) {
    const t = i / SN
    const sway = noise(t * 2.3 + 7.3) * cfg.stem.wobble * smoothstep(0, 0.24, t)
    spine.push({
      x: baseX + cfg.stem.lean * stemLen * t * t + sway,
      y: baseY - stemLen * t,
    })
  }

  const stemWidth = cfg.stem.width
  let stemD = tapered(
    wobble(spine, 0.3, noise, 0.4, 2.1),
    (t) => stemWidth * (1 - 0.55 * t) * (1 + 0.07 * Math.sin(t * 9 + 1)),
  )
  // the young plant is the same stem, cut where it had grown to
  const grown = young ? spine.slice(0, Math.max(3, Math.round(young.top * SN) + 1)) : spine
  if (young) {
    const w = stemWidth * young.stem
    stemD = tapered(
      wobble(grown, 0.3, noise, 0.4, 2.1),
      (t) => w * (1 - 0.62 * t) * (1 + 0.07 * Math.sin(t * 9 + 1)),
    )
  }
  const stemSvg = `<g class="bi-piece" style="--i:${ctx.nextPiece()}"><path d="${stemD}" fill="${pal.ink}"/></g>`

  // --- ground -------------------------------------------------------------
  let groundSvg = ''
  if (cfg.ground) {
    const points: Pt[] = []
    for (let i = 0; i <= 26; i++) {
      const t = i / 26
      points.push({
        x: lerp(baseX - 168, baseX + 132, t),
        y: baseY + 4 + noise(t * 3.2 + 11) * 0.9,
      })
    }
    const d = tapered(points, (t) => 2 * (0.2 + 0.8 * Math.pow(Math.sin(Math.PI * t), 0.4)))
    groundSvg = `<g class="bi-piece" style="--i:${ctx.nextPiece()}"><path d="${d}" fill="${pal.ink}"/></g>`
    if (ctx.ground === false) groundSvg = ''
  }

  // --- leaves -------------------------------------------------------------
  const nodeT: number[] = []
  {
    let t = cfg.nodes.from
    while (t <= cfg.nodes.to) {
      nodeT.push(t)
      t += rng.range(cfg.nodes.spacing[0], cfg.nodes.spacing[1])
    }
  }

  const back: string[] = []
  const front: string[] = []
  const firstSide: 1 | -1 = rng.chance(0.5) ? 1 : -1

  nodeT.forEach((t, index) => {
    const sides: Array<1 | -1> =
      cfg.nodes.mode === 'opposite'
        ? [1, -1]
        : cfg.nodes.mode === 'random'
          ? [rng.chance(0.5) ? 1 : -1]
          : [index % 2 === 0 ? firstSide : (-firstSide as 1 | -1)]

    for (const side of sides) {
      // in opposite pairs, the second leaf droops a little: nothing in
      // nature is at the exact same height
      const shifted =
        t +
        (cfg.nodes.mode === 'opposite'
          ? side === 1
            ? 0
            : rng.range(-0.016, 0.016)
          : rng.range(-0.009, 0.009))
      const { p, tan } = spineAt(spine, clamp(shifted, 0.02, 0.97))
      const angleDeg = rng.range(cfg.leaf.angle[0], cfg.leaf.angle[1])
      const angle = Math.atan2(tan.y, tan.x) + side * rad(angleDeg)
      const dir: Pt = { x: Math.cos(angle), y: Math.sin(angle) }
      let petiole = rng.range(cfg.leaf.petiole[0], cfg.leaf.petiole[1])
      // young leaf: smaller, and more so the closer to the growing tip
      const leafScale = young ? young.leaf(shifted) : 1
      if (young) petiole *= leafScale
      const leafBase = add(p, mul(dir, petiole))

      let length =
        rng.range(cfg.leaf.length[0], cfg.leaf.length[1]) *
        (1 - cfg.leaf.shrink * t) *
        (0.86 + 0.26 * rng.next())
      if (young) length *= leafScale

      // keep the leaf from leaving the plate
      const rawTip = add(leafBase, mul(dir, length))
      const over = Math.max(
        0,
        margin - rawTip.x,
        rawTip.x - (W - margin),
        margin - rawTip.y,
        rawTip.y - (H - margin),
      )
      length = Math.max(young ? 34 * leafScale : 34, length - over * 1.04)

      const tip = add(leafBase, mul(dir, length))
      const nrm = perp(dir)
      const upSign = nrm.y > 0 ? -1 : 1
      const curl = rng.chance(1 - cfg.leaf.droop) ? upSign : -upSign
      const bend = curl * rng.range(0.6, 1.15) * cfg.leaf.bend

      let leaf = ''
      if (petiole > 2) {
        const mid = add(add(p, mul(dir, petiole * 0.5)), mul(nrm, petiole * 0.14))
        leaf += `<path d="${tapered(wobble([p, mid, leafBase], 0.2, noise, 0.6, t * 9), (u) => 1.9 * (1 - 0.35 * u))}" fill="${pal.ink}"/>`
      }
      leaf += buildLeafSvg(leafBase, tip, bend, (length * cfg.leaf.aspect) / 2, ctx.nextPiece(), ctx)

      // what has not sprouted yet is drawn anyway (it consumes randomness) and discarded
      if (young && shifted > young.reach) continue
      if (side === -1) back.push(leaf)
      else front.push(leaf)
    }
  })

  // --- flowers ------------------------------------------------------------
  const flowers: string[] = []
  if (cfg.flower) {
    const fl = cfg.flower
    const count = rng.int(fl.count[0], fl.count[1])
    const size = () => rng.range(fl.size[0], fl.size[1])
    const petals = () => rng.int(fl.petals[0], fl.petals[1])

    const top = grown[grown.length - 1]
    const stalk = rng.range(fl.stalk[0], fl.stalk[1])
    const terminal: Pt = { x: top.x + rng.range(-7, 7), y: top.y - stalk }

    if (stalk > 3) {
      const mid = { x: (top.x + terminal.x) / 2 + rng.range(-4, 4), y: (top.y + terminal.y) / 2 }
      const d = `<path d="${tapered([top, mid, terminal], (t) => 1.5 * (1 - 0.4 * t))}" fill="${pal.ink}"/>`
      if (!young || young.bloom > 0) flowers.push(d)
    }
    if (!young) {
      flowers.push(
        `<g class="bi-piece" style="--i:${ctx.nextPiece()}">${buildFlowerSvg(terminal, size(), petals(), ctx)}</g>`,
      )
    } else {
      // the flower is always composed (randomness); it is emitted open, as a bud, or not at all
      const s = size() * young.flowerSize
      const svg = buildFlowerSvg(terminal, s, petals(), ctx)
      const piece = ctx.nextPiece()
      if (young.bloom > 0) flowers.push(`<g class="bi-piece" style="--i:${piece}">${svg}</g>`)
      else if (young.bud > 0) flowers.push(`<g class="bi-piece" style="--i:${piece}">${buildBud(top, young.bud, ctx)}</g>`)
    }

    const flowerSide: 1 | -1 = rng.chance(0.5) ? 1 : -1
    for (let i = 1; i < count; i++) {
      const t = 0.62 + i * 0.07 + rng.range(-0.03, 0.03)
      const { p } = spineAt(spine, t)
      const side: 1 | -1 = (i % 2 === 1 ? flowerSide : -flowerSide) as 1 | -1
      const lift = rad(rng.range(8, 22))
      const dir = { x: side * Math.cos(lift), y: -Math.sin(lift) }
      const len = rng.range(112, 150)
      const center = add(p, mul(dir, len))
      const ctrl = add(add(p, mul(dir, len * 0.55)), { x: 0, y: -len * 0.1 })
      const pedicel = `<path d="${tapered(wobble([p, ctrl, center], 0.3, noise, 0.5, i * 7), (u) => 1.4 * (1 - 0.35 * u))}" fill="${pal.ink}"/>`
      const sideFlower =
        `<g class="bi-piece" style="--i:${ctx.nextPiece()}">${pedicel}${buildFlowerSvg(center, size(), petals(), ctx)}</g>`
      // in the young plant the side flowers only appear with the whole plant
      if (!young) flowers.push(sideFlower)
    }
  }

  return {
    body: [groundSvg, ...back, stemSvg, ...front, ...flowers].filter(Boolean).join(''),
    origin: { x: baseX, y: baseY },
    sway: true,
  }
}
