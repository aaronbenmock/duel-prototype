// The duel rules as a pure function: (state, action) -> (new state, effects).
import { moveBot } from './bot';
import { ALIENS, CREATURES, DEFAULT_CREATURE } from './creatures';
import { between } from './rng';
import type { Action, DuelConfig, DuelState, EmptyReason, Effect, HitZone, Loadout, Pellet, Vec2 } from './types';
import { DEFAULT_WEAPON, WEAPONS, type RecoilDef } from './weapons';

export const MAX_HP = 100;

/** Reference scale (sage): sprite pixels per aim unit (degree). Each creature's own scale is in its zone map. */
export const SPRITE_PX_PER_UNIT = 78;
/** Where the opponent stands: torso reference height (aim units) puts its feet on the street. */
export const OPPONENT_Y = -1.6;
/** The opponent starts this far (aim units) either side of center. */
export const OPPONENT_SPAWN_X = 6;

/** How the bot's hits spread over the body when they don't hit the face. */
const BOT_BODY_SPLIT = { torso: 0.6, limb: 0.33, tail: 0.07 } as const;

const ZONE_CODES: HitZone[] = [null, 'face', 'torso', 'limb', 'tail', null];
/** Which zone counts as the "best" hit of a spread shot (for sounds and the label). */
const ZONE_RANK: HitZone[] = ['face', 'torso', 'limb', 'tail'];
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Tilt-to-move: sidestepping, and how it affects the bot's aim. */
export const MOVE = {
  maxSpeed: 1.2, // m/s at full tilt
  maxOffset: 1.5, // m either side of the start position
  opponentDistance: 12, // m, sets how far the opponent appears to slide
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
    intervalMin: 0.6,
    intervalMax: 0.95,
    hitChance: 0.9,
    headshotShare: 0.05,
    reloadTime: 1.5,
    movingHitFactor: 0.6,
    dashHitFactor: 0.4,
    moveRange: 2.0,
    walkSpeed: 1.5,
    dashChance: 0.45,
    dashSpeed: 3.8,
    dashDistMin: 0.8,
    dashDistMax: 1.5,
    jukeChance: 0.25,
    plantMin: 0.4,
    plantMax: 1.1,
    plantShotDelay: 0.3,
    reactMs: 700,
    reactChance: 0.5,
  },
};


/**
 * Which zone of the opponent a shot at `aim` lands on. Only visible parts of
 * the sprite count (from its generated hit-zone map); the hat is a miss.
 */
export function hitTest(creature: string, target: Vec2, aim: Vec2): HitZone {
  const c = CREATURES[creature];
  const px = c.torsoPx[0] + (aim.x - target.x) * c.pxPerUnit;
  const py = c.torsoPx[1] - (aim.y - target.y) * c.pxPerUnit;
  if (px < 0 || py < 0 || px >= c.canvas || py >= c.canvas) return null;
  const cell = c.canvas / c.grid;
  const code = Number(c.rows[Math.floor(py / cell)][Math.floor(px / cell)]);
  return ZONE_CODES[code] ?? null;
}

export const DEFAULT_LOADOUT: Loadout = { creature: DEFAULT_CREATURE, weapon: DEFAULT_WEAPON };

/**
 * How far recoil has moved the player's crosshair from where the phone points, at time `t`:
 * the kick holds briefly after a shot, then glides back to zero.
 */
export function recoilOffset(s: DuelState, t: number): Vec2 {
  const r = s.player.recoil;
  const def = WEAPONS[s.player.weapon].recoil;
  if (!def || r.at == null) return { x: 0, y: 0 };
  const e = t - r.at - def.recoveryDelayMs;
  const k = e <= 0 ? 1 : Math.exp(-e / def.recoveryTauMs);
  return { x: r.x * k, y: r.y * k };
}

/** Current spread radius (aim units): tightens from gun.spread toward choke.minSpread while held steady. */
export function currentSpread(s: DuelState): number {
  const gun = WEAPONS[s.player.weapon];
  if (!gun.choke) return gun.spread;
  const k = Math.min(1, s.player.steadyMs / gun.choke.tightenMs);
  return gun.spread - (gun.spread - gun.choke.minSpread) * k;
}

/** Choke: builds while the crosshair moves slower than steadySpeed, loosens faster when it moves more. */
function trackSteadiness(s: DuelState, now: number, aim: Vec2 | undefined) {
  const choke = WEAPONS[s.player.weapon].choke;
  const p = s.player;
  if (!choke) return;
  if (!aim || s.phase !== 'aim') {
    // Gun lowered (or not yet drawn): start over.
    p.steadyMs = 0;
    p.lastAim = null;
    return;
  }
  // Measure speed over at least 50 ms, so sensor-update steps don't read as jerks.
  if (!p.lastAim) {
    p.lastAim = { x: aim.x, y: aim.y, t: now };
    return;
  }
  const elapsed = now - p.lastAim.t;
  if (elapsed < 50) return;
  const speed = Math.hypot(aim.x - p.lastAim.x, aim.y - p.lastAim.y) / (elapsed / 1000);
  p.steadyMs = speed < choke.steadySpeed
    ? Math.min(choke.tightenMs, p.steadyMs + elapsed)
    : Math.max(0, p.steadyMs - elapsed * choke.loosenRate);
  p.lastAim = { x: aim.x, y: aim.y, t: now };
}

/** Adds one shot's kick: up, plus a sideways step from the pattern; quick strings kick harder. */
function addKick(s: DuelState, def: RecoilDef, current: Vec2, settled: boolean, now: number) {
  const r = s.player.recoil;
  const i = settled ? 0 : r.string;
  const grow = Math.pow(def.stackGrowth, i);
  const up = def.kickUp * grow * (1 + between(s, -def.variation, def.variation));
  const side = def.kickSide[Math.min(i, def.kickSide.length - 1)] * grow + between(s, -def.sideVariation, def.sideVariation);
  s.player.recoil = { x: current.x + side, y: current.y + up, at: now, string: i + 1 };
}

export function createDuel(config: DuelConfig, seed: number, now: number, loadout: Loadout = DEFAULT_LOADOUT): DuelState {
  const s: DuelState = {
    phase: 'holster',
    result: null,
    config,
    rng: seed >>> 0,
    creature: DEFAULT_CREATURE,
    target: { x: 0, y: 0 },
    startedAt: now,
    holsteredAt: null,
    drawSignalAt: null,
    drawnAt: null,
    endedAt: null,
    lastTickAt: now,
    player: {
      hp: MAX_HP, rounds: WEAPONS[loadout.weapon].capacity, shots: 0, hits: 0, headshots: 0,
      weapon: loadout.weapon, creature: loadout.creature, reloadNextAt: null, lastShotAt: null, recoil: { x: 0, y: 0, at: null, string: 0 }, steadyMs: 0, lastAim: null, heat: 0, overheated: false, venting: false, x: 0, lean: 0, vx: 0,
    },
    bot: {
      hp: MAX_HP, rounds: WEAPONS[DEFAULT_WEAPON].capacity, shots: 0, hits: 0, headshots: 0,
      weapon: DEFAULT_WEAPON, nextFireAt: null, reloadUntil: null, x: 0, destX: 0, vx: 0,
      mode: 'plant', nextMoveAt: null, jukeAt: null, onTargetMs: 0,
    },
    holes: [],
  };
  // The opponent is a different alien from the player's, picked at random.
  const others = ALIENS.map((a) => a.id).filter((id) => id !== loadout.creature);
  s.creature = others[Math.floor(between(s, 0, others.length))] ?? DEFAULT_CREATURE;
  // Put the opponent somewhere off-center on the street so the player has to aim.
  s.target = { x: between(s, -OPPONENT_SPAWN_X, OPPONENT_SPAWN_X), y: OPPONENT_Y };
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
  const gun = WEAPONS[s.player.weapon];
  const botGun = WEAPONS[s.bot.weapon];

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
      {
        // Empty, mid-reload, overheated or venting, or too soon after the last shot: the trigger just clicks.
        const p = s.player;
        const reason: EmptyReason | null = gun.heat
          ? p.venting ? 'venting' : p.overheated ? 'overheated' : null
          : p.rounds === 0 ? (p.reloadNextAt != null ? 'reloading' : 'empty')
            : p.reloadNextAt != null && !gun.reloadInterrupt ? 'reloading' : null;
        const tooSoon = p.lastShotAt != null && now - p.lastShotAt < gun.cooldownMs;
        if (reason || tooSoon) {
          fx.push({ type: 'empty', reason: reason ?? 'cooldown' });
          break;
        }
      }
      if (gun.heat) {
        s.player.heat += gun.heat.perShot;
        if (s.player.heat >= 100) {
          s.player.heat = 100;
          s.player.overheated = true;
          fx.push({ type: 'overheat' });
        }
      } else {
        // Firing with a round in cuts a one-at-a-time reload short (reloadInterrupt guns).
        s.player.reloadNextAt = null;
        s.player.rounds--;
      }
      s.player.shots++;
      s.player.lastShotAt = now;
      const spread = currentSpread(s);
      s.player.steadyMs = 0;
      {
        // Recoil: the shot goes where the crosshair is (phone aim plus any kick still recovering),
        // then this shot adds its own kick.
        const kick = recoilOffset(s, now);
        const settled = Math.hypot(kick.x, kick.y) < (gun.recoil?.settledAt ?? Infinity);
        const shotAim = { x: action.aim.x + kick.x, y: action.aim.y + kick.y };
        if (gun.recoil) addKick(s, gun.recoil, kick, settled, now);
        const t = apparentTarget(s);
        // Spread guns: blobs in an even sunflower pattern over the spread circle, turned at random.
        const turn = gun.pellets > 1 ? between(s, 0, 2 * Math.PI) : 0;
        const pellets: Pellet[] = [];
        let damage = 0;
        for (let i = 0; i < gun.pellets; i++) {
          const r = gun.pellets > 1 ? spread * Math.sqrt((i + 0.5) / gun.pellets) : 0;
          const a = turn + i * GOLDEN_ANGLE;
          const p = { x: shotAim.x + r * Math.cos(a), y: shotAim.y + r * Math.sin(a) };
          const zone = hitTest(s.creature, t, p);
          pellets.push({ ...p, zone });
          s.holes.push({ x: p.x - t.x, y: p.y - t.y, zone, t: now, size: gun.pellets > 1 ? 0.45 : 1 });
          if (zone) damage += gun.damage[zone];
        }
        const zone = ZONE_RANK.find((z) => pellets.some((p) => p.zone === z)) ?? null;
        if (zone) {
          s.player.hits++;
          if (pellets.some((p) => p.zone === 'face')) s.player.headshots++;
          s.bot.hp = Math.max(0, s.bot.hp - damage);
        }
        fx.push({ type: 'shot', zone, aim: shotAim, damage, pellets, last: !gun.heat && s.player.rounds === 0, recoil: kick, settled, spread });
      }
      if (s.bot.hp <= 0) end(s, 'victory', now, fx);
      break;

    case 'reload':
      // Heat guns: the same gesture vents instead (also cuts an overheat short).
      if (gun.heat) {
        if ((s.phase === 'draw' || s.phase === 'aim') && s.player.heat > 0 && !s.player.venting) {
          s.player.venting = true;
          fx.push({ type: 'ventStart' });
        }
        break;
      }
      // Starts a reload; rounds then go in one at a time on ticks (see below).
      if ((s.phase === 'draw' || s.phase === 'aim') && s.player.reloadNextAt == null && s.player.rounds < gun.capacity) {
        s.player.reloadNextAt = now + gun.reloadStartMs;
        fx.push({ type: 'reloadStart', missing: gun.capacity - s.player.rounds });
      }
      break;

    case 'lean':
      s.player.lean = Math.max(-1, Math.min(1, action.value));
      break;

    case 'tick': {
      const dt = Math.min(0.05, Math.max(0, (now - s.lastTickAt) / 1000));
      s.lastTickAt = now;
      trackSteadiness(s, now, action.aim);
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
      if (s.phase === 'draw' || s.phase === 'aim') {
        const k = recoilOffset(s, now);
        const onTarget = action.aim != null && hitTest(s.creature, apparentTarget(s), { x: action.aim.x + k.x, y: action.aim.y + k.y }) != null;
        moveBot(s, now, dt, onTarget, MOVE.opponentDistance);
      }
      // Heat guns: vent, overheat cool-down, or normal cooling after a pause in firing.
      if (gun.heat) {
        const h = gun.heat;
        const p = s.player;
        if (p.venting || p.overheated) {
          p.heat -= (p.venting ? 100000 / h.ventMs : h.overheatCoolPerSec) * dt;
          if (p.heat <= 0) {
            fx.push({ type: p.venting ? 'ventDone' : 'cooled' });
            p.heat = 0;
            p.venting = false;
            p.overheated = false;
          }
        } else if (p.lastShotAt == null || now - p.lastShotAt >= h.coolDelayMs) {
          p.heat = Math.max(0, p.heat - h.coolPerSec * dt);
        }
      }
      // Player reload: one round per interval, a click each, until full.
      while (s.player.reloadNextAt != null && now >= s.player.reloadNextAt) {
        s.player.rounds++;
        fx.push({ type: 'reloadRound' });
        if (s.player.rounds >= gun.capacity) {
          s.player.reloadNextAt = null;
          fx.push({ type: 'reloadDone' });
        } else {
          s.player.reloadNextAt += gun.reloadPerRoundMs;
        }
      }
      if (s.phase === 'draw' || s.phase === 'aim') {
        if (s.bot.reloadUntil != null && now >= s.bot.reloadUntil) {
          s.bot.rounds = botGun.capacity;
          s.bot.reloadUntil = null;
          s.bot.nextFireAt = now + between(s, bot.intervalMin, bot.intervalMax) * 1000;
        }
        if (s.bot.nextFireAt != null && now >= s.bot.nextFireAt && s.bot.rounds > 0) {
          s.bot.rounds--;
          s.bot.shots++;
          let zone: HitZone = null;
          // A player who is sidestepping is harder to hit.
          const dodging = Math.abs(s.player.vx) >= MOVE.dodgeSpeed;
          // ...and a bot on the move is less accurate than a planted one (least of all mid-dash).
          const moveFactor = s.bot.mode === 'plant' ? 1 : s.bot.mode === 'dash' ? bot.dashHitFactor : bot.movingHitFactor;
          const chance = bot.hitChance * (dodging ? MOVE.dodgeFactor : 1) * moveFactor;
          if (between(s, 0, 1) < chance) {
            const r = between(s, 0, 1);
            if (r < bot.headshotShare) zone = 'face';
            else {
              const b = (r - bot.headshotShare) / (1 - bot.headshotShare);
              zone = b < BOT_BODY_SPLIT.torso ? 'torso' : b < BOT_BODY_SPLIT.torso + BOT_BODY_SPLIT.limb ? 'limb' : 'tail';
            }
          }
          if (zone) {
            s.bot.hits++;
            if (zone === 'face') s.bot.headshots++;
            s.player.hp = Math.max(0, s.player.hp - botGun.damage[zone]);
          }
          fx.push({ type: 'botShot', zone });
          if (s.bot.rounds === 0) {
            s.bot.nextFireAt = null;
            s.bot.reloadUntil = now + bot.reloadTime * 1000;
            fx.push({ type: 'botReload' });
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
