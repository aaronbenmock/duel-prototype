# Duel Prototype: Beta Build Spec

## Who you're working with

I'm not a developer. You own the technical decisions. Explain each one in plain English, one or two sentences. Any time I need to click, type, or change a setting myself (GitHub, iPhone), give me numbered steps.

## Goal

A playable beta that my wife and I can each open on our own phones from a link and play solo against a simple bot. It should test one question: **is holstering, drawing, and aiming a phone like a revolver fun and reliable?**

The game is inspired by the physical duel mechanic of old iPhone games like High Noon, but it's original. Don't copy any names, art, UI, characters, or sounds. Use a placeholder title.

Head-to-head multiplayer is the likely next phase. Don't build it, but keep game state separate from input and rendering so it can be added later.

## Before you start

1. Read `CLAUDE.md` in this folder and in any parent folders, and follow them.
2. This folder was copied from a template. Build the project **here**, not in a new subfolder (for Vite, scaffold into `.`). Don't delete or overwrite template files.
3. Check that Node.js (LTS), git, and GitHub CLI (`gh`) are installed. If not, stop and give me Windows install steps.
4. Initialize git if needed.
5. Give me a short plan (milestones, file structure, key technical choices), then **stop and wait for my approval**.

## Tech

- TypeScript, HTML/CSS, Vite. No framework, no game engine, no backend. Keep dependencies to a minimum.
- Static site on GitHub Pages, deployed by a GitHub Actions workflow on every push to `main`. Use a relative Vite base (`'./'`) unless you have a reason not to.
- Primary target: Safari on a current iPhone, portrait. It should also work in Chrome on Android.

## Milestones

Work one milestone at a time. After each one, do three things:

1. Build and fix all errors.
2. Push, so it deploys.
3. Give me a short checklist of what to test on my phone and what "working" looks like.

Then stop and wait for my report before starting the next milestone.

### Milestone 1: Pipeline and sensor check

- Get the GitHub repo and Pages deployment working. Walk me through the manual steps: account, repo creation via `gh`, and setting Pages source to "GitHub Actions".
- The page has an "Enable Motion" button that requests motion and orientation permission from the tap (required on iOS). It then shows live orientation values, acceleration, and the sensor update rate. It should also play a test beep to confirm audio works.
- If permission is denied, show how to re-enable it.
- Give me the exact URL to open on my phone.

### Milestone 2: Core duel vs bot

1. **Start screen:** placeholder title, Enable Motion button, Start Duel button.
2. **Holster:** show "HOLSTER YOUR WEAPON", detect the phone lowered to the hip, then play a "ready" sound and show "READY".
3. **Draw:** after a random delay of 2 to 5 seconds, play a loud, distinct DRAW sound and start a timer. The sound is essential because the screen isn't visible while holstered.
4. **False start:** if the phone leaves the holster before the DRAW sound, the round is a foul.
5. **Detect draw:** detect the phone raised to the aiming pose and record the draw time.
6. **Aim:** device rotation moves a crosshair over a simple western scene with an opponent. CSS or SVG placeholders only, no polish.
7. **Fire:** tap anywhere to shoot. Use the aim position from about 80 ms before the tap, so the thumb tap doesn't throw off the shot.
8. **Scoring:** six-shot revolver. Head does 100 damage, torso does 40. Both player and bot have 100 HP.
9. **Bot fires back:** starting a random 1 to 2.5 seconds after DRAW, the bot fires every so often with a moderate hit chance. Pick reasonable defaults and tell me what they are.
10. **Reload:** after six shots, show "RELOAD" and play an empty click on further taps. Reload with a quick down-then-up flick of the phone. Include an on-screen reload button as a backup.
11. **Results:** Victory, Defeat, or Foul. Show draw time, shots, hits, accuracy, headshots, and an "Again" button.

Every key moment needs its own synthesized sound: ready, DRAW, shot, hit, headshot, miss, empty click, reload, and getting hit. Use Web Audio tones only, no audio files.

### Milestone 3: Tuning

Add a small settings button, with these controls saved on the device:

- aim sensitivity (horizontal and vertical)
- smoothing
- holster, draw, and reload sensitivity
- bot difficulty
- sound on/off

Also add:

- A live readout of the current game state and whether holster, draw, and reload are detected.
- A "Reset to defaults" button.
- A "Copy settings" button that copies the values as text. I'll paste them back to you.

## Technical requirements (don't skip these)

- **Aiming math:** don't drive aim from raw alpha/beta/gamma angles. They become unstable when the phone is held upright, which is exactly the aiming pose. Use a rotation matrix or quaternion, lock a reference orientation at the moment of the draw, and measure aim relative to it. Aim must feel steady, not jittery.
- **HTTPS:** iPhone motion sensors only work over HTTPS, so the real test loop is the GitHub Pages link. Local phone testing over Wi-Fi is optional; skip it unless it's easy.
- **Audio unlock:** start Web Audio on the Enable Motion tap. Try `navigator.audioSession` where supported so sound plays with the ringer on silent. Either way, tell me whether I need to turn silent mode off.
- **Screen rotation:** Safari can't lock orientation. If the phone goes landscape, show a "rotate back / lock rotation" overlay.
- **Screen awake:** keep the screen awake during a duel where supported (Screen Wake Lock).
- **Vibration:** use it where supported (Android). iPhone Safari doesn't support it; don't work around that for now.

## README

Write it in plain English. Cover:

- how to open the game on a phone
- the iPhone settings to use (lock portrait, silent mode)
- how to reset motion permission if denied
- what each setting does
- how I deploy a change

## When done

- Update status files as `CLAUDE.md` requires.
- Give me a short summary: what works, what's shaky, and what you'd tune first based on how the build behaved.
