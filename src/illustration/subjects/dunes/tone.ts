// ---------------------------------------------------------------------------
// dunes/tone — tones derived from the palette.
//
// The landscape needs more steps than the six roles of the palette: far,
// near, band shadow, a foreground deeper than `shade`. No hand-written
// hex: everything comes from mixing existing roles. If one day the
// palette adds a `deep` role, `deepOf` is replaced by it.
// ---------------------------------------------------------------------------

import type { Palette } from '../../core/palette'

type Rgb = [number, number, number]

function parse(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
}

function toHex(c: Rgb): string {
  return (
    '#' +
    c
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  )
}

/** Linear mix of two tones: t = 0 is `a`, t = 1 is `b`. */
export function mix(a: string, b: string, t: number): string {
  const ca = parse(a)
  const cb = parse(b)
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t) as Rgb)
}

/** Approximate luminance, 0..1. Enough to decide light or dark. */
export function lum(hex: string): number {
  const [r, g, b] = parse(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Distance between two tones, 0..1. */
export function dist(a: string, b: string): number {
  const ca = parse(a)
  const cb = parse(b)
  return Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]) / 441.7
}

/**
 * Atmospheric perspective: no tone gets farther from the paper than `max`.
 * Mixing with the paper shortens the distance linearly, so the cap
 * is exact. It is what makes the hill in the background a whisper in any
 * palette, including `mono`, where all the accents are the same black.
 */
export function haze(tone: string, paper: string, max: number): string {
  const d = dist(tone, paper)
  if (d <= max || d === 0) return tone
  return mix(tone, paper, 1 - max / d)
}

/** The dark and the light end of the palette, whether day or night. */
export function poles(pal: Palette): { dark: string; light: string } {
  return lum(pal.ink) < lum(pal.paper)
    ? { dark: pal.ink, light: pal.paper }
    : { dark: pal.paper, light: pal.ink }
}

export const isNight = (pal: Palette) => lum(pal.paper) < 0.35

/**
 * Local role `deep`: the foreground. Deeper than the accent, without reaching the
 * ink, so the crest line can still be read on top.
 */
export function deepOf(pal: Palette): string {
  const { dark } = poles(pal)
  return mix(pal.accent, dark, isNight(pal) ? 0.62 : 0.5)
}

/** Mark tone inside a band: one step toward the side that contrasts. */
export function markOf(band: string, pal: Palette, amount = 0.3): string {
  const { dark, light } = poles(pal)
  return lum(band) > 0.42 ? mix(band, dark, amount) : mix(band, light, amount * 0.85)
}

/** If two neighboring bands end up almost equal, the nearer one drops a step. */
export function separate(near: string, far: string, pal: Palette, min = 0.06): string {
  if (dist(near, far) >= min) return near
  const { dark, light } = poles(pal)
  return mix(near, lum(near) > 0.5 ? dark : light, 0.18)
}
