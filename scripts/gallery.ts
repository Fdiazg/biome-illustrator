/**
 * Renders the README gallery to docs/img.
 *   pnpm run gallery
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderIllustration, type IllustrationOptions } from '../src/illustration'

const outDir = join(process.cwd(), 'docs', 'img')
mkdirSync(outDir, { recursive: true })

const plates: Array<[string, IllustrationOptions]> = [
  ['ink-riso', { seed: 4821, subject: 'ink', palette: 'riso' }],
  ['flat-herbarium', { seed: 7391, subject: 'flat', palette: 'herbarium' }],
  ['line-mono', { seed: 1902, subject: 'line', palette: 'mono' }],
  ['dunes-wide', { seed: 9010, subject: 'dunes', palette: 'herbarium', format: 'wide' }],
  ['cumulus-wide', { seed: 4821, subject: 'cumulus', palette: 'riso', format: 'wide' }],
]

for (const [name, options] of plates) {
  writeFileSync(join(outDir, `${name}.svg`), renderIllustration({ ...options, animate: false }), 'utf8')
}
console.log(`${plates.length} SVG in ${outDir}`)
