// Saved gunslingers (profiles): name, alien, gun, settings and paint colour, several per phone.
// Stored under one versioned localStorage key; the active profile's id is kept separately.
// The pre-v0.7 keys (settings and loadout) are never deleted: the first run copies them into
// "Player 1", and the active profile keeps them up to date so an older build still works.
import { CREATURES } from '../game/creatures';
import { DEFAULT_LOADOUT } from '../game/duel';
import type { Loadout } from '../game/types';
import { WEAPONS } from '../game/weapons';
import { cleanStats, emptyStats, type Stats } from '../stats/stats';
import { randomId } from '../telemetry/upload';
import { loadLoadout, saveLoadout } from './loadout';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings';

const STORAGE_KEY = 'high-moon-profiles';
const ACTIVE_KEY = 'high-moon-active-profile';
/** 1: v0.7.0 (no stats). 2: v0.7.2 adds all-time stats per gunslinger. */
export const PROFILES_VERSION = 2;
export const MAX_PROFILES = 8;
export const NAME_MAX = 20;

/** Paint colour ids for your shots (looks in PAINT_ART, src/render/art.ts). */
export const PAINTS = ['yellow', 'orange', 'red', 'pink', 'magenta'] as const;

export interface Profile {
  id: string;
  name: string;
  alien: string;
  gun: string;
  settings: Settings;
  paint: string;
  /** ISO date. */
  createdAt: string;
  /** Set on the profile made from the pre-v0.7 data: older round logs on this phone belong to it. */
  fromLegacy?: boolean;
  /** All-time totals (src/stats/stats.ts). */
  stats: Stats;
}

export interface ProfileStore {
  version: number;
  profiles: Profile[];
  /** The one-time stats fill from this phone's round logs has run (saved with the stats it added). */
  backfilled?: boolean;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full: changes still apply for this visit.
  }
}

export function cleanName(name: unknown, fallback: string): string {
  const s = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim() : '';
  return s || fallback;
}

/** Fills in anything missing or invalid, so a profile from any version (or an import) is safe to use. */
function cleanProfile(p: unknown, i: number): Profile | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const settings = { ...DEFAULT_SETTINGS };
  if (o.settings && typeof o.settings === 'object') {
    for (const [k, v] of Object.entries(o.settings)) {
      const key = k as keyof Settings;
      if (key in DEFAULT_SETTINGS && typeof v === typeof DEFAULT_SETTINGS[key]) (settings as Record<string, unknown>)[key] = v;
    }
  }
  return {
    id: typeof o.id === 'string' && o.id ? o.id.slice(0, 32) : randomId(),
    name: cleanName(o.name, `Player ${i + 1}`),
    alien: typeof o.alien === 'string' && CREATURES[o.alien] ? o.alien : DEFAULT_LOADOUT.creature,
    gun: typeof o.gun === 'string' && WEAPONS[o.gun] ? o.gun : DEFAULT_LOADOUT.weapon,
    settings,
    paint: typeof o.paint === 'string' && (PAINTS as readonly string[]).includes(o.paint) ? o.paint : 'yellow',
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    ...(o.fromLegacy === true ? { fromLegacy: true } : {}),
    // Version 1 had no stats: they start empty (the round-log backfill fills in what it can).
    stats: cleanStats(o.stats),
  };
}

/**
 * Brings stored data from any earlier version up to the current one. `null` (nothing stored yet)
 * becomes "Player 1" made from the pre-v0.7 settings and loadout.
 */
export function migrate(raw: unknown, legacy: () => { settings: Settings; loadout: Loadout }): ProfileStore {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as ProfileStore).profiles) ? (raw as ProfileStore).profiles : [];
  const seen = new Set<string>();
  const profiles = list
    .map(cleanProfile)
    .filter((p): p is Profile => !!p && !seen.has(p.id) && !!seen.add(p.id))
    .slice(0, MAX_PROFILES);
  if (profiles.length === 0) {
    const { settings, loadout } = legacy();
    profiles.push({
      id: randomId(), name: 'Player 1', alien: loadout.creature, gun: loadout.weapon,
      settings: { ...settings }, paint: 'yellow', createdAt: new Date().toISOString(), fromLegacy: true, stats: emptyStats(),
    });
  }
  const backfilled = !!raw && typeof raw === 'object' && (raw as ProfileStore).backfilled === true;
  return { version: PROFILES_VERSION, profiles, ...(backfilled ? { backfilled } : {}) };
}

export class Profiles {
  store: ProfileStore;
  activeId: string;

  constructor() {
    const raw = readJson(STORAGE_KEY);
    this.store = migrate(raw, () => ({ settings: loadSettings(), loadout: loadLoadout() }));
    const saved = readJson(ACTIVE_KEY);
    this.activeId = this.store.profiles.some((p) => p.id === saved) ? (saved as string) : this.store.profiles[0].id;
    this.save();
  }

  get list(): readonly Profile[] {
    return this.store.profiles;
  }

  get active(): Profile {
    return this.store.profiles.find((p) => p.id === this.activeId) ?? this.store.profiles[0];
  }

  loadout(p = this.active): Loadout {
    return { creature: p.alien, weapon: p.gun };
  }

  /** Saves everything, and mirrors the active profile into the pre-v0.7 keys. */
  save() {
    write(STORAGE_KEY, JSON.stringify(this.store));
    write(ACTIVE_KEY, JSON.stringify(this.activeId));
    saveSettings(this.active.settings);
    saveLoadout(this.loadout());
  }

  byId(id: string | undefined): Profile | undefined {
    return this.store.profiles.find((p) => p.id === id);
  }

  update(change: Partial<Omit<Profile, 'id' | 'createdAt'>>) {
    Object.assign(this.active, change);
    if (change.name != null) this.active.name = cleanName(change.name, this.active.name);
    this.save();
  }

  switchTo(id: string) {
    if (!this.store.profiles.some((p) => p.id === id)) return;
    this.activeId = id;
    this.save();
  }

  /** A new gunslinger with default settings and loadout; becomes the active one. Null when full. */
  create(name: string): Profile | null {
    if (this.store.profiles.length >= MAX_PROFILES) return null;
    const p: Profile = {
      id: randomId(), name: cleanName(name, this.nextName()),
      alien: DEFAULT_LOADOUT.creature, gun: DEFAULT_LOADOUT.weapon,
      settings: { ...DEFAULT_SETTINGS }, paint: 'yellow', createdAt: new Date().toISOString(), stats: emptyStats(),
    };
    this.store.profiles.push(p);
    this.activeId = p.id;
    this.save();
    return p;
  }

  /** Never deletes the last profile. */
  remove(id: string): boolean {
    if (this.store.profiles.length <= 1) return false;
    this.store.profiles = this.store.profiles.filter((p) => p.id !== id);
    if (this.activeId === id) this.activeId = this.store.profiles[0].id;
    this.save();
    return true;
  }

  nextName(): string {
    for (let i = 1; ; i++) if (!this.store.profiles.some((p) => p.name === `Player ${i}`)) return `Player ${i}`;
  }

  /** Backup code: all profiles as text a player can copy somewhere safe. */
  exportCode(): string {
    const json = JSON.stringify({ app: 'high-moon', version: this.store.version, profiles: this.store.profiles });
    return 'HIGHMOON1:' + btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  }

  /**
   * Reads a backup code. Profiles with the same id are replaced by the backup's copy; the rest are
   * added while there is room (up to 8). Returns how many were restored, or an error message.
   */
  importCode(code: string): { restored: number; skipped: number } | { error: string } {
    let data: unknown;
    try {
      const b64 = code.trim().replace(/^HIGHMOON1:/, '').replace(/\s+/g, '');
      data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    } catch {
      return { error: "That doesn't look like a High Moon backup code." };
    }
    if (!data || typeof data !== 'object' || !Array.isArray((data as ProfileStore).profiles) || !(data as ProfileStore).profiles.length) {
      return { error: "That doesn't look like a High Moon backup code." };
    }
    const incoming = migrate(data, () => ({ settings: { ...DEFAULT_SETTINGS }, loadout: { ...DEFAULT_LOADOUT } })).profiles;
    let restored = 0;
    let skipped = 0;
    for (const p of incoming) {
      const i = this.store.profiles.findIndex((q) => q.id === p.id);
      if (i >= 0) this.store.profiles[i] = p;
      else if (this.store.profiles.length < MAX_PROFILES) this.store.profiles.push(p);
      else {
        skipped++;
        continue;
      }
      restored++;
    }
    this.save();
    return { restored, skipped };
  }
}

/** Asks the browser to keep this site's data (fails soft; Safari may still clear it unless on the Home Screen). */
export async function persistStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
