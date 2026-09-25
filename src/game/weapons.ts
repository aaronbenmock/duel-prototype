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
    cooldownMs: 0,
    // Topping up 2 rounds takes about 0.55 s; a full cylinder about 1 s.
    reloadStartMs: 300,
    reloadPerRoundMs: 120,
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
  // Future: 'desert-raygun' (overheats instead of reloading). Balance to a similar time to win.
};

export const DEFAULT_WEAPON = 'star-revolver';
