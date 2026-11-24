// ---------------------------------------------------------------------------
// garden/compose — the garden ground: horizon, stream, tufts and a sky body.
//
// It is the stage on which the motifs stand (`renderMotif`), not a finished
// landscape: it leaves air above the horizon for the plants. With dark
// paper (night palettes) the sun becomes a crescent moon.
// ---------------------------------------------------------------------------

import { FORMATS, type FormatId } from '../../core/format'
import { createRng } from '../../core/prng'
import type { ComposeCtx, ComposeResult } from '../types'
import { horizon, moon, pen, stream, sun, tuft, type Horizon } from './pieces'

/** Approximate luminance of a #rrggbb, 0..1. */
function lum(hex: string): number {
  const v = parseInt(hex.replace('#', ''), 16)
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255
}

interface Layout {
  /** height of the horizon, fraction of the height */
  base: number
  /** radius of the sky body, in px */
  R: number
  /** height of the sky body, fraction of the height */
  sky: number
  /** horizontal scale of the stream */
  spread: number
  tufts: [number, number]
  /** height of the tufts, in px */
  tuftH: [number, number]
}

const LAYOUT: Record<string, Layout> = {
  wide: { base: 0.68, R: 34, sky: 0.26, spread: 1, tufts: [8, 12], tuftH: [9, 15] },
  plate: { base: 0.66, R: 46, sky: 0.2, spread: 0.85, tufts: [5, 8], tuftH: [10, 17] },
  square: { base: 0.64, R: 56, sky: 0.2, spread: 1.15, tufts: [6, 9], tuftH: [12, 20] },
}

/**
 * The horizon that `meadow` draws with that seed and format, to ask
 * `y(x)` from outside (where to stand each plant) without parsing the SVG. It repeats the
 * first random call of the composer; if `composeMeadow` changes order,
 * this changes with it.
 */
export function meadowHorizon(seed: number, format: FormatId = 'wide'): Horizon {
  const f = FORMATS[format] ?? FORMATS.wide
  const s = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 1
  const inner = createRng(s).int(1, 2 ** 30)
  const L = LAYOUT[f.id] ?? LAYOUT.wide
  return horizon(inner, f.width, f.height * L.base, f.width < 1000 ? 0.7 : 1)
}

export function composeMeadow(ctx: ComposeCtx): ComposeResult {
  const { rng, pal, width: W, height: H } = ctx
  const L = LAYOUT[ctx.format] ?? LAYOUT.wide
  const night = lum(pal.paper) < 0.35
  const seed = rng.int(1, 2 ** 30)

  // horizon: its own hand, derived from the seed
  const hz = horizon(seed, W, H * L.base, W < 1000 ? 0.7 : 1)

  // the sky body on one side, the stream on the other
  const sunLeft = rng.chance(0.5)
  const sx = W * (sunLeft ? rng.range(0.1, 0.32) : rng.range(0.68, 0.9))
  const sy = H * L.sky + rng.range(-0.04, 0.04) * H
  const R = L.R * rng.range(0.9, 1.1)
  const streamX = W * (sunLeft ? rng.range(0.62, 0.84) : rng.range(0.16, 0.38))
  const streamDir: 1 | -1 = sunLeft ? -1 : 1

  const skyBody = night
    ? moon(pen(seed + 2), { x: sx, y: sy }, R * 0.95, pal.ink, pal.flower ?? pal.accent)
    : sun(pen(seed + 1), { x: sx, y: sy }, R, pal.ink, pal.accent, rng.chance(0.8))

  const water = stream(
    pen(seed + 3),
    hz.y,
    {
      id: `${ctx.uid}-arroyo`,
      x0: streamX,
      bottom: H + 4,
      dir: streamDir,
      spread: L.spread,
      registration: { x: ctx.registration * 1.6, y: ctx.registration },
    },
    pal.ink,
    pal.accentAlt,
  )
  ctx.defs.push(water.defs)

  // tufts: on the horizon, without stepping on the source of the stream
  const p = pen(seed + 9)
  let grass = ''
  const n = rng.int(L.tufts[0], L.tufts[1])
  for (let i = 0; i < n; i++) {
    let x = rng.range(W * 0.03, W * 0.97)
    if (Math.abs(x - streamX) < W * 0.04) x += W * 0.08 * (x < streamX ? -1 : 1)
    grass += tuft(p, { x, y: hz.y(x) }, rng.range(L.tuftH[0], L.tuftH[1]), rng.int(3, 6), pal.ink, pal.shade)
  }

  const body =
    `<g class="bi-sky bi-piece" style="--i:${ctx.nextPiece()}">${skyBody}</g>` +
    `<g class="bi-water bi-piece" style="--i:${ctx.nextPiece()}">${water.body}</g>` +
    `<g class="bi-horizon bi-piece" style="--i:${ctx.nextPiece()}">${hz.body(pal.ink, W < 1000 ? 2.2 : 2.5)}</g>` +
    `<g class="bi-grass bi-piece" style="--i:${ctx.nextPiece()}">${grass}</g>`

  return { body }
}
