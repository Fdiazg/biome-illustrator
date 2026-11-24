// ---------------------------------------------------------------------------
// noise — 1D value noise.
// It is the ingredient that separates a "computer" stroke from a drawn one:
// it displaces each point of the axis by a few tenths of a pixel, coherently.
// ---------------------------------------------------------------------------

export type Noise1D = (x: number) => number

export function makeNoise(seed: number): Noise1D {
  const hash = (i: number): number => {
    let h = Math.imul(i, 374761393) + Math.imul(seed >>> 0, 668265263)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }

  return (x: number): number => {
    const i = Math.floor(x)
    const f = x - i
    // quintic interpolation: continuous first and second derivatives
    const u = f * f * f * (f * (f * 6 - 15) + 10)
    return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1
  }
}
