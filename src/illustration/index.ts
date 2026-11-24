export {
  renderIllustration,
  describeIllustration,
  CANVAS,
  ENGINE_VERSION,
  FORMATS,
  FORMAT_ORDER,
  type Format,
  type FormatId,
  type IllustrationOptions,
  type ColorMode,
} from './render'
export {
  PALETTES,
  PALETTE_ORDER,
  resolvePalette,
  type Palette,
  type PaletteId,
} from './core/palette'
export {
  renderMotif,
  MOTIF_SUBJECTS,
  type Motif,
  type MotifBox,
  type MotifOptions,
  type MotifSubjectId,
} from './motif'
export {
  COLOR_ROLES,
  roleVar,
  paletteVars,
  toCssColors,
  markupBBox,
  penExtra,
  type ColorRole,
} from './markup'
export { SUBJECTS, SUBJECT_ORDER, PIECE_GATES } from './subjects'
export { SPECIMENS } from './subjects/botanical/species'
export { GROVE } from './subjects/grove/config'
export { SKY } from './subjects/sky/config'
export { DUNES } from './subjects/dunes/config'
export { meadowHorizon } from './subjects/garden/compose'
export {
  renderPiece,
  pieceFoot,
  MOTIF_PIECES,
  PIECE_CANVAS,
  type PieceKind,
  type MotifPieceKind,
  type PieceOptions,
} from './subjects/garden/piece'
export {
  daisy,
  stone,
  bush,
  bigLeaf,
  cypress,
  roundTree,
  hills,
  trail,
  lantern,
  LANTERN_STYLES,
  type LanternColors,
  type LanternOptions,
  type LanternStyle,
  type DaisyColors,
  type DaisyOptions,
  type HillsOptions,
  type TrailOptions,
} from './subjects/garden/motifs'
export {
  cageLantern,
  boulder,
  stoneCluster,
  grassClump,
  bed,
  sprig,
  cypressGroup,
  shrub,
  broadTree,
  type CageLanternColors,
  type CageLanternLayer,
  type CageLanternOptions,
  type BoulderColors,
  type BoulderOptions,
  type StoneClusterColors,
  type StoneClusterOptions,
  type GrassClumpColors,
  type GrassClumpOptions,
  type BedColors,
  type BedOptions,
  type SprigOptions,
  type CypressGroupOptions,
} from './subjects/garden/details'
export {
  pen,
  horizon,
  tuft,
  stream,
  sun,
  moon,
  type Pen,
  type Horizon,
  type MoonOptions,
  type StreamOptions,
} from './subjects/garden/pieces'
export { growthPlan, BLOOM_AT, BUD_AT, type GrowthPlan } from './subjects/botanical/growth'
export {
  auditSubject,
  auditAll,
  auditPiece,
  auditPieces,
  formatReport,
  DEFAULT_SEEDS,
  type QualityReport,
  type AuditOptions,
} from './quality'
export type {
  SubjectId,
  SubjectDef,
  SubjectFamily,
  QualityGate,
  ComposeCtx,
  ComposeResult,
} from './subjects/types'
export { createRng, hashSeed, type Rng } from './core/prng'
