/**
 * Contact sheet.
 *   pnpm sheet
 *
 * Renders each subject in several seeds and builds `out/sheet/index.html`.
 * Useful to curate seeds and to see at a glance whether a subject changes with the
 * seed or just shakes.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FORMATS,
  SUBJECTS,
  SUBJECT_ORDER,
  renderIllustration,
  auditSubject,
  type FormatId,
  type SubjectId,
} from '../src/illustration'

const SEEDS = [4821, 7391, 1902, 611, 47, 9031]
const outDir = join(process.cwd(), 'out', 'sheet')
mkdirSync(outDir, { recursive: true })

const fmt = (format: FormatId) => FORMATS[format]

function cell(subject: SubjectId, seed: number, format: FormatId): string {
  const name = `${subject}-${format}-${seed}.svg`
  const svg = renderIllustration({
    seed,
    subject,
    palette: 'herbarium',
    format,
    registration: 2.5,
    animate: false,
    grain: true,
  })
  writeFileSync(join(outDir, name), svg, 'utf8')
  const width = format === 'wide' ? 520 : 240
  return (
    `<figure class="cell">` +
    `<img src="${name}" width="${width}" alt="${subject}, seed ${seed}">` +
    `<figcaption>${subject} · ${seed}</figcaption>` +
    `</figure>`
  )
}

function row(subject: SubjectId, format: FormatId): string {
  const def = SUBJECTS[subject]
  const report = auditSubject(subject, { seeds: SEEDS, format })
  const mark = report.passes ? 'pass' : 'fail'
  const cells = SEEDS.map((seed) => cell(subject, seed, format)).join('')
  return (
    `<section class="row">` +
    `<header>` +
    `<h2>${def.latin}</h2>` +
    `<p>${subject} · ${def.family} · ${def.short}</p>` +
    `<p class="gate ${report.passes ? 'ok' : 'bad'}">${mark} · ${report.paths} paths · ${report.tones} tones · ${(report.variation * 100).toFixed(1)}% variation · ${fmt(format).short}</p>` +
    `</header>` +
    `<div class="cells">${cells}</div>` +
    `</section>`
  )
}

const sections: string[] = []
for (const subject of SUBJECT_ORDER) {
  const def = SUBJECTS[subject]
  sections.push(row(subject, def.formats[0]))
}

// format comparison: the same subject and the same seed on each canvas
sections.push(`<h1 class="divider">Same subject in every format</h1>`)
for (const subject of SUBJECT_ORDER) {
  const def = SUBJECTS[subject]
  const cells = def.formats.map((format) => cell(subject, 4821, format)).join('')
  sections.push(
    `<section class="row">` +
      `<header><h2>${def.latin}</h2><p>${subject} · ${def.formats.map((f) => fmt(f).name.toLowerCase()).join(' · ')}</p></header>` +
      `<div class="cells">${cells}</div>` +
      `</section>`,
  )
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>biome-illustrator · contact sheet</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; background: #dedad0; color: #1b1b18;
         font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
  h1 { font: italic 400 22px/1.2 Georgia, serif; margin: 0 0 18px; }
  h1.divider { margin: 42px 0 10px; padding-top: 18px; border-top: 1px solid #b9b3a6; }
  h2 { font: italic 400 17px/1.2 Georgia, serif; margin: 0; }
  p { margin: 3px 0 0; color: #555147; }
  .row { margin: 0 0 26px; }
  .row header { margin: 0 0 8px; }
  .gate { font-variant-numeric: tabular-nums; }
  .gate.ok { color: #2f6b3a; }
  .gate.bad { color: #a12d22; }
  .cells { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
  .cell { margin: 0; background: #f2ede2; box-shadow: 0 1px 0 #fff6, 0 8px 18px -12px #0008; }
  .cell img { display: block; height: auto; }
  .cell figcaption { padding: 5px 7px; color: #6b6559; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<h1>biome-illustrator · contact sheet</h1>
${sections.join('\n')}
</body>
</html>`

writeFileSync(join(outDir, 'index.html'), html, 'utf8')
console.log(`Contact sheet: ${join(outDir, 'index.html')}`)
console.log(`${SUBJECT_ORDER.length} subjects · ${SEEDS.length} seeds · all formats`)
