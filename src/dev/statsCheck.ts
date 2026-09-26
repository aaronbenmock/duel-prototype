// Check for the stats maths (not part of the game build). Feeds sample rounds through
// src/stats/stats.ts and compares the totals with values worked out by hand.
// Run from the project folder:
//   npx vite build --ssr src/dev/statsCheck.ts --outDir <scratch>/statsbuild
//   node -e "import('file:///<scratch>/statsbuild/statsCheck.js').then((m) => m.check())"
// or in the browser console of the dev server:
//   (await import('/src/dev/statsCheck.ts')).check()
import { addRound, addRounds, avg, cleanStats, emptyStats, pct, RECENT_MAX, type RoundInput, winPct } from '../stats/stats';

let n = 0;
function round(result: string | null, o: Partial<RoundInput> & { draw?: number; fight?: number; shots?: number; hits?: number; face?: number } = {}): RoundInput {
  n++;
  const drawSignalMs = result === 'foul' ? null : 3000;
  return {
    id: 'r' + n,
    startedAt: `2026-09-26T10:${String(n).padStart(2, '0')}:00.000Z`,
    result,
    drawSignalMs,
    drawnMs: drawSignalMs == null ? null : drawSignalMs + (o.draw ?? 500),
    durationMs: drawSignalMs == null ? 2000 : drawSignalMs + (o.fight ?? 10000),
    loadout: { alien: 'desert-sage', gun: o.loadout?.gun ?? 'star-revolver' },
    opponent: { creature: o.opponent?.creature ?? 'desert-blue', bot: o.opponent?.bot ?? 'normal' },
    map: o.map ?? 'alien-frontier',
    stats: { shots: o.shots ?? 10, hits: o.hits ?? 5, faceHits: o.face ?? 1 },
  };
}

function eq(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) throw new Error(`${label}: got ${g}, expected ${w}`);
}

export function check() {
  n = 0;
  const s = emptyStats();
  // win, win, loss, win, foul, abandoned, win (oldest first); given out of order to test sorting.
  const rounds = [
    round('victory', { draw: 400, fight: 12000, shots: 12, hits: 6, face: 2 }),
    round('victory', { draw: 300, fight: 8000, loadout: { alien: 'desert-sage', gun: 'desert-raygun' }, map: 'saltflat-oasis' }),
    round('defeat', { draw: 700, fight: 15000, shots: 20, hits: 4, face: 0, opponent: { creature: 'desert-gold', bot: 'hard' } }),
    round('victory', { draw: 250, fight: 9000 }),
    round('foul', { shots: 0, hits: 0, face: 0 }),
    round('abandoned', { shots: 3, hits: 1, face: 0 }),
    round('victory', { draw: 350, fight: 7000, opponent: { creature: 'desert-violet', bot: 'easy' } }),
  ];
  addRounds(s, [...rounds].reverse());

  eq('rounds (abandoned not counted)', s.rounds, 6);
  eq('wins / losses / fouls / left', [s.wins, s.losses, s.fouls, s.left], [4, 1, 1, 1]);
  eq('win %', winPct(s), 67);
  eq('current streak (win after the foul)', s.streak, 1);
  eq('best streak', s.bestStreak, 2);
  eq('shots / hits / face (abandoned excluded)', [s.shots, s.hits, s.faceHits], [12 + 10 + 20 + 10 + 0 + 10, 6 + 5 + 4 + 5 + 0 + 5, 2 + 1 + 0 + 1 + 0 + 1]);
  eq('accuracy %', pct(s.hits, s.shots), 40);
  eq('draws timed (foul excluded)', s.draws, 5);
  eq('average draw ms', avg(s.drawMsSum, s.draws), (400 + 300 + 700 + 250 + 350) / 5);
  eq('fastest draw ms', s.fastestDrawMs, 250);
  eq('wins timed', s.timedWins, 4);
  eq('average win ms', avg(s.winMsSum, s.timedWins), (12000 + 8000 + 9000 + 7000) / 4);
  eq('fastest win ms', s.fastestWinMs, 7000);
  eq('by gun', s.byGun, {
    'star-revolver': { rounds: 5, wins: 3, losses: 1, fouls: 1 },
    'desert-raygun': { rounds: 1, wins: 1, losses: 0, fouls: 0 },
  });
  eq('by opponent', Object.keys(s.byOpponent).sort(), ['desert-blue', 'desert-gold', 'desert-violet']);
  eq('by bot', [s.byBot.normal.rounds, s.byBot.hard.losses, s.byBot.easy.wins], [4, 1, 1]);
  eq('by map', s.byMap['saltflat-oasis'], { rounds: 1, wins: 1, losses: 0, fouls: 0 });
  eq('recent, newest first', s.recent.map((r) => r.r), ['win', 'foul', 'win', 'loss', 'win', 'win']);
  eq('recent fight time', s.recent[0].ms, 7000);
  eq('foul has no fight time', s.recent[1].ms, null);

  // Records: first values aren't records; beating them is.
  const t = emptyStats();
  eq('first win: no records', addRound(t, round('victory', { draw: 500, fight: 10000 })), { fastestDraw: false, fastestWin: false, bestStreak: false });
  eq('faster draw and win, streak 2', addRound(t, round('victory', { draw: 400, fight: 9000 })), { fastestDraw: true, fastestWin: true, bestStreak: true });
  eq('slower draw and win; streak 3 is a record', addRound(t, round('victory', { draw: 600, fight: 11000 })), { fastestDraw: false, fastestWin: false, bestStreak: true });
  addRound(t, round('defeat'));
  eq('streak after a loss', [t.streak, t.bestStreak], [0, 3]);
  eq('streak 1 after loss is not a record', addRound(t, round('victory', { draw: 700 })).bestStreak, false);

  // Recent list is capped.
  const u = emptyStats();
  for (let i = 0; i < 15; i++) addRound(u, round('defeat'));
  eq('recent capped', u.recent.length, RECENT_MAX);

  // Cleaning: stored data survives a round trip; junk becomes empty.
  eq('clean round trip', cleanStats(JSON.parse(JSON.stringify(s))), s);
  eq('clean junk', cleanStats({ wins: -3, rounds: 'x', byGun: 5, recent: [{ r: 'nope' }] }), emptyStats());
  eq('clean null', cleanStats(null), emptyStats());

  const msg = 'stats check: all passed';
  console.log(msg);
  return msg;
}
