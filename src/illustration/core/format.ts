// ---------------------------------------------------------------------------
// format — the canvas is data, not an engine constant.
//
// A herbarium plate, a 1600x360 footer and a square for social media are
// the same engine with a different format. A subject declares which formats
// it can compose; the studio only offers those.
// ---------------------------------------------------------------------------

export type FormatId = 'plate' | 'wide' | 'square'

export interface Format {
  id: FormatId
  name: string
  /** short name for the interface */
  short: string
  width: number
  height: number
  /** aspect ratio, so the interface reserves the right space */
  ratio: number
}

export const FORMATS: Record<FormatId, Format> = {
  plate: {
    id: 'plate',
    name: 'Plate',
    short: '620 × 780',
    width: 620,
    height: 780,
    ratio: 620 / 780,
  },
  wide: {
    id: 'wide',
    name: 'Band',
    short: '1600 × 360',
    width: 1600,
    height: 360,
    ratio: 1600 / 360,
  },
  square: {
    id: 'square',
    name: 'Square',
    short: '900 × 900',
    width: 900,
    height: 900,
    ratio: 1,
  },
}

export const FORMAT_ORDER: FormatId[] = ['plate', 'wide', 'square']

/** Classic plate: kept as an export for compatibility. */
export const CANVAS = { width: FORMATS.plate.width, height: FORMATS.plate.height }

export function resolveFormat(subjectFormats: readonly FormatId[], requested?: FormatId): Format {
  const id = requested && subjectFormats.includes(requested) ? requested : subjectFormats[0]
  return FORMATS[id]
}
