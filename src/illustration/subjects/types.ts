// ---------------------------------------------------------------------------
// subjects — the engine contract.
//
// A subject is not a drawing: it is a function that fills the plate. It receives randomness,
// noise, palette and a piece counter; it returns SVG markup. Everything that is not
// composition (paper, grain, animation, serialization) is added by the engine.
// ---------------------------------------------------------------------------

import type { FormatId } from '../core/format'
import type { Noise1D } from '../core/noise'
import type { Palette, PaletteId } from '../core/palette'
import type { Rng } from '../core/prng'
import type { Pt } from '../core/math'

export type SubjectId = 'flat' | 'ink' | 'line' | 'cumulus' | 'grove' | 'dunes' | 'meadow'
export type SubjectFamily = 'botanical' | 'sky' | 'landscape'

/**
 * A subject declares what it has to meet to be considered finished. It is not
 * a formality: it is what prevents publishing a subject that gives the same image
 * with any seed.
 */
export interface QualityGate {
  /** minimum strokes (`<path>` elements): measures richness of drawing */
  minPaths: number
  /** distinct fill values (ink, accent, shade, paper…) */
  minTones: number
  /** mean distance between seeds, 0..1 */
  minVariation: number
  /**
   * fraction of the canvas covered by the box of the drawing, 0..1, in each format.
   * Catches the tiny tree in the middle of a band or the cut-off cloud that fills
   * nothing. Optional: subjects that do not declare it are not measured.
   */
  minCoverage?: number
}

export interface ComposeCtx {
  rng: Rng
  noise: Noise1D
  pal: Palette
  defs: string[]
  uid: string
  width: number
  height: number
  format: FormatId
  /** offset in px between the fill and the line (imperfect registration) */
  registration: number
  /** global piece index: drives the delay of the entrance animation */
  nextPiece(): number
  /** registers a clipPath and returns `url(#id)` */
  clip(d: string): string
  /**
   * Optional reads. A subject that does not know them
   * ignores them; one that reads them must give the same SVG when they are missing, and cannot
   * consume the randomness differently because of them.
   */
  /** growth state, 0..1. Missing = 1, the whole plant */
  growth?: number
  /** ground strip, baseline and shadow. Missing = true; the motifs turn it off */
  ground?: boolean
}

export interface ComposeResult {
  /** inner markup, without `<svg>` */
  body: string
  /** pivot center of the sway; if missing, the piece does not sway */
  origin?: Pt
  sway?: boolean
  /** the subject has layers that drift on their own (bands, clouds) */
  ambient?: boolean
}

export interface SubjectDef {
  id: SubjectId
  family: SubjectFamily
  /** name of a herbarium, cloud or landscape; it is the label of the plate */
  latin: string
  note: string
  /** short description for the selector */
  short: string
  /** formats the subject can compose; the first one is the default */
  formats: readonly FormatId[]
  quality: QualityGate
  compose(ctx: ComposeCtx): ComposeResult
}

export type { PaletteId }
