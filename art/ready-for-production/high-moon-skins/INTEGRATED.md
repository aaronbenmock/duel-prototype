# Integrated 2026-09-26 (v0.8.1)

- Copied: `creatures/*.webp` -> `art/exports/creatures/` (12 files), `weapons/*.webp` -> `art/exports/weapons/` (36 files).
  WebP only (lossy q90, alpha q100; 1.8 MB + 2.8 MB); PNG copies stay out of git.
- Code: `SKIN_ART` in `src/render/art.ts` (found by file name), skin items and unlock rules in `CATALOGUE`
  (`src/wardrobe/wardrobe.ts`): per alien, first skin free, second after 5 wins, third after 3 wins in a row.
- Checks: `npm run build`, `npx tsc --noEmit -p .`, `src/dev/wardrobeCheck.ts` (12 items, all passed), browser at
  375 x 667 and 390 x 844 (Outfitter, portrait, poster, duel with bot skin and skinned hand).
- Unresolved: none.
