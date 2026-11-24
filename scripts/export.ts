/**
 * Exports plates to SVG on disk.
 *   pnpm export
 * Useful to generate a catalog without opening the browser. Each subject is exported
 * in every format it can compose.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PALETTES,
  PALETTE_ORDER,
  SUBJECTS,
  SUBJECT_ORDER,
  renderIllustration,
} from '../src/illustration'

const outDir = join(process.cwd(), 'out')
mkdirSync(outDir, { recursive: true })

const seeds = [4821, 7391, 1902]
let count = 0

for (const subject of SUBJECT_ORDER) {
  for (const format of SUBJECTS[subject].formats) {
    for (const palette of PALETTE_ORDER) {
      for (const seed of seeds) {
        const svg = renderIllustration({
          seed,
          subject,
          palette,
          format,
          animate: false,
          grain: true,
        })
        const name = `biome-${subject}-${format}-${palette}-${seed}.svg`
        writeFileSync(join(outDir, name), svg, 'utf8')
        count++
      }
    }
  }
}

console.log(`${count} láminas en ${outDir}`)
console.log(`paletas: ${PALETTE_ORDER.map((id) => PALETTES[id].name).join(', ')}`)
