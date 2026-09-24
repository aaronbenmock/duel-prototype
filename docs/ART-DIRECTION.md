# Art direction notes (not started)

Status: parked on 2026-09-24. Next step is a concept sheet (Claude builds it in chat), when Aaron asks.

Art workspace set up 2026-09-24: `art/` (Inkscape SVG masters, blank creature reference sheet, exports). How to use it: `art/README.md`. Working title under discussion: "Fast Hand".

## Goal
Stand apart from realistic western shooters. Keep the duel's tension, drop realistic violence.

## Ideas discussed (for reacting to, not decided)
- Characters: non-human, imaginary creatures (cactus critters, one-eyed gumball monsters, frog outlaws).
  Each needs a clear, visible "weak spot" that replaces the head hit zone (antenna, hat, eyeball).
- Weapons: comedic blasters (goo blaster, pie cannon, water pistol, confetti popper) instead of real guns.
- Health becomes a "splat meter"; defeat is comic (topples over dizzy, pops like a balloon).
- Tension comes from DRAW timing, sound, recoil and the countdown, not realism.

## Suggested workflow
1. Claude writes an art brief (tone, creatures, weapon, palette, technical rules).
2. Claude builds a concept sheet page in chat: 4 to 6 rough SVG creature/weapon options.
3. Optional: Aaron explores the chosen direction with an image tool (e.g. ChatGPT) for a mood board;
   drop favorites in 00_Inbox.
4. Final art: Claude redraws as layered flat SVG in code (cheapest, animatable), or a freelance
   illustrator works from the brief (best quality, clearest ownership).

## Technical rules for any art
- Transparent backgrounds; vector (SVG) preferred, PNG at 2x otherwise.
- Separate layers for parts that move (body, weak spot, arms, weapon, eyes).
- Hit zones stay the same as today (`BODY` in `src/game/duel.ts`): a body box and a weak-spot circle
  above it. Art must line up with them, or the zones get resized to match.
- The hand-and-gun view (`.vm` in `src/render/gameView.ts`) is a swappable placeholder.
- The repo is public, so anything committed is public.
