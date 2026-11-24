# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). While the package is
at `0.x`, the API may change between minor versions.

## [0.2.0]

New garden pieces, all opt-in: every existing plate and piece draws the same
SVG as in 0.1.0 (`ENGINE_VERSION` stays at 3).

### Added

- `cage-lantern` (`cageLantern`): a framed candle lantern with four panes, a
  pointed roof and a ring. `lit` turns the flame on or off; `layer` draws one
  layer (`halo`, `fill`, `glass` or `ink`) with the same geometry.
- `boulder`: a rounded stone half sunk in the ground, with a lighter flat
  plane on top.
- `stone-cluster` (`stoneCluster`): two to four boulders with grass clumps and
  optional daisies.
- `grass-clump` (`grassClump`): a fan of broad and thin blades, with a
  density option.
- `bed`: a patch of soil seen in perspective, with clods, pebbles and an
  optional rim of small stones (`ratio`, `rim`).
- `sprig`: a thin botanical branch in line only, legible at 60–90 px
  (`displayHeight` keeps the pen above a minimum width).
- `cypress-group` (`cypressGroup`), `shrub` and `broad-tree` (`broadTree`):
  silhouettes for the edge of a wood on the horizon.
- Moon with a phase: `maria` adds flat patches on the lit part (default off).
- `renderPiece` options for the new pieces: `lit`, `layer`, `ratio`, `rim`,
  `density`, `count`, `flowers` and `maria`.
- `pnpm run review`: a PNG sheet of the pieces over a day and a night ground.

## [0.1.0]

First public release (`ENGINE_VERSION = 3`).

- Seven subjects: `flat`, `ink`, `line`, `grove`, `cumulus`, `dunes` and `meadow`.
- Three formats (`plate`, `wide`, `square`) and six palettes.
- `renderIllustration`, `renderMotif` and `renderPiece`, with the garden
  pieces: sun, moon with phases, grass tufts, daisy, stone, bush, large leaf,
  cypress, round tree, hills, trail and lantern.
- Options `colors: 'css'`, `displayWidth`, `growth` and `registration`.
- Entry points `biome-illustrator`, `biome-illustrator/core` and `biome-illustrator/react`.

[0.2.0]: https://github.com/Fdiazg/biome-illustrator/releases/tag/v0.2.0
[0.1.0]: https://github.com/Fdiazg/biome-illustrator/releases/tag/v0.1.0
