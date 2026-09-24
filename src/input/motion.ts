import { quatFromDeviceOrientation, type Quat } from './quat';

export type PermissionResult = 'granted' | 'denied' | 'error';

export interface OrientationSample {
  t: number;
  alpha: number;
  beta: number;
  gamma: number;
  q: Quat;
}

export interface MotionSample {
  t: number;
  /** Acceleration without gravity, m/s^2 (null if the device does not report it). */
  acc: { x: number; y: number; z: number } | null;
  accG: { x: number; y: number; z: number } | null;
  /** Rotation rate, deg/s. */
  rot: { alpha: number; beta: number; gamma: number } | null;
  intervalMs: number;
}

type RequestFn = () => Promise<'granted' | 'denied'>;

/** Counts events over a sliding one-second window. */
class RateCounter {
  private stamps: number[] = [];
  tick(t: number) {
    this.stamps.push(t);
    while (this.stamps.length && t - this.stamps[0] > 1000) this.stamps.shift();
  }
  hz(now: number): number {
    while (this.stamps.length && now - this.stamps[0] > 1000) this.stamps.shift();
    return this.stamps.length;
  }
}

/**
 * Owns the motion/orientation permission and event listeners.
 * Game code reads `orientation` and `motion` or subscribes with onOrientation/onMotion.
 */
export class MotionSensors {
  orientation: OrientationSample | null = null;
  motion: MotionSample | null = null;
  private oriRate = new RateCounter();
  private motRate = new RateCounter();
  private started = false;
  private oriListeners: ((s: OrientationSample) => void)[] = [];
  private motListeners: ((s: MotionSample) => void)[] = [];

  /**
   * Must be called directly from a tap handler. iOS only shows the permission
   * prompt when the request comes from a user gesture. Both requests are fired
   * synchronously so neither loses the gesture.
   */
  request(): Promise<PermissionResult> {
    const dme = (window.DeviceMotionEvent as unknown as { requestPermission?: RequestFn }) ?? {};
    const doe = (window.DeviceOrientationEvent as unknown as { requestPermission?: RequestFn }) ?? {};
    const pending: Promise<'granted' | 'denied'>[] = [];
    try {
      if (typeof dme.requestPermission === 'function') pending.push(dme.requestPermission());
      if (typeof doe.requestPermission === 'function') pending.push(doe.requestPermission());
    } catch {
      return Promise.resolve('error');
    }
    // Android and desktop browsers have no prompt; events just start arriving.
    // Listen either way: some browsers report "denied" but still send data,
    // so callers should also check whether samples are actually arriving.
    return Promise.all(pending).then(
      (results) => {
        this.start();
        return results.every((r) => r === 'granted') ? ('granted' as const) : ('denied' as const);
      },
      () => {
        this.start();
        return 'error' as const;
      },
    );
  }

  get needsPrompt(): boolean {
    const doe = window.DeviceOrientationEvent as unknown as { requestPermission?: RequestFn } | undefined;
    return typeof doe?.requestPermission === 'function';
  }

  onOrientation(fn: (s: OrientationSample) => void) {
    this.oriListeners.push(fn);
  }
  onMotion(fn: (s: MotionSample) => void) {
    this.motListeners.push(fn);
  }

  orientationHz(): number {
    return this.oriRate.hz(performance.now());
  }
  motionHz(): number {
    return this.motRate.hz(performance.now());
  }

  private start() {
    if (this.started) return;
    this.started = true;
    window.addEventListener('deviceorientation', (e) => {
      if (e.alpha == null || e.beta == null || e.gamma == null) return;
      const t = performance.now();
      const s: OrientationSample = {
        t,
        alpha: e.alpha,
        beta: e.beta,
        gamma: e.gamma,
        q: quatFromDeviceOrientation(e.alpha, e.beta, e.gamma),
      };
      this.orientation = s;
      this.oriRate.tick(t);
      for (const fn of this.oriListeners) fn(s);
    });
    window.addEventListener('devicemotion', (e) => {
      const t = performance.now();
      const a = e.acceleration;
      const g = e.accelerationIncludingGravity;
      const r = e.rotationRate;
      const s: MotionSample = {
        t,
        acc: a && a.x != null ? { x: a.x, y: a.y ?? 0, z: a.z ?? 0 } : null,
        accG: g && g.x != null ? { x: g.x, y: g.y ?? 0, z: g.z ?? 0 } : null,
        rot: r && r.alpha != null ? { alpha: r.alpha, beta: r.beta ?? 0, gamma: r.gamma ?? 0 } : null,
        intervalMs: e.interval,
      };
      this.motion = s;
      this.motRate.tick(t);
      for (const fn of this.motListeners) fn(s);
    });
  }
}
