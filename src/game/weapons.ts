// Gun rules as data. Player and opponent (bot now, a person later) use the same definitions.
// Each gun is tuned by simulation (src/dev/sim.ts) to a similar time to win for a typical player.
import type { HitZone } from './types';

export type DamageZone = Exclude<HitZone, null>;

export interface WeaponDef {
  id: string;
  name: string;
  /** One line for the picker. */
  blurb: string;
  /** Rounds per load. */
  capacity: number;
  /** Paint damage per hit (per pellet for spread guns), by zone. Health is 100. */
  damage: Record<DamageZone, number>;
  /** Paint blobs per shot, spread evenly over a circle of this radius (aim units = degrees). 1 blob = no spread. */
  pellets: number;
  spread: number;
  /** Spread guns: holding the crosshair steady tightens the pattern (see ChokeDef). */
  choke?: ChokeDef;
  /** Reloading one round at a time can be cut short by firing once at least one round is in. */
  reloadInterrupt?: boolean;
  /** Shots that take time to fly (m/s, the opponent is 12 m away): hits are decided where the target is when they arrive. Unset = instant. */
  boltSpeed?: number;
  /** Shortest time between shots (ms); a tap sooner just clicks. */
  cooldownMs: number;
  /** Reloading: nothing happens for this long (ms)... */
  reloadStartMs: number;
  /** ...then one round goes in every this many ms until full, with a click each. You can't fire meanwhile. */
  reloadPerRoundMs: number;
  /** Heat guns (raygun) have no rounds: each shot adds heat, and at 100 the gun locks until it cools. */
  heat?: HeatDef;
  /** Guns with recoil: each shot kicks the crosshair, which then glides back. Shots go exactly where the crosshair is. */
  recoil?: RecoilDef;
}

/**
 * Choke: the spread circle shrinks from `spread` to `minSpread` while you hold the crosshair steady
 * (moving slower than steadySpeed degrees/second) for tightenMs. Moving faster loosens it again
 * (loosenRate times as fast), and every blast starts it over.
 */
export interface ChokeDef {
  minSpread: number;
  tightenMs: number;
  steadySpeed: number;
  loosenRate: number;
}

/**
 * Recoil: a consistent, learnable kick after each shot, then recovery back to where the phone points.
 * All angles are aim units (degrees). Tune the feel here.
 */
export interface RecoilDef {
  /** Upward kick of the first shot in a string. */
  kickUp: number;
  /** Sideways kick for shots 1, 2, 3... of a quick string (right is positive); the last value repeats. */
  kickSide: number[];
  /** Each further shot in a quick string kicks this much harder (1.15 = 15% more each time). */
  stackGrowth: number;
  /** Small randomness: kick size varies by up to this fraction (+/-), sideways by up to sideVariation degrees. */
  variation: number;
  sideVariation: number;
  /** After a shot the crosshair holds for recoveryDelayMs, then glides back with this time constant (ms). */
  recoveryDelayMs: number;
  recoveryTauMs: number;
  /** Once the kick left is under this (degrees) the gun counts as settled: the string resets and the crosshair shows ready. */
  settledAt: number;
}

export interface HeatDef {
  /** Heat added per shot (the gun overheats at 100). */
  perShot: number;
  /** Cooling per second once you stop firing for coolDelayMs. */
  coolPerSec: number;
  coolDelayMs: number;
  /** Cooling per second while overheated (locked until it reaches 0). */
  overheatCoolPerSec: number;
  /** Dipping the phone vents: heat drains to 0 at this pace (ms for a full 100). You can't fire meanwhile. */
  ventMs: number;
  /** Venting an overheated gun is slower (ms for a full 100), so it pays to vent before it overheats. */
  overheatVentMs: number;
  /**
   * Timed vent: while venting, a marker sweeps across the gauge. Tap while it's inside the window
   * (fractions of the vent) for a perfect vent: instantly cool, and the next perfectZaps zaps do
   * perfectDamage times the damage. Tap outside it and the vent jams: it drains at jamRate of the pace.
   */
  ventWindow: [number, number];
  perfectZaps: number;
  perfectDamage: number;
  jamRate: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  'star-revolver': {
    id: 'star-revolver',
    name: 'Star revolver',
    blurb: '6 shots, reload by dipping',
    capacity: 6,
    // Five face hits win (Aaron, 2026-09-25); other zones keep the same ratios to the face.
    damage: { face: 20, torso: 9, limb: 5, tail: 2 },
    pellets: 1,
    spread: 0,
    // Fastest cadence: one shot per 0.25 s (the hammer cycle).
    cooldownMs: 250,
    // Topping up 2 rounds takes about 0.55 s; a full cylinder about 1 s.
    reloadStartMs: 300,
    reloadPerRoundMs: 120,
    // Kicks up 3 degrees (about the height of the face) and drifts right in a fixed pattern; settled
    // again about 0.65 s after a single shot. Wait for it, or pull the phone down against it.
    // Simulated time to win vs the Normal bot (v0.6.8 player models, src/dev/sim.ts): beginner 17.0 s,
    //   intermediate 9.2 s, expert (aims at the face, pulls against the kick) 4.8 s, spammer 10.2 s
    //   missing 63% of shots.
    recoil: {
      kickUp: 3.0,
      kickSide: [0.8, 1.2, -0.6, 1.5, -0.8, 1.8],
      stackGrowth: 1.25,
      variation: 0.15,
      sideVariation: 0.15,
      recoveryDelayMs: 80,
      recoveryTauMs: 300,
      settledAt: 0.45,
    },
  },
  'wrapped-scattergun': {
    id: 'wrapped-scattergun',
    name: 'Scattergun',
    blurb: '2 blasts; hold steady for a tight pattern',
    capacity: 2,
    // Each blob does little; a centered blast lands most of them.
    damage: { face: 4, torso: 2, limb: 2, tail: 1 },
    pellets: 7,
    // Wide (2.6 degrees) when you fire straight away; held steady for 0.45 s it tightens to 1.6 degrees.
    spread: 2.6,
    choke: { minSpread: 1.6, tightenMs: 450, steadySpeed: 12, loosenRate: 3 },
    reloadInterrupt: true,
    cooldownMs: 450,
    // One shell at a time: the first goes in after 0.35 s, the second 0.45 s later (0.8 s for both).
    // Firing once a shell is in cuts the reload short.
    // Simulated time to win vs the Normal bot (v0.6.8 player models): beginner 13.8 s, intermediate 10.3 s,
    // expert 7.8 s, spammer 11.1 s. The forgiving gun: beginners do best with it, the revolver has the higher ceiling.
    reloadStartMs: 350,
    reloadPerRoundMs: 450,
    // One heavy kick per blast (6 degrees, about a whole head): a quick second blast sails over
    // the target unless you pull against it. Settled again about 0.75 s after a blast.
    recoil: {
      kickUp: 6,
      kickSide: [-1, 1.2],
      stackGrowth: 1.0,
      variation: 0.1,
      sideVariation: 0.2,
      recoveryDelayMs: 100,
      recoveryTauMs: 280,
      settledAt: 0.6,
    },
  },
  'desert-raygun': {
    id: 'desert-raygun',
    name: 'Raygun',
    blurb: 'Lead your target; vent in rhythm',
    capacity: 0,
    damage: { face: 20, torso: 10, limb: 6, tail: 2 },
    pellets: 1,
    spread: 0,
    // Bolts fly at 60 m/s: 0.2 s to reach the opponent, so lead a moving target
    // (about 1.5 degrees ahead of a walking bot, 3.5 ahead of a dashing one).
    boltSpeed: 60,
    // A zap every 0.3 s at most; about 6 in a row overheats it. Vent early (dip) for a quick 0.7 s vent;
    // once overheated, the vent takes 2 s. Tap while the vent marker is in the green window for a
    // perfect vent: instantly cool, and the next 3 zaps do 25% more damage. Tap outside it and the vent jams.
    // Simulated time to win vs the Normal bot (v0.6.9 player models): beginner 19.0 s, intermediate 9.2 s,
    // expert (leads targets, vents early, 85% perfect vents) 4.4 s, spammer 10.9 s.
    // The hardest gun to start with and the highest ceiling against a moving target.
    cooldownMs: 300,
    reloadStartMs: 0,
    reloadPerRoundMs: 0,
    heat: {
      perShot: 16, coolPerSec: 15, coolDelayMs: 500, overheatCoolPerSec: 40, ventMs: 700, overheatVentMs: 2000,
      ventWindow: [0.5, 0.68], perfectZaps: 3, perfectDamage: 1.25, jamRate: 0.5,
    },
  },
};

export const DEFAULT_WEAPON = 'star-revolver';
