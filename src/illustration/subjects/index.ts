// ---------------------------------------------------------------------------
// subjects/index — the catalog.
// Adding a new subject means adding an entry here, not touching the engine.
// Each subject declares its formats and its own criterion for being finished.
// ---------------------------------------------------------------------------

import { composeBotanical } from './botanical/compose'
import { SPECIMENS } from './botanical/species'
import { composeDunes } from './dunes/compose'
import { composeMeadow } from './garden/compose'
import { DUNES } from './dunes/config'
import { composeGrove } from './grove/compose'
import { GROVE } from './grove/config'
import { composeSky } from './sky/compose'
import { SKY } from './sky/config'
import type { MotifPieceKind } from './garden/piece'
import type { QualityGate, SubjectDef, SubjectId } from './types'

export const SUBJECTS: Record<SubjectId, SubjectDef> = {
  flat: {
    id: 'flat',
    family: 'botanical',
    latin: SPECIMENS.flat.latin,
    note: SPECIMENS.flat.note,
    short: 'flat ink and hatching',
    formats: ['plate', 'square'],
    quality: { minPaths: 60, minTones: 3, minVariation: 0.3 },
    compose: (ctx) => composeBotanical('flat', ctx),
  },
  ink: {
    id: 'ink',
    family: 'botanical',
    latin: SPECIMENS.ink.latin,
    note: SPECIMENS.ink.note,
    short: 'loose line, misregistered color',
    formats: ['plate', 'square'],
    quality: { minPaths: 20, minTones: 2, minVariation: 0.3 },
    compose: (ctx) => composeBotanical('ink', ctx),
  },
  line: {
    id: 'line',
    family: 'botanical',
    latin: SPECIMENS.line.latin,
    note: SPECIMENS.line.note,
    short: 'line only, striate leaves',
    formats: ['plate', 'square'],
    quality: { minPaths: 30, minTones: 1, minVariation: 0.25 },
    compose: (ctx) => composeBotanical('line', ctx),
  },
  grove: {
    id: 'grove',
    family: 'botanical',
    latin: GROVE.latin,
    note: GROVE.note,
    short: 'herbarium tree',
    formats: ['plate', 'square', 'wide'],
    quality: { minPaths: 90, minTones: 3, minVariation: 0.5, minCoverage: 0.45 },
    compose: composeGrove,
  },
  cumulus: {
    id: 'cumulus',
    family: 'sky',
    latin: SKY.latin,
    note: SKY.note,
    short: 'engraved sky',
    formats: ['plate', 'wide', 'square'],
    quality: { minPaths: 30, minTones: 3, minVariation: 0.5, minCoverage: 0.5 },
    compose: composeSky,
  },
  dunes: {
    id: 'dunes',
    family: 'landscape',
    latin: DUNES.latin,
    note: DUNES.note,
    short: 'landscape bands for footers',
    formats: ['wide', 'plate', 'square'],
    quality: { minPaths: 34, minTones: 8, minVariation: 0.5, minCoverage: 0.75 },
    compose: composeDunes,
  },
  // The garden ground: horizon, stream, tufts and sun or moon.
  // It is the stage of the loose motifs; it leaves air above.
  meadow: {
    id: 'meadow',
    family: 'landscape',
    latin: 'Pratum rivulare',
    note: 'hand-drawn horizon, stream and grass tufts; sun by day, crescent moon by night',
    short: 'garden ground',
    formats: ['wide', 'plate', 'square'],
    quality: { minPaths: 30, minTones: 3, minVariation: 0.4, minCoverage: 0.5 },
    compose: composeMeadow,
  },
}

export const SUBJECT_ORDER: SubjectId[] = ['flat', 'ink', 'line', 'grove', 'cumulus', 'dunes', 'meadow']

/**
 * Gates of the garden motifs (`renderPiece`), measured on each motif's own
 * canvas (`PIECE_CANVAS`) like a plate: strokes, tones, variation between
 * seeds and how much of the canvas the drawing takes.
 */
export const PIECE_GATES: Record<MotifPieceKind, QualityGate> = {
  daisy: { minPaths: 25, minTones: 3, minVariation: 0.7, minCoverage: 0.35 },
  stone: { minPaths: 6, minTones: 2, minVariation: 0.7, minCoverage: 0.3 },
  bush: { minPaths: 25, minTones: 2, minVariation: 0.7, minCoverage: 0.4 },
  leaf: { minPaths: 10, minTones: 2, minVariation: 0.7, minCoverage: 0.25 },
  cypress: { minPaths: 7, minTones: 2, minVariation: 0.7, minCoverage: 0.3 },
  'round-tree': { minPaths: 6, minTones: 2, minVariation: 0.7, minCoverage: 0.5 },
  hills: { minPaths: 9, minTones: 2, minVariation: 0.7, minCoverage: 0.7 },
  trail: { minPaths: 30, minTones: 2, minVariation: 0.7, minCoverage: 0.55 },
  lantern: { minPaths: 12, minTones: 3, minVariation: 0.7, minCoverage: 0.35 },
}
