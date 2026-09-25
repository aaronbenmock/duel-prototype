// The bot's movement brain: strafe, dash, juke, plant to shoot, and dodge when
// you hold your aim on it. Pure rules (no DOM); every choice uses the round's
// seeded randomness. Tuning lives in BotConfig (see BOTS in settings.ts).
import { between } from './rng';
import type { DuelState } from './types';

const RAD = 180 / Math.PI;
/** Keep the bot this far (aim units) inside the screen edge at normal sensitivity. */
const EDGE = 15;
/** Moves shorter than this (m) aren't worth making. */
const MIN_STEP = 0.5;

/** Sideways limits (m) for this round: its move range, but never so far it leaves the screen. */
function limits(s: DuelState, distance: number): [number, number] {
  const range = s.config.bot.moveRange;
  const lo = Math.tan((-EDGE - s.target.x) / RAD) * distance;
  const hi = Math.tan((EDGE - s.target.x) / RAD) * distance;
  return [Math.max(-range, lo), Math.min(range, hi)];
}

/** Starts a walk or a dash. `forceDash` = reacting to the player's aim. */
function startMove(s: DuelState, now: number, distance: number, forceDash = false) {
  const b = s.config.bot;
  const bot = s.bot;
  const [lo, hi] = limits(s, distance);
  const dash = forceDash || between(s, 0, 1) < b.dashChance;
  let dest: number;
  if (dash) {
    // Dash: a short burst, usually away from the nearer edge.
    const len = between(s, b.dashDistMin, b.dashDistMax);
    const dir = bot.x + len > hi ? -1 : bot.x - len < lo ? 1 : between(s, 0, 1) < 0.5 ? -1 : 1;
    dest = bot.x + dir * len;
  } else {
    dest = between(s, lo, hi);
    if (Math.abs(dest - bot.x) < MIN_STEP) dest = bot.x + (dest >= bot.x ? MIN_STEP : -MIN_STEP);
  }
  bot.destX = Math.max(lo, Math.min(hi, dest));
  bot.mode = dash ? 'dash' : 'walk';
  bot.nextMoveAt = null;
  // Walks sometimes turn back part-way (a juke).
  bot.jukeAt = !dash && between(s, 0, 1) < b.jukeChance ? now + between(s, 250, 600) : null;
}

/** Stops and plants; a planted bot shoots soon, then moves on after a moment. */
function plant(s: DuelState, now: number) {
  const b = s.config.bot;
  const bot = s.bot;
  bot.mode = 'plant';
  bot.vx = 0;
  bot.nextMoveAt = now + between(s, b.plantMin, b.plantMax) * 1000;
  const shotAt = now + b.plantShotDelay * 1000;
  if (bot.rounds > 0 && bot.reloadUntil == null && (bot.nextFireAt == null || bot.nextFireAt > shotAt)) bot.nextFireAt = shotAt;
}

/**
 * One tick of movement while the duel is live. `onTarget` = the player's crosshair is on the bot.
 * `distance` is how far away it stands (m), for the screen-edge limit.
 */
export function moveBot(s: DuelState, now: number, dt: number, onTarget: boolean, distance: number) {
  const b = s.config.bot;
  const bot = s.bot;
  bot.vx = 0;
  if (b.moveRange <= 0) return;

  // Reaction: aim held on a planted bot for a while may make it dash away (one roll per hold).
  bot.onTargetMs = onTarget ? bot.onTargetMs + dt * 1000 : 0;
  if (bot.mode === 'plant' && b.reactChance > 0 && bot.onTargetMs >= b.reactMs) {
    bot.onTargetMs = -1e9; // no second roll until the aim leaves and comes back
    if (between(s, 0, 1) < b.reactChance) startMove(s, now, distance, true);
  }

  if (bot.mode === 'plant') {
    if (bot.nextMoveAt != null && now >= bot.nextMoveAt) startMove(s, now, distance);
    else return;
  }

  if (bot.jukeAt != null && now >= bot.jukeAt) {
    // Juke: reverse direction for a short walk.
    const [lo, hi] = limits(s, distance);
    const back = Math.sign(bot.destX - bot.x) || 1;
    bot.destX = Math.max(lo, Math.min(hi, bot.x - back * between(s, 0.5, 1.2)));
    bot.jukeAt = null;
  }

  const speed = bot.mode === 'dash' ? b.dashSpeed : b.walkSpeed;
  const stepM = speed * dt;
  const gap = bot.destX - bot.x;
  const oldX = bot.x;
  bot.x = Math.abs(gap) <= stepM ? bot.destX : bot.x + Math.sign(gap) * stepM;
  bot.vx = dt > 0 ? (bot.x - oldX) / dt : 0;
  if (bot.x === bot.destX) plant(s, now);
}
