// Test logs: one record per round with everything needed to diagnose feel and tracking
// problems later (settings, loadout, game events, raw aim samples, errors). Saved on the
// phone and, when an upload key is set, sent to the private logs repo.
import type { DuelState, Effect } from '../game/types';

export interface RoundLog {
  v: 1;
  id: string;
  app: string;
  /** Random id for this phone (made once, kept in storage). */
  device: string;
  /** Tester's own label for this phone (Settings > Test logs). */
  label: string;
  startedAt: string;
  ua: string;
  screen: { w: number; h: number; dpr: number; homeScreen: boolean };
  settings: Record<string, unknown>;
  /** Random seed of the round, so the bot's choices can be replayed. */
  seed: number;
  loadout: { alien: string; gun: string };
  opponent: { creature: string; gun: string; bot: string };
  /** 'abandoned' if the page was closed mid-round. */
  result: string | null;
  durationMs: number;
  /** ms from round start to DRAW and to the player's draw. */
  drawSignalMs: number | null;
  drawnMs: number | null;
  stats: {
    playerHp: number; botHp: number; shots: number; hits: number; faceHits: number;
    botShots: number; botHits: number; reloads: number; sensorHz: number; spikes: number; pauses: number;
  };
  /** Set by "Something felt off" on the results screen. */
  flag: { note: string; at: string } | null;
  /** [ms since round start, event, ...details] */
  events: (string | number | null)[][];
  aimCols: string;
  /** One CSV row per sensor update while aiming (see aimCols); F rows are taps. */
  aim: string[];
  errors: string[];
}

/** botX: bot's sideways position (m); botMode: p planted, w walking, d dashing. */
export const AIM_COLS = 'ms,alpha,beta,gamma,rawX,rawY,x,y,flag,tilt,stepX,botX,botMode';
/** Aim rows kept per round: about 100 s at 60 updates a second. */
const AIM_MAX = 6000;
const r2 = (v: number) => Math.round(v * 100) / 100;

function effectEvent(e: Effect): (string | number | null)[] {
  switch (e.type) {
    case 'shot':
      // Details: zone, where it went (x, y), damage, last round?, recoil kick at the shot (x, y), fired settled?
      // ...and the spread radius (spread guns).
      return ['shot', e.zone, r2(e.aim.x), r2(e.aim.y), e.damage, e.last ? 'last' : null, r2(e.recoil.x), r2(e.recoil.y), e.settled ? 1 : 0, r2(e.spread)];
    case 'botShot':
      return ['botShot', e.zone];
    case 'reloadStart':
      return ['reloadStart', e.missing];
    case 'empty':
      return ['empty', e.reason];
    case 'boltHit':
      return ['boltHit', e.zone, r2(e.aim.x), r2(e.aim.y), e.damage];
    default:
      return [e.type];
  }
}

/** Collects one round's log while it is played. */
export class RoundRecorder {
  log: RoundLog | null = null;
  private t0 = 0;

  start(t0: number, base: Omit<RoundLog, 'result' | 'durationMs' | 'drawSignalMs' | 'drawnMs' | 'stats' | 'flag' | 'events' | 'aimCols' | 'aim' | 'errors'>) {
    this.t0 = t0;
    this.log = {
      ...base, result: null, durationMs: 0, drawSignalMs: null, drawnMs: null,
      stats: { playerHp: 0, botHp: 0, shots: 0, hits: 0, faceHits: 0, botShots: 0, botHits: 0, reloads: 0, sensorHz: 0, spikes: 0, pauses: 0 },
      flag: null, events: [], aimCols: AIM_COLS, aim: [], errors: [],
    };
  }

  ms(t: number) {
    return Math.round(t - this.t0);
  }

  event(t: number, ...details: (string | number | null)[]) {
    this.log?.events.push([this.ms(t), ...details]);
  }

  effects(t: number, fx: Effect[]) {
    for (const e of fx) this.event(t, ...effectEvent(e));
  }

  aimRow(row: string) {
    if (this.log && this.log.aim.length < AIM_MAX) this.log.aim.push(row);
  }

  error(msg: string) {
    this.log?.errors.push(msg.slice(0, 500));
  }

  /** Fills in the totals; returns the finished log (or null if no round was running). */
  finish(s: DuelState, now: number, extra: { sensorHz: number; spikes: number; pauses: number }): RoundLog | null {
    const log = this.log;
    if (!log) return null;
    this.log = null;
    log.result = s.result ?? 'abandoned';
    log.durationMs = this.ms(s.endedAt ?? now);
    log.drawSignalMs = s.drawSignalAt != null && s.phase !== 'holster' && s.phase !== 'ready' ? this.ms(s.drawSignalAt) : null;
    log.drawnMs = s.drawnAt != null ? this.ms(s.drawnAt) : null;
    log.stats = {
      playerHp: s.player.hp, botHp: s.bot.hp, shots: s.player.shots, hits: s.player.hits, faceHits: s.player.headshots,
      botShots: s.bot.shots, botHits: s.bot.hits, reloads: log.events.filter((e) => e[1] === 'reloadStart' || e[1] === 'ventStart').length, ...extra,
    };
    return log;
  }
}

/** The file name used in the logs repo and for shared files. */
export function logFileName(log: RoundLog): string {
  const time = log.startedAt.slice(11, 19).replace(/:/g, '');
  return `${time}-${log.result ?? 'round'}-${log.id.slice(0, 4)}.json`;
}
