// Round logs saved on the phone (IndexedDB: much more room than localStorage), plus
// the upload queue state for each. Every call fails soft: logging must never break a duel.
import type { RoundLog } from './roundLog';

export interface StoredRound {
  id: string;
  log: RoundLog;
  /** Path in the logs repo once uploaded, and the file version GitHub returned (needed to update it). */
  path: string | null;
  sha: string | null;
  /** True when the phone has changes GitHub doesn't have yet (new round, or a flag added later). */
  dirty: boolean;
}

/** Rounds kept on the phone. Uploaded ones beyond this are dropped oldest first. */
const KEEP = 30;
/** Hard cap even for rounds that never uploaded. */
const KEEP_MAX = 80;

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('high-moon-logs', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('rounds', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = d.transaction('rounds', mode);
        const req = fn(tx.objectStore('rounds'));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export async function putRound(r: StoredRound): Promise<void> {
  try {
    await run('readwrite', (s) => s.put(r));
    await prune();
  } catch {
    // Storage blocked (private mode) or full: the round still uploads from memory if it can.
  }
}

export async function allRounds(): Promise<StoredRound[]> {
  try {
    const rows = (await run<StoredRound[]>('readonly', (s) => s.getAll())) ?? [];
    return rows.sort((a, b) => a.log.startedAt.localeCompare(b.log.startedAt));
  } catch {
    return [];
  }
}

async function prune() {
  const rows = await allRounds();
  const extra = rows.length - KEEP;
  if (extra <= 0) return;
  const drop = rows.filter((r) => !r.dirty).slice(0, extra);
  // If uploads have been failing for a long time, drop the oldest anyway.
  const over = rows.length - drop.length - KEEP_MAX;
  if (over > 0) drop.push(...rows.filter((r) => r.dirty).slice(0, over));
  await run('readwrite', (s) => {
    for (const r of drop) s.delete(r.id);
  });
}
