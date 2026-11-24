import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FORMATS,
  PALETTES,
  PALETTE_ORDER,
  SUBJECTS,
  SUBJECT_ORDER,
  describeIllustration,
  renderIllustration,
  type FormatId,
  type IllustrationOptions,
  type PaletteId,
  type SubjectId,
} from '../illustration'
import { Illustration } from '../illustration/react'

interface State {
  seed: number
  subject: SubjectId
  palette: PaletteId
  format: FormatId
  registration: number
  animate: boolean
  grain: boolean
}

const DEFAULT: State = {
  seed: 4821,
  subject: 'flat',
  palette: 'herbarium',
  format: 'plate',
  registration: 2.5,
  animate: true,
  grain: true,
}

function readHash(): State {
  const raw = window.location.hash.replace(/^#\/?/, '')
  if (!raw) return DEFAULT
  const [seed, subject, palette, registration, format] = raw.split('/')
  const subjectId = (SUBJECT_ORDER as string[]).includes(subject)
    ? (subject as SubjectId)
    : DEFAULT.subject
  const def = SUBJECTS[subjectId]
  const reg = Number(registration)
  return {
    seed: Number(seed) > 0 ? Math.floor(Number(seed)) : DEFAULT.seed,
    subject: subjectId,
    palette: (PALETTE_ORDER as string[]).includes(palette) ? (palette as PaletteId) : DEFAULT.palette,
    format: def.formats.includes(format as FormatId) ? (format as FormatId) : def.formats[0],
    registration: Number.isFinite(reg) ? Math.min(8, Math.max(0, reg)) : DEFAULT.registration,
    animate: true,
    grain: true,
  }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function downloadSvg(options: IllustrationOptions) {
  const svg = renderIllustration({ ...options, animate: false })
  const meta = describeIllustration(options)
  saveBlob(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    `biome-${options.subject}-${meta.format}-${options.seed}.svg`,
  )
}

async function downloadPng(options: IllustrationOptions) {
  const svg = renderIllustration({ ...options, animate: false })
  const meta = describeIllustration(options)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  const image = new Image()
  image.src = url
  await image.decode()

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = meta.width * scale
  canvas.height = meta.height * scale
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (blob) {
      saveBlob(blob, `biome-${options.subject}-${meta.format}-${options.seed}@2x.png`)
    }
  }
  URL.revokeObjectURL(url)
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 1.6v8.1M4.9 6.6 8 9.7l3.1-3.1M2.4 12.6v1.4h11.2v-1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DiceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.9" cy="5.9" r="1" fill="currentColor" />
      <circle cx="10.1" cy="10.1" r="1" fill="currentColor" />
    </svg>
  )
}

export function App() {
  const [state, setState] = useState<State>(readHash)
  const [draftSeed, setDraftSeed] = useState(String(state.seed))
  // The variations strip hangs from this seed. Picking a variation only changes
  // `state.seed`, so the strip stays put; a new seed (R, the input) moves it.
  const [baseSeed, setBaseSeed] = useState(state.seed)

  const options: IllustrationOptions = useMemo(
    () => ({
      seed: state.seed,
      subject: state.subject,
      palette: state.palette,
      format: state.format,
      registration: state.registration,
      animate: state.animate,
      grain: state.grain,
    }),
    [state],
  )

  const meta = describeIllustration(options)
  const subject = SUBJECTS[state.subject]
  const palette = PALETTES[state.palette]

  useEffect(() => {
    window.history.replaceState(
      null,
      '',
      `#${state.seed}/${state.subject}/${state.palette}/${state.registration}/${state.format}`,
    )
    setDraftSeed(String(state.seed))
  }, [state.seed, state.subject, state.palette, state.registration, state.format])

  const newSeed = useCallback(() => {
    const seed = Math.floor(Math.random() * 90000) + 1000
    setBaseSeed(seed)
    setState((s) => ({ ...s, seed }))
  }, [])

  const pickSubject = useCallback((id: SubjectId) => {
    setState((s) => ({
      ...s,
      subject: id,
      format: SUBJECTS[id].formats.includes(s.format) ? s.format : SUBJECTS[id].formats[0],
    }))
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        newSeed()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newSeed])

  const commitSeed = () => {
    const next = Number.parseInt(draftSeed, 10)
    if (Number.isFinite(next) && next > 0) {
      setBaseSeed(next)
      setState((s) => ({ ...s, seed: next }))
    } else setDraftSeed(String(state.seed))
  }

  const variants = [baseSeed, ...Array.from({ length: 8 }, (_, i) => baseSeed + 11 * (i + 1) + 4)]

  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <span className="brand-name">biome-illustrator</span>
          <span className="brand-tag">generative illustration engine</span>
        </div>
        <div className="bar-tools">
          <span className="seed-chip">
            seed <b>{state.seed}</b>
          </span>
          <button className="btn" onClick={() => downloadSvg(options)}>
            <DownloadIcon /> SVG
          </button>
          <button className="btn" onClick={() => void downloadPng(options)}>
            <DownloadIcon /> PNG
          </button>
        </div>
      </header>

      <div className="work">
        <aside className="rail">
          <div className="rail-scroll">
            <div className="rail-head">
            <p className="eyebrow">plate {meta.plate}</p>
            <h1 className="latin">{subject.latin}</h1>
            <p className="note">{subject.note}</p>
          </div>

          <section className="group">
            <h2 className="group-title">subject</h2>
            <div className="subject-list">
              {SUBJECT_ORDER.map((id) => {
                const item = SUBJECTS[id]
                const active = id === state.subject
                return (
                  <button
                    key={id}
                    type="button"
                    className={`subject${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => pickSubject(id)}
                  >
                    <span className="subject-glyph" style={{ background: palette.paper }}>
                      <Illustration
                        seed={7}
                        subject={id}
                        palette={state.palette}
                        format={item.formats.includes('plate') ? 'plate' : item.formats[0]}
                        registration={0}
                        animate={false}
                        grain={false}
                      />
                    </span>
                    <span className="subject-text">
                      <span className="subject-latin">{item.latin}</span>
                      <span className="subject-note">{item.short}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="group">
            <h2 className="group-title">format</h2>
            <div className="formats">
              {subject.formats.map((id) => {
                const f = FORMATS[id]
                const active = id === state.format
                return (
                  <button
                    key={id}
                    type="button"
                    className={`format${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => setState((s) => ({ ...s, format: id }))}
                  >
                    <b>{f.name}</b>
                    <span>{f.short}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="group">
            <h2 className="group-title">palette</h2>
            <div className="palettes">
              {PALETTE_ORDER.map((id) => {
                const p = PALETTES[id]
                const active = id === state.palette
                return (
                  <button
                    key={id}
                    type="button"
                    className={`palette${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    aria-label={`Palette ${p.name}`}
                    title={p.name}
                    onClick={() => setState((s) => ({ ...s, palette: id }))}
                  >
                    <span style={{ background: p.paper, flex: 1 }} />
                    <span style={{ background: p.accent, flex: 1 }} />
                    <span style={{ background: p.accentAlt, flex: 1 }} />
                  </button>
                )
              })}
            </div>
            <p className="palette-name">{palette.name}</p>
          </section>

          <section className="group">
            <h2 className="group-title">seed</h2>
            <div className="seed-row">
              <label className="seed-field">
                <span className="seed-hash">#</span>
                <input
                  value={draftSeed}
                  inputMode="numeric"
                  onChange={(e) => setDraftSeed(e.target.value.replace(/[^\d]/g, ''))}
                  onBlur={commitSeed}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                  aria-label="Seed number"
                />
              </label>
              <button type="button" className="icon-btn" onClick={newSeed} aria-label="Random seed" title="Random seed (R)">
                <DiceIcon />
              </button>
            </div>
          </section>

          <section className="group">
            <h2 className="group-title">registration</h2>
            <div className="range-row">
              <input
                className="range"
                type="range"
                min={0}
                max={6}
                step={0.5}
                value={state.registration}
                onChange={(e) =>
                  setState((s) => ({ ...s, registration: Number(e.target.value) }))
                }
                aria-label="Offset between color and line"
              />
              <span className="range-value">{state.registration.toFixed(1)}</span>
            </div>
          </section>

          <section className="group toggles">
            <div className="toggle-row">
              <span>animation</span>
              <button
                type="button"
                role="switch"
                aria-checked={state.animate}
                className="switch"
                onClick={() => setState((s) => ({ ...s, animate: !s.animate }))}
              >
                <span className="sr-only">Animate the entrance</span>
              </button>
            </div>
            <div className="toggle-row">
              <span>paper grain</span>
              <button
                type="button"
                role="switch"
                aria-checked={state.grain}
                className="switch"
                onClick={() => setState((s) => ({ ...s, grain: !s.grain }))}
              >
                <span className="sr-only">Paper texture</span>
              </button>
            </div>
          </section>
          </div>

          <button type="button" className="cta" onClick={newSeed}>
            New seed
            <kbd>R</kbd>
          </button>
        </aside>

        <main className="stage">
          <figure className="plate-wrap">
            <div
              className="plate"
              style={{
                aspectRatio: String(meta.ratio),
                height: meta.ratio >= 1 ? 'auto' : '100%',
                width: meta.ratio >= 1 ? '100%' : 'auto',
              }}
            >
              <Illustration
                seed={state.seed}
                subject={state.subject}
                palette={state.palette}
                format={state.format}
                registration={state.registration}
                animate={state.animate}
                grain={state.grain}
              />
            </div>
            <figcaption className="plate-caption">
              <span className="cap-latin">{subject.latin}</span>
              <span>
                seed {meta.seed} · {palette.name.toLowerCase()} · {meta.format.toLowerCase()}
              </span>
            </figcaption>
          </figure>
        </main>
      </div>

      <footer className="strip">
        <span className="strip-label">variations</span>
        <div className="strip-row">
          {variants.map((seed) => (
            <button
              key={seed}
              type="button"
              className={seed === state.seed ? 'thumb is-active' : 'thumb'}
              aria-pressed={seed === state.seed}
              title={seed === baseSeed ? `Original seed ${seed}` : `Use seed ${seed}`}
              aria-label={seed === baseSeed ? `Original seed ${seed}` : `Use seed ${seed}`}
              onClick={() => setState((s) => ({ ...s, seed }))}
            >
              <Illustration
                seed={seed}
                subject={state.subject}
                palette={state.palette}
                format={state.format}
                registration={state.registration}
                animate={false}
                grain={false}
              />
            </button>
          ))}
        </div>
      </footer>
    </div>
  )
}
