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

## Art and content
- More aliens (blue, gold, violet) and guns (scattergun, raygun); character/gun picker.
- Opponent draw and fire pose, hit reactions, defeat pose (needs new art).

## Bigger steps
- Milestone 4: head-to-head (needs Aaron's OK to relax "no backend").
- Check the "High Moon" name before any public launch.
