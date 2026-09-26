# Next session: integrate the high-moon-expansion art batch (planned v0.6.10)

**DONE in v0.6.10 (2026-09-25).** Results and decisions: `art/exports/PROTOTYPE-FROM-DRAFTS.md` (third batch). Three maps, not four: the expansion folder's fourth background file is a copy of alien-frontier.

Written 2026-09-26 at the end of the v0.6.9 session. Aaron will start a new session with a prompt that
points here. Plan first, report findings, and wait for Aaron's go-ahead before building.

## What arrived (all drafts, git-ignored: `art/drafts/high-moon-expansion/v01/`)
Checked 2026-09-26 by listing the folder and reading README.md, manifest.json and CONTACT-SHEET.jpg.

| Files | What | Notes |
|---|---|---|
| `backgrounds/bg_moonlit-canyon.{png,webp}` | Night canyon, purple | 1290 x 2796 opaque, upscaled from 852 x 1846 |
| `backgrounds/bg_desert-outpost.{png,webp}` | Day outpost, bright orange | same size; check crosshair/paint/HUD contrast |
| `opponents/creature_desert-{sage,blue,gold,violet}_revolver_front.{png,webp}` | Full-body aiming poses, revolver raised to the side | 1024 canvas, feet near y 944, forehead near (512, 260) by visual estimate; ~500 KB lossless each; collision not verified |
| `first-person/weapon_{star-revolver,wrapped-scattergun,desert-raygun}_violet_pov.{png,webp}` | Violet's hands on each gun | 1024 canvas; anchors need calibration |
| `branding/ui_high-moon_logo.{png,webp}` | HIGH MOON logo | 2048 x 1024 transparent raster |
| `CONTACT-SHEET.jpg`, `OPPONENTS-REVIEW.jpg`, `PROMPTS.md`, `generation-spec.json`, `ACCESS_CHECK.json` | Review material | not for the game |

Also relevant: `art/drafts/HIGH_MOON_ASSET_INDEX.md` (index of every draft pack) and the older violet neutral
front in `art/drafts/frontier-paint-violet/v01/characters/` (different art batch; the new opponent pose
is the better match).

**Mismatch to raise:** Aaron expects four backgrounds. Only three exist: `bg_alien-frontier` (in the game
since v0.5) plus the two above. Ask Aaron where the fourth is if it hasn't appeared.

## Aaron's asks
- Use the new versions and new content carefully.
- The map picks one of the (now four) backgrounds at random each round.
- Add the new cowgirl (desert-violet: one eye, braids).

## Approach (proposed; confirm with Aaron)
1. **Approval and provenance:** Aaron approved using this draft batch in the public game (2026-09-26 request).
   Record it in `art/exports/PROTOTYPE-FROM-DRAFTS.md` like the v0.5 and v0.6.2 batches. Never edit drafts;
   copy to `art/exports/`. Opponent sprites: re-encode WebP lossy q90, alpha 100.
2. **Backgrounds:** a background list (url, size, street line) in `src/render/art.ts`; `GameView.resize()`
   currently assumes one background (`BG` constant with `streetFrac: 0.54`). Pick per round from the
   round's seeded randomness in `createDuel` (state field, logged in `RoundLog`), so logs show which map.
3. **Opponent poses:** swap `CREATURE_ART` sprites to the `_revolver_front` versions. Add rules for each
   creature (incl. violet) in `art/tools/build_hitzones.py`; hat and raised gun = miss (code 5 or 0),
   raised arm = limb. The script already scales every creature to sage's hittable area (`pxPerUnit`) and keeps
   feet on the same street line. Show Aaron the overlays. Update `handPx` (bot paint origin) to each
   sprite's muzzle. The `RELOADING` tag sits 75 px below the top of the canvas; check it clears the hats.
4. **Violet:** add to `ALIENS` (src/game/creatures/index.ts), `CREATURE_ART`, and `GUN_ART.*.pov`. Check
   her first-person muzzle and grip anchors against the image (the scattergun is turned about its grip so its
   barrel points at the screen center: `GameView.barrelTurn`).
5. **Picker:** four alien cards (portraits are crops of the full-body sprite; check violet's crop).
6. **Logo:** replace the `HIGH MOON` text title in `src/render/startView.ts`.
7. **No rule changes.** Re-run `aliens()` in `src/dev/sim.ts` (see CLAUDE.md "How to verify" for the Node
   bundling recipe); target all four within about 5% time to win.
8. **Verify:** `npm run build`; in-app browser at phone size with `window.__duel`. The pane crops screenshots
   (bottom HUD often missing from captures): confirm with DOM queries instead.
9. **Release:** own commit and version; update README (aliens, maps), `PROTOTYPE-FROM-DRAFTS.md`, CLAUDE.md
   handoff, `Apps/_STATUS.md`; plain-English summary with a test checklist.

After this: v0.7 (names and saved profiles; see docs/BACKLOG.md).
