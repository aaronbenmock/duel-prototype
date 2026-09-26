# high-moon-skins

STATUS: READY

Promoted by Claude Code on 2026-09-26 after review and testing, under Aaron's instruction that Claude reviews
drafted art, tests it and moves what works into production (see `../CLAUDE-HANDOFF.md`, top section).

## What it is
Three colour variants (skins) for each of the four aliens, for the pictures the game shows:
- `creatures/creature_desert-<alien>_<skin>_revolver_front.webp`: opponent / portrait sprite, 1024 x 1024,
  transparent, same canvas, pose and outline as `exports/creatures/creature_desert-<alien>_revolver_front`.
- `weapons/weapon_<gun>_<alien>-<skin>_pov.webp`: first-person hand and gun for all three guns, 1024 x 1024,
  same anchors as the originals (muzzle and grip unchanged).

| Alien | Skins |
|---|---|
| sage | dusty-coral, glacier-blue, moon-lilac |
| blue | mint, peach, orchid |
| gold | celadon, periwinkle, rose |
| violet | seafoam, ice-blue, apricot |

## Source and method
Palettes and method from `art/drafts/high-moon-wardrobe-worlds/v01` (`prepare_skins.py`, `SKIN_PALETTES.md`).
That draft recoloured the old holstered sprites, which the game no longer shows, so the same transforms were
applied to the game's aiming sprites and hand pictures by `art/tools/build_skins.py` (deterministic; re-run to
rebuild, including the PNG copies, which are not committed). Only skin pixels change: hue rotated to the
palette's target, saturation and value scaled; alpha and every other pixel are byte-identical to the source.
Masks are in `masks/`; how they were chosen is in `manifest.json` and the tool's docstring.

## Review and tests (all passed)
- Alpha identical to the source sprite and every pixel outside the mask unchanged: asserted for all 48 files,
  so the existing hit-zone maps fit every skin exactly (looks only).
- Masks checked visually (`review/SKIN-MASKS-REVIEW.jpg`): skin, ears, frills, tails and hands only; clothing,
  hats, boots, gun, eyes, mouth and tongue untouched. Blue's hat band, Gold's chaps, boots, vest embroidery,
  hat band, tongue and gun cylinder, and Violet's pink-grey gun are excluded.
- Results checked visually (`review/SKINS-REVOLVER-REVIEW.jpg`, `review/HANDS-REVIEW.jpg`): hands match their
  body colour; the gun art is identical across skins.
- In the game (browser, 375 x 667): every skin and hand loads; the Outfitter shows them; a duel draws the bot's
  skin and your hand in your skin; the hit-area overlay and paint mask still line up.

## Known limits
- Violet's revolver hand was already a duller purple than her other hands; its skins inherit that.
- The hands are a little darker than the body sprites in some skins (the source hand pictures are darker).
