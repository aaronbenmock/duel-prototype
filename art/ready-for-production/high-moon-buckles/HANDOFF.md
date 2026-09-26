# high-moon-buckles

STATUS: READY

Promoted by Claude Code on 2026-09-26 after review and testing (Aaron's instruction: Claude reviews drafted art,
tests it and moves what works into production; see `../CLAUDE-HANDOFF.md`, top section).

## Files
| File | Size | Source |
|---|---|---|
| `acc_buckle-meteor.png` / `.webp` | 512 x 512, transparent | `art/drafts/high-moon-wardrobe-worlds/v01/accessories/buckle_meteor.png` (pixels unchanged; WebP q90, alpha q100) |
| `acc_buckle-ringed-moon.png` / `.webp` | 512 x 512, transparent | `.../accessories/buckle_ringed-moon.png` (same) |
| `fit.json` | | placement on each alien's aiming sprite (1024 canvas px: x, y, square size) |
| `review/BUCKLE-FIT.jpg` | | top row: painted buckles; then each design fitted over them |

## Fit and tests (all passed)
- `art/tools/fit_buckles.py` finds each alien's painted buckle on the aiming sprite by colour (gold oval; Gold's
  grey plate), grows it by 5 px to include its outline, and scales each design (no distortion) until the old
  buckle is 100% hidden under opaque pixels. Coverage: 1.0 for all eight fits (Gold + ringed moon needed a 9%
  larger buckle than the first estimate).
- Visual check (review sheet): centred on the belt, no painted buckle showing, nothing important covered
  (Gold's bolo tips touch the ringed moon's top edge).
- In the game (browser, 375 x 667): the bot wears a buckle about half the rounds, placed and moving with the
  sprite; your buckle shows on the Outfitter's full-length preview.
- Looks only: the buckle sits on the belt (body zone) and hit zones come from the sprite, so nothing changes.

## Known limits
- On the phone the opponent's buckle is about 20 px wide: it reads as a shape and colour, not detail.
  The draft README's note that the ringed moon is ornate for small display stands; it's still recognisable.
- The draft's `worn/buckle_*` layers were fitted to the old holstered sprites and are not used.
