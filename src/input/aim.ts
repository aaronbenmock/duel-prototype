// Turns phone orientation into a crosshair position, relative to the pose
// locked at the moment of the draw.
import { barrelInEarthFrame, type Quat } from './quat';

const RAD = 180 / Math.PI;

export interface AimConfig {
  /** Multiplier on horizontal / vertical movement. 1 = one degree of turn moves one aim unit. */
  sensX: number;
  sensY: number;
  /** One Euro filter: lower minCutoff = steadier but laggier; higher beta = snappier on fast swings. */
  minCutoff: number;
  beta: number;
}

export const DEFAULT_AIM: AimConfig = { sensX: 1, sensY: 1, minCutoff: 1.2, beta: 0.05 };

/** Scene bounds in aim units; the crosshair is kept inside. */
export const AIM_LIMIT = { x: 20, y: 30 };

/**
 * One Euro filter: smooths heavily when the signal is still (kills hand
 * jitter) and lightly when it moves fast (keeps big swings responsive).
 */
class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(private cfg: () => { minCutoff: number; beta: number }) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }

  filter(value: number, tMs: number): number {
    if (this.x == null) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += OneEuro.alpha(1.0, dt) * (rawDx - this.dx);
    const { minCutoff, beta } = this.cfg();
    const cutoff = minCutoff + beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

/** Heading (degrees clockwise) and elevation (degrees up) of the phone's back. */
function barrelAngles(q: Quat): { heading: number; elevation: number } {
  const b = barrelInEarthFrame(q);
  return {
    heading: Math.atan2(b[0], b[1]) * RAD,
    elevation: Math.asin(Math.max(-1, Math.min(1, b[2]))) * RAD,
  };
}

function wrap180(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));

export class AimTracker {
  private ref: { heading: number; elevation: number } | null = null;
  private fx: OneEuro;
  private fy: OneEuro;
  /** Recent aim positions, used to find where the player was aiming just before a tap. */
  private history: { t: number; x: number; y: number }[] = [];
  current = { x: 0, y: 0 };

  constructor(public config: AimConfig = { ...DEFAULT_AIM }) {
    this.fx = new OneEuro(() => this.config);
    this.fy = new OneEuro(() => this.config);
  }

  get locked() {
    return this.ref != null;
  }

  /** Locks the reference orientation. Aim is measured from here and starts at the center. */
  lock(q: Quat, t: number) {
    this.ref = barrelAngles(q);
    this.fx.reset();
    this.fy.reset();
    this.history = [{ t, x: 0, y: 0 }];
    this.current = { x: 0, y: 0 };
  }

  unlock() {
    this.ref = null;
  }

  update(q: Quat, t: number) {
    if (!this.ref) return;
    // The barrel direction comes from the full rotation (quaternion), so it
    // stays stable when the phone is upright. Only the differences from the
    // locked reference are used.
    const a = barrelAngles(q);
    const rawX = clamp(wrap180(a.heading - this.ref.heading) * this.config.sensX, AIM_LIMIT.x);
    const rawY = clamp((a.elevation - this.ref.elevation) * this.config.sensY, AIM_LIMIT.y);
    this.current = { x: this.fx.filter(rawX, t), y: this.fy.filter(rawY, t) };
    this.history.push({ t, ...this.current });
    while (this.history.length > 2 && t - this.history[0].t > 1000) this.history.shift();
  }

  /** Aim position at time t (interpolated between samples). */
  at(t: number): { x: number; y: number } {
    const h = this.history;
    if (!h.length) return { ...this.current };
    if (t <= h[0].t) return { x: h[0].x, y: h[0].y };
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1];
      const b = h[i];
      if (t >= a.t) {
        if (t >= b.t) return { x: b.x, y: b.y };
        const k = (t - a.t) / (b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return { x: h[0].x, y: h[0].y };
  }
}
