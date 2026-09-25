// Balance simulator (not part of the game build). Plays many rounds through the real
// rules with a model player, to compare guns and aliens by time to win.
// Run in the browser console of the dev server:
//   const sim = await import('/src/dev/sim.ts'); sim.table()
import { createDuel, DEFAULT_CONFIG, step, apparentTarget } from '../game/duel';
import type { Action, BotConfig, DuelState } from '../game/types';
import { WEAPONS } from '../game/weapons';
import { BOTS } from '../settings/settings';

export interface PlayerModel {
  /** Aim error, aim units (degrees), per axis (normal distribution around the body center). */
  sigma: number;
  /** Typical time between taps (ms), and how much it varies (+/-). */
  tapMs: number;
  tapJitterMs: number;
  /** From DRAW to the gun being up. */
  drawMs: number;
  /** From "out of ammo" (or "too hot") to the dip starting a reload. */
  reloadReactMs: number;
  /** After a reload, time to settle the aim again. */
  recenterMs: number;
  /** Tracking a moving bot: the player aims where it was this long ago (ms). */
  trackLagMs: number;
}

export const TYPICAL: PlayerModel = { sigma: 2.4, tapMs: 750, tapJitterMs: 250, drawMs: 450, reloadReactMs: 450, recenterMs: 300, trackLagMs: 250 };

function gauss(): number {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

export interface RoundResult {
  timeMs: number;
  shots: number;
  reloads: number;
}

/** One round against a bot (moving, but never firing back); returns the player's time to win (from DRAW). */
export function playRound(weapon: string, model: PlayerModel, opponent?: string, bot: BotConfig = DEFAULT_CONFIG.bot): RoundResult {
  const config = { ...DEFAULT_CONFIG, bot: { ...bot, hitChance: 0 } };
  let s: DuelState = createDuel(config, (Math.random() * 2 ** 32) >>> 0, 0, { creature: 'desert-sage', weapon });
  if (opponent) s.creature = opponent;
  const gun = WEAPONS[weapon];
  const act = (a: Action) => (s = step(s, a).state);
  let now = 0;
  let reloads = 0;
  act({ type: 'holster', now });
  while (s.phase !== 'draw') act({ type: 'tick', now: (now += 20) });
  const drawAt = now;
  let nextShot = now + model.drawMs;
  let reloadAt: number | null = null;
  let wasReloading = false;
  const phase = (): string => s.phase;
  // Where the bot appeared recently, so the model's aim trails a moving target.
  const seen: { t: number; x: number }[] = [];
  const tracked = () => {
    const t = apparentTarget(s);
    const past = seen.find((p) => p.t >= now - model.trackLagMs) ?? seen[seen.length - 1];
    return { x: past ? past.x : t.x, y: t.y };
  };
  while (phase() !== 'over' && now < drawAt + 120000) {
    now += 20;
    seen.push({ t: now, x: apparentTarget(s).x });
    if (seen.length > 40) seen.shift();
    act({ type: 'tick', now, aim: phase() === 'aim' ? tracked() : undefined });
    if (phase() === 'draw' && now >= drawAt + model.drawMs) act({ type: 'drawPose', now });
    if (phase() !== 'aim') continue;
    // Reloading (or venting a heat gun): wait, then take a moment to re-aim.
    const reloading = s.player.reloadNextAt != null || s.player.venting;
    if (wasReloading && !reloading) nextShot = now + model.recenterMs;
    wasReloading = reloading;
    if (reloading) continue;
    // Out of rounds, or overheated: the model player dips to reload / vent.
    if (gun.heat ? s.player.overheated : s.player.rounds === 0) {
      reloadAt ??= now + model.reloadReactMs;
      if (now >= reloadAt) {
        act({ type: 'reload', now });
        reloads++;
        reloadAt = null;
      }
      continue;
    }
    if (now >= nextShot) {
      const t = tracked();
      act({ type: 'fire', now, aim: { x: t.x + gauss() * model.sigma, y: t.y + gauss() * model.sigma } });
      nextShot = now + Math.max(gun.cooldownMs, model.tapMs + (Math.random() * 2 - 1) * model.tapJitterMs);
    }
  }
  return { timeMs: now - drawAt, shots: s.player.shots, reloads };
}

/** How long a bot takes to paint out a player who stands still and never fires back (seconds). */
export function botKillTime(bot: BotConfig): number {
  let s: DuelState = createDuel({ ...DEFAULT_CONFIG, bot }, (Math.random() * 2 ** 32) >>> 0, 0);
  const act = (a: Action) => (s = step(s, a).state);
  let now = 0;
  act({ type: 'holster', now });
  const phase = (): string => s.phase;
  while (phase() !== 'draw') act({ type: 'tick', now: (now += 20) });
  const drawAt = now;
  act({ type: 'drawPose', now: now + 450 });
  while (phase() !== 'over' && now < drawAt + 300000) act({ type: 'tick', now: (now += 20) });
  return (now - drawAt) / 1000;
}

export function botTable(rounds = 2000) {
  return Object.entries(BOTS).map(([name, bot]) => {
    const t = Array.from({ length: rounds }, () => botKillTime(bot)).sort((a, b) => a - b);
    return { bot: name, medianKill: +t[Math.floor(t.length / 2)].toFixed(1) };
  });
}

export function summarize(weapon: string, model: PlayerModel = TYPICAL, rounds = 3000, opponent?: string, bot?: BotConfig) {
  const res = Array.from({ length: rounds }, () => playRound(weapon, model, opponent, bot));
  const times = res.map((r) => r.timeMs).sort((a, b) => a - b);
  const q = (p: number) => +(times[Math.floor(p * (times.length - 1))] / 1000).toFixed(1);
  const mean = (f: (r: RoundResult) => number) => +(res.reduce((a, r) => a + f(r), 0) / res.length).toFixed(1);
  return { weapon, sigma: model.sigma, median: q(0.5), p25: q(0.25), p75: q(0.75), shots: mean((r) => r.shots), reloads: mean((r) => r.reloads) };
}

/** Every gun at three skill levels: sharp (sigma 1.4), typical (2.4) and wild (3.6). */
export function table(rounds = 3000) {
  const rows = [];
  for (const w of Object.keys(WEAPONS)) {
    for (const sigma of [1.4, 2.4, 3.6]) rows.push(summarize(w, { ...TYPICAL, sigma }, rounds));
  }
  console.table(rows);
  return rows;
}

/** Same gun and player against each alien: should match if aliens are really looks only. */
export function aliens(weapon = 'star-revolver', rounds = 4000) {
  const rows = ['desert-sage', 'desert-blue', 'desert-gold'].map((c) => ({ opponent: c, ...summarize(weapon, TYPICAL, rounds, c) }));
  console.table(rows);
  return rows;
}

/** Exposed so tuning runs can try gun and bot numbers without editing the source. */
export { BOTS, WEAPONS };
