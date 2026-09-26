// Wanted Poster tab: the active gunslinger's all-time record (HTML for StartView.setPoster).
import { alienName } from '../game/creatures';
import { MAP_NAMES } from '../game/maps';
import { WEAPONS } from '../game/weapons';
import type { Profile } from '../settings/profiles';
import { avg, pct, type Stats, type Tally, winPct } from '../stats/stats';
import { skinOf } from '../wardrobe/wardrobe';
import { creatureUrl } from './art';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const secs = (ms: number | null, digits: number) => (ms == null ? '&ndash;' : `${(ms / 1000).toFixed(digits)} s`);
const percent = (v: number | null) => (v == null ? '&ndash;' : `${v}%`);
const BOT_NAMES: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const OUTCOME_LABEL = { win: 'W', loss: 'L', foul: 'F' } as const;

function table(title: string, rows: Record<string, Tally>, name: (id: string) => string): string {
  const list = Object.entries(rows).sort((a, b) => b[1].rounds - a[1].rounds);
  if (!list.length) return '';
  return `
    <div class="panel"><h2>${title}</h2>
      <table class="stat-table">
        <thead><tr><th></th><th>W</th><th>L</th><th>F</th><th>Win</th></tr></thead>
        <tbody>${list.map(([id, t]) => `
          <tr><td>${esc(name(id))}</td><td>${t.wins}</td><td>${t.losses}</td><td>${t.fouls}</td><td>${percent(winPct(t))}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

export function posterHtml(p: Profile): string {
  const s: Stats = p.stats;
  if (s.rounds === 0 && s.left === 0) {
    return `<div class="panel poster-empty"><p>Play a round to start your record.</p></div>`;
  }
  const numbers: [string, string][] = [
    ['Win rate', percent(winPct(s))],
    ['Win streak', `${s.streak} <small>best ${s.bestStreak}</small>`],
    ['Accuracy', percent(pct(s.hits, s.shots))],
    ['Hits on the face', percent(pct(s.faceHits, s.hits))],
    ['Average draw', secs(avg(s.drawMsSum, s.draws), 2)],
    ['Fastest draw', secs(s.fastestDrawMs, 2)],
    ['Average win', secs(avg(s.winMsSum, s.timedWins), 1)],
    ['Fastest win', secs(s.fastestWinMs, 1)],
  ];
  const recent = s.recent.length
    ? `
    <div class="panel"><h2>Last ${s.recent.length}</h2>
      <ol class="recent">${s.recent.map((r) => `
        <li><b class="res ${r.r}">${OUTCOME_LABEL[r.r]}</b><span>vs ${esc(alienName(r.opp))} &middot; ${esc(WEAPONS[r.gun]?.name ?? r.gun)} &middot; ${esc(MAP_NAMES[r.map] ?? r.map)}</span><span class="t">${r.r === 'foul' ? 'foul' : secs(r.ms, 1)}</span></li>`).join('')}
      </ol>
    </div>`
    : '';
  return `
    <div class="poster">
      <div class="poster-head">WANTED</div>
      <div class="poster-sub">for painting aliens</div>
      <span class="poster-face"><img src="${creatureUrl(p.alien, skinOf(p.outfit, p.alien))}" alt=""></span>
      <div class="poster-name">${esc(p.name)}</div>
      <div class="poster-record">${s.wins} W &middot; ${s.losses} L &middot; ${s.fouls} F</div>
      <div class="poster-small">${s.rounds} round${s.rounds === 1 ? '' : 's'}${s.left ? ` &middot; ${s.left} left early` : ''}</div>
      <div class="poster-grid">${numbers.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    </div>
    ${recent}
    ${table('By gun', s.byGun, (id) => WEAPONS[id]?.name ?? id)}
    ${table('By opponent', s.byOpponent, alienName)}
    ${table('By map', s.byMap, (id) => MAP_NAMES[id] ?? id)}
    ${table('By bot difficulty', s.byBot, (id) => BOT_NAMES[id] ?? id)}
    <p class="help poster-note">Draw = DRAW sound to gun up. Win time = DRAW sound to the opponent covered in paint. Fouls count as rounds not won. Rounds from before v0.7.2 come from the logs still on this phone (its last 30 or so).</p>`;
}
