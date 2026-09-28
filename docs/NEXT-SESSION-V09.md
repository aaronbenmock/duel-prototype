# Next session brief: v0.8.5 to v0.9.x (phone-test fixes, signature outfits, hats and clothing)

Written 2026-09-28 after v0.8.4. A new session starts by reading this brief, then `docs/V08-WARDROBE.md`
(wardrobe plan, decisions, art review), then the CLAUDE.md Handoff, and continues from the first unfinished step.
Record progress in the "Progress" table at the bottom of this file after every version.

## Where things stand
- Live: v0.8.4. Ten maps; saved gunslingers (profiles) with stats and a Wanted Poster; tabbed start screen;
  Wardrobe with 12 skins, 2 gun charms, 2 belt buckles, all earned from stats (one free per slot).
- Not yet phone-tested by Aaron: v0.6.7 to v0.8.4. Checklists: `docs/AUTOPILOT.md` (v0.6.11 to v0.7.4) and
  `docs/V08-WARDROBE.md` (v0.8.0 to v0.8.4).
- Art rule (since 2026-09-26): Aaron does not mark art ready. Claude reviews drafts in `art/drafts/`, tests them in
  the game and promotes what passes into `art/ready-for-production/<pkg>/` with its own HANDOFF.md (STATUS: READY
  plus test results), then integrates. See `art/ready-for-production/CLAUDE-HANDOFF.md` (top section). A package
  Aaron hands off himself (like `high-moon-arena-trio`) is validated and integrated the normal way.

## Ground rules
- One version per build, each its own commit with a plain-English message, pushed to `main` only after
  `npm run build`, `npx tsc --noEmit -p .`, the check scripts (`src/dev/statsCheck.ts`, `src/dev/wardrobeCheck.ts`)
  and a browser check at 390 x 844 and 375 x 667 (`duel-dev`; the pane crops and lags screenshots, so confirm
  positions with DOM queries; give the test player huge health in the page to keep a duel running).
  Bump `APP_VERSION` and package.json together (the build refuses to run if they differ).
- Never lose player data: migrate the profile store forward (`src/settings/profiles.ts`, currently version 3).
- Looks never change hit areas. Anything that changes a sprite's outline needs its own zone map from
  `art/tools/build_hitzones.py` (same hittable area for everyone) and a fairness run of `aliens()` in
  `src/dev/sim.ts`.
- No balance changes (guns, bot, damage, health) unless Aaron asks.
- If a step needs a decision, pick the sensible default and write it under "Decisions for Aaron" in
  `docs/V08-WARDROBE.md`. If a step is blocked on art, write exactly what art is needed and move on.
- Files use CRLF in the working copy (git autocrlf): normalise line endings before scripted string replacements.

## Steps

### 1. v0.8.5 Phone-test fixes
Ask Aaron for his phone-test results if he hasn't given them in the session prompt. Also read the test logs:
`node tools/logs.mjs --days 7` and `--flagged` (logs now carry the gunslinger, skins, buckle and map). Fix what he
reports and anything the logs show (errors, stuck states), as one version. If there's nothing to fix, skip.

### 2. v0.9.0 Signature outfits (whole-character costumes)
Draft: `art/drafts/high-moon-signature-outfits/v01/` (Moontrail Ranger for Sage, Comet Railhand for Blue, Crystal
Prospector for Gold, Starseed Scout for Violet). They are complete characters, not layers, so they avoid the
painted-in-clothes problem, but they are drawn in the **old neutral (holstered) pose**, while the game shows the
**aiming-revolver pose**. Their outlines also differ from the base sprites (Blue has a sleeve gap).
- If aiming-pose versions exist in `art/drafts/` (check `art/drafts/HIGH_MOON_ASSET_INDEX.md` and newer folders),
  review and promote them: an "Outfit" Wardrobe slot that swaps the whole opponent/portrait sprite; its own hit-zone
  map per outfit (extend `build_hitzones.py`'s CREATURES list, same hittable area); fairness sim; first-person
  hands that match the sleeves (or keep the base hands if the sleeves aren't visible); the bot may wear them.
  Earned like other items.
- If only the neutral pose exists: don't integrate. Write the art ask (below) into `docs/V08-WARDROBE.md` and move on.

### 3. v0.9.x Hats, neckwear, vests, jackets (layers)
Blocked until each alien has an aiming-pose sprite **without hat, bandanna and vest** (same canvas, pose, scale and
position as `art/exports/creatures/creature_desert-<alien>_revolver_front.png`). The 2026-09-26 fit test rejected
all 24 hat fits (old hat 82-96% hidden, up to 35% of the face covered). If clean base bodies appear: regenerate
hit zones from the base body, fit each wardrobe-worlds item per alien (like `art/tools/fit_buckles.py`: 100% of the
painted item hidden, no face covered), promote and integrate one slot per version.

### 4. v0.9.x Tilt-to-move dead zone setting (small, no art)
From the backlog: Aaron's aim log showed 15 to 20 degrees of natural cant while steering, past the 12 degree dead
zone (`leanDeadZone` in `src/input/gestures.ts`), so he sidestepped without meaning to. Add a "Sidestep tilt threshold" setting (default unchanged at 12
degrees) in Settings, saved per gunslinger. Not a balance change: it only changes how much tilt counts as a step.

## Art asks for Aaron (paste into his art workflow)
1. Signature outfits in the **aiming-revolver pose**: each alien's outfit redrawn on the same 1024 x 1024 canvas,
   pose, scale and feet position as `art/exports/creatures/creature_desert-<alien>_revolver_front.png`, revolver
   raised the same way. Fix Blue's sleeve gap.
2. **Clean base bodies**: the same four aiming sprites without hat, neckwear and vest (skin, hair/braids, boots,
   belt and gun stay), so hats and clothing can be layered on.
3. Optional: first-person hand pictures with each outfit's sleeve, if the sleeve would show in first person.

## Not now
Head-to-head (needs Aaron's OK to add a backend), bot guns other than the revolver, balance changes, new mechanics.

## Prompt for a new chat (Aaron pastes this)
```
Continue High Moon. Read docs/NEXT-SESSION-V09.md first and follow it, then docs/V08-WARDROBE.md and the
Handoff section of CLAUDE.md. Continue from the first unfinished step in the brief's Progress table. You review
drafted art yourself, test it in the game and promote what works to ready-for-production (I won't mark art
ready). Ship each version separately (build, type-check, check scripts, phone-size browser check, commit, push)
and update the Progress table after each one. Make sensible choices where needed and record them under
"Decisions for Aaron". If something is blocked on art, write exactly what art is needed and go on to the next
step. My phone-test notes: <paste notes here, or "none yet">.
```

## Progress
| Step | Version | Status | Notes |
|---|---|---|---|
| 1 | v0.8.5 | not started | phone-test fixes |
| 2 | v0.9.0 | not started | signature outfits (needs aiming-pose art) |
| 3 | v0.9.x | blocked | hats and clothing (needs clean base bodies) |
| 4 | v0.9.x | not started | tilt dead zone setting |
