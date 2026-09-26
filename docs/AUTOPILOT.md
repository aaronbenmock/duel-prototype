# Autopilot progress (v0.7 builds)

Brief: `docs/NEXT-SESSION-V07.md`. A restarted session reads the brief, then this file, then the CLAUDE.md
Handoff, and continues from the first unfinished step below.

## Plan and status

| Order | Version | What | Status |
|---|---|---|---|
| 0 | v0.6.11 | Four wardrobe-worlds backgrounds (Aaron approved in the session prompt) | done, pushed |
| 1 | v0.7.0 | Saved gunslingers (profiles), export/import, storage persist | next |
| 2 | v0.7.1 | Tabbed start screen (Main Street / Outfitter / Wanted Poster), paint colour | |
| 3 | v0.7.2 | Stats per profile, backfill from round logs, wanted poster | |
| 4 | v0.7.3 | Optional 1: "Update available" notice | |
| 5 | v0.7.4 | Optional 2: records on the results screen | |
| - | - | Any other art folder with `APPROVED.txt` (check between steps) | none found yet |

## Decisions for Aaron
- **Backgrounds shipped as v0.6.11, not v0.7.x**, so the brief's step numbers (profiles v0.7.0, start screen
  v0.7.1, stats v0.7.2) still match. Alternative: renumber; nothing depends on it.
- **All seven maps are in one rotation with equal odds.** Adding maps changes which map a given seed lands on
  (logs store the map by name, so old logs still read correctly). Alternative: weight the new maps or let the
  player pick; change `MAPS` / `mapForSeed` in `src/game/maps.ts`.

## Versions

### v0.6.11 (2026-09-26): four new maps
Salt-flat oasis, lunar mining town, bioluminescent canyon and comet rail station join the three existing maps
(one of 7 at random per round, looks only). Street lines from the art review (0.515 / 0.52 / 0.53 / 0.515).
Checks: build, type-check, browser at 390 x 844 and 375 x 667 (feet on the street, crosshair, yellow paint on
the cream salt flat, bottom HUD inside the screen).

Phone test:
- [ ] Start screen shows v0.6.11.
- [ ] Play until you have seen the new maps; the opponent's feet stand on the street in each (not floating, not sunk).
- [ ] Salt flat (the brightest): your yellow paint, the crosshair and the RELOADING tag are easy to see.
- [ ] Dark maps (lunar town, bioluminescent canyon, comet station): the opponent and teal paint stand out.
