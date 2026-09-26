# Autopilot brief: v0.7 profiles, new start screen, stats (plus art when it arrives)

Written 2026-09-26 at the end of the v0.6.10 session. Aaron is away and wants Claude to work through these builds
without him. **Progress lives in `docs/AUTOPILOT.md`** (create it on the first run). Every session, including a
resumed or restarted one, starts by reading this brief, then `docs/AUTOPILOT.md`, then CLAUDE.md (Handoff), and
continues from the first unfinished step.

## Ground rules while Aaron is away
- **Don't wait for answers.** If a choice is needed, pick the sensible default, write it under "Decisions for
  Aaron" in `docs/AUTOPILOT.md` (what you chose, the alternative, how to change it), and keep going.
- **No game-rule or balance changes** (guns, bot, hit zones, damage, health). These builds are menus, saved data
  and stats only. Aaron still has v0.6.7 to v0.6.10 to test on his phone.
- **One version per build**, each its own commit with a plain-English message, pushed to `main` only after
  `npm run build`, `npx tsc --noEmit -p .` and an in-app browser check at phone size (390 x 844 and 375 x 667;
  `duel-dev` or `duel-dev-alt`; the pane crops screenshots, so check the bottom of the screen with DOM queries).
  Bump `APP_VERSION` (src/settings/settings.ts) and package.json each time.
- **Never lose player data.** Existing localStorage keys (`duel-settings-v1`, `high-moon-loadout-v1`,
  `high-moon-device`, upload key) and the IndexedDB round logs (`high-moon-logs`) must survive every build.
  Migrate forward; never delete. Test the migration with data from the previous version.
- **Privacy:** the repo is public. No real player names in code, docs, tests or commits (use "Player 1" etc.).
  CLAUDE.md is git-ignored and may mention names. Claude never enters or handles the upload key.
- Never modify `art/drafts/`; follow `art/README.md` and `art/exports/PROTOTYPE-FROM-DRAFTS.md` for art.
- After each version: update `docs/AUTOPILOT.md` (done, what's next, test checklist for that version),
  the CLAUDE.md handoff, `Apps/_STATUS.md` and README. Keep commits small and reversible.
- When every step is done, write a final summary with a combined phone test checklist in `docs/AUTOPILOT.md`
  and stop. Don't invent extra features beyond "Optional" below.

## Step 1: v0.7.0 Saved gunslingers (profiles)
- A profile = id, name, alien, gun, settings (the current Settings object), paint colour (see step 2),
  created date, and stats totals (step 3). Stored in localStorage under a new versioned key with a `version`
  field and a migration function; the active profile id stored separately.
- First run: migrate the current loadout and settings into "Player 1" (name editable) so nothing changes for
  an existing player.
- Create, rename, switch, delete (delete asks to confirm, and never deletes the last profile). Up to 8 profiles.
- Round logs record `profile: { id, name }` (logs go to the private logs repo, so names are fine there);
  `tools/logs.mjs` shows the profile name.
- Keeping the data: call `navigator.storage.persist()`; show a one-time tip that iPhone Safari can clear site data
  after about a week unless the game is added to the Home Screen; add Export / Import (a copyable text code of all
  profiles, in Settings) so a player can back up and restore.
- Keep the existing start screen for this step (a simple profile switcher at the top is enough); step 2 redesigns it.

## Step 2: v0.7.1 New start screen with tabs
Bottom tab bar (thumb reach), three tabs. Western names (Aaron may rename; record in Decisions):
1. **Main Street** (landing): the active gunslinger as a card (portrait, name, alien, gun), switch-profile
   control, then **Enable Motion** and **Draw!** (start duel) as the big buttons. Version line and logo stay.
   How to play moves to a "How to play" button that opens a sheet. Settings gear stays top-right.
2. **Outfitter** (the locker room): name, alien picker (4), gun picker (3), paint colour (a few preset hues for
   your paint, done with the existing CSS hue-rotate; the bot's paint stays teal and must stay clearly different).
   Changes save to the active profile immediately.
3. **Wanted Poster** (stats): see step 3; until then show "Play a round to start your record".
- Remember the last tab. Everything must fit a 375 x 667 phone without sideways scrolling; test both sizes.
- Sensor check stays reachable (Settings or the help sheet).

## Step 3: v0.7.2 Stats (all time, per profile)
- Update totals in the profile when each round ends (don't rely on round logs alone; logs may be large or cleared).
- **Backfill** once from the round logs already in IndexedDB: attribute them to the profile that existed at
  migration ("Player 1"). Skip abandoned rounds for win/loss but count them as "rounds left".
- Show: rounds played, wins / losses / fouls, win %, current and best win streak; accuracy (hits / shots),
  face-hit %; average draw time and fastest draw (DRAW sound to gun up, from `drawnMs - drawSignalMs`; fouls
  excluded); average and fastest time to win; breakdowns by gun, by opponent alien, by map and by bot difficulty;
  last 10 results.
- Keep the maths in a pure module (e.g. `src/stats/stats.ts`) with a dev check script in the style of
  `src/dev/sim.ts` that feeds sample rounds and checks the totals (no new dependencies).
- Present it as a wanted poster (big name, "record", key numbers), then the breakdown tables below.

## Step 4 (only when ready): Aaron's new art
Aaron is making new backgrounds and other art (ready in an hour or two). **Integrate only a folder that contains
a file named `APPROVED.txt`** (Aaron creates it to approve public use; it may carry notes). Check for it between
steps: search `art/drafts/` and `art/ready-for-production/` for `APPROVED.txt` newer than this brief. Then:
- Backgrounds: add each to `MAPS` (src/game/maps.ts) and `MAP_ART` (src/render/art.ts). Measure the street line
  at the same depth below the horizon as the others (0.54 frontier, 0.53 canyon, 0.525 outpost; see
  PROTOTYPE-FROM-DRAFTS.md), and check crosshair, paint, HUD and RELOADING tag readability at phone size.
- Anything else: follow the art rules; if it needs a decision, integrate what's clear and list the rest.
- Record it in PROTOTYPE-FROM-DRAFTS.md as a new batch with Aaron's approval (the APPROVED.txt file).
- Its own version (v0.7.x in sequence). If no approved art has appeared by the time steps 1 to 3 and the
  optional items are done, note it in AUTOPILOT.md and stop.

## Optional (do after steps 1 to 3, in this order, if time allows)
1. **"New version" notice** (backlog): a small version file checked on load and every few minutes on the start
   screen; shows "Update available, tap to reload". Saves Aaron testing a cached old build.
2. Stats on the results screen: "Fastest draw yet!" / "New best streak" when a record falls.

## Not now
Head-to-head, bot guns other than the revolver, new gameplay mechanics, anything needing new art beyond step 4.
