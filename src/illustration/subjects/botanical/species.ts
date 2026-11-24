// ---------------------------------------------------------------------------
// botanical/species — growth rules.
//
// A species is a set of parameters, not a drawing file: how many
// leaves, at what height, at what angle, with what fill. Changing a rule
// produces a whole family of plates.
// ---------------------------------------------------------------------------

import type { LeafProfile } from '../../core/leaf'

export type SpeciesId = 'flat' | 'ink' | 'line'
export type LeafPattern = 'solid' | 'hatch' | 'herringbone' | 'stripes' | 'none'
export type LeafColor = 'ink' | 'accent' | 'accentAlt' | 'shade' | 'none'

export interface LeafFill {
  pattern: LeafPattern
  color: LeafColor
  weight: number
}

export interface SpeciesConfig {
  id: SpeciesId
  latin: string
  /** herbarium description, in Spanish and in a quiet voice */
  note: string
  stem: { length: number; lean: number; wobble: number; width: number }
  nodes: {
    from: number
    to: number
    spacing: [number, number]
    mode: 'alternate' | 'opposite' | 'random'
  }
  leaf: {
    length: [number, number]
    shrink: number
    aspect: number
    angle: [number, number]
    bend: number
    droop: number
    petiole: [number, number]
    outline: number
    veins: number
    /** multiplier of the hand tremor of the outline */
    roughness: number
    /** shape of the blade */
    profile: LeafProfile
    /** pen overshoot when closing the outline, in px */
    overshoot: number
    fills: LeafFill[]
  }
  flower: {
    count: [number, number]
    size: [number, number]
    petals: [number, number]
    /** petal width relative to its length */
    petalWidth: [number, number]
    /** length of the peduncle that separates the flower from the stem */
    stalk: [number, number]
    fill: 'accent' | 'accentAlt'
    outline: number
    center: number
  } | null
  ground: boolean
}

export const SPECIMENS: Record<SpeciesId, SpeciesConfig> = {
  // Broad alternate leaves, flat fills, herringbone hatching.
  flat: {
    id: 'flat',
    latin: 'Solanum chartaceum',
    note: 'hojas alternas, hábito erguido, corola pentámera',
    stem: { length: 0.86, lean: 0.05, wobble: 8, width: 3.0 },
    nodes: { from: 0.12, to: 0.9, spacing: [0.058, 0.076], mode: 'alternate' },
    leaf: {
      length: [150, 185],
      shrink: 0.4,
      aspect: 0.6,
      angle: [54, 78],
      bend: 0.07,
      droop: 0.18,
      petiole: [0, 5],
      outline: 2.4,
      veins: 5,
      roughness: 1,
      profile: 'oval',
      overshoot: 4,
      fills: [
        { pattern: 'solid', color: 'ink', weight: 20 },
        { pattern: 'solid', color: 'shade', weight: 26 },
        { pattern: 'herringbone', color: 'none', weight: 34 },
        { pattern: 'hatch', color: 'none', weight: 12 },
        { pattern: 'none', color: 'none', weight: 8 },
      ],
    },
    flower: {
      count: [2, 3],
      size: [28, 34],
      petals: [5, 6],
      petalWidth: [0.48, 0.58],
      stalk: [12, 24],
      fill: 'accent',
      outline: 2.4,
      center: 0.17,
    },
    ground: true,
  },

  // Loose line, large petals, misregistered color.
  ink: {
    id: 'ink',
    latin: 'Papaver tremulum',
    note: 'tallo grácil, hojas lanceoladas, corola tetrámera',
    stem: { length: 0.78, lean: 0.06, wobble: 16, width: 2.2 },
    nodes: { from: 0.04, to: 0.56, spacing: [0.095, 0.12], mode: 'alternate' },
    leaf: {
      length: [138, 178],
      shrink: 0.18,
      aspect: 0.38,
      angle: [24, 42],
      bend: 0.24,
      droop: 0.35,
      petiole: [8, 20],
      outline: 2.7,
      veins: 0,
      roughness: 2.6,
      profile: 'lanceolate',
      overshoot: 9,
      fills: [
        { pattern: 'solid', color: 'shade', weight: 55 },
        { pattern: 'none', color: 'none', weight: 45 },
      ],
    },
    flower: {
      count: [1, 1],
      size: [80, 92],
      petals: [4, 4],
      petalWidth: [0.74, 0.9],
      stalk: [0, 3],
      fill: 'accent',
      outline: 3.1,
      center: 0,
    },
    ground: false,
  },

  // Opposite pairs, narrow leaf, stripes and no fill at all.
  line: {
    id: 'line',
    latin: 'Ramulus striatus',
    note: 'hojas opuestas, limbo linear, nervadura estriada',
    stem: { length: 0.9, lean: 0.08, wobble: 26, width: 3 },
    nodes: { from: 0.04, to: 0.94, spacing: [0.1, 0.125], mode: 'opposite' },
    leaf: {
      length: [100, 145],
      shrink: 0.32,
      aspect: 0.36,
      angle: [44, 60],
      bend: 0.1,
      droop: 0.1,
      petiole: [5, 13],
      outline: 2.5,
      veins: 0,
      roughness: 0.9,
      profile: 'oval',
      overshoot: 3,
      fills: [{ pattern: 'stripes', color: 'none', weight: 100 }],
    },
    flower: null,
    ground: false,
  },
}
