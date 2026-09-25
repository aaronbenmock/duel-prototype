# High Moon

A motion-controlled quick-draw paint duel for your phone, set on an alien frontier. Holster the phone at your hip, wait for the DRAW sound, raise it, aim and tap to shoot. You play solo against a simple bot.

This is a beta for testing one question: is drawing and aiming a phone like a revolver fun and reliable?

**Game link:** https://aaronbenmock.github.io/duel-prototype/

## Open the game on a phone

1. On the phone, open the link above in **Safari** (iPhone) or **Chrome** (Android).
2. Tap **Enable Motion**, then tap **Allow** when the phone asks about motion and orientation.
3. Optional: tap the Share button, then **Add to Home Screen**, so the game opens with one tap.

## iPhone settings to use

- **Lock portrait:** swipe down from the top-right corner to open Control Center and turn on **Portrait Orientation Lock** (the lock with a circular arrow). If the phone goes sideways, the game covers the screen and asks you to rotate back.
- **Silent mode:** you can leave it on. The game asks Safari to play sound even when the ringer is on silent, and this was confirmed working on an iPhone during testing. If you ever hear no beep after tapping Enable Motion, turn silent mode off and raise the volume.
- **Vibration:** Android phones vibrate on DRAW, hits and shots. iPhone Safari has no real vibration for websites; the game tries an experimental light haptic tap instead, which may or may not be felt.
- **Volume:** turn it up. The DRAW sound is your only cue, because you can't see the screen while the phone is holstered.

## If motion access was denied

**iPhone:**

1. Close the game's Safari tab.
2. Open **Settings**, then **Apps**, then **Safari**, then **Advanced**, then **Website Data**.
3. Search **github.io**, swipe left on it, then tap **Delete**.
4. Open the game link again, tap **Enable Motion**, then tap **Allow**.

If that doesn't work, go to Settings, then Apps, then Safari, then **Clear History and Website Data**. This also signs you out of websites in Safari.

**Android (Chrome):** tap the icon left of the address bar, then **Permissions** (or **Site settings**), and turn **Motion sensors** on.

## How to play

1. Tap **Start Duel**. Hang the phone at your hip, top pointing at the floor, and hold still until you hear the ready click.
2. Wait for the loud **DRAW** sound. Moving before it is a foul.
3. Raise the phone upright, screen facing you. The crosshair appears.
4. Turn the phone to aim. Tap anywhere to fire paint. Only the visible alien counts: face = 50 (two face hits win), body = 20, arms, ears and legs = 10, tail = 5; the hat is a miss. Both you and the bot have 100 health.
5. Tip the phone sideways (like canting a revolver) to sidestep left or right, up to about 1.5 m each way. This doesn't move your aim. While you're moving, the bot misses more often.
6. After six shots, flick the phone down and up to reload, or tap **Reload**.
7. On the results screen, the buttons wake up after one second so a late tap can't skip the results. **Again** starts the next round.

## Settings

Open **Settings** from the top-right of the start screen, or the top-right of the results screen. Changes save on the phone automatically.

| Setting | What it does | Default |
|---|---|---|
| Aim sensitivity: left / right | How far the crosshair moves when you turn the phone sideways. 2.0x = half the turning needed. | 1.0x |
| Aim sensitivity: up / down | Same, for tilting up and down. | 1.0x |
| Smoothing | Steadies the crosshair. Higher = steadier but trails behind your hand. 0 = raw sensor. | 2 |
| Tap look-back | A shot uses where you were aiming this many milliseconds before your tap, to cancel the bump from your thumb. Higher protects more against the bump but shots taken while swinging land slightly behind the crosshair. | 30 ms |
| Holster sensitivity | Higher = the phone counts as holstered sooner and at a looser angle, and a foul is more likely. Lower = you must hold it straighter and longer. | 5 |
| Draw sensitivity | Higher = the draw counts earlier as you raise the phone (faster draw times). Lower = you must be closer to upright and level. | 5 |
| Reload flick sensitivity | Higher = a gentler down-and-up flick reloads. Lower = needs a sharper flick. | 5 |
| Bot difficulty (top of Settings) | Easy: hits half its shots, slower; paints out an idle player in about 21 s; barely shuffles. Normal: hits 3 in 4; about 11 s; wanders about 1 m either way. Hard: fires fastest; about 8.5 s; wanders up to 1.5 m. Face hits are rare at every level. | Normal |
| Tilt to move (sidestep) | Tip the phone sideways past a small dead zone (12 degrees) to step left or right; full speed at 35 degrees. Moving cuts the bot's hit chance by 40%. | On |
| Sound | Turns all game sounds on or off. | On |
| Show hit areas (testing) | Tints the opponent to show what each spot is worth: red face, yellow body, blue arms, ears and legs, green tail. | Off |
| Show detection readout during duels | A small line at the top of the duel screen showing the game state and whether holster, draw and reload are detected. | On |

The **Live detection** box at the top of Settings shows what the phone is detecting right now, so you can test holster, draw and flick while adjusting.

- **Reset to defaults** puts every setting back to the values above.
- **Copy settings** copies your current values as text. Paste them to Claude to make them the new defaults.
- **Copy aim log** (results screen) copies the raw aiming data from the last round, for diagnosing tracking problems.

## Deploy a change

The site rebuilds and republishes by itself every time code is pushed to the `main` branch on GitHub. It takes about 1 to 2 minutes.

- To check progress, open https://github.com/aaronbenmock/duel-prototype/actions. A green check means the new version is live.
- If the phone still shows the old version, close the tab and open the link again.

## For Claude (technical notes)

- Vite + TypeScript, no framework. `npm install`, then `npm run dev` (local) or `npm run build` (output in `dist/`).
- Deploy: `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.
- Art: the game imports only from `art/exports/` (see `art/README.md` and `art/exports/PROTOTYPE-FROM-DRAFTS.md`). Creature hit zones are generated by `art/tools/build_hitzones.py` into `src/game/creatures/`.
- Layout: `src/game` (rules, no DOM or sensors), `src/input` (permission, quaternion orientation, gestures), `src/audio` (Web Audio synth), `src/render` (screens), `src/platform` (wake lock, vibration, rotate overlay), `src/settings` (saved settings and how they map to aim, gesture and bot configs).
