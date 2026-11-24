// ---------------------------------------------------------------------------
// quality — is this subject finished?
//
// Three cheap questions that catch what the eye takes a while to admit:
//   1. does it have enough drawing inside?          (paths)
//   2. does it use color hierarchy?                 (tones)
//   3. does the seed change the shape or just shake it? (variation)
//
// Variation is measured with the starting points of each stroke (`M`): they are the
// real anchors of the drawing (base of a leaf, tip of a branch, start of
// a cloud). They are projected onto a grid and occupancy is compared between
// seeds with Jaccard distance.
// ---------------------------------------------------------------------------

import { resolveFormat, type FormatId } from './core/format'
import { renderIllustration, type IllustrationOptions } from './render'
import { PIECE_GATES, SUBJECTS } from './subjects'
import { MOTIF_PIECES, PIECE_CANVAS, renderPiece, type MotifPieceKind } from './subjects/garden/piece'
import type { SubjectId, QualityGate } from './subjects/types'

export interface QualityReport {
  /** subject id, or `piece:<kind>` for a garden motif */
  subject: SubjectId | `piece:${MotifPieceKind}`
  /** plate format; `piece` for a garden motif */
  format: FormatId | 'piece'
  seeds: number[]
  /** `<path>` elements */
  paths: number
  /** animatable groups with class bi-piece */
  pieces: number
  /** distinct fill values */
  tones: number
  /** mean shape distance between seeds, 0..1 */
  variation: number
  /** mean fraction of the canvas covered by the box of the drawing, 0..1 */
  coverage: number
  gate: QualityGate
  passes: boolean
  issues: string[]
}

const GRID = 24

/**
 * Description of each piece: where it is and how big, in coordinates
 * relative to the canvas. Two seeds are compared by how many pieces share
 * position and size. It is more honest than comparing the silhouette: a stable
 * composition with different shapes (a sheet of clouds) is not punished for not
 * moving around.
 */
function descriptors(svg: string, W: number, H: number): Set<string> {
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '')
  const out = new Set<string>()
  for (const match of body.matchAll(/<path\b[^>]*>/g)) {
    const tag = match[0]
    if (!/fill="#/.test(tag)) continue
    const d = tag.match(/\sd="([^"]+)"/)
    if (!d) continue
    const nums = d[1].match(/-?\d+(?:\.\d+)?/g)
    if (!nums || nums.length < 6) continue
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i])
      const y = Number(nums[i + 1])
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    const q = (v: number) => Math.max(0, Math.min(GRID - 1, Math.round(v * GRID)))
    out.add(
      [
        q((x0 + x1) / 2 / W),
        q((y0 + y1) / 2 / H),
        q(Math.abs(x1 - x0) / W),
        q(Math.abs(y1 - y0) / H),
      ].join(':'),
    )
  }
  return out
}

/**
 * Box of the drawing clipped to the canvas, as a fraction of the area. All
 * `<path>` outside `<defs>` are counted: what matters is where there is ink, not
 * which piece it is.
 */
function coverageOf(svg: string, W: number, H: number): number {
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '')
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const match of body.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) {
    const nums = match[1].match(/-?\d+(?:\.\d+)?/g)
    if (!nums) continue
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Math.max(0, Math.min(W, Number(nums[i])))
      const y = Math.max(0, Math.min(H, Number(nums[i + 1])))
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (!Number.isFinite(x0)) return 0
  return ((x1 - x0) * (y1 - y0)) / (W * H)
}

function jaccardDistance(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let shared = 0
  for (const cell of a) if (b.has(cell)) shared++
  const union = a.size + b.size - shared
  return union === 0 ? 0 : 1 - shared / union
}

export const DEFAULT_SEEDS = [4821, 7391, 1902, 611, 47, 9031, 271, 5150]

export interface AuditOptions {
  seeds?: number[]
  palette?: IllustrationOptions['palette']
  format?: FormatId
}

export function auditSubject(subject: SubjectId, options: AuditOptions = {}): QualityReport {
  const seeds = options.seeds ?? DEFAULT_SEEDS
  const def = SUBJECTS[subject]
  const fmt = resolveFormat(def.formats, options.format)
  const format = fmt.id
  const palette = options.palette ?? 'herbarium'

  const svgs = seeds.map((seed) =>
    renderIllustration({
      seed,
      subject,
      palette,
      format,
      registration: 2.5,
      animate: false,
      grain: false,
      paper: false,
    }),
  )

  const first = svgs[0]
  const paths = (first.match(/<path /g) ?? []).length
  const pieces = (first.match(/bi-piece/g) ?? []).length
  const tones = new Set(
    [...first.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase()),
  ).size

  const size = fmt
  const W = size.width
  const H = size.height

  const signatures = svgs.map((svg) => descriptors(svg, W, H))
  let total = 0
  for (let i = 1; i < signatures.length; i++) {
    total += jaccardDistance(signatures[0], signatures[i])
  }
  const variation = signatures.length > 1 ? total / (signatures.length - 1) : 0
  const coverage = svgs.reduce((sum, svg) => sum + coverageOf(svg, W, H), 0) / svgs.length

  const issues: string[] = []
  if (paths < def.quality.minPaths) {
    issues.push(`${paths} paths (min ${def.quality.minPaths}): not enough detail`)
  }
  if (tones < def.quality.minTones) {
    issues.push(`${tones} tones (min ${def.quality.minTones}): no color hierarchy`)
  }
  if (variation < def.quality.minVariation) {
    issues.push(
      `${(variation * 100).toFixed(1)}% variation (min ${(def.quality.minVariation * 100).toFixed(0)}%): the seed does not change the shape`,
    )
  }

  const minCoverage = def.quality.minCoverage
  if (minCoverage !== undefined && coverage < minCoverage) {
    issues.push(
      `${(coverage * 100).toFixed(0)}% coverage (min ${(minCoverage * 100).toFixed(0)}%): the drawing does not fill the format`,
    )
  }

  return {
    subject,
    format,
    seeds,
    paths,
    pieces,
    tones,
    variation,
    coverage,
    gate: def.quality,
    passes: issues.length === 0,
    issues,
  }
}

/**
 * Without `format`, audits each subject in every format it declares: a
 * subject that looks good as a plate and bad as a band is not finished.
 */
export function auditAll(options: AuditOptions = {}): QualityReport[] {
  return (Object.keys(SUBJECTS) as SubjectId[]).flatMap((subject) => {
    const formats = options.format
      ? [options.format]
      : [...SUBJECTS[subject].formats]
    return formats
      .filter((format) => SUBJECTS[subject].formats.includes(format))
      .map((format) => auditSubject(subject, { ...options, format }))
  })
}

export function formatReport(report: QualityReport): string {
  const mark = report.passes ? 'PASS' : 'FAIL'
  return [
    `${report.subject.padEnd(report.format === 'piece' ? 16 : 8)} ${report.format.padEnd(6)} ${mark.padEnd(5)}`,
    `${String(report.paths).padStart(4)} paths`,
    `${String(report.pieces).padStart(3)} pieces`,
    `${report.tones} tones`,
    `${(report.variation * 100).toFixed(1).padStart(5)}% variation`,
    `${(report.coverage * 100).toFixed(0).padStart(3)}% coverage`,
    report.issues.length ? `\n           · ${report.issues.join('\n           · ')}` : '',
  ].join('  ')
}

/**
 * Quality of a garden motif (`renderPiece`), on its own canvas: the same
 * four questions as a plate (strokes, tones, variation, coverage) against
 * `PIECE_GATES`.
 */
export function auditPiece(kind: MotifPieceKind, options: Pick<AuditOptions, 'seeds' | 'palette'> = {}): QualityReport {
  const seeds = options.seeds ?? DEFAULT_SEEDS
  const gate = PIECE_GATES[kind]
  const { width: W, height: H } = PIECE_CANVAS[kind]
  const palette = options.palette ?? 'garden'
  const svgs = seeds.map((seed) => renderPiece({ kind, seed, palette }))
  const first = svgs[0]
  const paths = (first.match(/<path /g) ?? []).length
  const tones = new Set([...first.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase())).size
  const signatures = svgs.map((svg) => descriptors(svg, W, H))
  let total = 0
  for (let i = 1; i < signatures.length; i++) total += jaccardDistance(signatures[0], signatures[i])
  const variation = signatures.length > 1 ? total / (signatures.length - 1) : 0
  const coverage = svgs.reduce((sum, svg) => sum + coverageOf(svg, W, H), 0) / svgs.length

  const issues: string[] = []
  if (paths < gate.minPaths) issues.push(`${paths} paths (min ${gate.minPaths}): not enough detail`)
  if (tones < gate.minTones) issues.push(`${tones} tones (min ${gate.minTones}): no color hierarchy`)
  if (variation < gate.minVariation) {
    issues.push(`${(variation * 100).toFixed(1)}% variation (min ${(gate.minVariation * 100).toFixed(0)}%): the seed does not change the shape`)
  }
  if (gate.minCoverage !== undefined && coverage < gate.minCoverage) {
    issues.push(`${(coverage * 100).toFixed(0)}% coverage (min ${(gate.minCoverage * 100).toFixed(0)}%): the drawing does not fill the canvas`)
  }
  return {
    subject: `piece:${kind}`,
    format: 'piece',
    seeds,
    paths,
    pieces: 0,
    tones,
    variation,
    coverage,
    gate,
    passes: issues.length === 0,
    issues,
  }
}

/** Every garden motif. */
export const auditPieces = (options: Pick<AuditOptions, 'seeds' | 'palette'> = {}): QualityReport[] =>
  MOTIF_PIECES.map((kind) => auditPiece(kind, options))
