// ---------------------------------------------------------------------------
// fill — which fill a leaf gets.
//
// Lives in core because it is not botanical data: the tree has leaves too.
// The rule that makes the rhythm (two consecutive pieces never share a fill)
// is applied here, once, for every subject that draws foliage.
// ---------------------------------------------------------------------------

import type { Palette } from './palette'
import type { Rng } from './prng'

export type LeafPattern = 'solid' | 'hatch' | 'herringbone' | 'stripes' | 'none'
export type LeafColor = 'ink' | 'accent' | 'accentAlt' | 'shade' | 'none'

export interface LeafFill {
  pattern: LeafPattern
  color: LeafColor
  weight: number
}

export function colorOf(pal: Palette, color: LeafColor): string | null {
  if (color === 'ink') return pal.ink
  if (color === 'accent') return pal.accent
  if (color === 'accentAlt') return pal.accentAlt
  if (color === 'shade') return pal.shade
  return null
}

/** Picks a fill avoiding a repeat of the previous one, so two blots do not merge. */
export function pickFill(
  rng: Rng,
  fills: readonly LeafFill[],
  last?: { pattern: LeafPattern; color: LeafColor },
): LeafFill {
  let fill = rng.weighted(fills, (f) => f.weight)
  if (last && fill.pattern === last.pattern && fill.color === last.color) {
    const pool = fills.filter((f) => !(f.pattern === fill.pattern && f.color === fill.color))
    if (pool.length) fill = rng.weighted(pool, (f) => f.weight)
  }
  return fill
}
