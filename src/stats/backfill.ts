// One-time fill of the stats from the round logs already on this phone (rounds played before
// v0.7.2, when totals started being kept as each round ends). The phone keeps its last 30 to 80
// rounds, so older ones can't be recovered.
import type { Profile, Profiles } from '../settings/profiles';
import { allRounds } from '../telemetry/store';
import { addRounds, type RoundInput } from './stats';

/** From this version on, each round is added to the totals when it ends. */
const LIVE_FROM = [0, 7, 2];

/** True if the app version counted its rounds live (so the backfill must skip them). */
export function countedLive(app: string): boolean {
  const v = app.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((v[i] ?? 0) !== LIVE_FROM[i]) return (v[i] ?? 0) > LIVE_FROM[i];
  return true;
}

/**
 * Adds the older logs to the gunslinger who played them: a log from v0.7.0 or v0.7.1 names its
 * gunslinger; an older one belongs to "Player 1" (the profile made from the pre-v0.7 data).
 * Runs once per phone; returns how many rounds were added.
 */
export async function backfillStats(profiles: Profiles): Promise<number> {
  if (profiles.store.backfilled) return 0;
  const rows = await allRounds();
  // Nothing readable yet (no logs, or storage blocked): try again next time.
  if (!rows.length) return 0;
  const legacy = profiles.list.find((p) => p.fromLegacy);
  const groups = new Map<Profile, RoundInput[]>();
  for (const { log } of rows) {
    if (countedLive(log.app)) continue;
    const owner = log.profile ? profiles.byId(log.profile.id) : legacy;
    if (!owner) continue;
    if (!groups.has(owner)) groups.set(owner, []);
    groups.get(owner)!.push(log);
  }
  let added = 0;
  for (const [p, logs] of groups) {
    addRounds(p.stats, logs);
    added += logs.length;
  }
  // Marked done in the same save as the stats it added, so it can't run twice.
  profiles.store.backfilled = true;
  profiles.save();
  return added;
}
