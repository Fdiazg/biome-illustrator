// ---------------------------------------------------------------------------
// dunes/config — folds of earth.
//
// The system: flat bands that cross, paper with texture and a minimal
// object. The depth: pale, tight distant hills, a dark, wide foreground, and something that
// gives scale (a house, a tree, a road that fades away).
//
// Everything that is proportion lives here; `compose.ts` only assembles it.
// ---------------------------------------------------------------------------

import type { FormatId } from '../../core/format'

export type FocalKind = 'house' | 'tree' | 'boat' | 'path'

export interface DunesLayout {
  /** how many bands, from the farthest to the nearest */
  bands: number
  /** where the land starts, as a fraction of the height */
  horizon: number
  /** where the nearest band settles, as a fraction of the height */
  front: number
  /**
   * perspective: >1 squeezes the far bands against the horizon, which is
   * what makes a valley seen from afar
   */
  squeeze: number
  /** ridges per band: many and low far away, few and wide near */
  keysFar: number
  keysNear: number
  /** long strokes of sky (strata) */
  streaks: [number, number]
  /** relief: multiplies amplitude and drop; the narrow band asks for more */
  relief: number
  /** size of the focal object: in the wide band it reads smaller */
  scale: number
}

export interface DunesConfig {
  id: 'dunes'
  latin: string
  note: string
  /** amplitude of the crests relative to the stretch of land, far and near */
  ampFar: number
  ampNear: number
  /** maximum contrast against the paper in the farthest band (0..1) */
  haze: number
  /** probability of a low sun or moon */
  sun: number
  /** probability of a flock of birds */
  birds: number
  /** weight of each focal object in the draw */
  focal: Record<FocalKind, number>
  layout: Record<FormatId, DunesLayout>
}

export const DUNES: DunesConfig = {
  id: 'dunes',
  latin: 'Litus quietum',
  note: 'folds of land crossing under a low light',
  ampFar: 0.035,
  ampNear: 0.11,
  haze: 0.13,
  sun: 0.8,
  birds: 0.45,
  focal: { house: 3, tree: 3, boat: 2, path: 3 },
  layout: {
    wide: {
      bands: 7,
      horizon: 0.3,
      front: 0.84,
      squeeze: 1.25,
      keysFar: 11,
      keysNear: 5,
      streaks: [1, 3],
      relief: 1.3,
      scale: 1.3,
    },
    plate: {
      bands: 8,
      horizon: 0.44,
      front: 0.9,
      squeeze: 1.45,
      keysFar: 6,
      keysNear: 3,
      streaks: [2, 4],
      relief: 1,
      scale: 1,
    },
    square: {
      bands: 8,
      horizon: 0.4,
      front: 0.88,
      squeeze: 1.4,
      keysFar: 7,
      keysNear: 4,
      streaks: [2, 4],
      relief: 1,
      scale: 1,
    },
  },
}
