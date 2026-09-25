// The player's last alien and gun pick, remembered on this phone.
import { CREATURES } from '../game/creatures';
import { DEFAULT_LOADOUT } from '../game/duel';
import type { Loadout } from '../game/types';
import { WEAPONS } from '../game/weapons';

const STORAGE_KEY = 'high-moon-loadout-v1';

export function loadLoadout(): Loadout {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Loadout>;
    return {
      creature: saved.creature && CREATURES[saved.creature] ? saved.creature : DEFAULT_LOADOUT.creature,
      weapon: saved.weapon && WEAPONS[saved.weapon] ? saved.weapon : DEFAULT_LOADOUT.weapon,
    };
  } catch {
    return { ...DEFAULT_LOADOUT };
  }
}

export function saveLoadout(l: Loadout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
  } catch {
    // Storage blocked: the pick still applies for this visit.
  }
}
