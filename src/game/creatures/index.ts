// Creature hit-zone maps and display names, by slug. Aliens are looks only:
// build_hitzones.py sizes each one to the same hittable area.
import { DESERT_BLUE } from './desert-blue';
import { DESERT_GOLD } from './desert-gold';
import { DESERT_SAGE } from './desert-sage';
import type { CreatureZones } from './types';

export const CREATURES: Record<string, CreatureZones> = {
  [DESERT_SAGE.slug]: DESERT_SAGE,
  [DESERT_BLUE.slug]: DESERT_BLUE,
  [DESERT_GOLD.slug]: DESERT_GOLD,
};

/** Aliens the player can pick, in picker order. */
export const ALIENS: { id: string; name: string }[] = [
  { id: DESERT_SAGE.slug, name: 'Sage' },
  { id: DESERT_BLUE.slug, name: 'Blue' },
  { id: DESERT_GOLD.slug, name: 'Gold' },
];

export const DEFAULT_CREATURE = DESERT_SAGE.slug;
export const alienName = (id: string) => ALIENS.find((a) => a.id === id)?.name ?? 'Opponent';
export type { CreatureZones };
