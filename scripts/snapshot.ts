/**
 * Regression test: byte-for-byte identity of the SVG.
 *   pnpm run snapshot            compares against scripts/snapshot.json
 *   pnpm run snapshot --update   rewrites the manifest
 *
 * Renders every subject × its formats × every palette × six
 * seeds, with the default options and with one variant (animated, no
 * paper, registration 0), and stores the sha1 of each SVG. The quality gate measures
 * whether a subject is finished; this measures whether someone changed it by accident.
 *
 * Exits with code 1 if an existing entry changed or disappeared. New
 * entries (an added palette or subject) are reported, they do not fail.
 *
 * The garden motifs (`renderPiece`) enter too, per palette and seed, in hex and in
 * css with a display width.
 *
 * It also checks that the opt-in options at their neutral value
 * (`growth: 1`, `colors: 'hex'`) give the same SVG as without them.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MOTIF_PIECES,
  PALETTE_ORDER,
  SUBJECTS,
  SUBJECT_ORDER,
  renderIllustration,
  renderPiece,
  type IllustrationOptions,
} from '../src/illustration'

const SEEDS = [4821, 7391, 1902, 47, 1, 90210]
const VARIANTS: Record<string, Partial<IllustrationOptions>> = {
  base: {},
  anim: { animate: true, paper: false, registration: 0 },
}

const file = join(process.cwd(), 'scripts', 'snapshot.json')
const update = process.argv.includes('--update')

const sha1 = (svg: string) => createHash('sha1').update(svg).digest('hex')
const current: Record<string, string> = {}
const neutralBroken: string[] = []
for (const subject of SUBJECT_ORDER) {
  for (const format of SUBJECTS[subject].formats) {
    for (const palette of PALETTE_ORDER) {
      for (const seed of SEEDS) {
        for (const [variant, extra] of Object.entries(VARIANTS)) {
          const svg = renderIllustration({ seed, subject, palette, format, ...extra })
          const key = `${subject}/${format}/${palette}/${seed}/${variant}`
          current[key] = sha1(svg)
          if (variant === 'base') {
            const neutral = renderIllustration({ seed, subject, palette, format, growth: 1, colors: 'hex' })
            if (sha1(neutral) !== current[key]) neutralBroken.push(key)
          }
        }
      }
    }
  }
}
// the garden motifs (renderPiece): hex and css colors
for (const kind of MOTIF_PIECES) {
  for (const palette of PALETTE_ORDER) {
    for (const seed of SEEDS) {
      current[`piece/${kind}/${palette}/${seed}/base`] = sha1(renderPiece({ kind, seed, palette }))
      current[`piece/${kind}/${palette}/${seed}/css`] = sha1(renderPiece({ kind, seed, palette, colors: 'css', displayWidth: 120 }))
    }
  }
}
if (neutralBroken.length) {
  console.log(`${neutralBroken.length} entries change with neutral options (growth: 1, colors: 'hex')`)
  for (const key of neutralBroken.slice(0, 10)) console.log(`  neutral  ${key}`)
  process.exitCode = 1
}

const total = Object.keys(current).length
if (update || !existsSync(file)) {
  writeFileSync(file, JSON.stringify(current, null, 1) + '\n', 'utf8')
  console.log(`Wrote ${total} entries to ${file}`)
  process.exit(0)
}

const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
let same = 0
const changed: string[] = []
const missing: string[] = []
const added: string[] = []
for (const [key, hash] of Object.entries(saved)) {
  if (!(key in current)) missing.push(key)
  else if (current[key] === hash) same++
  else changed.push(key)
}
for (const key of Object.keys(current)) if (!(key in saved)) added.push(key)

console.log(`Snapshot: ${same}/${Object.keys(saved).length} entries unchanged`)
if (added.length) console.log(`${added.length} new entries (not in the snapshot yet; run with --update)`)
for (const key of changed.slice(0, 20)) console.log(`  changed  ${key}`)
for (const key of missing.slice(0, 20)) console.log(`  missing  ${key}`)
if (changed.length > 20) console.log(`  … and ${changed.length - 20} more`)
if (changed.length || missing.length) process.exitCode = 1
