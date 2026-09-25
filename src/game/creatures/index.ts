// Creature hit-zone maps, by slug.
import { DESERT_SAGE } from './desert-sage';
import type { CreatureZones } from './types';

export const CREATURES: Record<string, CreatureZones> = {
  [DESERT_SAGE.slug]: DESERT_SAGE,
};

export const DEFAULT_CREATURE = DESERT_SAGE.slug;
export type { CreatureZones };
