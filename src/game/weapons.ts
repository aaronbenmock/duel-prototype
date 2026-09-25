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
    // Simulated time to win vs the Normal bot (same basic aim, different recoil handling):
    //   waits to settle 16.5 s, intermediate 10.3 s, expert (fast and compensating) 8.0 s,
    //   spamming at full speed 9.9 s but missing 61% of shots.
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
    blurb: '2 blasts of 7 blobs, forgiving aim',
    capacity: 2,
    // Each blob does little; a centered blast lands most of them.
    damage: { face: 4, torso: 2, limb: 1, tail: 1 },
    pellets: 7,
    spread: 2.4,
    cooldownMs: 450,
    // One shell at a time: the first goes in after 0.35 s, the second 0.45 s later (0.8 s for both).
    // Simulated time to win (sharp / typical / wild aim): 9.6 / 12.7 / 20.0 s,
    // vs the revolver's 9.6 / 13.5 / 22.2 s: same for good aim, kinder to wild aim.
    reloadStartMs: 350,
    reloadPerRoundMs: 450,
  },
  'desert-raygun': {
    id: 'desert-raygun',
    name: 'Raygun',
    blurb: 'No ammo: fire until it overheats, dip to vent',
    capacity: 0,
    damage: { face: 18, torso: 8, limb: 4, tail: 2 },
    pellets: 1,
    spread: 0,
    // Fast zaps, but about 8 in a row overheats it (then 2.5 s locked, or vent in 0.7 s by dipping).
    // Simulated time to win (sharp / typical / wild aim): 10.4 / 13.5 / 22.3 s, vs revolver 9.6 / 13.5 / 22.2 s.
    cooldownMs: 250,
    reloadStartMs: 0,
    reloadPerRoundMs: 0,
    heat: { perShot: 14, coolPerSec: 15, coolDelayMs: 500, overheatCoolPerSec: 40, ventMs: 700 },
  },
};

export const DEFAULT_WEAPON = 'star-revolver';
