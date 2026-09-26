# Autopilot progress (v0.7 builds)

Brief: `docs/NEXT-SESSION-V07.md`. A restarted session reads the brief, then this file, then the CLAUDE.md
Handoff, and continues from the first unfinished step below.

## Plan and status

| Order | Version | What | Status |
|---|---|---|---|
| 0 | v0.6.11 | Four wardrobe-worlds backgrounds (Aaron approved in the session prompt) | done, pushed |
| 1 | v0.7.0 | Saved gunslingers (profiles), export/import, storage persist | done, pushed |
| 2 | v0.7.1 | Tabbed start screen (Main Street / Outfitter / Wanted Poster), paint colour | next |
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

- **New gunslingers start from default settings and the default alien and gun**, not a copy of the current
  one. Alternative: copy the active gunslinger's settings (same phone, so sensor settings may carry over);
  change `Profiles.create` in `src/settings/profiles.ts`.
- **Restore merges instead of replacing:** a gunslinger with the same id is overwritten by the backup copy,
  new ones are added while there is room (8 max), nothing on the phone is deleted. Alternative: replace all.
- **Backup is a text code** (`HIGHMOON1:` + base64 JSON) copied to the clipboard and shown in a box, not a
  file download (simpler on iPhone). Names are capped at 20 characters.
- **Storage key names:** `high-moon-profiles` (with a `version` field inside) and `high-moon-active-profile`.
  The old `duel-settings-v1` / `high-moon-loadout-v1` keys are kept and mirror the active gunslinger, so
  going back to v0.6.x still works.
- **The Home Screen tip shows only on iPhone/iPad Safari outside Home Screen mode**, once ("Got it").

## Versions

### v0.7.0 (2026-09-26): saved gunslingers
Up to 8 gunslingers per phone (name, alien, gun, settings; paint colour is stored for v0.7.1). Switcher with
New / Rename / Delete at the top of the start screen (delete confirms; the last one can't be deleted). First
run turns the v0.6 picks and settings into "Player 1". Settings shows whose settings they are and has
"Back up gunslingers" (copy a code / restore from a code). The game asks the browser to keep its data
(`navigator.storage.persist()`) and shows a one-time Home Screen tip on iPhone Safari. Round logs record
`profile: { id, name }`; `node tools/logs.mjs` has a player column.
Checks: build, type-check, browser at 375 x 667: migration from v0.6 data (settings, alien, gun carried
into Player 1; old keys kept), create / switch / rename / delete, export then import, bad code message,
round log carries the profile, no sideways scrolling.

Phone test:
- [ ] Start screen shows v0.7.0 and "Player 1" with your usual alien, gun and settings (nothing reset).
- [ ] The "Keep your gunslingers" tip shows once in Safari; "Got it" hides it for good.
- [ ] New: make a second gunslinger, pick a different alien/gun, change a setting; switch back and forth, each keeps its own.
- [ ] Rename works; Delete asks first; with one left, Delete is greyed out.
- [ ] Settings > Back up gunslingers > Copy backup code, paste it into Notes; delete a gunslinger; paste the code into Restore from code (tap Restore, paste, tap Restore again); it comes back.
- [ ] Play a round; `node tools/logs.mjs` shows the gunslinger's name.

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
