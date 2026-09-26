# high-moon-charms

STATUS: READY

Promoted by Claude Code on 2026-09-26 after review and testing (Aaron's instruction: Claude reviews drafted art,
tests it and moves what works into production; see `../CLAUDE-HANDOFF.md`, top section).

## Files
| File | Size | Source |
|---|---|---|
| `acc_charm-saguaro.png` / `.webp` | 512 x 512, transparent | `art/drafts/high-moon-wardrobe-worlds/v01/accessories/charm_saguaro.png` (unchanged pixels; WebP q90, alpha q100) |
| `acc_charm-moonbeetle.png` / `.webp` | 512 x 512, transparent | `.../accessories/charm_moonbeetle.png` (same) |

Draft PNG hashes match `accessory-manifest.json`. Renamed to the art naming rules (`acc_` type prefix).

## Attachment
- The leather loop's top centre is at (50%, 7%) of the canvas; the charm hangs from there.
- In first person it hangs from the gun frame just in front of the trigger hand, at these points of the
  1024 x 1024 first-person picture: star revolver (0.53, 0.52), scattergun (0.53, 0.66), raygun (0.50, 0.57);
  drawn at 22.5% of the picture's width (`GUN_ART[...].charm` and `CHARM_SIZE` in `src/render/art.ts`).
- The game keeps it hanging straight down and swings it like a pendulum when the gun turns, moves or kicks.

## Review and tests (passed)
- Decode, size, transparency and hashes checked. The fit sheet (`review/CHARM-FIT-FIRST-PERSON.jpg`) shows both
  charms on all three guns: attached to the frame, not covering the sights or muzzle, fully on screen.
- In the game (browser, 375 x 667): the charm draws at the anchor, moves with the gun (recoil, sidestep tilt,
  raise), stays within the screen, and swings after a shot.
- Looks only: the charm is on your own gun in first person; it changes nothing about hit areas or aiming.

## Not used (reviewed)
- The draft's `worn/charm_*_<alien>` layers place charms on the old holstered sprites' belts; the opponent's gun
  is too small on screen for a charm to read, so charms show in first person only for now.
