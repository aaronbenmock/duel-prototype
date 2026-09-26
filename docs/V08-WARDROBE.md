# v0.8 wardrobe: plan, progress and decisions

Started 2026-09-26 after the v0.7 autopilot. Aaron asked for the wardrobe builds and said Claude should review
drafted art, test it and promote what works (he won't mark art ready): see
`art/ready-for-production/CLAUDE-HANDOFF.md` (top section). A restarted session reads this file, then the
CLAUDE.md Handoff, and continues from the first unfinished row.

## Plan and status

| Version | What | Status |
|---|---|---|
| v0.8.0 | Wardrobe foundation: outfit in each gunslinger (store v3), catalogue + unlock rules from stats, Wardrobe section in the Outfitter, skin-aware pictures, bot skin per round, logs record looks, check script | done |
| v0.8.1 | Skins: 12 recolours of the aiming sprites + 36 first-person hands, promoted from the wardrobe-worlds draft palettes | done |
| v0.8.2 | Gun charms in first person | done |
| v0.8.3 | Belt buckles on the opponent sprite and a full-length Outfitter preview (passed the fit tests) | done |
| later | Hats, neckwear, vests, jackets: blocked on clean base bodies (see Art review) | blocked, needs art |

## Decisions for Aaron
- **Items are earned from your record, with a free starter in each slot.** Rules are worked out from the stats
  every time (nothing extra is stored), so they can't get out of step; a results-screen line says
  "Unlocked: ..." when a round earns something. Change rules in `CATALOGUE` (`src/wardrobe/wardrobe.ts`).
- **Looks only:** hit zones always come from the alien's base sprite. Skins keep the sprite's outline exactly
  (checked pixel for pixel by the build tool), and add-ons are drawn on top without changing any zone.
- **The bot wears a random skin** from the round seed (original about a third of the time), like the map, so the
  bot's behaviour for a seed doesn't change. Logged as `opponent.skin`.
- **Skin unlocks:** for each alien, the first skin is free, the second after 5 wins, the third after 3 wins in a row
  (any alien counts). Only WebP copies are committed (PNG copies are rebuilt by the tool; 25 MB saved).
- **Charm unlocks:** saguaro free, moon beetle after 25 face hits. Charms show in first person only (the
  opponent's gun is too small on screen for one to read).
- **Buckle unlocks:** meteor free, ringed moon after wins on 5 different maps. The bot wears one about half the
  rounds. Your own buckle shows on a new full-length preview at the top of the Wardrobe (portraits are face crops).
- **Skins are per alien** in each gunslinger: switching alien keeps each one's chosen skin.

## Art review (2026-09-26): high-moon-wardrobe-worlds v01
- **Skins:** usable after rebuilding. The draft recoloured the old holstered sprites; the game shows the aiming
  poses. The same palettes and method (masked HSV shift, outline and non-skin pixels untouched) were applied to
  the aiming sprites and hand pictures by `art/tools/build_skins.py`. Masks checked visually per alien (Blue's hat
  band, Gold's chaps/boots/embroidery/tongue/gun cylinder and Violet's pink-grey gun excluded). Hands: the four
  aliens' hand pictures are pixel-aligned, so the hand is exactly the pixels that differ between them.
- **Charms and buckles: promoted.** Charms fitted to the three first-person guns (fit sheet in the package);
  buckles fitted over each alien's painted buckle with 100% coverage (`art/tools/fit_buckles.py`).
- **Hats, neckwear, vests, jackets: not usable yet.** Every sprite has its hat, bandanna and vest painted in; the
  fitting previews show the old items around the new ones, and the package itself says hats must replace, not
  stack. Needed from Aaron's art workflow: each alien's aiming sprite (and portrait) without hat, neckwear and
  vest, same canvas and pose, so worn layers can replace them.
- **Hat fit test (2026-09-26), all 24 rejected.** Each of the 6 hats was scaled (1.0 to 1.5x the old hat's width)
  and moved (±30 px) over each alien's painted hat, keeping the best fit. Best share of the old hat hidden:
  82-96% (the old brim shows at the edges); fits that hide the most also cover 6-35% of the face (Violet
  worst), which would hide hittable area from the player. Promotion needs 100% hidden and no face covered, so
  hats wait for the clean base bodies. Same reason for neckwear, vests and jackets (they sit over painted ones).

## What's needed to unblock hats and clothing (for Aaron's art workflow)
For each alien (sage, blue, gold, violet), the aiming-revolver sprite **without hat, bandanna/neckwear and vest**,
on the same 1024 x 1024 canvas with the same pose, scale and position as
`art/exports/creatures/creature_desert-<alien>_revolver_front.png` (put them anywhere under `art/drafts/`; Claude
reviews and tests them). Then the hats and clothing can be fitted per alien and the hit zones regenerated from the
base body.

## Versions

### v0.8.3 (2026-09-26): belt buckles and full-length preview
Two belt buckles (meteor, ringed moon) in the Wardrobe, each fitted to hide the painted buckle on every alien.
The Wardrobe now opens with a full-length preview of your gunslinger (skin and buckle). The bot wears a buckle
about half the rounds. Promoted package: `art/ready-for-production/high-moon-buckles/`.
Checks: build, type-check, wardrobe check (16 items, bot buckle spread), fit tool coverage (8 of 8 at 100%),
browser at 375 x 667 (preview with buckle, bot with buckle in a duel).

Phone test:
- [ ] Start screen shows v0.8.3. Outfitter > Wardrobe shows your gunslinger full length; wear the meteor buckle and it appears on the belt, with no old buckle peeking out.
- [ ] Some opponents wear a buckle; it moves with them.
- [ ] The ringed moon shows "Win on 5 different maps (x / 5)" until earned.

### v0.8.2 (2026-09-26): gun charms
Two gun charms (saguaro, moon beetle) in the Wardrobe. Yours hangs from the frame in front of your trigger hand
on all three guns, stays hanging straight down as the gun tilts, and swings when you turn, sidestep or fire.
Promoted package: `art/ready-for-production/high-moon-charms/`.
Checks: build, type-check, wardrobe check (14 items), browser at 375 x 667: placement on all three guns once the
gun is fully raised (clear of the bottom HUD), counter-rotation on the turned scattergun, swing after a shot.

Phone test:
- [ ] Start screen shows v0.8.2. Wear the saguaro charm (Outfitter > Wardrobe > Gun charm).
- [ ] In a duel it hangs by your trigger hand on each gun, doesn't hide the crosshair or the ammo, and swings on each shot and when you turn.
- [ ] The moon beetle shows "Land 25 face hits (x / 25)" until earned.

### v0.8.1 (2026-09-26): skins
Twelve skins (three per alien) in the Outfitter's Wardrobe, with matching first-person hands for all three guns;
the bot wears a random skin each round. Promoted package: `art/ready-for-production/high-moon-skins/`
(HANDOFF.md has the review and tests).
Checks: build, type-check, wardrobe check (12 items), skin build tool's pixel checks, browser at 375 x 667 and
390 x 844 (Outfitter lists skins with lock hints, portrait and alien picker follow the skin, a duel shows the bot's
skin and your skinned hand, four skin choices fit without sideways scrolling).

Phone test:
- [ ] Start screen shows v0.8.1. Outfitter > Wardrobe > Skin lists Original plus three; the first is free, the others say what earns them.
- [ ] Wear a skin: the Main Street card, the alien picker and the Wanted Poster show it; in a duel your hand is the same colour.
- [ ] Opponents turn up in different skins; they're easy to see on every map.
- [ ] Earn one (5 wins, or 3 in a row): the results screen says "Unlocked: ...".

### v0.8.0 (2026-09-26): wardrobe foundation
Each gunslinger now has an outfit (skin per alien, charm, buckle), saved with them (profile store version 3;
older profiles start in their original look, stats kept). The Outfitter has a Wardrobe section that lists
what can be worn and, for locked items, what earns them with progress ("Win 5 rounds (3 / 5)"). Pictures are
chosen by skin everywhere (opponent, first-person hand, portraits, poster). Round logs record your skin and
add-ons and the bot's skin. No items yet, so nothing looks different.
Checks: build, type-check, stats and wardrobe check scripts, browser at 375 x 667 (v2 profiles migrate to v3 with
stats kept; logs carry the looks).

Phone test:
- [ ] Start screen shows v0.8.0; your gunslingers, settings and Wanted Poster are unchanged.
- [ ] Outfitter shows a Wardrobe section ("Outfits arrive soon").
