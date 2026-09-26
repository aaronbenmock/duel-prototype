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

1. On the start screen, pick your alien (Sage, Blue, Gold or Violet) and gun (the phone remembers your pick). Aliens are looks only: every alien is equally easy to hit. Your opponent is one of the other aliens, picked at random each round, and each round is played on one of three maps at random (desert town at night, moonlit canyon, desert outpost at sunset). Maps are looks only too.
1. Tap **Start Duel**. Hang the phone at your hip, top pointing at the floor, and hold still until you hear the ready click.
2. Wait for the loud **DRAW** sound. Moving before it is a foul.
3. Raise the phone upright, screen facing you. The crosshair appears.
4. Turn the phone to aim. Tap anywhere to fire paint. Only the visible alien counts: face = 20 (five face hits win), body = 9, arms, ears and legs = 5, tail = 2. The hat, Violet's braids and the opponent's raised gun are misses. Both you and the bot have 100 health.
5. Tip the phone sideways (like canting a revolver) to sidestep left or right, up to about 1.5 m each way. This doesn't move your aim. While you're moving, the bot misses more often.
6. To reload (any time), dip the phone to point at the floor and raise it again; a quick down-up flick also works. Rounds go in one at a time with a click each (0.3 s, then 0.12 s per round: about 1 s for a full cylinder) and you can't fire until it's done. The opponent shows a blinking RELOADING tag while it reloads. While the phone is lowered, aiming pauses; when you raise it again the crosshair re-centers where you point. An on-screen Reload button can be turned on in Settings.
7. On the results screen, the buttons wake up after one second so a late tap can't skip the results. **Again** starts the next round.

## Guns

Each gun has its own learning curve (simulated against the Normal bot, time to win for a beginner / intermediate / expert): scattergun 13.9 / 10.2 / 7.7 s (forgiving), revolver 18.0 / 9.2 / 4.7 s (precision), raygun 18.9 / 9.1 / 4.3 s (rhythm and leading targets).

| Gun | How it works |
|---|---|
| Star revolver | The precision gun (highest ceiling). 6 shots. Face 20, body 9, arms/ears/legs 5, tail 2. Reload: about 1 s for a full cylinder. Shots go exactly where the crosshair is, but each shot kicks it up about 3 degrees and to the right (a fixed pattern that climbs if you keep firing fast). The crosshair turns amber and grows while kicked, a white dot shows where it will settle, and it glides back in about 0.65 s with a soft click and a white pop when ready. Beginners can wait for the click; with practice, pull the phone down against the kick and fire sooner. At most one shot every 0.25 s. |
| Scattergun | 2 blasts, each 7 paint blobs. Each blob: face 4, body 2, arms/ears/legs 2, tail 1. The dashed ring around the crosshair shows the pattern: it starts wide (about 2.6 degrees) and, if you hold the crosshair steady for about half a second, shrinks to 1.6 degrees and turns solid green. Each blast kicks hard (about a head's height), so a quick second blast goes high unless you pull down against it. Reload one shell at a time (about 0.8 s for both); once a shell is in you can fire and cut the reload short. The forgiving gun: easiest for beginners, and experts get a tight pattern on the face. |
| Raygun | The rhythm gun (hardest to start, strongest in expert hands). No ammo. Face 20, body 10, arms/ears/legs 6, tail 2. Bolts take 0.2 s to fly, so aim ahead of a moving bot. Each zap adds heat (about 6 quick zaps overheat it; one zap per 0.3 s at most). Dip the phone to vent: 0.7 s if you vent before it overheats, 2 s once it has. While venting, a white marker sweeps across the heat gauge: tap while it is in the green window for a perfect vent (instantly cool, and the next 3 zaps do 25% more damage, gauge glows blue); tap outside it and the vent jams (slower). |

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
| Reload flick sensitivity | For the quick down-up flick: higher = a gentler flick reloads. Dipping the phone to point at the floor always reloads. | 5 |
| Show Reload button | Adds an on-screen Reload button as a backup. | Off |
| Bot difficulty (top of Settings) | The bot strafes, dashes, jukes (turns back mid-walk) and plants to shoot: it's accurate when standing still, misses more while walking and even more mid-dash. On Normal and Hard, holding your crosshair on a standing bot may make it dash away. Easy: slow, rarely dashes, moves up to 1.5 m either way; paints out an idle player in about 30 s. Normal: about 16 s; 2 m either way, frequent dashes. Hard: about 12 s; 3 m, fast and dashes often. A typical player (simulated) needs about 14 s to win on Easy, 15 s on Normal and 19 s on Hard. Face hits are rare at every level. | Normal |
| Tilt to move (sidestep) | Tip the phone sideways past a small dead zone (12 degrees) to step left or right; full speed at 35 degrees. Moving cuts the bot's hit chance by 40%. | On |
| Sound | Turns all game sounds on or off. | On |
| Show hit areas (testing) | Tints the opponent to show what each spot is worth: red face, yellow body, blue arms, ears and legs, green tail. | Off |
| Show detection readout during duels | A small line at the top of the duel screen showing the game state and whether holster, draw and reload are detected. | On |

The **Live detection** box at the top of Settings shows what the phone is detecting right now, so you can test holster, draw and flick while adjusting.

- **Reset to defaults** puts every setting back to the values above.
- **Copy settings** copies your current values as text. Paste them to Claude to make them the new defaults.

## Test logs

Every round is recorded on the phone automatically (the last 30 rounds): settings, what happened when, raw aiming data and any errors.

- **Upload key (one-time setup):** in Settings > Test logs, paste the GitHub key and tap **Save key**. From then on every round uploads by itself to the private repo `high-moon-logs`, where Claude reads it. If you're offline, it uploads later.
- **Phone label:** a short name for the phone (for example `aaron-iphone`) so Claude knows whose rounds are whose.
- **Something felt off** (results screen): flags that round, with an optional note, so Claude looks at it first.
- **Share log** (results screen) or **Share all logs** (Settings): sends the log as a file through the phone's share sheet, as a backup to uploading.

## Deploy a change

The site rebuilds and republishes by itself every time code is pushed to the `main` branch on GitHub. It takes about 1 to 2 minutes.

- To check progress, open https://github.com/aaronbenmock/duel-prototype/actions. A green check means the new version is live.
- The version number is on the start screen (for example "Beta · v0.5.3"). GitHub lets phones keep the old page for up to 10 minutes; if the number is old, wait a few minutes, then pull down on the page to refresh.

## For Claude (technical notes)

- Vite + TypeScript, no framework. `npm install`, then `npm run dev` (local) or `npm run build` (output in `dist/`).
- Deploy: `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.
- Art: the game imports only from `art/exports/` (see `art/README.md` and `art/exports/PROTOTYPE-FROM-DRAFTS.md`). Creature hit zones are generated by `art/tools/build_hitzones.py` into `src/game/creatures/` (it also sizes every alien to the same hittable area). Maps: ids in `src/game/maps.ts` (picked from the round seed, logged as `map`), images and street lines in `MAP_ART` in `src/render/art.ts`; add a map by exporting `bg_<id>.webp`, measuring where the opponent's feet belong (`streetFrac`) and adding one line to each.
- Test logs: `src/telemetry` records each round (`roundLog.ts`), keeps it in IndexedDB (`store.ts`) and PUTs it to `aaronbenmock/high-moon-logs` through the GitHub contents API (`upload.ts`). The key is stored only in the phone's localStorage and is never part of settings text or logs. On the PC, `node tools/logs.mjs` pulls and summarizes (`--flagged`, `--days N`, `--show <file>`).
- Layout: `src/game` (rules, no DOM or sensors), `src/input` (permission, quaternion orientation, gestures), `src/audio` (Web Audio synth), `src/render` (screens), `src/platform` (wake lock, vibration, rotate overlay), `src/settings` (saved settings and how they map to aim, gesture and bot configs).
