// ---------------------------------------------------------------------------
// garden/piece — a garden piece as a loose SVG: sun, moon, tuft and the
// garden motifs (daisy, stone, bush, big leaf, cypress, round tree, hills,
// trail, lantern).
//
// For when the page wants each piece on its own layer (the sky body to move
// it by the hour, a stone to sow it on the ground) instead of inside
// `meadow`. It goes through the same passes as the plate: colors as variables
// and pen according to the final size.
//
// Standing pieces have their foot at the bottom center of the canvas, 4 % above
// the edge (`pieceFoot`). Hills fill the canvas width; the trail fills the
// canvas and is meant to lie flat.
// ---------------------------------------------------------------------------

import { num } from '../../core/math'
import { resolvePalette, type Palette, type PaletteId } from '../../core/palette'
import { finishSvg, ENGINE_VERSION, type ColorMode } from '../../render'
import { bigLeaf, bush, cypress, daisy, hills, lantern, roundTree, stone, trail } from './motifs'
import { moon, pen, sun, tuft } from './pieces'

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

/** The garden motifs: pieces with their own canvas and quality gate. */
export type MotifPieceKind = Exclude<PieceKind, 'sun' | 'moon' | 'tuft'>

export const MOTIF_PIECES: readonly MotifPieceKind[] = ['daisy', 'stone', 'bush', 'leaf', 'cypress', 'round-tree', 'hills', 'trail', 'lantern']

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
}

/** Foot of a standing piece on its canvas. */
export const pieceFoot = (width: number, height: number) => ({ x: width / 2, y: height * 0.96 })

function motifBody(kind: MotifPieceKind, seed: number, pal: Palette, W: number, H: number): string {
  const p = pen(seed)
  const foot = pieceFoot(W, H)
  const flower = pal.flower ?? pal.accent
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
      body = moon(pen(seed), c, S * 0.25, pal.ink, pal.flower ?? pal.accent, opts.phase === undefined ? undefined : { phase: opts.phase })
    else body = tuft(pen(seed), { x: S / 2, y: S * 0.96 }, S * 0.8, 3 + (seed % 4), pal.ink, pal.shade)
  } else {
    const def = PIECE_CANVAS[opts.kind]
    if (!def) throw new Error(`unknown piece: ${String(opts.kind)}`)
    const wide = opts.width ?? opts.size
    W = wide ?? def.width
    H = opts.height ?? (wide !== undefined ? (W * def.height) / def.width : def.height)
    body = motifBody(opts.kind, seed, pal, W, H)
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(W)} ${num(H)}" width="${num(dw ?? W)}" height="${num(dw ? (dw * H) / W : H)}" ` +
    `aria-hidden="true" data-biome="piece" data-engine="${ENGINE_VERSION}" data-seed="${seed}" data-piece="${opts.kind}">` +
    body +
    `</svg>`
  return finishSvg(svg, pal, opts.colors, dw ? dw / W : undefined)
}
