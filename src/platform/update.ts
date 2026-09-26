// "Update available": GitHub Pages lets a phone keep the old page for up to 10 minutes, so a test
// can run on a stale build. The build writes version.json (vite.config.ts); this compares it with
// the running version on load and every few minutes while the start screen is showing.
import { APP_VERSION } from '../settings/settings';

const CHECK_EVERY_MS = 3 * 60 * 1000;

/** True if version a is newer than b ("0.7.10" > "0.7.9"). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/** The live version, or null (offline, or the dev server, which has no version.json). */
export async function liveVersion(): Promise<string | null> {
  try {
    // A fresh query string gets past the browser and GitHub caches.
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const v = ((await res.json()) as { version?: unknown }).version;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

/** Loads the page again past the cache (the query string makes GitHub serve the new page). */
export function reloadToLatest(version: string) {
  const url = new URL(location.href);
  url.searchParams.set('v', version);
  location.replace(url.toString());
}

/**
 * Checks now and then every few minutes while `active()` says the start screen is up and the page
 * is visible; calls `found` once with the newer version.
 */
export function watchForUpdate(active: () => boolean, found: (version: string) => void) {
  let told = false;
  const check = async () => {
    if (told || document.visibilityState !== 'visible' || !active()) return;
    const v = await liveVersion();
    if (v && isNewer(v, APP_VERSION)) {
      told = true;
      found(v);
    }
  };
  void check();
  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => void check());
}
