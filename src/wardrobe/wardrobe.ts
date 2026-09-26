// Wardrobe: what a gunslinger can wear, and how items are earned. Pure data and rules, no DOM
// (checked by src/dev/wardrobeCheck.ts). Pictures for each item are in src/render/art.ts.
//
// Cosmetics are looks only: hit zones always come from the alien's base sprite, so nothing worn
// can make a gunslinger easier or harder to hit.
import type { Stats } from '../stats/stats';

/** Slots, in drawing order for layered items. Skins are per alien (switching alien keeps each one's skin). */
export type Slot = 'skin' | 'charm' | 'buckle';
export const SLOTS: { id: Slot; name: string }[] = [
  { id: 'skin', name: 'Skin' },
  { id: 'charm', name: 'Gun charm' },
  { id: 'buckle', name: 'Belt buckle' },
];

/** How an item is earned. Everything is worked out from the gunslinger's stats, so it can't drift. */
export type Rule =
  | { kind: 'wins'; n: number }
  | { kind: 'rounds'; n: number }
  | { kind: 'streak'; n: number }
  | { kind: 'draw'; ms: number }
  | { kind: 'fastWin'; ms: number }
  | { kind: 'faceHits'; n: number }
  | { kind: 'gunWins'; gun: string; gunName: string; n: number }
  | { kind: 'hardWins'; n: number }
  | { kind: 'maps'; n: number };

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  /** Skins only: the alien it belongs to. */
  alien?: string;
  /** null = free from the start. */
  unlock: Rule | null;
}

/** The original look of each alien (always available). */
export const ORIGINAL = 'original';

/**
 * Every wearable item besides each alien's original look. Art arrives in stages; an item is listed only
 * once its pictures are in the game (src/render/art.ts). Ids never change once shipped (outfits store them).
 */
export const CATALOGUE: Item[] = [];

export const itemById = (id: string | null | undefined) => CATALOGUE.find((i) => i.id === id);

/** Items for a slot (skins: only the given alien's), original / none first. */
export function itemsFor(slot: Slot, alien: string): Item[] {
  return CATALOGUE.filter((i) => i.slot === slot && (slot !== 'skin' || i.alien === alien));
}

/** Progress towards a rule: have / need (for "7 / 10 wins"); smaller-is-better rules report met or not. */
export function progress(rule: Rule, s: Stats): { have: number; need: number; met: boolean } {
  const count = (have: number, need: number) => ({ have: Math.min(have, need), need, met: have >= need });
  switch (rule.kind) {
    case 'wins': return count(s.wins, rule.n);
    case 'rounds': return count(s.rounds, rule.n);
    case 'streak': return count(s.bestStreak, rule.n);
    case 'faceHits': return count(s.faceHits, rule.n);
    case 'gunWins': return count(s.byGun[rule.gun]?.wins ?? 0, rule.n);
    case 'hardWins': return count(s.byBot.hard?.wins ?? 0, rule.n);
    case 'maps': return count(Object.values(s.byMap).filter((t) => t.wins > 0).length, rule.n);
    case 'draw': return { have: 0, need: 1, met: s.fastestDrawMs != null && s.fastestDrawMs <= rule.ms };
    case 'fastWin': return { have: 0, need: 1, met: s.fastestWinMs != null && s.fastestWinMs <= rule.ms };
  }
}

export const isUnlocked = (item: Item, s: Stats) => !item.unlock || progress(item.unlock, s).met;

/** What to do to earn it, in plain words, with progress where it counts up. */
export function ruleText(rule: Rule, s?: Stats): string {
  const p = s ? progress(rule, s) : null;
  const of = (label: string) => (p && !p.met ? `${label} (${p.have} / ${p.need})` : label);
  switch (rule.kind) {
    case 'wins': return of(`Win ${rule.n} rounds`);
    case 'rounds': return of(`Play ${rule.n} rounds`);
    case 'streak': return of(`Win ${rule.n} in a row`);
    case 'faceHits': return of(`Land ${rule.n} face hits`);
    case 'gunWins': return of(`Win ${rule.n} rounds with the ${rule.gunName.toLowerCase()}`);
    case 'hardWins': return of(`Beat the Hard bot ${rule.n === 1 ? 'once' : `${rule.n} times`}`);
    case 'maps': return of(`Win on ${rule.n} different maps`);
    case 'draw': return `Draw in ${(rule.ms / 1000).toFixed(2)} s or faster`;
    case 'fastWin': return `Win within ${Math.round(rule.ms / 1000)} s of the DRAW`;
  }
}

/** Ids of items unlocked now that weren't before (for "New outfit unlocked!"). */
export function newlyUnlocked(before: Stats, after: Stats): Item[] {
  return CATALOGUE.filter((i) => i.unlock && !isUnlocked(i, before) && isUnlocked(i, after));
}

/** What a gunslinger has on. Skins by alien id; other slots hold an item id or null (nothing). */
export interface Outfit {
  skins: Record<string, string>;
  charm: string | null;
  buckle: string | null;
}

export const emptyOutfit = (): Outfit => ({ skins: {}, charm: null, buckle: null });

/** Cleans a stored outfit: unknown items are dropped (an item never vanishes from the catalogue, but be safe). */
export function cleanOutfit(raw: unknown): Outfit {
  const o = emptyOutfit();
  if (!raw || typeof raw !== 'object') return o;
  const r = raw as Record<string, unknown>;
  if (r.skins && typeof r.skins === 'object') {
    for (const [alien, id] of Object.entries(r.skins as Record<string, unknown>)) {
      if (typeof id === 'string' && id.length <= 64) o.skins[alien] = id;
    }
  }
  for (const slot of ['charm', 'buckle'] as const) {
    if (typeof r[slot] === 'string' && (r[slot] as string).length <= 64) o[slot] = r[slot] as string;
  }
  return o;
}

/** The skin to draw for an alien: the chosen one if it exists, else the original. */
export function skinOf(outfit: Outfit, alien: string): string {
  const id = outfit.skins[alien];
  return id && itemById(id)?.alien === alien ? id.split(':')[1] : ORIGINAL;
}

/** An equipped item for a non-skin slot, or null if none / unknown. */
export function wornItem(outfit: Outfit, slot: Exclude<Slot, 'skin'>): Item | null {
  const it = itemById(outfit[slot]);
  return it && it.slot === slot ? it : null;
}

/**
 * The bot's look for a round, from the round seed (like the map), so it never touches the bot's random
 * stream. Original about a third of the time; otherwise one of that alien's skins.
 */
export function botSkinForSeed(seed: number, alien: string): string {
  const skins = itemsFor('skin', alien);
  if (!skins.length) return ORIGINAL;
  const h = Math.imul((seed ^ 0x5bd1e995) >>> 0, 0x27d4eb2d) >>> 0;
  const pick = (h >>> 12) % (skins.length + Math.ceil(skins.length / 2));
  return pick < skins.length ? skins[pick].id.split(':')[1] : ORIGINAL;
}
