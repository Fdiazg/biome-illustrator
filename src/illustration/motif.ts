// ---------------------------------------------------------------------------
// motif — a single plant, cropped to its drawing.
//
// The plate is a 620 × 780 canvas with the plant inside. A garden
// needs the opposite: the plant alone, with a tight box, transparent, without
// the ground line and with its anchor point (the foot of the stem) to stand it
// on a horizon. It is the same `compose` of the subject with `ground: false`;
// the box comes from the geometry of the markup, not from rasterizing.
// ---------------------------------------------------------------------------

import { num } from './core/math'
import type { Palette, PaletteId } from './core/palette'
import { markupBBox, penExtra } from './markup'
import {
  animationCss,
  composeScene,
  ENGINE_VERSION,
  finishSvg,
  type ColorMode,
} from './render'

/** Subjects that are a plant with a foot: the ones that make sense as a motif. */
export type MotifSubjectId = 'line' | 'ink' | 'flat' | 'grove'
export const MOTIF_SUBJECTS: readonly MotifSubjectId[] = ['line', 'ink', 'flat', 'grove']

export interface MotifOptions {
  seed: number
  subject: MotifSubjectId
  palette: PaletteId | Palette
  /** canvas it is composed on before cropping; default: the subject's own */
  format?: 'plate' | 'square'
  /** growth state 0..1 (botanical); default 1 */
  growth?: number
  /** px per canvas unit. Default 1. Same scale = comparable plants */
  scale?: number
  /** final width in px; if given, it overrides `scale` */
  displayWidth?: number
  /** margin around the drawing, in canvas units. Default 4 */
  pad?: number
  registration?: number
  colors?: ColorMode
  /** staggered entrance and sway on the foot */
  animate?: boolean
}

export interface MotifBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Motif {
  /** self-contained, transparent SVG, `viewBox="0 0 w h"` */
  svg: string
  /** size in px (width/height attributes) */
  width: number
  height: number
  /** box of the drawing, in viewBox units (without the margin) */
  bbox: MotifBox
  /** foot of the stem, in viewBox units */
  anchor: { x: number; y: number }
  /** foot of the stem as a fraction of the SVG: to place it in px without scaling */
  anchorFrac: { x: number; y: number }
  /** where the viewBox was inside the source canvas */
  source: MotifBox
}

const round2 = (v: number) => Math.round(v * 100) / 100

export function renderMotif(opts: MotifOptions): Motif {
  const growth = opts.growth
  const { seed, subject, pal, format, uid, scene, defs } = composeScene(
    {
      seed: opts.seed,
      subject: opts.subject,
      palette: opts.palette,
      format: opts.format,
      registration: opts.registration,
      growth,
    },
    { ground: false, uidSuffix: 'm' + (typeof opts.palette === 'string' ? opts.palette.replace(/\W/g, '') : '') },
  )

  const foot = scene.origin ?? { x: format.width / 2, y: format.height }
  const raw = markupBBox(scene.body, defs.join('')) ?? { x0: foot.x, y0: foot.y, x1: foot.x, y1: foot.y }
  // the foot always stays inside, even if the stroke ends a hair earlier
  const box = {
    x0: Math.min(raw.x0, foot.x),
    y0: Math.min(raw.y0, foot.y),
    x1: Math.max(raw.x1, foot.x),
    y1: Math.max(raw.y1, foot.y),
  }
  const pad = opts.pad ?? 4
  const drawW = box.x1 - box.x0
  const drawH = box.y1 - box.y0

  // the thickened pen takes up room too: the margin grows with it
  let pxPerUnit = opts.scale && opts.scale > 0 ? opts.scale : 1
  if (opts.displayWidth && opts.displayWidth > 0) pxPerUnit = opts.displayWidth / (drawW + pad * 2)
  const extra = penExtra(pxPerUnit)
  const margin = pad + extra / 2

  const x0 = box.x0 - margin
  const y0 = box.y0 - margin
  const w = round2(drawW + margin * 2)
  const h = round2(drawH + margin * 2)
  if (opts.displayWidth && opts.displayWidth > 0) pxPerUnit = opts.displayWidth / w
  const pw = round2(w * pxPerUnit)
  const ph = round2(h * pxPerUnit)
  const anchor = { x: round2(foot.x - x0), y: round2(foot.y - y0) }

  const body =
    `<g class="bi-plant" style="transform-origin:${num(anchor.x)}px ${num(anchor.y)}px">` +
    `<g transform="translate(${num(-x0)} ${num(-y0)})">${scene.body}</g></g>`

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(w)} ${num(h)}" width="${num(pw)}" height="${num(ph)}" ` +
    `class="${uid}" aria-hidden="true" data-biome="motif" data-engine="${ENGINE_VERSION}" data-seed="${seed}" data-subject="${subject.id}"` +
    (growth !== undefined ? ` data-growth="${num(growth)}"` : '') +
    `>` +
    (opts.animate ? animationCss(uid, scene) : '') +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    body +
    `</svg>`

  return {
    svg: finishSvg(svg, pal, opts.colors, extra > 0 ? pxPerUnit : undefined),
    width: pw,
    height: ph,
    bbox: { x: round2(box.x0 - x0), y: round2(box.y0 - y0), width: round2(drawW), height: round2(drawH) },
    anchor,
    anchorFrac: { x: Math.round((anchor.x / w) * 1e4) / 1e4, y: Math.round((anchor.y / h) * 1e4) / 1e4 },
    source: { x: round2(x0), y: round2(y0), width: w, height: h },
  }
}
