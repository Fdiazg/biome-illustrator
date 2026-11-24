/**
 * Review sheet of the garden pieces: each piece over a day ground and a night
 * ground, a few seeds each, in one PNG.
 *   pnpm run review
 *   pnpm run review --only=boulder,bed --seeds=1,2,3 --cell=320
 *   pnpm run review --out=out/review.png
 *
 * Day uses the `garden` palette on sage, night `garden-night` on ink blue.
 * By default it shows the pieces added in 0.2.0.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { PIECE_CANVAS, renderPiece, type PieceOptions } from '../src/illustration'

const args = process.argv.slice(2)
const read = (name: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

interface Row {
  label: string
  opts: Omit<PieceOptions, 'seed' | 'palette'>
  /** px height to show it at, if not the cell */
  displayHeight?: number
}

const ROWS: Row[] = [
  { label: 'cage-lantern (lit)', opts: { kind: 'cage-lantern' } },
  { label: 'cage-lantern (unlit)', opts: { kind: 'cage-lantern', lit: false } },
  { label: 'boulder', opts: { kind: 'boulder' } },
  { label: 'stone-cluster', opts: { kind: 'stone-cluster' } },
  { label: 'grass-clump', opts: { kind: 'grass-clump' } },
  { label: 'bed', opts: { kind: 'bed' } },
  { label: 'sprig', opts: { kind: 'sprig' } },
  { label: 'sprig at 80 px', opts: { kind: 'sprig' }, displayHeight: 80 },
  { label: 'cypress-group', opts: { kind: 'cypress-group' } },
  { label: 'shrub', opts: { kind: 'shrub' } },
  { label: 'broad-tree', opts: { kind: 'broad-tree' } },
  { label: 'moon, maria', opts: { kind: 'moon', phase: 0.5, maria: true } },
  { label: 'moon, gibbous + maria', opts: { kind: 'moon', phase: 0.62, maria: true } },
]

const only = read('only')?.split(',')
const rows = only ? ROWS.filter((r) => only.some((o) => r.label.startsWith(o))) : ROWS
const seeds = (read('seeds') ?? '4821,47,90210').split(',').map(Number)
const cell = Number(read('cell') ?? 220)
const out = resolve(read('out') ?? 'out/review-0.2.0.png')
const GROUNDS = [
  { palette: 'garden' as const, bg: '#d9e3cf' },
  { palette: 'garden-night' as const, bg: '#4d5878' },
]
const LABEL = 150
const GAP = 8

const cols = seeds.length * GROUNDS.length
const W = LABEL + cols * (cell + GAP)
const H = rows.length * (cell + GAP) + GAP
let body = `<rect width="${W}" height="${H}" fill="#f6f3ec"/>`
rows.forEach((row, r) => {
  const y = GAP + r * (cell + GAP)
  body += `<text x="10" y="${y + cell / 2}" font-family="sans-serif" font-size="14" fill="#333">${row.label}</text>`
  GROUNDS.forEach((g, gi) => {
    seeds.forEach((seed, si) => {
      const x = LABEL + (gi * seeds.length + si) * (cell + GAP)
      body += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${g.bg}"/>`
      const kind = row.opts.kind
      const canvas = kind === 'sun' || kind === 'moon' || kind === 'tuft' ? { width: 160, height: 160 } : PIECE_CANVAS[kind]
      // fit the canvas in the cell, or show it at its display height
      const fit = Math.min(cell / canvas.width, cell / canvas.height)
      const scale = row.displayHeight ? row.displayHeight / canvas.height : fit
      const dw = canvas.width * scale
      const svg = renderPiece({ ...row.opts, seed, palette: g.palette, displayWidth: dw })
      const dh = canvas.height * scale
      const px = x + (cell - dw) / 2
      const py = y + (cell - dh) / 2
      body += svg.replace(/^<svg /, `<svg x="${px}" y="${py}" `)
    })
  })
})
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, new Resvg(sheet, { fitTo: { mode: 'width', value: W } }).render().asPng())
console.log(`Review sheet: ${rows.length} rows × ${cols} cells → ${out}`)
