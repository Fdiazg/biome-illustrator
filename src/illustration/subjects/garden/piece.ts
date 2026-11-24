// ---------------------------------------------------------------------------
// garden/piece — a garden piece as a loose SVG: sun, moon, tuft and the
// garden motifs (daisy, stone, bush, big leaf, cypress, round tree, hills,
// trail, lantern), and the second set (cage lantern, boulder, stone cluster,
// grass clump, bed, sprig, cypress group, shrub, broad tree).
//
// For when the page wants each piece on its own layer (the sky body to move
// it by the hour, a stone to sow it on the ground) instead of inside
// `meadow`. It goes through the same passes as the plate: colors as variables
// and pen according to the final size.
//
// Standing pieces have their foot at the bottom center of the canvas, 4 % above
// the edge (`pieceFoot`). Hills fill the canvas width; the trail fills the
// canvas and is meant to lie flat; so does the bed, centered on its canvas.
// ---------------------------------------------------------------------------

import { num } from '../../core/math'
import { resolvePalette, type Palette, type PaletteId } from '../../core/palette'
import { finishSvg, ENGINE_VERSION, type ColorMode } from '../../render'
import { bigLeaf, bush, cypress, daisy, hills, lantern, roundTree, stone, trail } from './motifs'
import { moon, pen, sun, tuft } from './pieces'
import { bed, boulder, broadTree, cageLantern, cypressGroup, grassClump, shrub, sprig, stoneCluster, type CageLanternLayer } from './details'
import { lum, mix } from '../dunes/tone'

export type PieceKind =
  | 'sun'
  | 'moon'
  | 'tuft'
  | 'daisy'
  | 'stone'
  | 'bush'
  | 'leaf'
  | 'cypress'
  | 'round-tree'
  | 'hills'
  | 'trail'
  | 'lantern'
  | 'cage-lantern'
  | 'boulder'
  | 'stone-cluster'
  | 'grass-clump'
  | 'bed'
  | 'sprig'
  | 'cypress-group'
  | 'shrub'
  | 'broad-tree'

/** The garden motifs: pieces with their own canvas and quality gate. */
export type MotifPieceKind = Exclude<PieceKind, 'sun' | 'moon' | 'tuft'>

export const MOTIF_PIECES: readonly MotifPieceKind[] = [
  'daisy',
  'stone',
  'bush',
  'leaf',
  'cypress',
  'round-tree',
  'hills',
  'trail',
  'lantern',
  'cage-lantern',
  'boulder',
  'stone-cluster',
  'grass-clump',
  'bed',
  'sprig',
  'cypress-group',
  'shrub',
  'broad-tree',
]

export interface PieceOptions {
  kind: PieceKind
  seed: number
  palette: PaletteId | Palette
  /** side of the square canvas of sun, moon and tuft, in units. Default 160. For a motif, its width (keeping its aspect) */
  size?: number
  /** canvas of a motif, in units (overrides `size`) */
  width?: number
  height?: number
  /** rays of the sun. Default true */
  rays?: boolean
  /** lunar phase of the moon, 0..1 (0 new, 0.5 full). Without it, the fixed crescent */
  phase?: number
  /** moon with `phase`: flat patches (maria) on the lit part. Default false */
  maria?: boolean
  /** cage lantern: candle burning, with flame and halo. Default true */
  lit?: boolean
  /** cage lantern: one layer only (`halo`, `fill`, `glass` or `ink`). Default `all` */
  layer?: CageLanternLayer
  /** bed: height / width of the patch (0.15..0.6). Default by seed */
  ratio?: number
  /** bed: a rim of small stones. Default by seed */
  rim?: boolean
  /** grass clump and stone cluster: grass density multiplier. Default 1 */
  density?: number
  /** cypress group: trees (2..5); stone cluster: stones (2..4). Default by seed */
  count?: number
  /** stone cluster: daisies (0..3). Default by seed */
  flowers?: number
  colors?: ColorMode
  /** final width in px: thickens the pen if small */
  displayWidth?: number
}

/** Default canvas of each motif, in units. */
export const PIECE_CANVAS: Record<MotifPieceKind, { width: number; height: number }> = {
  daisy: { width: 120, height: 160 },
  stone: { width: 160, height: 100 },
  bush: { width: 220, height: 140 },
  leaf: { width: 320, height: 320 },
  cypress: { width: 90, height: 240 },
  'round-tree': { width: 220, height: 240 },
  hills: { width: 800, height: 240 },
  trail: { width: 240, height: 640 },
  lantern: { width: 180, height: 240 },
  'cage-lantern': { width: 240, height: 260 },
  boulder: { width: 160, height: 110 },
  'stone-cluster': { width: 300, height: 180 },
  'grass-clump': { width: 160, height: 120 },
  bed: { width: 320, height: 170 },
  sprig: { width: 110, height: 150 },
  'cypress-group': { width: 200, height: 240 },
  shrub: { width: 220, height: 120 },
  'broad-tree': { width: 260, height: 260 },
}

/** Foot of a standing piece on its canvas. */
export const pieceFoot = (width: number, height: number) => ({ x: width / 2, y: height * 0.96 })

type PieceExtras = Pick<PieceOptions, 'lit' | 'layer' | 'ratio' | 'rim' | 'density' | 'count' | 'flowers'>

function motifBody(kind: MotifPieceKind, seed: number, pal: Palette, W: number, H: number, x: PieceExtras = {}): string {
  const p = pen(seed)
  const foot = pieceFoot(W, H)
  const flower = pal.flower ?? pal.accent
  // the second set reads light and dark from the paper: on a dark paper the ink is the light tone
  const dark = lum(pal.paper) < 0.5
  const light = dark ? pal.ink : pal.mid
  const stoneColors = () => ({ ink: pal.ink, fill: pal.accentAlt, top: mix(pal.accentAlt, light, dark ? 0.3 : 0.45), grass: pal.shade })
  switch (kind) {
    case 'daisy':
      return daisy(p, foot, H * p.rng.range(0.62, 0.86), { ink: pal.ink, petal: pal.paper, center: flower, leaf: pal.shade })
    case 'stone': {
      const w = W * p.rng.range(0.5, 0.85)
      return stone(p, foot, w, Math.min(H * 0.86, w * p.rng.range(0.3, 0.5)), pal.ink, pal.accentAlt)
    }
    case 'bush':
      return bush(p, foot, W * p.rng.range(0.6, 0.9), H * p.rng.range(0.6, 0.88), pal.ink, pal.shade, pal.shade)
    case 'leaf':
      return bigLeaf(p, foot, H * p.rng.range(0.7, 0.9), p.rng.range(-0.35, 0.35), p.rng.int(1, 3), pal.ink, pal.shade)
    case 'cypress':
      return cypress(p, foot, H * p.rng.range(0.78, 0.94), pal.ink, pal.shade)
    case 'round-tree':
      return roundTree(p, foot, H * p.rng.range(0.78, 0.94), pal.ink, pal.shade)
    case 'hills':
      return hills(p, W, H, pal.ink, pal.accentAlt, { layers: p.rng.int(3, 4) })
    case 'trail':
      return trail(p, W, H, pal.ink, pal.accent)
    case 'lantern':
      return lantern(p, foot, H * p.rng.range(0.8, 0.92), { ink: pal.ink, body: pal.shade, glass: flower })
    case 'cage-lantern':
      return cageLantern(
        p,
        foot,
        H * p.rng.range(0.82, 0.9),
        {
          ink: pal.ink,
          body: dark ? mix(pal.paper, pal.accent, 0.3) : mix(pal.ink, pal.accent, 0.28),
          glass: flower,
          flame: mix(flower, light, 0.5),
          candle: mix(light, flower, 0.12),
          halo: flower,
        },
        { lit: x.lit, layer: x.layer },
      )
    case 'boulder': {
      const w = W * p.rng.range(0.55, 0.85)
      return boulder(p, foot, w, Math.min(H * 0.78, w * p.rng.range(0.45, 0.65)), stoneColors())
    }
    case 'stone-cluster':
      return stoneCluster(
        p,
        foot,
        W * p.rng.range(0.74, 0.84),
        { ...stoneColors(), leaf: pal.shade, petal: dark ? pal.ink : pal.paper, center: flower },
        { stones: x.count, flowers: x.flowers, grass: x.density },
      )
    case 'grass-clump':
      return grassClump(p, foot, H * p.rng.range(0.75, 0.92), { ink: pal.ink, fill: pal.shade }, { density: x.density })
    case 'bed': {
      const rim = x.rim ?? p.rng.chance(0.5)
      return bed(
        p,
        { x: W / 2, y: H / 2 },
        W * p.rng.range(0.84, 0.9),
        { ink: pal.ink, fill: dark ? mix(pal.accent, pal.paper, 0.45) : mix(pal.accent, light, 0.5), pebble: pal.accentAlt },
        { ratio: x.ratio, rim },
      )
    }
    case 'sprig':
      return sprig(p, { x: W * 0.3, y: foot.y }, H * p.rng.range(0.86, 0.92), pal.ink)
    case 'cypress-group':
      return cypressGroup(p, foot, W * 0.7, H * p.rng.range(0.82, 0.94), pal.ink, pal.shade, { count: x.count })
    case 'shrub':
      return shrub(p, foot, W * p.rng.range(0.8, 0.92), H * p.rng.range(0.62, 0.85), pal.ink, pal.shade)
    case 'broad-tree':
      return broadTree(p, foot, H * p.rng.range(0.82, 0.92), pal.ink, pal.shade)
  }
}

export function renderPiece(opts: PieceOptions): string {
  const pal = resolvePalette(opts.palette)
  const seed = Number.isFinite(opts.seed) ? Math.abs(Math.floor(opts.seed)) : 1
  const dw = opts.displayWidth && opts.displayWidth > 0 ? opts.displayWidth : undefined
  let W: number
  let H: number
  let body: string
  if (opts.kind === 'sun' || opts.kind === 'moon' || opts.kind === 'tuft') {
    const S = opts.size ?? 160
    W = H = S
    const c = { x: S / 2, y: S / 2 }
    if (opts.kind === 'sun') body = sun(pen(seed), c, S * 0.26, pal.ink, pal.accent, opts.rays !== false)
    else if (opts.kind === 'moon')
      body = moon(
        pen(seed),
        c,
        S * 0.25,
        pal.ink,
        pal.flower ?? pal.accent,
        opts.phase === undefined ? undefined : opts.maria ? { phase: opts.phase, maria: true } : { phase: opts.phase },
      )
    else body = tuft(pen(seed), { x: S / 2, y: S * 0.96 }, S * 0.8, 3 + (seed % 4), pal.ink, pal.shade)
  } else {
    const def = PIECE_CANVAS[opts.kind]
    if (!def) throw new Error(`unknown piece: ${String(opts.kind)}`)
    const wide = opts.width ?? opts.size
    W = wide ?? def.width
    H = opts.height ?? (wide !== undefined ? (W * def.height) / def.width : def.height)
    body = motifBody(opts.kind, seed, pal, W, H, opts)
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(W)} ${num(H)}" width="${num(dw ?? W)}" height="${num(dw ? (dw * H) / W : H)}" ` +
    `aria-hidden="true" data-biome="piece" data-engine="${ENGINE_VERSION}" data-seed="${seed}" data-piece="${opts.kind}">` +
    body +
    `</svg>`
  return finishSvg(svg, pal, opts.colors, dw ? dw / W : undefined)
}
