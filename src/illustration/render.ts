// ---------------------------------------------------------------------------
// render — serialization.
//
// The engine knows nothing about plants or clouds: it asks a subject to fill the
// plate and then adds paper, grain, animation and the SVG wrapper.
// ---------------------------------------------------------------------------

import { clamp, num } from './core/math'
import { resolveFormat, type Format, type FormatId } from './core/format'
import { makeNoise } from './core/noise'
import { resolvePalette, type Palette, type PaletteId } from './core/palette'
import { createRng } from './core/prng'
import { penExtra, thickenPen, toCssColors } from './markup'
import { SUBJECTS } from './subjects'
import type { ComposeCtx, ComposeResult, SubjectDef, SubjectId } from './subjects/types'

/**
 * Engine version. If the order of the random calls changes, the drawing of
 * every seed changes: published plates are frozen with their version so the
 * rest can keep iterating.
 */
export const ENGINE_VERSION = 3

export { CANVAS } from './core/format'

/**
 * How the palette colors are written.
 * - `hex`: `fill="#191A17"` attributes. The file looks the same anywhere.
 *   This is the default.
 * - `css`: `style="fill:var(--bi-ink,#191A17)"`. The page can retint live by
 *   changing `--bi-paper`, `--bi-ink`, `--bi-accent`, `--bi-accent-alt`,
 *   `--bi-shade`, `--bi-mid` and `--bi-flower`.
 */
export type ColorMode = 'hex' | 'css'

export interface IllustrationOptions {
  seed: number
  subject: SubjectId
  /** id of a catalog palette or a custom palette */
  palette: PaletteId | Palette
  /** canvas format; if the subject does not support it, its own default is used */
  format?: FormatId
  /** offset in px between color and line. 0 = perfect registration */
  registration?: number
  /** animates the entrance and the sway (respects prefers-reduced-motion) */
  animate?: boolean
  /** paper texture */
  grain?: boolean
  /** paper background; if false the SVG stays transparent */
  paper?: boolean
  /** colors in hex (default) or in CSS variables with a fallback */
  colors?: ColorMode
  /**
   * width in px at which the SVG will be displayed. If small, the pen is
   * thickened to stay legible, and `width`/`height` become that
   * size. Unset, nothing changes.
   */
  displayWidth?: number
  /**
   * growth state 0..1 for the botanical subjects: fewer nodes,
   * smaller leaves, no flower below ~0.7. 1 (default) = the whole plant,
   * same SVG as without the option.
   */
  growth?: number
}

/** @internal what the plate and the motif share */
export interface Composed {
  seed: number
  subject: SubjectDef
  pal: Palette
  format: Format
  uid: string
  scene: ComposeResult
  defs: string[]
}

/**
 * Composes the subject: randomness, noise, context and `compose`. It is what the
 * plate and the motif have in common; the order of the calls must not change.
 * @internal
 */
export function composeScene(
  opts: IllustrationOptions,
  extra: { ground?: boolean; uidSuffix?: string } = {},
): Composed {
  const seed = Number.isFinite(opts.seed) ? Math.abs(Math.floor(opts.seed)) : 1
  const subject = SUBJECTS[opts.subject] ?? SUBJECTS.flat
  const pal = resolvePalette(opts.palette)
  const format = resolveFormat(subject.formats, opts.format)
  const growth = opts.growth === undefined ? undefined : clamp(opts.growth, 0, 1)
  // with growth the drawing changes: its clip ids must not collide with
  // those of the same whole seed on the same page
  const uid =
    `bi${seed.toString(36)}${subject.id}${format.id}` +
    (growth !== undefined && growth < 1 ? `g${Math.round(growth * 100)}` : '') +
    (extra.uidSuffix ?? '')
  const W = format.width
  const H = format.height

  const rng = createRng(seed)
  const noise = makeNoise(seed)
  const registration = clamp(opts.registration ?? 2.5, 0, 8)
  const defs: string[] = []
  let piece = 0
  let clipN = 0

  const ctx: ComposeCtx = {
    rng,
    noise,
    pal,
    defs,
    uid,
    width: W,
    height: H,
    format: format.id,
    registration,
    nextPiece: () => ++piece,
    clip: (d: string) => {
      const id = `${uid}-c${clipN++}`
      defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`)
      return `url(#${id})`
    },
  }
  if (growth !== undefined) ctx.growth = growth
  if (extra.ground === false) ctx.ground = false

  const scene = subject.compose(ctx)
  return { seed, subject, pal, format, uid, scene, defs }
}

/** The `<style>` rule of the entrance and drift animation. @internal */
export function animationCss(uid: string, scene: ComposeResult): string {
  const rules = [
    `.${uid} .bi-plant{transform-box:view-box}`,
    `@media (prefers-reduced-motion:no-preference){`,
    `.${uid} .bi-piece{animation:${uid}-in .62s cubic-bezier(.22,.68,.2,1) both;animation-delay:calc(var(--i,0) * 36ms + 60ms)}`,
  ]
  if (scene.sway) {
    rules.push(
      `.${uid} .bi-plant{animation:${uid}-sway 12s ease-in-out 1.5s infinite alternate}`,
    )
  }
  if (scene.ambient) {
    rules.push(
      `.${uid} .bi-drift{animation:${uid}-drift var(--dur,60s) ease-in-out infinite alternate}`,
    )
  }
  rules.push('}')
  rules.push(
    `@keyframes ${uid}-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}`,
  )
  if (scene.sway) {
    rules.push(`@keyframes ${uid}-sway{from{transform:rotate(-.3deg)}to{transform:rotate(.3deg)}}`)
  }
  if (scene.ambient) {
    rules.push(
      `@keyframes ${uid}-drift{from{transform:translateX(0)}to{transform:translateX(var(--drift,40px))}}`,
    )
  }
  return `<style>${rules.join('')}</style>`
}

/**
 * Passes that depend on the target: pen for the final size, and color.
 * Without `pxPerUnit` or css mode, it returns the same string.
 * @internal
 */
export function finishSvg(svg: string, pal: Palette, colors?: ColorMode, pxPerUnit?: number): string {
  let out = svg
  if (pxPerUnit !== undefined) out = thickenPen(out, pal.ink, penExtra(pxPerUnit))
  if (colors === 'css') out = toCssColors(out, pal).replace('<svg ', '<svg data-colors="css" ')
  return out
}

export function renderIllustration(opts: IllustrationOptions): string {
  const { seed, subject, pal, format, uid, scene, defs } = composeScene(opts)
  const W = format.width
  const H = format.height

  const body =
    `<g class="bi-plant"` +
    (scene.origin ? ` style="transform-origin:${num(scene.origin.x)}px ${num(scene.origin.y)}px"` : '') +
    `>${scene.body}</g>`

  let grain = ''
  if (opts.grain !== false) {
    const gid = `${uid}-grain`
    defs.push(
      `<filter id="${gid}" x="0" y="0" width="100%" height="100%">` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="4" seed="${seed % 97}" stitchTiles="stitch"/>` +
        `<feColorMatrix type="saturate" values="0"/>` +
        `</filter>`,
    )
    grain = `<rect width="${W}" height="${H}" filter="url(#${gid})" opacity="0.05" style="mix-blend-mode:multiply"/>`
  }

  const paper = opts.paper === false ? '' : `<rect width="${W}" height="${H}" fill="${pal.paper}"/>`

  const css = opts.animate ? animationCss(uid, scene) : ''

  const title = `${subject.latin} — semilla ${seed}`

  const dw = opts.displayWidth && opts.displayWidth > 0 ? opts.displayWidth : undefined
  const size = dw ? `width="${num(dw)}" height="${num((dw * H) / W)}"` : `width="${W}" height="${H}"`

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${size} ` +
    `class="${uid}" role="img" aria-labelledby="${uid}-title" data-biome="illustration" data-engine="${ENGINE_VERSION}" data-seed="${seed}" data-subject="${subject.id}" data-format="${format.id}">` +
    `<title id="${uid}-title">${title}</title>` +
    css +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    paper +
    body +
    grain +
    `</svg>`

  if (!dw && opts.colors !== 'css') return svg
  return finishSvg(svg, pal, opts.colors, dw ? dw / W : undefined)
}

/** Metadata for the plate card. */
export function describeIllustration(opts: IllustrationOptions) {
  const subject = SUBJECTS[opts.subject] ?? SUBJECTS.flat
  const pal = resolvePalette(opts.palette)
  const format = resolveFormat(subject.formats, opts.format)
  const plate = (Math.abs(opts.seed) % 97) + 1
  return {
    latin: subject.latin,
    note: subject.note,
    family: subject.family,
    palette: pal.name,
    plate: String(plate).padStart(2, '0'),
    seed: opts.seed,
    format: format.name,
    width: format.width,
    height: format.height,
    ratio: format.ratio,
    engine: ENGINE_VERSION,
    formats: subject.formats,
    quality: subject.quality,
  }
}

export { FORMATS, FORMAT_ORDER, type Format, type FormatId } from './core/format'
