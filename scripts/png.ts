/**
 * Renders plates to PNG without a browser, with resvg.
 *   pnpm run png --subject=grove
 *   pnpm run png --subject=cumulus --format=wide --palette=night --seeds=4821,47
 *   pnpm run png --subject=dunes --out=out/png-dunes --width=900
 *
 * Options:
 *   --growth=0.2,0.5,1     one plate per growth state
 *   --display=120          `displayWidth`: pen for that width (and PNG at that width)
 *   --colors=css --tint=garden-night
 *                          variables mode; resvg does not resolve var(), so they
 *                          are replaced the way a page would that defines
 *                          the variables with the `tint` palette
 *   --motif                `renderMotif` (line, ink, flat, grove); with
 *                          --debug it draws the box and the foot on top
 *
 * By default: every format of the subject, herbarium palette, four
 * seeds, 700 px wide, in out/png/. Useful to look at a subject without
 * opening the studio.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import {
  MOTIF_SUBJECTS,
  PALETTES,
  SUBJECTS,
  renderIllustration,
  renderMotif,
  roleVar,
  COLOR_ROLES,
  type ColorMode,
  type FormatId,
  type MotifSubjectId,
  type PaletteId,
} from '../src/illustration'
import type { SubjectId } from '../src/illustration/subjects/types'

const args = process.argv.slice(2)
const read = (name: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}
const flag = (name: string) => args.includes(`--${name}`)

const subject = (read('subject') ?? 'grove') as SubjectId
if (!SUBJECTS[subject]) {
  console.error(`Unknown subject: ${subject}`)
  process.exit(1)
}
const def = SUBJECTS[subject]
const requested = read('format') as FormatId | undefined
const formats = requested ? [requested] : [...def.formats]
const palette = (read('palette') ?? 'herbarium') as PaletteId
const seeds = (read('seeds') ?? '4821,7391,1902,47').split(',').map(Number)
const display = read('display') ? Number(read('display')) : undefined
const width = Number(read('width') ?? display ?? 700)
const outDir = resolve(read('out') ?? join('out', 'png'))
const grain = read('grain') !== 'false'
const growths = read('growth') ? read('growth')!.split(',').map(Number) : [undefined]
const colors = read('colors') as ColorMode | undefined
const tint = PALETTES[(read('tint') ?? palette) as PaletteId] ?? PALETTES[palette]
const motif = flag('motif')
const debug = flag('debug')

/** What the page would do: define the variables with the `tint` palette. */
function resolveVars(svg: string): string {
  const values = new Map(COLOR_ROLES.map((r) => [roleVar(r), tint[r]]))
  return svg.replace(/var\((--bi-[a-z-]+),([^)]+)\)/g, (_, name: string, fallback: string) => values.get(name) ?? fallback)
}

function toPng(svg: string, w: number, file: string, background?: string) {
  let src = colors === 'css' ? resolveVars(svg) : svg
  if (background) src = src.replace(/(<svg[^>]*>)/, `$1<rect x="-9999" y="-9999" width="99999" height="99999" fill="${background}"/>`)
  writeFileSync(join(outDir, file), new Resvg(src, { fitTo: { mode: 'width', value: w } }).render().asPng())
}

mkdirSync(outDir, { recursive: true })
let count = 0
const g = (v?: number) => (v === undefined ? '' : `-g${v}`)

if (motif) {
  if (!MOTIF_SUBJECTS.includes(subject as MotifSubjectId)) {
    console.error(`${subject} is not a motif subject (expected one of: ${MOTIF_SUBJECTS.join(', ')})`)
    process.exit(1)
  }
  for (const seed of seeds) {
    for (const growth of growths) {
      const m = renderMotif({ seed, subject: subject as MotifSubjectId, palette, growth, colors, displayWidth: display })
      let svg = m.svg
      if (debug) {
        const { bbox: b, anchor: a } = m
        svg = svg.replace(
          '</svg>',
          `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="none" stroke="#E0218A" stroke-width="1.5" stroke-dasharray="6 4"/>` +
            `<path d="M${a.x - 12} ${a.y}H${a.x + 12}M${a.x} ${a.y - 12}V${a.y + 12}" stroke="#0A8F6A" stroke-width="2.5"/></svg>`,
        )
      }
      // at its own size (scale 1) unless a width is requested
      toPng(svg, display ?? Math.round(m.width), `motif-${subject}-${palette}-${seed}${g(growth)}${display ? `-d${display}` : ''}.png`, tint.paper)
      console.log(`${subject} ${seed}${g(growth)}: ${m.width}×${m.height} px, anchor (${m.anchor.x}, ${m.anchor.y})`)
      count++
    }
  }
} else {
  for (const format of formats) {
    for (const seed of seeds) {
      for (const growth of growths) {
        const svg = renderIllustration({ seed, subject, palette, format, animate: false, grain, growth, colors, displayWidth: display })
        const tag = `${colors === 'css' ? `-css-${tint.id}` : ''}${display ? `-d${display}` : ''}`
        toPng(svg, width, `${subject}-${format}-${palette}-${seed}${g(growth)}${tag}.png`)
        count++
      }
    }
  }
}
console.log(`Rendered ${count} PNG files to ${outDir}`)
