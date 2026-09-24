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

/**
 * iPhone Safari has no vibration API. Experimental workaround: iOS 18+ plays a
 * light haptic tap when a native "switch" checkbox is toggled, including from
 * code. It may not fire outside a tap, so it is a bonus, not a guarantee.
 */
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
let hapticLabel: HTMLLabelElement | null = null;

function iosTap() {
  if (!hapticLabel) {
    hapticLabel = document.createElement('label');
    hapticLabel.setAttribute('aria-hidden', 'true');
    hapticLabel.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    hapticLabel.appendChild(input);
    document.body.appendChild(hapticLabel);
  }
  hapticLabel.click();
}

export const vibrationMode: 'vibrate' | 'ios-haptic' | 'none' = canVibrate ? 'vibrate' : isIOS ? 'ios-haptic' : 'none';

/** Vibrates on Android. On iPhone, plays one light haptic tap per pulse in the pattern (experimental). */
export function vibrate(pattern: number | number[]) {
  if (canVibrate) {
    navigator.vibrate(pattern);
    return;
  }
  if (!isIOS) return;
  const pulses = Array.isArray(pattern) ? pattern.filter((_, i) => i % 2 === 0) : [pattern];
  // Long pulses become a quick burst of taps so they're easier to feel.
  let delay = 0;
  for (const ms of pulses) {
    const taps = Math.max(1, Math.min(4, Math.round(ms / 60)));
    for (let i = 0; i < taps; i++) {
      setTimeout(iosTap, delay);
      delay += 70;
    }
    delay += 80;
  }
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
