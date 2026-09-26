# Integrated 2026-09-26 (v0.8.3)

- Copied to `art/exports/accessories/`: `acc_buckle-meteor.png/.webp`, `acc_buckle-ringed-moon.png/.webp` (by the fit tool).
- Code: `ITEM_ART` and `BUCKLE_FIT` (from fit.json) in `src/render/art.ts`; buckle items in `CATALOGUE` and
  `botBuckleForSeed` in `src/wardrobe/wardrobe.ts` (meteor free, ringed moon after wins on 5 different maps);
  drawn on the opponent in `src/render/gameView.ts` and on the Outfitter preview in `src/render/startView.ts`;
  logged as `opponent.buckle`.
- Checks: build, type-check, wardrobe check, fit tool coverage asserts, browser at 375 x 667.
- Unresolved: none.
