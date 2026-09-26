// All-time stats for a gunslinger: pure maths, no DOM or storage (checked by src/dev/statsCheck.ts).
// Totals live in the profile and are updated when each round ends; they don't depend on the round
// logs, which the phone trims. Older rounds are added once from the logs still on the phone (backfill).

/** The parts of a round log the stats need (a RoundLog fits this shape). */
export interface RoundInput {
  id: string;
  startedAt: string;
  /** 'victory' | 'defeat' | 'foul' | 'abandoned' (or null for an unfinished log). */
  result: string | null;
  durationMs: number;
  drawSignalMs: number | null;
  drawnMs: number | null;
  loadout: { alien: string; gun: string };
  opponent: { creature: string; bot: string };
  map?: string;
  stats: { shots: number; hits: number; faceHits: number };
}

export type Outcome = 'win' | 'loss' | 'foul';

/** Rounds and outcomes for one row of a breakdown table. */
export interface Tally {
  rounds: number;
  wins: number;
  losses: number;
  fouls: number;
}

export interface RecentRound {
  r: Outcome;
  /** ISO date the round started. */
  at: string;
  gun: string;
  opp: string;
  map: string;
  /** DRAW to the win or loss (ms); null for a foul. */
  ms: number | null;
}

export interface Stats extends Tally {
  /** Rounds closed mid-duel (not a win or loss). */
  left: number;
  streak: number;
  bestStreak: number;
  shots: number;
  hits: number;
  faceHits: number;
  /** Draws timed (DRAW sound to gun up); fouls have none. */
  draws: number;
  drawMsSum: number;
  fastestDrawMs: number | null;
  /** Wins timed from the DRAW sound. */
  timedWins: number;
  winMsSum: number;
  fastestWinMs: number | null;
  byGun: Record<string, Tally>;
  byOpponent: Record<string, Tally>;
  byMap: Record<string, Tally>;
  byBot: Record<string, Tally>;
  /** Newest first, at most RECENT_MAX. */
  recent: RecentRound[];
}

export const RECENT_MAX = 10;

export function emptyStats(): Stats {
  return {
    rounds: 0, wins: 0, losses: 0, fouls: 0, left: 0, streak: 0, bestStreak: 0,
    shots: 0, hits: 0, faceHits: 0, draws: 0, drawMsSum: 0, fastestDrawMs: null,
    timedWins: 0, winMsSum: 0, fastestWinMs: null,
    byGun: {}, byOpponent: {}, byMap: {}, byBot: {}, recent: [],
  };
}

const OUTCOME: Record<string, Outcome> = { victory: 'win', defeat: 'loss', foul: 'foul' };

/** What a finished round adds to the record, or null if it wasn't finished (closed mid-duel). */
export function outcomeOf(round: RoundInput): Outcome | null {
  return OUTCOME[round.result ?? ''] ?? null;
}

/** New records set by a round (for "Fastest draw yet!" and friends). */
export interface Records {
  fastestDraw: boolean;
  fastestWin: boolean;
  bestStreak: boolean;
}

function tally(map: Record<string, Tally>, key: string, o: Outcome) {
  const t = (map[key] ??= { rounds: 0, wins: 0, losses: 0, fouls: 0 });
  t.rounds++;
  if (o === 'win') t.wins++;
  else if (o === 'loss') t.losses++;
  else t.fouls++;
}

/**
 * Adds one round to the totals (changes `s` in place) and returns the records it broke.
 * A round closed mid-duel only counts as "left"; it doesn't touch the win streak.
 * A new record needs an earlier value to beat, so the very first draw or win isn't called a record.
 */
export function addRound(s: Stats, round: RoundInput): Records {
  const rec: Records = { fastestDraw: false, fastestWin: false, bestStreak: false };
  const o = outcomeOf(round);
  if (!o) {
    s.left++;
    return rec;
  }
  s.rounds++;
  if (o === 'win') s.wins++;
  else if (o === 'loss') s.losses++;
  else s.fouls++;

  if (o === 'win') {
    s.streak++;
    if (s.streak > s.bestStreak) {
      rec.bestStreak = s.bestStreak > 0;
      s.bestStreak = s.streak;
    }
  } else {
    s.streak = 0;
  }

  s.shots += round.stats.shots;
  s.hits += round.stats.hits;
  s.faceHits += round.stats.faceHits;

  // Draw time: DRAW sound to gun up (fouls have no draw).
  if (o !== 'foul' && round.drawSignalMs != null && round.drawnMs != null && round.drawnMs >= round.drawSignalMs) {
    const d = round.drawnMs - round.drawSignalMs;
    s.draws++;
    s.drawMsSum += d;
    if (s.fastestDrawMs == null || d < s.fastestDrawMs) {
      rec.fastestDraw = s.fastestDrawMs != null;
      s.fastestDrawMs = d;
    }
  }

  // Time to win: DRAW sound to the opponent covered in paint.
  const fightMs = o !== 'foul' && round.drawSignalMs != null ? Math.max(0, round.durationMs - round.drawSignalMs) : null;
  if (o === 'win' && fightMs != null) {
    s.timedWins++;
    s.winMsSum += fightMs;
    if (s.fastestWinMs == null || fightMs < s.fastestWinMs) {
      rec.fastestWin = s.fastestWinMs != null;
      s.fastestWinMs = fightMs;
    }
  }

  tally(s.byGun, round.loadout.gun, o);
  tally(s.byOpponent, round.opponent.creature, o);
  tally(s.byMap, round.map ?? 'unknown', o);
  tally(s.byBot, round.opponent.bot, o);
  s.recent.unshift({ r: o, at: round.startedAt, gun: round.loadout.gun, opp: round.opponent.creature, map: round.map ?? 'unknown', ms: fightMs });
  s.recent.length = Math.min(s.recent.length, RECENT_MAX);
  return rec;
}

/** Adds many rounds, oldest first (the order matters for streaks and the recent list). */
export function addRounds(s: Stats, rounds: RoundInput[]) {
  for (const r of [...rounds].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) addRound(s, r);
}

/** Share as a whole percent, or null with nothing to divide by. */
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
/** Win share of rounds that were won or lost (fouls count as losses here: you lost the round). */
export const winPct = (t: Tally) => pct(t.wins, t.rounds);
export const avg = (sum: number, n: number) => (n > 0 ? sum / n : null);

/** Cleans stats read from storage or a backup: anything missing or wrong becomes empty. */
export function cleanStats(raw: unknown): Stats {
  const s = emptyStats();
  if (!raw || typeof raw !== 'object') return s;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  for (const k of ['rounds', 'wins', 'losses', 'fouls', 'left', 'streak', 'bestStreak', 'shots', 'hits', 'faceHits', 'draws', 'drawMsSum', 'timedWins', 'winMsSum'] as const) {
    s[k] = num(o[k]) ?? 0;
  }
  s.fastestDrawMs = num(o.fastestDrawMs);
  s.fastestWinMs = num(o.fastestWinMs);
  for (const k of ['byGun', 'byOpponent', 'byMap', 'byBot'] as const) {
    const m = o[k];
    if (!m || typeof m !== 'object') continue;
    for (const [key, t] of Object.entries(m as Record<string, unknown>)) {
      if (!t || typeof t !== 'object') continue;
      const v = t as Record<string, unknown>;
      s[k][key] = { rounds: num(v.rounds) ?? 0, wins: num(v.wins) ?? 0, losses: num(v.losses) ?? 0, fouls: num(v.fouls) ?? 0 };
    }
  }
  if (Array.isArray(o.recent)) {
    s.recent = o.recent
      .filter((r): r is RecentRound => !!r && typeof r === 'object' && ['win', 'loss', 'foul'].includes((r as RecentRound).r))
      .slice(0, RECENT_MAX)
      .map((r) => ({ r: r.r, at: String(r.at ?? ''), gun: String(r.gun ?? ''), opp: String(r.opp ?? ''), map: String(r.map ?? ''), ms: num(r.ms) }));
  }
  return s;
}
