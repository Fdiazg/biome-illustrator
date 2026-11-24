// ---------------------------------------------------------------------------
// sky/config — rules of the cumulus.
//
// An engraved cloud is not a union of circles. What makes it
// recognizable, in order of importance:
//   1. horizontal tails that leave the base and taper to a point;
//   2. hatching that follows the edge of each dome (not an even diagonal hatching);
//   3. interior loops shaped like "∩", "C" or "@", with a shadow underneath;
//   4. a sheet of clouds of different sizes that breathe against each other.
// ---------------------------------------------------------------------------

import type { FormatId } from '../../core/format'

export interface SkyLayout {
  /** width of the body of each cloud, as a fraction of the canvas width */
  sizes: number[]
  /** how many of the last (smallest) ones may be missing */
  optional: number
  /** margins as a fraction of the canvas */
  margin: [number, number]
  /** sun: radius relative to the width; 0 = no sun */
  sun: number
}

export interface SkyConfig {
  id: 'cumulus'
  latin: string
  note: string
  /** height of the cloud relative to its width */
  aspect: [number, number]
  /** main domes per cloud */
  domes: [number, number]
  /** how much two neighboring domes overlap (fraction of the sum of radii) */
  spacing: [number, number]
  /** small domes in the valleys: chance */
  valleyBumps: number
  /** tails: length relative to the width of the body */
  tailLength: [number, number]
  /** tails: thickness relative to the height of the cloud */
  tailThick: [number, number]
  /** chance of a tail on each side and of a second tail below */
  tailChance: number
  tailDouble: number
  /** interior loops: one every so many px of width */
  curlEvery: number
  /** engraving hatching: spacing between lines in px */
  hatchGap: [number, number]
  hatchWidth: number
  outline: number
  layouts: Record<FormatId, SkyLayout>
}

export const SKY: SkyConfig = {
  id: 'cumulus',
  latin: 'Cumulus humilis',
  note: 'fair-weather cloud: flat base, scalloped domes, tapering tails',
  aspect: [0.34, 0.46],
  domes: [3, 6],
  spacing: [0.5, 0.68],
  valleyBumps: 0.55,
  tailLength: [0.22, 0.42],
  tailThick: [0.16, 0.24],
  tailChance: 0.78,
  tailDouble: 0.4,
  curlEvery: 130,
  hatchGap: [1.7, 2.6],
  hatchWidth: 0.7,
  outline: 2.3,
  layouts: {
    plate: {
      sizes: [0.62, 0.47, 0.37, 0.29, 0.22, 0.16],
      optional: 1,
      margin: [0.04, 0.035],
      sun: 0.07,
    },
    square: {
      sizes: [0.46, 0.36, 0.29, 0.23, 0.17, 0.13],
      optional: 1,
      margin: [0.04, 0.04],
      sun: 0.06,
    },
    wide: {
      sizes: [0.22, 0.17, 0.14, 0.11, 0.085, 0.07],
      optional: 1,
      margin: [0.02, 0.06],
      sun: 0,
    },
  },
}
