// Browser features that differ between iPhone and Android.

/** Keeps the screen on while held. Supported on iOS 16.4+ Safari and Android Chrome. */
export class ScreenAwake {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;
  status: 'unsupported' | 'off' | 'on' | 'failed' = 'wakeLock' in navigator ? 'off' : 'unsupported';

  constructor() {
    // The browser drops the lock when the page is hidden; take it back on return.
    document.addEventListener('visibilitychange', () => {
      if (this.wanted && document.visibilityState === 'visible') void this.acquire();
    });
  }

  async acquire(): Promise<void> {
    this.wanted = true;
    if (!('wakeLock' in navigator) || this.sentinel) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.status = 'on';
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
        this.status = 'off';
      });
    } catch {
      this.status = 'failed';
    }
  }

  async release(): Promise<void> {
    this.wanted = false;
    await this.sentinel?.release();
    this.sentinel = null;
  }
}

export const canVibrate = typeof navigator.vibrate === 'function';

export function vibrate(pattern: number | number[]) {
  if (canVibrate) navigator.vibrate(pattern);
}

/**
 * Safari cannot lock screen orientation, so show a full-screen "rotate back"
 * overlay whenever a touch device is in landscape.
 */
export function installRotateOverlay() {
  const el = document.createElement('div');
  el.className = 'rotate-overlay';
  el.innerHTML = `
    <div class="rotate-box">
      <div class="rotate-icon">&#x21bb;</div>
      <p><strong>Rotate back to portrait</strong></p>
      <p>Tip: turn on Portrait Orientation Lock in Control Center so this doesn't happen mid-duel.</p>
    </div>`;
  document.body.appendChild(el);
  const mq = window.matchMedia('(orientation: landscape) and (pointer: coarse)');
  const update = () => el.classList.toggle('show', mq.matches);
  mq.addEventListener('change', update);
  update();
}
