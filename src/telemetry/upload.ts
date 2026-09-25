// Sends saved round logs to the private GitHub repo that Claude reads.
// The upload key lives only in this phone's storage (never in the code, the
// settings text or the logs), and the key only has access to that one repo.
import { logFileName, type RoundLog } from './roundLog';
import { allRounds, putRound, type StoredRound } from './store';

export const LOG_REPO = 'aaronbenmock/high-moon-logs';
const API = 'https://api.github.com/repos/' + LOG_REPO;
const KEY_STORAGE = 'high-moon-log-key';
const LABEL_STORAGE = 'high-moon-log-label';
const DEVICE_STORAGE = 'high-moon-device';

function readLocal(k: string): string {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
}

function writeLocal(k: string, v: string) {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    // Storage blocked: works for this visit only.
  }
}

export function randomId(): string {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function deviceId(): string {
  let id = readLocal(DEVICE_STORAGE);
  if (!id) {
    id = randomId().slice(0, 8);
    writeLocal(DEVICE_STORAGE, id);
  }
  return id;
}

export const getKey = () => readLocal(KEY_STORAGE);
export const setKey = (k: string) => writeLocal(KEY_STORAGE, k.trim());
export const getLabel = () => readLocal(LABEL_STORAGE);
export const setLabel = (l: string) => writeLocal(LABEL_STORAGE, l.trim().slice(0, 24));

/** Folder-safe version of a label. */
const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'phone';

function repoPath(log: RoundLog): string {
  return `logs/${log.startedAt.slice(0, 10)}/${safe(log.label || log.device)}/${logFileName(log)}`;
}

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function headers(key: string): HeadersInit {
  return { Authorization: `Bearer ${key}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}

export type KeyCheck = 'ok' | 'none' | 'rejected' | 'offline';

/** Does the saved key work for the logs repo? */
export async function checkKey(): Promise<KeyCheck> {
  const key = getKey();
  if (!key) return 'none';
  try {
    const res = await fetch(API, { headers: headers(key) });
    return res.ok ? 'ok' : 'rejected';
  } catch {
    return 'offline';
  }
}

async function currentSha(key: string, path: string): Promise<string | null> {
  const res = await fetch(`${API}/contents/${path}`, { headers: headers(key) });
  if (!res.ok) return null;
  return ((await res.json()) as { sha?: string }).sha ?? null;
}

async function uploadOne(key: string, r: StoredRound): Promise<boolean> {
  const path = r.path ?? repoPath(r.log);
  const body = (sha: string | null) =>
    JSON.stringify({
      message: `Log ${r.log.label || r.log.device} ${r.log.startedAt} ${r.log.result}${r.log.flag ? ' (flagged)' : ''}`,
      content: base64(JSON.stringify(r.log)),
      ...(sha ? { sha } : {}),
    });
  let res = await fetch(`${API}/contents/${path}`, { method: 'PUT', headers: headers(key), body: body(r.sha) });
  if (res.status === 409 || res.status === 422) {
    // The file already exists (or changed): fetch its version and try once more.
    res = await fetch(`${API}/contents/${path}`, { method: 'PUT', headers: headers(key), body: body(await currentSha(key, path)) });
  }
  if (!res.ok) return false;
  const json = (await res.json()) as { content?: { sha?: string } };
  await putRound({ ...r, path, sha: json.content?.sha ?? null, dirty: false });
  return true;
}

export interface UploadStatus {
  saved: number;
  waiting: number;
  lastError: string | null;
  busy: boolean;
}

export const status: UploadStatus = { saved: 0, waiting: 0, lastError: null, busy: false };
const listeners: (() => void)[] = [];
export function onStatus(fn: () => void) {
  listeners.push(fn);
}
const notify = () => listeners.forEach((fn) => fn());

export async function refreshCounts(): Promise<void> {
  const rows = await allRounds();
  status.saved = rows.length;
  status.waiting = rows.filter((r) => r.dirty).length;
  notify();
}

/** Uploads every round that GitHub doesn't have yet, oldest first. Safe to call often. */
export async function flush(): Promise<void> {
  const key = getKey();
  if (status.busy) return;
  if (!key) {
    await refreshCounts();
    return;
  }
  status.busy = true;
  notify();
  try {
    for (const r of (await allRounds()).filter((x) => x.dirty)) {
      if (!(await uploadOne(key, r))) {
        status.lastError = 'GitHub refused the upload (check the key in Settings)';
        break;
      }
      status.lastError = null;
    }
  } catch {
    status.lastError = 'No connection; will retry';
  } finally {
    status.busy = false;
    await refreshCounts();
  }
}

/** Saves a finished round (or a changed one) and tries to upload it. */
export async function saveRound(log: RoundLog): Promise<void> {
  const existing = (await allRounds()).find((r) => r.id === log.id);
  await putRound({ id: log.id, log, path: existing?.path ?? null, sha: existing?.sha ?? null, dirty: true });
  await flush();
}

// Retry whenever the game comes back into view or the network returns.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void flush();
});
window.addEventListener('online', () => void flush());
