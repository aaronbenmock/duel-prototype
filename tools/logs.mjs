// Pulls the private test-log repo and summarizes rounds (for Claude, on the PC).
//
//   node tools/logs.mjs                 pull, then list today's and yesterday's rounds
//   node tools/logs.mjs --days 7        list the last 7 days
//   node tools/logs.mjs --flagged       only rounds marked "Something felt off"
//   node tools/logs.mjs --show <file>   one round in detail: events, then aim rows as CSV
//
// The logs repo is cloned next to this app: ../high-moon-logs (git-ignored, private).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_DIR = resolve(import.meta.dirname, '../../high-moon-logs');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] ?? true : null;
};

if (!existsSync(REPO_DIR)) {
  execFileSync('gh', ['repo', 'clone', 'aaronbenmock/high-moon-logs', REPO_DIR], { stdio: 'inherit' });
} else if (!opt('--no-pull')) {
  execFileSync('git', ['-C', REPO_DIR, 'pull', '--quiet', '--ff-only'], { stdio: 'inherit' });
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
  });
}

const show = opt('--show');
if (show) {
  const file = existsSync(show) ? show : walk(join(REPO_DIR, 'logs')).find((f) => f.endsWith(show));
  if (!file) throw new Error('No log matching ' + show);
  const log = JSON.parse(readFileSync(file, 'utf8'));
  const { events, aim, aimCols, ...meta } = log;
  console.log(JSON.stringify(meta, null, 1));
  console.log('\n# events (ms since round start)');
  for (const e of events) console.log(e.join(' '));
  console.log('\n# aim (flags: C re-centering, P paused/lowered, S glitch ignored, F tap)');
  console.log(aimCols);
  console.log(aim.join('\n'));
  process.exit(0);
}

const days = Number(opt('--days') ?? 2);
const since = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);
const logs = walk(join(REPO_DIR, 'logs'))
  .filter((f) => f.replace(/\\/g, '/').split('/logs/')[1] >= since)
  .map((f) => ({ f, log: JSON.parse(readFileSync(f, 'utf8')) }))
  .filter(({ log }) => !opt('--flagged') || log.flag)
  .sort((a, b) => a.log.startedAt.localeCompare(b.log.startedAt));

const pad = (s, n) => String(s ?? '').padEnd(n);
console.log(`${logs.length} round(s) since ${since}\n`);
console.log([pad('started (UTC)', 20), pad('phone', 14), pad('app', 7), pad('alien/gun', 28), pad('vs', 22), pad('result', 10), pad('secs', 6), pad('shots/hits', 11), pad('reloads', 8), pad('you/bot hp', 11), pad('Hz', 4), 'notes'].join(''));
for (const { f, log } of logs) {
  const s = log.stats;
  const reloadSources = log.events.filter((e) => e[1] === 'reload').map((e) => e[2]).filter(Boolean);
  const notes = [
    log.flag ? `FLAG: ${log.flag.note || '(no note)'}` : '',
    log.errors.length ? `${log.errors.length} error(s)` : '',
    s.spikes ? `${s.spikes} glitches` : '',
    reloadSources.length ? `reload by ${[...new Set(reloadSources)].join('/')}` : '',
  ].filter(Boolean).join('; ');
  console.log([
    pad(log.startedAt.slice(0, 19).replace('T', ' '), 20), pad(log.label || log.device, 14), pad(log.app, 7),
    pad(`${log.loadout.alien}/${log.loadout.gun}`, 28), pad(`${log.opponent.creature} ${log.opponent.bot}`, 22),
    pad(log.result, 10), pad((log.durationMs / 1000).toFixed(1), 6), pad(`${s.shots}/${s.hits}`, 11), pad(s.reloads, 8),
    pad(`${s.playerHp}/${s.botHp}`, 11), pad(s.sensorHz, 4), notes,
  ].join(''));
  if (opt('--paths')) console.log('   ' + f);
}
