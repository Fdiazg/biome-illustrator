// ---------------------------------------------------------------------------
// markup — passes over the already composed SVG.
//
// Subjects write `fill="#hex"` with the palette values and know nothing
// about the target. What depends on the target (tinting through CSS variables,
// thickening the pen for a small size, measuring the box of the drawing) is
// resolved here, on the markup, after composing. That way no new option
// touches the randomness or the geometry, and without options the SVG is the same byte
// for byte.
//
// Only the tags that change are rewritten; the rest of the text is copied
// as is.
// ---------------------------------------------------------------------------

import type { BBox } from './core/path'
import type { Palette } from './core/palette'

// ---------------------------------------------------------------------------
// Tags and attributes
// ---------------------------------------------------------------------------

export interface Attr {
  name: string
  value: string
}

const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g
const ATTR = /\s+([\w:-]+)="([^"]*)"/g

function parseAttrs(raw: string): Attr[] {
  const out: Attr[] = []
  for (const m of raw.matchAll(ATTR)) out.push({ name: m[1], value: m[2] })
  return out
}

/**
 * Walks the opening tags. If `fn` returns a list of attributes,
 * the tag is rewritten with it; if it returns `undefined`, it is left intact.
 */
export function rewriteTags(
  svg: string,
  fn: (name: string, attrs: Attr[]) => Attr[] | undefined,
): string {
  return svg.replace(TAG, (whole, name: string, raw: string, self: string) => {
    const next = fn(name, parseAttrs(raw))
    if (!next) return whole
    return `<${name}${next.map((a) => ` ${a.name}="${a.value}"`).join('')}${self ? '/' : ''}>`
  })
}

const get = (attrs: Attr[], name: string) => attrs.find((a) => a.name === name)?.value

// ---------------------------------------------------------------------------
// Color roles
// ---------------------------------------------------------------------------

export type ColorRole = 'paper' | 'ink' | 'accent' | 'accentAlt' | 'shade' | 'mid' | 'flower'

/**
 * Priority order when two roles share a value (in `herbarium`
 * `accentAlt` and `shade` are the same lilac; in `mono` ink and accent are the
 * same black): the first in the list wins. The SVG does not keep which role each
 * color came from, only the value.
 */
export const COLOR_ROLES: readonly ColorRole[] = [
  'ink',
  'paper',
  'accent',
  'accentAlt',
  'shade',
  'mid',
  'flower',
]

/** Name of the custom property of a role: `accentAlt` → `--bi-accent-alt`. */
export const roleVar = (role: ColorRole) =>
  `--bi-${role.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`

/** Value → role, with the priority of `COLOR_ROLES`. */
export function roleMap(pal: Palette): Map<string, ColorRole> {
  const map = new Map<string, ColorRole>()
  for (const role of COLOR_ROLES) {
    const hex = pal[role]
    if (hex && !map.has(hex.toUpperCase())) map.set(hex.toUpperCase(), role)
  }
  return map
}

/**
 * CSS declarations with the values of a palette, to tint a page or a
 * container: `--bi-paper:#F4F0E6;--bi-ink:#2B2A28;…`. A role the palette
 * does not define (`flower`) is omitted and the SVG uses its fallback.
 */
export function paletteVars(pal: Palette): string {
  return COLOR_ROLES.filter((r) => pal[r])
    .map((r) => `${roleVar(r)}:${pal[r]}`)
    .join(';')
}

const COLOR_ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']

/**
 * `colors: 'css'` mode. Each color that is a palette role goes from a presentation
 * attribute to `style`, with the variable and the original value as a fallback:
 *
 *   fill="#191A17"  →  style="fill:var(--bi-ink,#191A17)"
 *
 * It goes in `style` and not in the attribute because `var()` in presentation
 * attributes is not reliable across browsers (and resvg does not resolve it). The
 * inline rule beats the attributes, so there is no conflict.
 *
 * Derived colors (the mixes in `dunes/tone.ts`) are not a role and
 * stay in hex: the landscape only tints in its roles.
 */
export function toCssColors(svg: string, pal: Palette): string {
  const roles = roleMap(pal)
  return rewriteTags(svg, (_name, attrs) => {
    const decl: string[] = []
    const keep: Attr[] = []
    for (const a of attrs) {
      const role = COLOR_ATTRS.includes(a.name) ? roles.get(a.value.toUpperCase()) : undefined
      if (role) decl.push(`${a.name}:var(${roleVar(role)},${a.value})`)
      else keep.push(a)
    }
    if (!decl.length) return undefined
    const style = keep.find((a) => a.name === 'style')
    if (style) {
      style.value = `${style.value.replace(/;?\s*$/, '')};${decl.join(';')}`
      return keep
    }
    return [...keep, { name: 'style', value: decl.join(';') }]
  })
}

// ---------------------------------------------------------------------------
// Pen according to the final size
// ---------------------------------------------------------------------------

/** Width of the main stroke of the subjects, in canvas units. */
export const PEN_UNITS = 2.4
/** Minimum width in screen px that this stroke must have. */
export const PEN_MIN_PX = 1.1

/**
 * Canvas units to add to each stroke so the pen looks right
 * at `scale` px per unit. 0 if it is shown at a sufficient size.
 */
export function penExtra(scale: number): number {
  if (!(scale > 0)) return 0
  return Math.max(0, PEN_MIN_PX / scale - PEN_UNITS)
}

const fmt = (v: number) => String(Math.round(v * 100) / 100)

/**
 * Thickens the pen by adding `extra` units:
 * - ink fills (every variable-width stroke is an ink polygon)
 *   gain an outline of the same color, `extra` wide;
 * - `stroke` strokes (veins, stripes, hatching) gain half of it,
 *   so the interior detail does not cover the blot.
 *
 * It is additive and not multiplicative: a 1 u hairline and a 2.4 u line
 * both end up legible, and the hierarchy is kept as a difference.
 */
export function thickenPen(svg: string, ink: string, extra: number): string {
  if (!(extra > 0)) return svg
  const INK = ink.toUpperCase()
  return rewriteTags(svg, (name, attrs) => {
    if (name === 'svg' || name === 'g' || name === 'rect') return undefined
    const stroke = get(attrs, 'stroke')
    if (stroke && stroke !== 'none') {
      const w = attrs.find((a) => a.name === 'stroke-width')
      const base = w ? Number(w.value) : 1
      const next = fmt(base + extra * 0.5)
      if (w) w.value = next
      else attrs.push({ name: 'stroke-width', value: next })
      return attrs
    }
    if ((get(attrs, 'fill') ?? '').toUpperCase() === INK) {
      attrs.push(
        { name: 'stroke', value: get(attrs, 'fill')! },
        { name: 'stroke-width', value: fmt(extra) },
        { name: 'stroke-linejoin', value: 'round' },
      )
      return attrs
    }
    return undefined
  })
}

// ---------------------------------------------------------------------------
// Box of the drawing, from the geometry
// ---------------------------------------------------------------------------

type Mat = [number, number, number, number, number, number]
const ID: Mat = [1, 0, 0, 1, 0, 0]

const mulMat = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

const apply = (m: Mat, x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
})

function parseTransform(t: string | undefined): Mat {
  let m: Mat = ID
  if (!t) return m
  for (const call of t.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = call[2].split(/[\s,]+/).filter(Boolean).map(Number)
    let n: Mat = ID
    switch (call[1]) {
      case 'translate':
        n = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0]
        break
      case 'scale':
        n = [v[0], 0, 0, v[1] ?? v[0], 0, 0]
        break
      case 'rotate': {
        const a = ((v[0] ?? 0) * Math.PI) / 180
        const c = Math.cos(a)
        const s = Math.sin(a)
        const cx = v[1] ?? 0
        const cy = v[2] ?? 0
        n = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]
        break
      }
      case 'matrix':
        n = v.slice(0, 6) as Mat
        break
    }
    m = mulMat(m, n)
  }
  return m
}

/** Points of a `d` attribute: vertices and samples of the curves. */
function pathPoints(d: string): { x: number; y: number }[] {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? []
  const pts: { x: number; y: number }[] = []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  const n = () => Number(tokens[i++])
  const isNum = () => i < tokens.length && !/[A-Za-z]/.test(tokens[i])
  const cubic = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    for (let k = 1; k <= 8; k++) {
      const t = k / 8
      const u = 1 - t
      pts.push({
        x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      })
    }
  }
  while (i < tokens.length) {
    if (!isNum()) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    switch (cmd.toUpperCase()) {
      case 'M':
        x = ox + n()
        y = oy + n()
        sx = x
        sy = y
        pts.push({ x, y })
        cmd = rel ? 'l' : 'L'
        break
      case 'L':
      case 'T':
        x = ox + n()
        y = oy + n()
        pts.push({ x, y })
        break
      case 'H':
        x = ox + n()
        pts.push({ x, y })
        break
      case 'V':
        y = oy + n()
        pts.push({ x, y })
        break
      case 'C': {
        const x1 = ox + n(), y1 = oy + n(), x2 = ox + n(), y2 = oy + n(), x3 = ox + n(), y3 = oy + n()
        cubic(x, y, x1, y1, x2, y2, x3, y3)
        x = x3
        y = y3
        break
      }
      case 'S': {
        const x2 = ox + n(), y2 = oy + n(), x3 = ox + n(), y3 = oy + n()
        cubic(x, y, x, y, x2, y2, x3, y3)
        x = x3
        y = y3
        break
      }
      case 'Q': {
        const x1 = ox + n(), y1 = oy + n(), x2 = ox + n(), y2 = oy + n()
        cubic(x, y, x + (2 / 3) * (x1 - x), y + (2 / 3) * (y1 - y), x2 + (2 / 3) * (x1 - x2), y2 + (2 / 3) * (y1 - y2), x2, y2)
        x = x2
        y = y2
        break
      }
      case 'A': {
        const rx = n(), ry = n()
        i += 3
        x = ox + n()
        y = oy + n()
        // conservative: the arc fits in a circle of its larger radius
        const r = Math.max(rx, ry)
        pts.push({ x: x - r, y: y - r }, { x: x + r, y: y + r })
        break
      }
      case 'Z':
        x = sx
        y = sy
        break
      default:
        i++
    }
  }
  return pts
}

/** Points of a shape, in its local system. */
function shapePoints(name: string, attrs: Attr[]): { x: number; y: number }[] {
  const num = (k: string) => Number(get(attrs, k) ?? 0)
  switch (name) {
    case 'path':
      return pathPoints(get(attrs, 'd') ?? '')
    case 'circle':
    case 'ellipse': {
      const rx = name === 'circle' ? num('r') : num('rx')
      const ry = name === 'circle' ? num('r') : num('ry')
      const cx = num('cx')
      const cy = num('cy')
      return [
        { x: cx - rx, y: cy - ry },
        { x: cx + rx, y: cy - ry },
        { x: cx - rx, y: cy + ry },
        { x: cx + rx, y: cy + ry },
      ]
    }
    case 'rect': {
      const x = num('x')
      const y = num('y')
      return [
        { x, y },
        { x: x + num('width'), y: y + num('height') },
        { x: x + num('width'), y },
        { x, y: y + num('height') },
      ]
    }
    case 'line':
      return [
        { x: num('x1'), y: num('y1') },
        { x: num('x2'), y: num('y2') },
      ]
    case 'polygon':
    case 'polyline': {
      const v = (get(attrs, 'points') ?? '').split(/[\s,]+/).filter(Boolean).map(Number)
      const out = []
      for (let k = 0; k + 1 < v.length; k += 2) out.push({ x: v[k], y: v[k + 1] })
      return out
    }
  }
  return []
}

const SKIP = new Set(['defs', 'clipPath', 'mask', 'filter', 'linearGradient', 'radialGradient', 'pattern', 'title', 'style', 'symbol'])
const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline'])

/**
 * Box of the drawing measured on the geometry, not by rasterizing: it walks the
 * shapes, applies the transforms of each group (registration, flower
 * rotation), adds half a `stroke-width` to the strokes and clips what is under a
 * `clip-path` (the hatching of a leaf is drawn larger than the leaf).
 *
 * `defs` is the markup of the definitions, to resolve the clips.
 */
export function markupBBox(body: string, defs = ''): BBox | null {
  const clips = new Map<string, BBox>()
  for (const m of defs.matchAll(/<clipPath id="([^"]+)"[^>]*>([\s\S]*?)<\/clipPath>/g)) {
    const box = markupBBox(m[2])
    if (box) clips.set(m[1], box)
  }

  interface Frame {
    name: string
    m: Mat
    clip: BBox | null
  }
  const stack: Frame[] = [{ name: '#root', m: ID, clip: null }]
  let skip = 0
  let box: BBox | null = null

  const grow = (b: BBox) => {
    box = box
      ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) }
      : b
  }

  const clipBox = (m: Mat, ref: string | undefined, outer: BBox | null): BBox | null => {
    const id = ref?.match(/url\(#([^)]+)\)/)?.[1]
    const local = id ? clips.get(id) : undefined
    if (!local) return outer
    const corners = [
      apply(m, local.x0, local.y0),
      apply(m, local.x1, local.y0),
      apply(m, local.x0, local.y1),
      apply(m, local.x1, local.y1),
    ]
    const b = {
      x0: Math.min(...corners.map((p) => p.x)),
      y0: Math.min(...corners.map((p) => p.y)),
      x1: Math.max(...corners.map((p) => p.x)),
      y1: Math.max(...corners.map((p) => p.y)),
    }
    return outer
      ? { x0: Math.max(b.x0, outer.x0), y0: Math.max(b.y0, outer.y0), x1: Math.min(b.x1, outer.x1), y1: Math.min(b.y1, outer.y1) }
      : b
  }

  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g)) {
    const [, close, name, raw, self] = m
    if (close) {
      if (SKIP.has(name)) skip = Math.max(0, skip - 1)
      else if (!skip && stack.length > 1 && stack[stack.length - 1].name === name) stack.pop()
      continue
    }
    if (SKIP.has(name)) {
      if (!self) skip++
      continue
    }
    if (skip) continue
    const attrs = parseAttrs(raw)
    const top = stack[stack.length - 1]
    const mat = mulMat(top.m, parseTransform(get(attrs, 'transform')))
    const clip = clipBox(mat, get(attrs, 'clip-path'), top.clip)

    if (SHAPES.has(name) && get(attrs, 'opacity') !== '0') {
      const stroke = get(attrs, 'stroke')
      const sw = stroke && stroke !== 'none' ? Number(get(attrs, 'stroke-width') ?? 1) : 0
      const scale = Math.sqrt(Math.abs(mat[0] * mat[3] - mat[1] * mat[2])) || 1
      const pad = (sw / 2) * scale
      const pts = shapePoints(name, attrs).map((p) => apply(mat, p.x, p.y))
      if (pts.length) {
        let b: BBox = {
          x0: Math.min(...pts.map((p) => p.x)) - pad,
          y0: Math.min(...pts.map((p) => p.y)) - pad,
          x1: Math.max(...pts.map((p) => p.x)) + pad,
          y1: Math.max(...pts.map((p) => p.y)) + pad,
        }
        if (clip) {
          b = { x0: Math.max(b.x0, clip.x0), y0: Math.max(b.y0, clip.y0), x1: Math.min(b.x1, clip.x1), y1: Math.min(b.y1, clip.y1) }
        }
        if (b.x1 > b.x0 && b.y1 > b.y0) grow(b)
      }
    }
    if (!self) stack.push({ name, m: mat, clip })
  }
  return box
}
