/**
 * Review sheet of the fan sprig as a signature: the branch beside a name set
 * in a serif, on a day paper and a night paper, next to the 0.2.0 sprig and
 * the name alone, plus the branch at phone size and up close.
 *   pnpm run review:sprig
 *   pnpm run review:sprig --seeds=4821,47,90210 --out=out/review-0.3.0.png
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { fanSprig, markupBBox, pen, sprig } from '../src/illustration'

const args = process.argv.slice(2)
const read = (name: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

const seeds = (read('seeds') ?? '4821,47,90210').split(',').map(Number)
const out = resolve(read('out') ?? 'out/review-0.3.0.png')
const NAME = read('name') ?? 'Felipe Díaz'
const FONT = `Georgia, 'Times New Roman', serif`

const GROUNDS = [
  { label: 'day', bg: '#f8f6f0', ink: '#2c2a33' },
  { label: 'night', bg: '#1f2347', ink: '#ece6d8' },
]

type Draw = (color: string, shown: number) => string
const U = 100 // drawing units of the branch height

/** The branch drawn at `shown` px tall, its bounding box in px, as a nested svg. */
function placed(draw: Draw, color: string, shown: number) {
  const body = draw(color, shown)
  const b = markupBBox(body) ?? { x0: 0, y0: 0, x1: U, y1: U }
  const s = shown / U
  const pad = 2
  const w = (b.x1 - b.x0 + pad * 2) * s
  const h = (b.y1 - b.y0 + pad * 2) * s
  const svg = (x: number, y: number) =>
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${b.x0 - pad} ${b.y0 - pad} ${b.x1 - b.x0 + pad * 2} ${b.y1 - b.y0 + pad * 2}" overflow="visible">${body}</svg>`
  // where the foot of the stem lands, relative to the box
  return { w, h, svg, footY: (U - (b.y0 - pad)) * s }
}

const fan =
  (seed: number, side: 1 | -1 = 1): Draw =>
  (c, shown) =>
    fanSprig(pen(seed), { x: 0, y: U }, U, c, { side, displayHeight: shown })
// the 0.2.0 sprig, as a signature uses it today
const current =
  (seed: number): Draw =>
  (c, shown) =>
    sprig(pen(seed), { x: 0, y: U }, U, c, { leaves: 5, side: 1, displayHeight: shown })

interface Mock {
  label: string
  draw?: Draw
  shown: number
  font: number
}

const CELL_W = 560
const LABEL = 190
const GAP = 10

/** A name mock-up: the branch to the left of the name, centered on the name with its foot near the underline. */
function mock(m: Mock, g: (typeof GROUNDS)[number], x: number, y: number, h: number): string {
  let s = `<rect x="${x}" y="${y}" width="${CELL_W}" height="${h}" fill="${g.bg}"/>`
  const baseline = y + h * 0.5 + m.font * 0.3
  let tx = x + 40
  if (m.draw) {
    const b = placed(m.draw, g.ink, m.shown)
    const top = Math.min(baseline + m.font * 0.3 - b.footY, baseline - m.font * 0.35 - b.h / 2)
    s += b.svg(x + 40, top)
    tx = x + 40 + b.w + m.font * 0.22
  }
  s += `<text x="${tx}" y="${baseline}" font-family="${FONT}" font-size="${m.font}" fill="${g.ink}">${NAME}</text>`
  // the underline, as the page draws it
  s += `<path d="M${tx} ${baseline + m.font * 0.3}h${m.font * 5.2}" stroke="${g.ink}" stroke-width="${m.font > 40 ? 1.2 : 0.9}" opacity="0.7"/>`
  return s
}

const rows: { label: string; height: number; render: (g: (typeof GROUNDS)[number], x: number, y: number) => string }[] = []
for (const seed of seeds)
  rows.push({ label: `fan · seed ${seed} · 80 px`, height: 150, render: (g, x, y) => mock({ label: '', draw: fan(seed), shown: 80, font: 52 }, g, x, y, 150) })
rows.push({ label: `fan · seed ${seeds[0]} · 70 px`, height: 140, render: (g, x, y) => mock({ label: '', draw: fan(seeds[0]), shown: 70, font: 52 }, g, x, y, 140) })
rows.push({ label: `fan · side -1 · 80 px`, height: 150, render: (g, x, y) => mock({ label: '', draw: fan(seeds[1], -1), shown: 80, font: 52 }, g, x, y, 150) })
rows.push({ label: 'current sprig (0.2.0)', height: 150, render: (g, x, y) => mock({ label: '', draw: current(seeds[0]), shown: 72, font: 52 }, g, x, y, 150) })
rows.push({ label: 'no sprig', height: 150, render: (g, x, y) => mock({ label: '', shown: 0, font: 52 }, g, x, y, 150) })
// phone: three seeds side by side at 45 px, then one in a mock-up with a smaller name
rows.push({
  label: 'fan · 45 px (phone)',
  height: 100,
  render: (g, x, y) => {
    let s = `<rect x="${x}" y="${y}" width="${CELL_W}" height="100" fill="${g.bg}"/>`
    seeds.forEach((seed, i) => {
      const b = placed(fan(seed), g.ink, 45)
      s += b.svg(x + 40 + i * 110, y + 50 - b.h / 2)
    })
    return s
  },
})
rows.push({ label: `fan · phone mock-up`, height: 110, render: (g, x, y) => mock({ label: '', draw: fan(seeds[0]), shown: 45, font: 32 }, g, x, y, 110) })
rows.push({
  label: 'fan · up close (200 px)',
  height: 240,
  render: (g, x, y) => {
    let s = `<rect x="${x}" y="${y}" width="${CELL_W}" height="240" fill="${g.bg}"/>`
    seeds.forEach((seed, i) => {
      const b = placed(fan(seed), g.ink, 200)
      s += b.svg(x + 20 + i * 180 + (170 - b.w) / 2, y + 120 - b.h / 2)
    })
    return s
  },
})

const W = LABEL + GROUNDS.length * (CELL_W + GAP)
const H = rows.reduce((sum, r) => sum + r.height + GAP, GAP)
let body = `<rect width="${W}" height="${H}" fill="#e9e6de"/>`
let y = GAP
for (const row of rows) {
  body += `<text x="10" y="${y + row.height / 2 + 5}" font-family="sans-serif" font-size="14" fill="#333">${row.label}</text>`
  GROUNDS.forEach((g, gi) => (body += row.render(g, LABEL + gi * (CELL_W + GAP), y)))
  y += row.height + GAP
}
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, new Resvg(sheet, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true, defaultFontFamily: 'Georgia' } }).render().asPng())
console.log(`Sprig review sheet: ${rows.length} rows → ${out}`)
