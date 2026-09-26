# Integrated 2026-09-26 (v0.8.2)

- Copied to `art/exports/accessories/`: `acc_charm-saguaro.png/.webp`, `acc_charm-moonbeetle.png/.webp`.
- Code: `ITEM_ART`, `CHARM_SIZE` and each gun's `charm` anchor in `src/render/art.ts`; charm items in `CATALOGUE`
  (`src/wardrobe/wardrobe.ts`: saguaro free, moon beetle after 25 face hits); drawn and swung in
  `src/render/gameView.ts` (`swingCharm`); worn from the Outfitter's Wardrobe.
- Checks: build, type-check, wardrobe check, browser at 375 x 667 (placement on all three guns, swing on a shot).
- Unresolved: none.
