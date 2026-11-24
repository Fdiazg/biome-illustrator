/**
 * Quality audit.
 *   pnpm run audit
 *   pnpm run audit --palette=mono
 *   pnpm run audit --format=wide
 *
 * Exits with code 1 if any subject does not meet its own criterion.
 */
import { auditAll, auditPieces, formatReport, type AuditOptions } from '../src/illustration'

const args = process.argv.slice(2)
const read = (name: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : undefined
}

const options: AuditOptions = {
  palette: read('palette') as AuditOptions['palette'],
  format: read('format') as AuditOptions['format'],
}

const plates = auditAll(options)
// the garden motifs have their own canvas: they are not filtered by format
const pieces = options.format ? [] : auditPieces({ palette: options.palette })
const reports = [...plates, ...pieces]
console.log('')
for (const report of plates) console.log(formatReport(report))
if (pieces.length) {
  console.log('')
  for (const report of pieces) console.log(formatReport(report))
}
console.log('')

const failed = reports.filter((r) => !r.passes)
console.log(`${reports.length - failed.length}/${reports.length} combinaciones sujeto × formato y motivos pasan el gate`)
if (failed.length) process.exitCode = 1
