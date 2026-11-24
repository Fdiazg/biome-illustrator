// ---------------------------------------------------------------------------
// grove/config — growth rules of the tree.
//
// Like species.ts for the plants: curated proportions as data. Four
// kinds of tree:
//
//   sapling  few branches, large loose leaves
//   oak      forks, clusters at the tips and
//            leaves also along the branches
//   canopy   thick trunk that opens into two dense
//            crowns of small leaves
//   poplar   a narrow, tall silhouette, so the band is not a single profile
//   shrub    low bush: it only lives between the trees of the band
//
// Measurements in px are meant for a tree 560 px tall and are
// scaled with it.
// ---------------------------------------------------------------------------

import type { LeafFill } from '../../core/fill'
import type { LeafProfile } from '../../core/leaf'

export type GroveSpeciesId = 'oak' | 'sapling' | 'canopy' | 'poplar' | 'shrub'

export interface GroveSpecies {
  id: GroveSpeciesId
  /** weight when drawing the main tree (0 = never the protagonist) */
  weight: number
  trunk: {
    /** length of the trunk relative to the height of the tree */
    share: number
    /** width in px for a 560 px tree */
    width: number
    wobble: number
    /** maximum lean, in radians */
    lean: number
  }
  branch: {
    depth: number
    /** opening of the children, in radians */
    spread: [number, number]
    /** opening of the first fork (if missing, `spread`) */
    rootSpread?: [number, number]
    children: [number, number]
    rootChildren?: [number, number]
    /** length of the child relative to the mother */
    length: [number, number]
    widthFalloff: number
    upward: number
    wind: number
    /** how much longer the branches on one side are (asymmetry of the tree) */
    bias: number
    /** belly of the mother branch */
    bend: number
  }
  leaf: {
    profile: LeafProfile
    aspect: number
    /** length of the leaf relative to the height of the tree */
    size: [number, number]
  }
  /** cluster at the tip of each terminal branch */
  cluster: {
    leaves: [number, number]
    /** opening of the fan, in radians */
    spread: number
  }
  /** loose, alternate leaves along the intermediate branches */
  along: {
    /** probability that each node carries a leaf */
    density: number
    /** maximum depth (0 = tips) of the branches that carry leaves */
    maxDepth: number
    /** spacing between nodes, in leaf lengths */
    step: number
    /** angle of the leaf relative to the branch */
    angle: number
  }
  /** probability of an extra cluster (rosette) on intermediate branches */
  extra: number
  /** proportion of clusters that go behind the skeleton */
  backShare: number
  /**
   * How much the leaves are allowed to overlap each other: minimum distance between centers
   * in summed radii. Higher = looser leaves, more gaps.
   */
  crowd: number
  roots: [number, number]
}

const OAK: GroveSpecies = {
  id: 'oak',
  weight: 34,
  trunk: { share: 0.33, width: 14, wobble: 1.3, lean: 0.07 },
  branch: {
    depth: 4,
    spread: [0.42, 0.66],
    children: [2, 2],
    length: [0.56, 0.68],
    widthFalloff: 0.7,
    upward: 0.06,
    wind: 0.014,
    bias: 0.14,
    bend: 0.05,
  },
  leaf: { profile: 'oval', aspect: 0.6, size: [0.085, 0.11] },
  cluster: { leaves: [2, 4], spread: 1.05 },
  along: { density: 0.55, maxDepth: 2, step: 0.9, angle: 0.85 },
  extra: 0.15,
  backShare: 0.36,
  crowd: 0.78,
  roots: [2, 3],
}

const SAPLING: GroveSpecies = {
  id: 'sapling',
  weight: 22,
  trunk: { share: 0.4, width: 11, wobble: 1.1, lean: 0.06 },
  branch: {
    depth: 3,
    spread: [0.36, 0.56],
    rootSpread: [0.3, 0.5],
    children: [2, 2],
    length: [0.6, 0.72],
    widthFalloff: 0.66,
    upward: 0.1,
    wind: 0.01,
    bias: 0.1,
    bend: 0.06,
  },
  leaf: { profile: 'lanceolate', aspect: 0.56, size: [0.14, 0.19] },
  cluster: { leaves: [1, 2], spread: 0.7 },
  along: { density: 0.75, maxDepth: 2, step: 0.75, angle: 0.95 },
  extra: 0,
  backShare: 0.3,
  crowd: 0.86,
  roots: [2, 2],
}

const CANOPY: GroveSpecies = {
  id: 'canopy',
  weight: 26,
  trunk: { share: 0.3, width: 19, wobble: 1.6, lean: 0.06 },
  branch: {
    depth: 4,
    spread: [0.34, 0.55],
    rootSpread: [0.62, 0.82],
    children: [2, 2],
    length: [0.52, 0.62],
    widthFalloff: 0.68,
    upward: 0.3,
    wind: 0.01,
    bias: 0.1,
    bend: 0.06,
  },
  leaf: { profile: 'oval', aspect: 0.66, size: [0.062, 0.08] },
  cluster: { leaves: [3, 5], spread: 1.6 },
  along: { density: 0.4, maxDepth: 1, step: 0.85, angle: 0.9 },
  extra: 0.6,
  backShare: 0.42,
  crowd: 0.72,
  roots: [3, 3],
}

const POPLAR: GroveSpecies = {
  id: 'poplar',
  weight: 18,
  trunk: { share: 0.26, width: 12, wobble: 1.1, lean: 0.04 },
  branch: {
    depth: 4,
    spread: [0.22, 0.36],
    children: [2, 3],
    length: [0.6, 0.72],
    widthFalloff: 0.66,
    upward: 0.32,
    wind: 0.008,
    bias: 0.08,
    bend: 0.03,
  },
  leaf: { profile: 'cordate', aspect: 0.78, size: [0.06, 0.078] },
  cluster: { leaves: [2, 3], spread: 1.1 },
  along: { density: 0.6, maxDepth: 3, step: 0.95, angle: 0.75 },
  extra: 0,
  backShare: 0.4,
  crowd: 0.76,
  roots: [2, 2],
}

const SHRUB: GroveSpecies = {
  id: 'shrub',
  weight: 0,
  trunk: { share: 0.1, width: 7, wobble: 0.8, lean: 0.1 },
  branch: {
    depth: 2,
    spread: [0.55, 0.8],
    rootSpread: [0.7, 1.05],
    children: [2, 2],
    rootChildren: [3, 4],
    length: [0.8, 1],
    widthFalloff: 0.62,
    upward: 0.18,
    wind: 0.01,
    bias: 0.1,
    bend: 0.08,
  },
  leaf: { profile: 'oval', aspect: 0.62, size: [0.2, 0.26] },
  cluster: { leaves: [2, 3], spread: 1.2 },
  along: { density: 0.5, maxDepth: 1, step: 0.8, angle: 0.9 },
  extra: 0,
  backShare: 0.35,
  crowd: 0.74,
  roots: [0, 0],
}

export const GROVE_SPECIES: Record<GroveSpeciesId, GroveSpecies> = {
  oak: OAK,
  sapling: SAPLING,
  canopy: CANOPY,
  poplar: POPLAR,
  shrub: SHRUB,
}

export const GROVE = {
  id: 'grove' as const,
  latin: 'Quercus graphica',
  note: 'forking trunk, crown of leaf clusters, grass at the base',
  /** height of the tree alone, as a fraction of the canvas */
  height: { plate: 0.74, square: 0.76 },
  leaf: {
    outline: 2.1,
    roughness: 1,
    overshoot: 3,
    /** petiole, in leaf lengths */
    petiole: 0.14,
    /**
     * Fills. The flat blot rules: in the reference the crown reads because
     * each leaf is a solid color with its light vein. Hatching stays
     * as an accent, not as a texture for the whole crown.
     */
    fills: [
      { pattern: 'solid', color: 'shade', weight: 44 },
      { pattern: 'none', color: 'none', weight: 20 },
      { pattern: 'solid', color: 'ink', weight: 17 },
      { pattern: 'herringbone', color: 'none', weight: 9 },
      { pattern: 'hatch', color: 'none', weight: 4 },
    ] as LeafFill[],
    /** some seeds bring autumn leaves (accent) */
    autumn: { chance: 0.35, fill: { pattern: 'solid', color: 'accent', weight: 9 } as LeafFill },
  },
  /** the band: a little grove instead of a tree lost in the middle */
  band: {
    trees: [4, 5] as [number, number],
    shrubs: [2, 4] as [number, number],
    /** height of each tree relative to the height of the band */
    height: [0.56, 0.9] as [number, number],
    shrubHeight: [0.24, 0.36] as [number, number],
    /**
     * In the band the trees are half the size they are in the plate; with leaves at
     * scale they would be 20 px specks. Larger, fewer leaves: they read
     * better and the file weighs half as much.
     */
    leafScale: 1.5,
    /** simplification tolerance in the band, in px */
    tolerance: 0.75,
  },
  ground: {
    /** flat shadow under the tree, as in the reference */
    shadow: 0.3,
    tufts: [2, 4] as [number, number],
  },
  /** outline simplification, in px */
  tolerance: 0.6,
}
