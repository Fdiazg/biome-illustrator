// ---------------------------------------------------------------------------
// dunes — landscape of bands.
//
// The subject that is neither plant nor cloud: folds of earth in flat color,
// in crossing bands. It serves as a footer, a hero background and a divider.
//
// Three ideas take it out of the area chart:
//   1. Atmospheric depth: the far band is almost paper and is squeezed
//      against the horizon; the foreground is deep, wide and with a thick line.
//   2. Drawn texture: furrows, stipple, ticks and ripples inside each
//      band, with the same pen as the rest of the engine.
//   3. Scale: a single small object (house, tree, boat, path) resting on
//      a middle hill. Without it, the bands have no size.
//
// Order of the randomness: tones → crests → object → sky → bands. Changing it changes
// every seed.
// ---------------------------------------------------------------------------

import { lerp, num, type Pt } from '../../core/math'
import { polyline, tapered } from '../../core/path'
import type { ComposeCtx, ComposeResult } from '../types'
import { DUNES, type FocalKind } from './config'
import {
  birds,
  boat,
  flat,
  house,
  pathRibbon,
  stars,
  streaks,
  sun,
  tree,
  type Ink,
} from './focal'
import { crestLine, furrows, ripples, stipple, ticks, tufts } from './marks'
import { BLEED, crest, type Crest } from './terrain'
import { deepOf, dist, haze, isNight, markOf, mix, poles, separate } from './tone'

type Texture = 'furrows' | 'stipple' | 'grass' | 'ripples' | 'plain'

interface Band {
  i: number
  /** 0 = far, 1 = foreground */
  d: number
  tone: string
  crest: Crest
  body: string
  water: boolean
  texture: Texture
}

export function composeDunes(ctx: ComposeCtx): ComposeResult {
  const { rng, noise, pal, width: W, height: H } = ctx
  const cfg = DUNES
  const lay = cfg.layout[ctx.format]
  const N = lay.bands
  const night = isNight(pal)
  const { dark, light } = poles(pal)
  const deep = deepOf(pal)
  const top = H * lay.horizon
  const span = H - top
  /** pen width relative to the format: the 360 px band is the unit */
  const pen = Math.sqrt(H / 360)

  // --- focal object: drawn first because it decides whether there is water ----
  const kind = rng.weighted(Object.keys(cfg.focal) as FocalKind[], (k) => cfg.focal[k])
  const waterAt = kind === 'boat' ? rng.int(2, N - 3) : -1

  // --- tones: palette roles, from far to near -----------------------------
  // Light and dark alternate: if two neighbors have the same value, the crossing
  // of bands disappears.
  const tan = mix(pal.accent, light, 0.45)
  const sand = mix(mix(pal.mid, light, 0.3), pal.accent, 0.16)
  const ladders = [
    [pal.shade, pal.accentAlt, pal.mid, pal.shade, tan, pal.accent, sand, deep],
    [pal.accentAlt, pal.shade, tan, pal.mid, pal.shade, sand, pal.accent, deep],
    [pal.shade, pal.mid, pal.accentAlt, tan, pal.shade, pal.accent, sand, deep],
  ]
  const ladder = rng.pick(ladders).slice()
  if (N < ladder.length) ladder.splice(N === 7 ? 4 : 1, ladder.length - N)

  const tones: string[] = []
  for (let i = 0; i < N; i++) {
    const d = i / (N - 1)
    let base = ladder[i]
    if (i === waterAt) base = mix(pal.shade, pal.accentAlt, 0.35)
    // contrast cap against the paper: far away, a whisper; near, everything
    let t = haze(base, pal.paper, lerp(cfg.haze, 1, Math.pow(d, 1.3)))
    if (i > 0) t = separate(t, tones[i - 1], pal)
    tones.push(t)
  }

  // --- crests -------------------------------------------------------------
  const diag = rng.int(N - 4, N - 2)
  const crests: Crest[] = []
  let sign = rng.chance(0.5) ? 1 : -1
  for (let i = 0; i < N; i++) {
    const d = i / (N - 1)
    const seat = lerp(top, H * lay.front, Math.pow(d, lay.squeeze))
    sign = rng.chance(0.78) ? -sign : sign
    const water = i === waterAt
    const isDiag = i === diag && !water
    const amp = span * lerp(cfg.ampFar, cfg.ampNear, d) * lay.relief * rng.range(0.8, 1.25)
    crests.push(
      crest(
        W,
        {
          seat: water ? seat + span * 0.02 : seat,
          slope: water
            ? 0
            : isDiag
              ? sign * span * rng.range(0.24, 0.36)
              : sign * span * lerp(0.05, 0.2, d) * lay.relief * rng.range(0.6, 1.3),
          amp: isDiag ? amp * 0.25 : amp,
          keys: water ? 2 : isDiag ? 2 : Math.round(lerp(lay.keysFar, lay.keysNear, d)) + rng.int(-1, 1),
          flat: water,
        },
        noise,
        rng,
        i * 7.3,
      ),
    )
  }

  /** visible height of band k at x: how much it has left before the crest in front */
  const room = (k: number, x: number) => {
    let m = Infinity
    for (let j = k + 1; j < N; j++) m = Math.min(m, crests[j].y(x) - crests[k].y(x))
    return Math.min(m, H - crests[k].y(x))
  }

  /** Looks for a hill and x where an object of height h (depending on the band) is fully visible. */
  const seatFor = (ks: number[], size: (k: number) => number) => {
    let best = { k: ks[0], x: W / 2, score: -Infinity }
    for (const k of ks) {
      const h = size(k)
      for (let s = 0; s < 26; s++) {
        const x = lerp(W * 0.1, W * 0.9, rng.next())
        const score = room(k, x) / h + rng.range(0, 0.4)
        if (score > best.score) best = { k, x, score }
      }
    }
    return best
  }

  // --- object: where and what size ---------------------------------------
  const ink: Ink = { line: pal.ink, reg: ctx.registration, noise }
  const objSize = (k: number) => span * lerp(0.08, 0.22, k / (N - 1)) * lay.scale
  const host: Record<number, string> = {}
  const pathSeg: Record<number, { body: Pt[]; left: Pt[]; right: Pt[] }> = {}
  let focalX = W / 2

  const midBands = Array.from({ length: Math.max(1, N - 4) }, (_, j) => j + 2)
  const faceTone = mix(pal.mid, light, 0.5)
  const houseTones = (k: number) => ({
    face: haze(night ? mix(light, pal.accentAlt, 0.25) : faceTone, pal.paper, 1),
    side: separate(mix(faceTone, dark, night ? 0.55 : 0.22), tones[k], pal, 0.1),
    roof: separate(dist(pal.accent, tones[k]) < 0.15 ? deep : pal.accent, tones[k], pal, 0.1),
    hole: mix(dark, pal.accent, 0.15),
  })

  if (kind === 'house' || kind === 'tree') {
    const at = seatFor(rng.pick([midBands, midBands.slice(0, 2)]), objSize)
    focalX = at.x
    const h = objSize(at.k) * (kind === 'tree' ? 1.35 : 1)
    const c = crests[at.k]
    if (kind === 'house') {
      const foot = h * 0.95
      const by = Math.max(c.y(at.x - foot), c.y(at.x), c.y(at.x + foot)) + h * 0.06
      host[at.k] = house({ x: at.x, y: by }, h, houseTones(at.k), ink, rng)
    } else {
      // one, or a small group of two or three of different heights
      const count = rng.weighted([1, 2, 3], (n) => (n === 1 ? 3 : 1))
      const crown = separate(mix(pal.shade, dark, night ? 0.25 : 0.55), tones[at.k], pal, 0.12)
      const lit = markOf(crown, pal, 0.35)
      let out = ''
      for (let t = 0; t < count; t++) {
        const x = at.x + (t === 0 ? 0 : (t % 2 ? 1 : -1) * h * rng.range(0.45, 0.8))
        const hh = h * (t === 0 ? 1 : rng.range(0.55, 0.8))
        out = tree({ x, y: c.y(x) + hh * 0.04 }, hh, crown, lit, ink, rng, t * 4.1) + out
      }
      host[at.k] = out
    }
  } else if (kind === 'boat') {
    const k = waterAt
    let bestX = W / 2
    let bestS = -Infinity
    for (let s = 0; s < 26; s++) {
      const x = lerp(W * 0.12, W * 0.88, rng.next())
      const sc = room(k, x) + rng.range(0, objSize(k) * 0.3)
      if (sc > bestS) {
        bestS = sc
        bestX = x
      }
    }
    focalX = bestX
    // the boat floats a bit lower than the far shore, inside the water
    const h = objSize(k) * 0.95
    const lane = Math.min(room(k, bestX) * 0.45, h * 0.5)
    host[k] = boat(
      { x: bestX, y: crests[k].y(bestX) + Math.max(3, lane) },
      h,
      mix(dark, pal.accent, 0.25),
      night ? mix(light, pal.accentAlt, 0.2) : separate(mix(pal.mid, light, 0.5), tones[k], pal, 0.1),
      ink,
      rng,
    )
  } else {
    // path: it starts at the bottom, wide, and climbs hill by hill until it fades
    // in the wide band there is little height: the path ends closer or fades out
    const ends = ctx.format === 'wide' ? [N - 4, N - 3] : midBands.slice(0, 2)
    const end = seatFor(ends, objSize)
    focalX = end.x
    const x0 = lerp(W * 0.3, W * 0.7, rng.next())
    const w0 = Math.min(W, H) * (ctx.format === 'wide' ? 0.2 : 0.14)
    let prev: Pt = { x: x0 + rng.range(-1, 1) * W * 0.05, y: H + 24 }
    let wPrev = w0
    for (let j = N - 1; j >= end.k; j--) {
      const t = (N - 1 - j + 1) / (N - end.k)
      const target = lerp(x0, end.x, Math.pow(t, 0.8))
      const x = j === end.k ? end.x : target + rng.range(-1, 1) * span * 0.12 * (1 - t)
      const w = Math.max(1.6, w0 * Math.pow(0.5, N - j) * 1.4)
      const p = { x, y: crests[j].y(x) + Math.min(w * 0.4, 4) }
      pathSeg[j] = pathRibbon({ x: prev.x, y: prev.y + 6 }, wPrev, p, w)
      prev = p
      wPrev = w
    }
    if (rng.chance(0.55)) {
      const h = objSize(end.k) * 0.8
      const c = crests[end.k]
      const bx = end.x + (rng.chance(0.5) ? 1 : -1) * h * 0.9
      const by = Math.max(c.y(bx - h), c.y(bx + h)) + h * 0.06
      host[end.k] = house({ x: bx, y: by }, h, houseTones(end.k), ink, rng)
    }
  }

  // --- sky ----------------------------------------------------------------
  let sky = ''
  const sunLeft = focalX > W / 2 ? rng.chance(0.8) : rng.chance(0.2)
  if (rng.chance(cfg.sun) || night) {
    const wide = ctx.format === 'wide'
    const r = wide ? H * rng.range(0.11, 0.17) : Math.min(W, H) * rng.range(0.07, 0.11)
    const cx = W * (sunLeft ? rng.range(0.12, 0.32) : rng.range(0.68, 0.88))
    const cy = crests[0].y(cx) - r * (wide ? rng.range(0.15, 0.7) : rng.range(0.3, 2.2))
    let fill: string
    let rim = rng.chance(0.4)
    let marks = ''
    if (night) {
      fill = mix(light, pal.accentAlt, 0.12)
      marks = mix(fill, dark, 0.1)
    } else {
      const options = [pal.accent, pal.accent, pal.accentAlt]
      fill = rng.pick(options)
      // in mono the sun and the foreground would be the same black: light disc
      if (dist(fill, deep) < 0.2 || dist(fill, pal.paper) < 0.08) {
        fill = mix(light, dark, 0.14)
        rim = true
      }
    }
    sky += `<g class="bi-sun">${sun({ x: cx, y: cy }, r, fill, ink, rng, rim, marks)}</g>`
  }
  const [s0, s1] = lay.streaks
  sky += streaks(
    W,
    H * 0.07,
    top - span * 0.08,
    rng.int(s0, s1),
    haze(night ? pal.shade : pal.shade, pal.paper, 0.16),
    rng,
    noise,
  )
  if (night) {
    sky += stars(W, H * 0.04, top - 6, Math.min(40, Math.round((W * top) / 9000)), mix(light, dark, 0.15), rng)
  }
  if (rng.chance(cfg.birds)) {
    const bx = W * (sunLeft ? rng.range(0.55, 0.85) : rng.range(0.15, 0.45))
    const by = lerp(H * 0.12, top - span * 0.05, rng.range(0.2, 0.7))
    sky += birds({ x: bx, y: by }, rng.int(3, 7), Math.max(4, H * 0.016) * pen, mix(pal.ink, pal.paper, 0.2), rng)
  }

  // --- bands --------------------------------------------------------------
  const bands: Band[] = crests.map((c, i) => {
    const d = i / (N - 1)
    const body = polyline([...c.points, { x: W + BLEED, y: H + 60 }, { x: -BLEED, y: H + 60 }], true)
    return { i, d, tone: tones[i], crest: c, body, water: i === waterAt, texture: 'plain' }
  })

  // texture: never the same on two consecutive bands
  const kinds: Texture[] = ['furrows', 'stipple', 'grass']
  let last: Texture = 'plain'
  for (const b of bands) {
    if (b.water) b.texture = 'ripples'
    else if (b.d < 0.15) b.texture = rng.chance(0.5) ? 'stipple' : 'plain'
    else b.texture = rng.pick(kinds.filter((k) => k !== last))
    last = b.texture
  }

  let land = ''
  for (const b of bands) {
    const { d, crest: c, tone } = b
    const markTone = markOf(tone, pal, lerp(0.16, 0.34, d))
    const lineTone = haze(pal.ink, pal.paper, lerp(0.3, 1, Math.pow(d, 0.8)))
    const lw = lerp(0.6, 2.6, d) * pen
    const deepRoom = span * lerp(0.05, 0.22, d)

    let tex = ''
    switch (b.texture) {
      case 'furrows':
        tex = furrows(c, W, rng.int(2, 4), lerp(3, 11, d) * pen, lerp(0.7, 1.8, d) * pen, rng, noise, b.i)
        break
      case 'stipple':
        tex = stipple(c, W, Math.round((W / 100) * lerp(10, 26, d)), deepRoom, lerp(0.6, 1.3, d) * pen, rng)
        break
      case 'grass':
        tex = ticks(
          c,
          W,
          Math.round((W / 100) * lerp(6, 14, d)),
          deepRoom * 1.4,
          lerp(3, 9, d) * pen,
          lerp(0.7, 1.6, d) * pen,
          rng.range(-0.5, 0.5),
          rng,
        )
        break
      case 'ripples':
        tex = ripples(c.y(W / 2), c.y(W / 2) + deepRoom * 1.6, W, Math.round((W / 100) * 6), lw * 0.7, rng)
        break
      default:
        break
    }

    const clipBody = ctx.clip(b.body)
    let inner = ''
    // crest light: a slightly lighter strip, clipped by the hill
    if (!b.water && d > 0.1) {
      inner += `<path d="${polyline(
        c.points.map((p) => ({ x: p.x, y: p.y + 7 * pen })),
        false,
      )}" fill="none" stroke="${light}" stroke-width="${num(12 * pen)}" opacity="${night ? 0.06 : 0.12}"/>`
    }
    if (tex) {
      const ripple = b.water ? mix(tone, light, 0.45) : markTone
      inner += `<path d="${tex}" fill="${ripple}"/>`
    }
    const seg = pathSeg[b.i]
    if (seg) {
      // the road is the lightened band: always lighter than the earth it covers
      const road = mix(tone, light, night ? 0.4 : 0.6)
      const ew = Math.max(0.6, lw * 0.55)
      const edge = (side: Pt[]) =>
        tapered(side, (t) => ew * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.2))))
      inner +=
        flat(polyline(seg.body, true), road, ink.reg) +
        `<path d="${edge(seg.left)}${edge(seg.right)}" fill="${lineTone}"/>`
    }

    const crestInk = crestLine(c, lw, rng, noise, b.i * 2.9)
    const grass =
      b.i === N - 1 ? `<path d="${tufts(c, W, Math.round(W / 70), 9 * pen, rng)}" fill="${pal.ink}"/>` : ''
    const drift = -(3 + d * 16)

    land +=
      `<g class="bi-piece" style="--i:${ctx.nextPiece()}">` +
      `<g class="bi-drift" style="--drift:${num(drift)}px;--dur:${num(90 - d * 30)}s">` +
      flat(b.body, tone, ink.reg * (0.4 + d * 0.6)) +
      `<g clip-path="${clipBody}">${inner}</g>` +
      `<path d="${crestInk}" fill="${lineTone}"/>` +
      grass +
      (host[b.i] ?? '') +
      `</g></g>`
  }

  return {
    body: `<g class="bi-air bi-piece" style="--i:${ctx.nextPiece()}">${sky}</g>` + land,
    sway: false,
    ambient: true,
  }
}
