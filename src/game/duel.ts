// The duel rules as a pure function: (state, action) -> (new state, effects).
import type { Action, DuelConfig, DuelState, Effect, HitZone, Vec2 } from './types';

export const MAX_HP = 100;
export const CYLINDER = 6;
export const DAMAGE = { head: 100, torso: 40 } as const;

/** Opponent hit boxes, in aim units (degrees). The torso center is the target position. */
export const BODY = {
  headRadius: 1.6,
  headAbove: 6, // head center is this far above torso center
  torsoWidth: 5,
  torsoHeight: 8,
  legLength: 7,
} as const;

/** Tilt-to-move: sidestepping, and how it affects the bot's aim. */
export const MOVE = {
  maxSpeed: 1.2, // m/s at full tilt
  maxOffset: 1.5, // m either side of the start position
  opponentDistance: 10, // m, sets how far the opponent appears to slide
  dodgeSpeed: 0.3, // m/s; moving at least this fast counts as dodging
  dodgeFactor: 0.6, // bot hit chance is multiplied by this while you dodge
} as const;

const RAD = 180 / Math.PI;

/**
 * Where the opponent appears in aim units, after the player's sidestep.
 * Stepping right makes him appear further left, and vice versa.
 */
export function apparentTarget(s: DuelState): Vec2 {
  return { x: s.target.x + Math.atan2(s.bot.x - s.player.x, MOVE.opponentDistance) * RAD, y: s.target.y };
}

/** How far (aim units) something at `distance` meters appears to shift from the player's sidestep. */
export function parallax(s: DuelState, distance: number): number {
  return -Math.atan2(s.player.x, distance) * RAD;
}

export const DEFAULT_CONFIG: DuelConfig = {
  drawDelayMin: 2000,
  drawDelayMax: 5000,
  bot: {
    firstShotMin: 1,
    firstShotMax: 2.5,
    intervalMin: 0.9,
    intervalMax: 1.5,
    hitChance: 0.36,
    headshotShare: 0.08,
    reloadTime: 2.2,
    moveRange: 1.0,
    moveSpeed: 0.7,
    pauseMin: 1.0,
    pauseMax: 2.5,
  },
};

/** Small seeded random generator (mulberry32). Returns [0..1) and the next state. */
function rand(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

function between(s: DuelState, min: number, max: number): number {
  const [r, next] = rand(s.rng);
  s.rng = next;
  return min + r * (max - min);
}

export function hitTest(target: Vec2, aim: Vec2): HitZone {
  const hx = aim.x - target.x;
  const hy = aim.y - (target.y + BODY.headAbove);
  if (hx * hx + hy * hy <= BODY.headRadius * BODY.headRadius) return 'head';
  if (Math.abs(aim.x - target.x) <= BODY.torsoWidth / 2 && Math.abs(aim.y - target.y) <= BODY.torsoHeight / 2) {
    return 'torso';
  }
  return null;
}

export function createDuel(config: DuelConfig, seed: number, now: number): DuelState {
  const s: DuelState = {
    phase: 'holster',
    result: null,
    config,
    rng: seed >>> 0,
    target: { x: 0, y: 0 },
    startedAt: now,
    holsteredAt: null,
    drawSignalAt: null,
    drawnAt: null,
    endedAt: null,
    lastTickAt: now,
    player: { hp: MAX_HP, rounds: CYLINDER, shots: 0, hits: 0, headshots: 0, x: 0, lean: 0, vx: 0 },
    bot: {
      hp: MAX_HP, rounds: CYLINDER, shots: 0, hits: 0, headshots: 0,
      nextFireAt: null, reloadUntil: null, x: 0, destX: 0, vx: 0, nextMoveAt: null,
    },
    holes: [],
  };
  // Put the opponent somewhere off-center so the player has to aim.
  s.target = { x: between(s, -9, 9), y: between(s, -3, 3) };
  return s;
}

function end(s: DuelState, result: 'victory' | 'defeat' | 'foul', now: number, fx: Effect[]) {
  s.phase = 'over';
  s.result = result;
  s.endedAt = now;
  fx.push({ type: result });
}

export function step(prev: DuelState, action: Action): { state: DuelState; effects: Effect[] } {
  if (prev.phase === 'over') return { state: prev, effects: [] };
  const s = structuredClone(prev);
  const fx: Effect[] = [];
  const now = action.now;
  const bot = s.config.bot;

  switch (action.type) {
    case 'holster':
      if (s.phase === 'holster') {
        s.phase = 'ready';
        s.holsteredAt = now;
        s.drawSignalAt = now + between(s, s.config.drawDelayMin, s.config.drawDelayMax);
        fx.push({ type: 'ready' });
      }
      break;

    case 'unholster':
      // Leaving the holster before DRAW is a false start.
      if (s.phase === 'ready') end(s, 'foul', now, fx);
      break;

    case 'drawPose':
      if (s.phase === 'draw') {
        s.phase = 'aim';
        s.drawnAt = now;
      }
      break;

    case 'fire':
      if (s.phase !== 'aim') break;
      if (s.player.rounds === 0) {
        fx.push({ type: 'empty' });
        break;
      }
      s.player.rounds--;
      s.player.shots++;
      {
        const t = apparentTarget(s);
        const zone = hitTest(t, action.aim);
        s.holes.push({ x: action.aim.x - t.x, y: action.aim.y - t.y, zone });
        if (zone) {
          s.player.hits++;
          if (zone === 'head') s.player.headshots++;
          s.bot.hp = Math.max(0, s.bot.hp - DAMAGE[zone]);
        }
        fx.push({ type: 'shot', zone });
      }
      if (s.bot.hp <= 0) end(s, 'victory', now, fx);
      break;

    case 'reload':
      if ((s.phase === 'draw' || s.phase === 'aim') && s.player.rounds < CYLINDER) {
        s.player.rounds = CYLINDER;
        fx.push({ type: 'reload' });
      }
      break;

    case 'lean':
      s.player.lean = Math.max(-1, Math.min(1, action.value));
      break;

    case 'tick': {
      const dt = Math.min(0.05, Math.max(0, (now - s.lastTickAt) / 1000));
      s.lastTickAt = now;
      if (s.phase === 'aim') {
        const oldX = s.player.x;
        s.player.x = Math.max(-MOVE.maxOffset, Math.min(MOVE.maxOffset, oldX + s.player.lean * MOVE.maxSpeed * dt));
        s.player.vx = dt > 0 ? (s.player.x - oldX) / dt : 0;
      } else {
        s.player.vx = 0;
      }
      if (s.phase === 'ready' && s.drawSignalAt != null && now >= s.drawSignalAt) {
        s.phase = 'draw';
        fx.push({ type: 'draw' });
        s.bot.nextFireAt = s.drawSignalAt + between(s, bot.firstShotMin, bot.firstShotMax) * 1000;
        s.bot.nextMoveAt = s.drawSignalAt + between(s, 0.3, 1.0) * 1000;
      }
      s.bot.vx = 0;
      if ((s.phase === 'draw' || s.phase === 'aim') && bot.moveRange > 0) {
        // Bot wanders: pause, pick a new spot, walk there, repeat.
        if (s.bot.nextMoveAt != null && now >= s.bot.nextMoveAt) {
          s.bot.nextMoveAt = null;
          s.bot.destX = between(s, -bot.moveRange, bot.moveRange);
        }
        if (s.bot.nextMoveAt == null && s.bot.destX !== s.bot.x) {
          const stepM = bot.moveSpeed * dt;
          const gap = s.bot.destX - s.bot.x;
          const oldX = s.bot.x;
          s.bot.x = Math.abs(gap) <= stepM ? s.bot.destX : s.bot.x + Math.sign(gap) * stepM;
          s.bot.vx = dt > 0 ? (s.bot.x - oldX) / dt : 0;
          if (s.bot.x === s.bot.destX) s.bot.nextMoveAt = now + between(s, bot.pauseMin, bot.pauseMax) * 1000;
        }
      }
      if (s.phase === 'draw' || s.phase === 'aim') {
        if (s.bot.reloadUntil != null && now >= s.bot.reloadUntil) {
          s.bot.rounds = CYLINDER;
          s.bot.reloadUntil = null;
          s.bot.nextFireAt = now + between(s, bot.intervalMin, bot.intervalMax) * 1000;
        }
        if (s.bot.nextFireAt != null && now >= s.bot.nextFireAt && s.bot.rounds > 0) {
          s.bot.rounds--;
          s.bot.shots++;
          let zone: HitZone = null;
          // A player who is sidestepping is harder to hit.
          const dodging = Math.abs(s.player.vx) >= MOVE.dodgeSpeed;
          const chance = bot.hitChance * (dodging ? MOVE.dodgeFactor : 1);
          if (between(s, 0, 1) < chance) zone = between(s, 0, 1) < bot.headshotShare ? 'head' : 'torso';
          if (zone) {
            s.bot.hits++;
            if (zone === 'head') s.bot.headshots++;
            s.player.hp = Math.max(0, s.player.hp - DAMAGE[zone]);
          }
          fx.push({ type: 'botShot', zone });
          if (s.bot.rounds === 0) {
            s.bot.nextFireAt = null;
            s.bot.reloadUntil = now + bot.reloadTime * 1000;
          } else {
            s.bot.nextFireAt = now + between(s, bot.intervalMin, bot.intervalMax) * 1000;
          }
          if (s.player.hp <= 0) end(s, 'defeat', now, fx);
        }
      }
      break;
    }
  }
  return { state: s, effects: fx };
}

/** Draw time in milliseconds, or null if the player never drew. */
export function drawTime(s: DuelState): number | null {
  return s.drawnAt != null && s.drawSignalAt != null ? s.drawnAt - s.drawSignalAt : null;
}
