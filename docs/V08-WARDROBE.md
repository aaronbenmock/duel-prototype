# v0.8 wardrobe: plan, progress and decisions

Started 2026-09-26 after the v0.7 autopilot. Aaron asked for the wardrobe builds and said Claude should review
drafted art, test it and promote what works (he won't mark art ready): see
`art/ready-for-production/CLAUDE-HANDOFF.md` (top section). A restarted session reads this file, then the
CLAUDE.md Handoff, and continues from the first unfinished row.

## Plan and status

| Version | What | Status |
|---|---|---|
| v0.8.0 | Wardrobe foundation: outfit in each gunslinger (store v3), catalogue + unlock rules from stats, Wardrobe section in the Outfitter, skin-aware pictures, bot skin per round, logs record looks, check script | done |
| v0.8.1 | Skins: 12 recolours of the aiming sprites + 36 first-person hands, promoted from the wardrobe-worlds draft palettes | next |
| v0.8.2 | Gun charms in first person | |
| v0.8.3 | Belt buckles on the opponent sprite and portraits (only if they pass the fit tests) | |
| later | Hats, neckwear, vests, jackets: blocked on clean base bodies (see Art review) | blocked |

## Decisions for Aaron
- **Items are earned from your record, with a free starter in each slot.** Rules are worked out from the stats
  every time (nothing extra is stored), so they can't get out of step; a results-screen line says
  "Unlocked: ..." when a round earns something. Change rules in `CATALOGUE` (`src/wardrobe/wardrobe.ts`).
- **Looks only:** hit zones always come from the alien's base sprite. Skins keep the sprite's outline exactly
  (checked pixel for pixel by the build tool), and add-ons are drawn on top without changing any zone.
- **The bot wears a random skin** from the round seed (original about a third of the time), like the map, so the
  bot's behaviour for a seed doesn't change. Logged as `opponent.skin`.
- **Skins are per alien** in each gunslinger: switching alien keeps each one's chosen skin.

## Art review (2026-09-26): high-moon-wardrobe-worlds v01
- **Skins:** usable after rebuilding. The draft recoloured the old holstered sprites; the game shows the aiming
  poses. The same palettes and method (masked HSV shift, outline and non-skin pixels untouched) were applied to
  the aiming sprites and hand pictures by `art/tools/build_skins.py`. Masks checked visually per alien (Blue's hat
  band, Gold's chaps/boots/embroidery/tongue/gun cylinder and Violet's pink-grey gun excluded). Hands: the four
  aliens' hand pictures are pixel-aligned, so the hand is exactly the pixels that differ between them.
- **Charms and buckles:** small, self-contained items; to be fitted to the game's pictures and tested.
- **Hats, neckwear, vests, jackets: not usable yet.** Every sprite has its hat, bandanna and vest painted in; the
  fitting previews show the old items around the new ones, and the package itself says hats must replace, not
  stack. Needed from Aaron's art workflow: each alien's aiming sprite (and portrait) without hat, neckwear and
  vest, same canvas and pose, so worn layers can replace them.

## Versions

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
