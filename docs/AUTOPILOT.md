# Autopilot progress (v0.7 builds)

Brief: `docs/NEXT-SESSION-V07.md`. A restarted session reads the brief, then this file, then the CLAUDE.md
Handoff, and continues from the first unfinished step below.

## Plan and status

| Order | Version | What | Status |
|---|---|---|---|
| 0 | v0.6.11 | Four wardrobe-worlds backgrounds (Aaron approved in the session prompt) | done, pushed |
| 1 | v0.7.0 | Saved gunslingers (profiles), export/import, storage persist | done, pushed |
| 2 | v0.7.1 | Tabbed start screen (Main Street / Outfitter / Wanted Poster), paint colour | done, pushed |
| 3 | v0.7.2 | Stats per profile, backfill from round logs, wanted poster | done, pushed |
| 4 | v0.7.3 | Optional 1: "Update available" notice | done, pushed |
| 5 | v0.7.4 | Optional 2: records on the results screen | done, pushed |
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

- **Tab names as in the brief:** Main Street, Outfitter, Wanted Poster (rename in `TABS`, `src/render/startView.ts`).
- **"How to play" is a button top-left** (opposite Settings) that opens a sheet with the rules and Sensor check;
  a button under Draw! fell below the tab bar on a 375 x 667 phone. **"Start Duel" is now "Draw!"**.
- **Rename and Delete moved to the Outfitter** (name field saves when you leave it; Delete sits at the bottom).
  Main Street keeps the switcher and **+ New**.
- **Paint colours:** yellow (default), orange, red, pink, magenta. CSS can only shift the yellow art's hue while
  keeping its brightness, so a true purple or dark red isn't possible without new art; these were measured in the
  browser to stay apart from each other and far from the bot's teal. **With any colour but yellow, the raygun's
  bolts are your colour instead of green** (mixing the two gave muddy olive and brown). Yellow + raygun stays
  green as before. Change in `PAINT_ART` (`src/render/art.ts`) and `shotTint` (`src/render/gameView.ts`).
- **Stats definitions:** win rate = wins / rounds (fouls count as rounds not won). "Hits on the face" = face
  hits / hits (how many of your hits were face hits); accuracy = hits / shots. Time to win is measured from the
  DRAW sound (not from the start of the round, which includes the holster wait). A round closed mid-duel counts
  as "left early" and doesn't break or extend the win streak; the rest of its numbers are ignored.
- **Backfill ownership:** logs from v0.7.0 and v0.7.1 go to the gunslinger they name (skipped if deleted since);
  older logs go to "Player 1" (the profile made from the v0.6 data). Only the logs still on the phone (last 30 to
  80 rounds) can be counted; the uploaded logs in the private repo are not read back.
- **Backup codes now include the record**, so restoring a gunslinger restores their stats too.
- **Update check runs only on the start screen** (on load, every 3 minutes, and when the game comes back to the
  foreground), never mid-duel; the bar sits just above the tab bar. It reloads with `?v=<version>` in the address
  so GitHub's 10-minute page cache can't serve the old page again.
- **Records need something to beat:** the first timed draw or win isn't announced as a record; a faster one later
  is. A fastest draw counts on a lost round too (it's still your quickest draw).

## Versions

### v0.7.4 (2026-09-26): personal records on the results screen
Under the result, a gold line for each record the round broke: "Fastest draw yet! 0.22 s", "Fastest win yet! 4.2 s",
"New best streak: 3 wins in a row".
Checks: build, type-check, browser at 375 x 667: first round shows nothing, faster rounds show the right lines,
a loss with a faster draw shows only the draw record, the results panel still fits with three lines.

Phone test:
- [ ] Start screen shows v0.7.4 (and, on v0.7.3, the "Update available" bar offered it).
- [ ] Beat your fastest draw or win, or set a new best streak: the results screen says so; an ordinary round shows no extra line.

### v0.7.3 (2026-09-26): "Update available" notice
The build now writes `version.json`. While the start screen is up, the game compares it with its own version and
shows "Update available (vX): tap to reload" above the tab bar when a newer build is live.
Checks: build (version.json = 0.7.3; the build refuses to run if APP_VERSION and package.json differ), type-check,
browser at 375 x 667 with a stubbed newer version (bar shows above the tabs, no sideways scroll).

Phone test (needs the next deploy after this one to see it for real):
- [ ] Start screen shows v0.7.3.
- [ ] After Claude pushes v0.7.4, open the game (or come back to it) on the start screen: within 3 minutes "Update available (v0.7.4)" shows; tapping it loads v0.7.4.
- [ ] It never shows during a duel.

### v0.7.2 (2026-09-26): stats and the Wanted Poster
Totals per gunslinger (profile store version 2; v1 profiles get empty stats, then the one-time backfill),
updated when each round ends. Wanted Poster: parchment poster with portrait, name, record (W / L / F), win rate,
streak (current and best), accuracy, hits on the face, average and fastest draw, average and fastest win; then
the last 10 rounds and tables by gun, opponent, map and bot difficulty. Maths in `src/stats/stats.ts`, checked by
`src/dev/statsCheck.ts` (all passed).
Checks: build, type-check, stats check, browser at 375 x 667 and 390 x 844: v0.7.1 profiles gained stats and the
backfill added the older logs once (reloading doesn't add them again), fresh v0.6 data backfills into Player 1,
a live win adds one round and a streak, poster and tables render without sideways scrolling.

Phone test:
- [ ] Start screen shows v0.7.2. Wanted Poster shows a record built from your recent rounds (roughly your last 30 on this phone), under the gunslinger who played them.
- [ ] Play a round: the record, streak, draw time and "Last 10" update straight away.
- [ ] A foul shows as F and resets the streak; closing the game mid-duel shows as "left early".
- [ ] The numbers look right against what you remember (draw times, fastest win); tell Claude if any look off.
- [ ] Switch gunslinger: the poster shows theirs.

### v0.7.1 (2026-09-26): tabbed start screen and paint colour
Bottom tab bar: **Main Street** (logo, gunslinger card with portrait, name, alien and gun; switcher and + New;
Enable Motion; big **Draw!**), **Outfitter** (name, alien, gun, paint colour, delete), **Wanted Poster**
("Play a round to start your record" until v0.7.2). The last tab is remembered. How to play (with Sensor
check) opens as a sheet from the top-left button. Your paint colour tints your flying paint, impacts and the
splats on the opponent (an SVG filter with the same shift).
Checks: build, type-check, browser at 375 x 667 and 390 x 844 (no sideways scroll; Main Street fits without
scrolling at 375 x 667), paint saved per gunslinger, splat filter applied in a duel, Menu from results returns
to the tabs, sheet opens and closes.

Phone test:
- [ ] Start screen shows v0.7.1 with three tabs at the bottom; your gunslinger's card shows the right alien and gun.
- [ ] Everything on Main Street fits without scrolling; Draw! starts a duel as Start Duel did.
- [ ] Outfitter: change name (tap Done), alien, gun and paint; go back to Main Street, the card matches; switch gunslinger and back, each keeps its own.
- [ ] In a duel your paint (and the splats on the opponent) is your colour and never looks like the bot's teal; with yellow + raygun, bolts are still green.
- [ ] Close and reopen the game: it opens on the tab you last used.
- [ ] How to play (top-left) opens the rules; Sensor check still works from there.

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
