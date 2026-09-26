// Player-adjustable settings, saved on the device, and how they map onto
// the aim, gesture and bot configs.
import { DEFAULT_CONFIG } from '../game/duel';
import type { BotConfig, DuelConfig } from '../game/types';
import type { AimConfig } from '../input/aim';
import { DEFAULT_GESTURES, type GestureConfig } from '../input/gestures';

export const APP_VERSION = '0.6.10';
const STORAGE_KEY = 'duel-settings-v1';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface Settings {
  /** Crosshair movement per degree of turn (1 = one degree moves one degree). */
  aimSensX: number;
  aimSensY: number;
  /** 0 = raw sensor, 10 = heaviest smoothing. */
  smoothing: number;
  /** How far back (ms) to take the aim when you tap, to cancel thumb jolt. */
  lookbackMs: number;
  /** 1 to 10. Higher = easier to trigger. */
  holsterSens: number;
  drawSens: number;
  reloadSens: number;
  bot: BotDifficulty;
  sound: boolean;
  /** Show the detection readout at the top of the duel screen. */
  showReadout: boolean;
  /** Tilt the phone sideways to sidestep. */
  tiltMove: boolean;
  /** Draw the opponent's hit areas on screen (testing aid). */
  showHitZones: boolean;
  /** Show an on-screen Reload button as a backup to the dip/flick. */
  showReloadButton: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  aimSensX: 1,
  aimSensY: 1,
  smoothing: 2,
  lookbackMs: 30,
  holsterSens: 5,
  drawSens: 5,
  reloadSens: 5,
  bot: 'normal',
  sound: true,
  showReadout: true,
  tiltMove: true,
  showHitZones: false,
  showReloadButton: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Storage blocked or corrupt: fall back to defaults.
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode or storage full: settings still apply for this visit.
  }
}

export function aimConfig(s: Settings): AimConfig {
  return {
    sensX: s.aimSensX,
    sensY: s.aimSensY,
    // Smoothing 0 -> 10 Hz cutoff (almost raw), 2 -> 3.3 Hz (default), 10 -> 0.9 Hz (heavy).
    minCutoff: 10 / (1 + s.smoothing),
    beta: 0.1,
  };
}

export function gestureConfig(s: Settings): GestureConfig {
  const holsterDown = 0.9 - 0.04 * s.holsterSens; // 5 -> 0.70
  return {
    ...DEFAULT_GESTURES,
    holsterDown,
    unholsterDown: holsterDown - 0.3, // 5 -> 0.40
    holsterHoldMs: 700 - 60 * s.holsterSens, // 5 -> 400 ms
    aimUpright: 0.65 - 0.05 * s.drawSens, // 5 -> 0.40
    aimMaxTilt: 15 + 5 * s.drawSens, // 5 -> 40 degrees
    reloadAccel: 20 - 2 * s.reloadSens, // 5 -> 10 m/s^2
  };
}

const BOTS: Record<BotDifficulty, BotConfig> = {
  // Simulated (src/dev/sim.ts, v0.6.5), typical player with the star revolver:
  //   bot's time to paint out a player who never fires back: easy 30 s, normal 16 s, hard 12 s;
  //   player's time to win against the moving bot: easy 14 s, normal 15 s, hard 19 s
  //   (v0.6.4 was about 13.5 s at every level: the old bot barely moved).
  // Movement: strafe, dash, juke, plant to shoot; 1 m is about 5 degrees of aim at 12 m.
  easy: {
    firstShotMin: 1.5, firstShotMax: 3, intervalMin: 0.9, intervalMax: 1.4, hitChance: 0.75, headshotShare: 0.03, reloadTime: 2.2,
    movingHitFactor: 0.6, dashHitFactor: 0.4, moveRange: 1.5, walkSpeed: 0.9, dashChance: 0.15, dashSpeed: 2.8, dashDistMin: 0.6, dashDistMax: 1.1,
    jukeChance: 0.15, plantMin: 0.9, plantMax: 2.0, plantShotDelay: 0.45, reactMs: 1000, reactChance: 0,
  },
  normal: DEFAULT_CONFIG.bot,
  hard: {
    firstShotMin: 1, firstShotMax: 2, intervalMin: 0.45, intervalMax: 0.7, hitChance: 0.95, headshotShare: 0.03, reloadTime: 1.2,
    movingHitFactor: 0.7, dashHitFactor: 0.45, moveRange: 3.0, walkSpeed: 1.9, dashChance: 0.55, dashSpeed: 4.6, dashDistMin: 1.2, dashDistMax: 2.0,
    jukeChance: 0.4, plantMin: 0.3, plantMax: 0.8, plantShotDelay: 0.2, reactMs: 450, reactChance: 0.7,
  },
};

export { BOTS };

export function duelConfig(s: Settings): DuelConfig {
  return { ...DEFAULT_CONFIG, bot: BOTS[s.bot] };
}

/** Plain-text summary to paste back to Claude. */
export function settingsText(s: Settings): string {
  const lines = Object.entries(s).map(([k, v]) => `${k}=${v}`);
  return [`Duel settings (app ${APP_VERSION})`, ...lines, `device=${navigator.userAgent}`].join('\n');
}
