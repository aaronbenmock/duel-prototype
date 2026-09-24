# Duel Prototype

A motion-controlled quick-draw duel for your phone. Holster the phone at your hip, wait for the DRAW sound, raise it, aim and tap to shoot. You play solo against a simple bot.

This is a beta for testing one question: is drawing and aiming a phone like a revolver fun and reliable?

**Game link:** https://aaronbenmock.github.io/duel-prototype/

## Open the game on a phone

1. On the phone, open the link above in **Safari** (iPhone) or **Chrome** (Android).
2. Tap **Enable Motion**, then tap **Allow** when the phone asks about motion and orientation.
3. Optional: tap the Share button, then **Add to Home Screen**, so the game opens with one tap.

## iPhone settings to use

- **Lock portrait:** swipe down from the top-right corner to open Control Center and turn on **Portrait Orientation Lock** (the lock with a circular arrow). If the phone goes sideways, the game covers the screen and asks you to rotate back.
- **Silent mode:** the game asks Safari to play sound even when the ringer switch is on silent. On newer iPhones this usually works. If you hear no beep after tapping Enable Motion, turn silent mode off and raise the volume.
- **Volume:** turn it up. The DRAW sound is your only cue, because you can't see the screen while the phone is holstered.

## If motion access was denied

**iPhone:**

1. Close the game's Safari tab.
2. Open **Settings**, then **Apps**, then **Safari**, then **Advanced**, then **Website Data**.
3. Search **github.io**, swipe left on it, then tap **Delete**.
4. Open the game link again, tap **Enable Motion**, then tap **Allow**.

If that doesn't work, go to Settings, then Apps, then Safari, then **Clear History and Website Data**. This also signs you out of websites in Safari.

**Android (Chrome):** tap the icon left of the address bar, then **Permissions** (or **Site settings**), and turn **Motion sensors** on.

## Settings

Coming in Milestone 3.

## Deploy a change

The site rebuilds and republishes by itself every time code is pushed to the `main` branch on GitHub. It takes about 1 to 2 minutes.

- To check progress, open https://github.com/aaronbenmock/duel-prototype/actions. A green check means the new version is live.
- If the phone still shows the old version, close the tab and open the link again.

## For Claude (technical notes)

- Vite + TypeScript, no framework. `npm install`, then `npm run dev` (local) or `npm run build` (output in `dist/`).
- Deploy: `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.
- Layout: `src/game` (rules, no DOM or sensors), `src/input` (permission, quaternion orientation, gestures), `src/audio` (Web Audio synth), `src/render` (screens), `src/platform` (wake lock, vibration, rotate overlay).
