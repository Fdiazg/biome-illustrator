// ---------------------------------------------------------------------------
// palette — color is data, not a stylesheet.
// Each palette defines paper, ink and three accents. A subject chooses which role it uses.
// ---------------------------------------------------------------------------

export type PaletteId = 'herbarium' | 'riso' | 'night' | 'mono' | 'garden' | 'garden-night'

export interface Palette {
  id: PaletteId
  name: string
  paper: string
  ink: string
  accent: string
  accentAlt: string
  /** secondary fill tone (leaves, shadows, water) */
  shade: string
  mid: string
  /**
   * color of the corolla. Optional: subjects that draw flowers use
   * `flower ?? accent`, so a palette without this role looks the same as before
   * and one that defines it does not steal the accent from the rest.
   */
  flower?: string
}

export const PALETTES: Record<PaletteId, Palette> = {
  herbarium: {
    id: 'herbarium',
    name: 'Herbarium',
    paper: '#EDE7D8',
    ink: '#191A17',
    accent: '#D9482A',
    accentAlt: '#B2A0E6',
    shade: '#B2A0E6',
    mid: '#F7F3E9',
  },
  riso: {
    id: 'riso',
    name: 'Riso',
    paper: '#F4F0E6',
    ink: '#1B1B20',
    accent: '#EF8368',
    accentAlt: '#A9A48F',
    shade: '#A9A48F',
    mid: '#FCF9F2',
  },
  night: {
    id: 'night',
    name: 'Night',
    paper: '#182019',
    ink: '#EDE7D8',
    accent: '#E2582F',
    accentAlt: '#9C8BE0',
    shade: '#6F7F6A',
    mid: '#26312A',
  },
  mono: {
    id: 'mono',
    name: 'Mono',
    paper: '#F2EFE6',
    ink: '#151515',
    accent: '#151515',
    accentAlt: '#151515',
    shade: '#D6D2C6',
    mid: '#FAF8F2',
  },
  // Garden palettes: cream and charcoal by
  // day, ink blue and cream by night. Peach is the accent (sun), lavender the
  // alternate, sage the leaf shade and butter the flower.
  garden: {
    id: 'garden',
    name: 'Garden',
    paper: '#F4F0E6',
    ink: '#2B2A28',
    accent: '#F2B38F',
    accentAlt: '#B2A0E6',
    shade: '#A9C2A0',
    mid: '#FAF7F0',
    flower: '#EBCB7A',
  },
  'garden-night': {
    id: 'garden-night',
    name: 'Garden night',
    paper: '#1E2230',
    ink: '#EDE7D8',
    accent: '#C99A80',
    accentAlt: '#8E82B8',
    shade: '#7F9479',
    mid: '#272C3C',
    flower: '#B8A266',
  },
}

export const PALETTE_ORDER: PaletteId[] = ['herbarium', 'riso', 'night', 'mono', 'garden', 'garden-night']

/** A palette by id or a custom palette (object), with `herbarium` as the fallback. */
export function resolvePalette(p: PaletteId | Palette | undefined): Palette {
  if (p && typeof p === 'object') return p
  return (p && PALETTES[p]) || PALETTES.herbarium
}
