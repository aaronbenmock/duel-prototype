# Integrated 2026-09-28 (v0.8.4)

- Validated: all six files decode, 1290 x 2796, opaque, SHA-256 matches `manifest.json`.
- Copied to `art/exports/backgrounds/`: `bg_starlight-train-deck.webp`, `bg_frontier-spaceport.webp`,
  `bg_titan-fossil-arch.webp` (WebP only, as-is; the game uses WebP for backgrounds; PNGs stay in this package).
- Code: `MAPS` and `MAP_NAMES` in `src/game/maps.ts` (10 maps, one per round from the seed), `MAP_ART` in
  `src/render/art.ts`. Street lines (where the opponent's feet stand, fraction of image height), set at the same
  0.11 depth below where the ground starts as the other maps: train deck 0.545 (flatbed starts about 0.44),
  spaceport 0.51 (hangar floor about 0.40), fossil arch 0.515 (sand about 0.405).
- Checks: `npm run build`, `npx tsc --noEmit -p .`, browser at 390 x 844 and 375 x 667 on each map: feet on the
  floor, crosshair, paint and charm readable, bottom HUD inside the screen, no sideways scrolling.
- Notes: the train deck is the corrected connected train (the superseded first train was never in the game).
  On Hard the bot's widest strafes take it close to the flatbed's side rails; it stays on the deck.
- Unresolved: none.
