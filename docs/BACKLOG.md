# Backlog: ideas for later

Not scheduled. Add a date and who asked for each idea.

## Gameplay feel
- **Wobble after reload** (Aaron, 2026-09-25): when the gun comes back up after a reload, add a short,
  deliberate crosshair wobble that settles within about a second. Aaron likes an element of chaos, but
  it should be predictable and fair, not the accidental bounce fixed in v0.5.2. Hook: `AimTracker`
  re-centers after a pause (`resumes` counter in `src/input/aim.ts`); add a decaying offset there.
- **Tilt-to-move dead zone** (Claude, 2026-09-25): Aaron's aim log showed 15 to 20 degrees of natural
  cant while steering, past the 12 degree dead zone, so he sidestepped without meaning to. Consider a
  larger dead zone or a setting.

- **Names and saved profiles (v0.7)** (Aaron, 2026-09-25): name, alien, gun and settings per player;
  Home Screen app so Safari keeps the data; back up profiles to the private logs repo.

- **"New version" notice** (Claude, 2026-09-25): GitHub Pages lets phones cache the page for up to
  10 minutes, so a fresh deploy can look unchanged (Aaron tested v0.5.1 thinking it was v0.5.2). A small
  check against a version file could show "Update available, tap to reload". **Done in v0.7.3.**

## Art and content
- Violet alien: art arrived 2026-09-26 (first-person hands, aiming opponent pose); integration planned as v0.6.10,
  see docs/NEXT-SESSION-ART.md. More aliens later. (Blue, gold, scattergun,
  raygun and the picker shipped in v0.6.2 to v0.6.4.)
- Bot using the scattergun or raygun (needs the bot model and opponent gun art).
- Opponent draw and fire pose, hit reactions, defeat pose (needs new art).

- Update `art/creatures/_template/creature_TEMPLATE_refsheet.svg`: its blue hit-zone guides come from the
  old rectangle/circle hit boxes. Hit areas are now generated from each sprite (art/tools/build_hitzones.py);
  the template should show the 1024 canvas, the foot line at y = 944 and the sage alien's size instead.

## Bigger steps
- Milestone 4: head-to-head (needs Aaron's OK to relax "no backend").
- Check the "High Moon" name before any public launch.
