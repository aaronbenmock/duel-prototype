// Gun rules as data. Player and opponent (bot now, a person later) use the same definitions.
import type { HitZone } from './types';

export type DamageZone = Exclude<HitZone, null>;

export interface WeaponDef {
  id: string;
  name: string;
  /** One line for the picker. */
  blurb: string;
  /** Rounds per load. A single-shot gun (like the scattergun) would be 1. */
  capacity: number;
  /** Paint damage per hit, by zone. Health is 100. */
  damage: Record<DamageZone, number>;
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
    // Topping up 2 rounds takes about 0.55 s; a full cylinder about 1 s.
    reloadStartMs: 300,
    reloadPerRoundMs: 120,
  },
  // Future: 'wrapped-scattergun' (capacity 1, several pellets in a cone, quick reload) and
  // 'desert-raygun' (overheats instead of reloading). Balance each to a similar time to win.
};

export const DEFAULT_WEAPON = 'star-revolver';
