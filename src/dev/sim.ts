// Balance simulator (not part of the game build). Plays many rounds through the real
// rules with a model player, to compare guns and aliens by time to win.
// Run in the browser console of the dev server:
//   const sim = await import('/src/dev/sim.ts'); sim.table()
import { createDuel, DEFAULT_CONFIG, step, apparentTarget, recoilOffset } from '../game/duel';
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
  /** Recoil guns: share of the current kick the player cancels by pulling against it (0 none, 1 perfect). */
  compensation?: number;
  /** Recoil guns: wait until the gun has settled before firing again (plus this reaction time, ms). */
  waitSettleMs?: number;
  /** Spread guns: hold steady until the choke has built this long (ms) before firing; gives up after 400 ms more. */
  chokeWaitMs?: number;
  /** Reload-interrupt guns: fire mid-reload once a round is in, when the bot is standing still. */
  interruptReload?: boolean;
  /** Aim at the face instead of the middle of the body. */
  aimFace?: boolean;
  /** Travelling bolts: how much of the needed lead the player aims ahead of a moving target (0 none, 1 exact). */
  leadFactor?: number;
  /** Timed vent: chance the player's tap lands in the window (unset = never tries). */
  ventSkill?: number;
  /** Heat guns: vent early once heat reaches this (unset = only when overheated). */
  ventAtHeat?: number;
}

/** How far away the opponent stands (m), for bolt flight times. */
const DEFAULT_DISTANCE = 12;

/** Face center above the torso reference point, aim units (about the same for every alien). */
const FACE_UP = 3.1;

/**
 * Skill levels. Beginners aim at the body and wait for the gun; intermediates aim a bit better, fire sooner
 * and partly handle recoil; experts aim well, go for the face, fire fast and use every gun's tricks.
 * The spammer fires as fast as the gun allows with beginner aim and no recoil control.
 */
export const BEGINNER: PlayerModel = { sigma: 2.6, tapMs: 750, tapJitterMs: 250, drawMs: 450, reloadReactMs: 450, recenterMs: 300, trackLagMs: 250, compensation: 0, waitSettleMs: 150 };
export const INTERMEDIATE: PlayerModel = { ...BEGINNER, sigma: 2.0, tapMs: 450, tapJitterMs: 120, compensation: 0.5, waitSettleMs: undefined, chokeWaitMs: 300, leadFactor: 0.5, ventSkill: 0.5, ventAtHeat: 85 };
export const EXPERT: PlayerModel = { ...BEGINNER, sigma: 1.5, tapMs: 300, tapJitterMs: 60, compensation: 0.85, waitSettleMs: undefined, chokeWaitMs: 450, interruptReload: true, aimFace: true, trackLagMs: 180, leadFactor: 0.9, ventSkill: 0.85, ventAtHeat: 85 };
export const SPAMMER: PlayerModel = { ...BEGINNER, tapMs: 220, tapJitterMs: 30, compensation: 0, waitSettleMs: undefined };

export const TYPICAL: PlayerModel = { sigma: 2.4, tapMs: 750, tapJitterMs: 250, drawMs: 450, reloadReactMs: 450, recenterMs: 300, trackLagMs: 250 };

function gauss(): number {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

export interface RoundResult {
  timeMs: number;
  shots: number;
  reloads: number;
  /** Shots by zone hit ('miss' for none), and the average recoil kick at the moment of firing. */
  zones: Record<string, number>;
  kickAtShot: number;
}

/** One round against a bot (moving, but never firing back); returns the player's time to win (from DRAW). */
export function playRound(weapon: string, model: PlayerModel, opponent?: string, bot: BotConfig = DEFAULT_CONFIG.bot): RoundResult {
  const config = { ...DEFAULT_CONFIG, bot: { ...bot, hitChance: 0 } };
  let s: DuelState = createDuel(config, (Math.random() * 2 ** 32) >>> 0, 0, { creature: 'desert-sage', weapon });
  if (opponent) s.creature = opponent;
  const gun = WEAPONS[weapon];
  const zones: Record<string, number> = {};
  let kickSum = 0;
  const act = (a: Action) => {
    const r = step(s, a);
    s = r.state;
    for (const e of r.effects) {
      // Zones count where shots land: at firing for instant guns, on arrival for travelling bolts.
      if (e.type === 'boltHit') {
        zones[e.zone ?? 'miss'] = (zones[e.zone ?? 'miss'] ?? 0) + 1;
        continue;
      }
      if (e.type !== 'shot') continue;
      kickSum += Math.hypot(e.recoil.x, e.recoil.y);
      if (e.travelMs > 0) continue;
      zones[e.zone ?? 'miss'] = (zones[e.zone ?? 'miss'] ?? 0) + 1;
    }
  };
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
  const travelS = gun.boltSpeed ? DEFAULT_DISTANCE / gun.boltSpeed : 0;
  const tracked = () => {
    const t = apparentTarget(s);
    const past = seen.find((p) => p.t >= now - model.trackLagMs) ?? seen[seen.length - 1];
    // Leading a moving target (travelling bolts): aim ahead by its recent speed times the flight time.
    let lead = 0;
    if (travelS && model.leadFactor && seen.length > 4) {
      const a = seen[seen.length - 4];
      const b = seen[seen.length - 1];
      lead = model.leadFactor * ((b.x - a.x) / ((b.t - a.t) / 1000)) * travelS;
    }
    return { x: (past ? past.x : t.x) + lead, y: t.y };
  };
  let ventTapAt: number | null = null;
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
    const interrupt = reloading && model.interruptReload && gun.reloadInterrupt && s.player.rounds > 0 && s.bot.mode === 'plant';
    // Timed vent: tap in the window (or miss it) according to the player's skill.
    const v = s.player.vent;
    if (v && !v.tapped && model.ventSkill != null && gun.heat) {
      if (ventTapAt == null) {
        const [w0, w1] = gun.heat.ventWindow;
        const f = Math.random() < model.ventSkill ? (w0 + w1) / 2 : Math.random() < 0.5 ? w0 * 0.5 : Math.min(0.97, w1 + 0.15);
        ventTapAt = v.startAt + f * v.durationMs;
      }
      if (now >= ventTapAt) {
        act({ type: 'ventTap', now });
        ventTapAt = null;
      }
    }
    if (!s.player.vent) ventTapAt = null;
    if (reloading && !interrupt) continue;
    // Out of rounds, or overheated: the model player dips to reload / vent.
    if (gun.heat ? s.player.overheated || (model.ventAtHeat != null && s.player.heat >= model.ventAtHeat) : s.player.rounds === 0) {
      reloadAt ??= now + model.reloadReactMs;
      if (now >= reloadAt) {
        act({ type: 'reload', now });
        reloads++;
        reloadAt = null;
      }
      continue;
    }
    const kick = recoilOffset(s, now);
    const def = gun.recoil;
    if (def && model.waitSettleMs != null) {
      // Beginner: don't fire until the gun has settled (then a moment to react).
      if (Math.hypot(kick.x, kick.y) >= def.settledAt) {
        nextShot = Math.max(nextShot, now + model.waitSettleMs);
        continue;
      }
    }
    // Spread guns: hold steady for a tighter pattern (but don't wait forever).
    if (gun.choke && model.chokeWaitMs && now >= nextShot && s.player.steadyMs < model.chokeWaitMs && now < nextShot + model.chokeWaitMs + 400) continue;
    if (now >= nextShot) {
      const t = tracked();
      // Pulling against the kick cancels part of it (the rules then add the kick back).
      const c = model.compensation ?? 0;
      const up = model.aimFace ? FACE_UP : 0;
      act({ type: 'fire', now, aim: { x: t.x + gauss() * model.sigma - c * kick.x, y: t.y + up + gauss() * model.sigma - c * kick.y } });
      nextShot = now + Math.max(gun.cooldownMs, model.tapMs + (Math.random() * 2 - 1) * model.tapJitterMs);
    }
  }
  return { timeMs: now - drawAt, shots: s.player.shots, reloads, zones, kickAtShot: s.player.shots ? kickSum / s.player.shots : 0 };
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
  const zoneTotals: Record<string, number> = {};
  for (const r of res) for (const [z, n] of Object.entries(r.zones)) zoneTotals[z] = (zoneTotals[z] ?? 0) + n;
  const allShots = res.reduce((a, r) => a + r.shots, 0) || 1;
  const zonePct = Object.fromEntries(Object.entries(zoneTotals).map(([z, n]) => [z, Math.round((n / allShots) * 100)]));
  return {
    weapon, sigma: model.sigma, median: q(0.5), p25: q(0.25), p75: q(0.75), shots: mean((r) => r.shots), reloads: mean((r) => r.reloads),
    zonePct, kickAtShot: mean((r) => r.kickAtShot),
  };
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
