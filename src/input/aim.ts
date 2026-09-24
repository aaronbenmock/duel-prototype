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

export const DEFAULT_AIM: AimConfig = { sensX: 1, sensY: 1, minCutoff: 10 / 3, beta: 0.1 };

/** Scene bounds in aim units; the crosshair is kept inside. */
export const AIM_LIMIT = { x: 19, y: 30 };

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

/** Angle in degrees between two orientations. */
function quatAngle(a: Quat, b: Quat): number {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, dot)) * RAD;
}

/** A jump bigger than this between two readings (under 60 ms apart) is treated as a sensor glitch. */
const SPIKE_DEG = 25;
/** After the draw, keep re-centering while the phone is still swinging faster than this (deg/s)... */
const SETTLE_SPEED = 40;
/** ...and stop once it has stayed slower than that for this long (ms)... */
const SETTLE_STILL_MS = 60;
/** ...or after this long at most (ms). */
const SETTLE_MAX_MS = 400;

export class AimTracker {
  private ref: { heading: number; elevation: number } | null = null;
  private fx: OneEuro;
  private fy: OneEuro;
  /** Recent aim positions, used to find where the player was aiming just before a tap. */
  private history: { t: number; x: number; y: number }[] = [];
  private lastQ: Quat | null = null;
  private lastT = 0;
  private pendingSpike: Quat | null = null;
  private settleUntil = 0;
  private slowSince: number | null = null;
  current = { x: 0, y: 0 };
  /** Diagnostics for the aim log. */
  raw = { x: 0, y: 0 };
  spikes = 0;
  lastWasSpike = false;
  settling = false;

  constructor(public config: AimConfig = { ...DEFAULT_AIM }) {
    this.fx = new OneEuro(() => this.config);
    this.fy = new OneEuro(() => this.config);
  }

  get locked() {
    return this.ref != null;
  }

  /**
   * Locks the reference orientation. Aim is measured from here and starts at
   * the center. While the draw swing is still moving fast, the center keeps
   * following the phone (see update), so it settles where the arm stops.
   */
  lock(q: Quat, t: number) {
    this.recenter(q, t);
    this.lastQ = q;
    this.lastT = t;
    this.pendingSpike = null;
    this.spikes = 0;
    this.settleUntil = t + SETTLE_MAX_MS;
    this.slowSince = null;
    this.settling = true;
  }

  private recenter(q: Quat, t: number) {
    this.ref = barrelAngles(q);
    this.fx.reset();
    this.fy.reset();
    this.history = [{ t, x: 0, y: 0 }];
    this.current = { x: 0, y: 0 };
    this.raw = { x: 0, y: 0 };
  }

  unlock() {
    this.ref = null;
    this.lastQ = null;
  }

  update(q: Quat, t: number) {
    if (!this.ref) return;

    // Glitch filter: ignore a single reading that jumps further than a hand
    // can turn. If the next reading agrees with it, the move was real.
    this.lastWasSpike = false;
    if (this.lastQ && t - this.lastT < 60 && quatAngle(this.lastQ, q) > SPIKE_DEG) {
      if (!this.pendingSpike || quatAngle(this.pendingSpike, q) > 10) {
        this.pendingSpike = q;
        this.spikes++;
        this.lastWasSpike = true;
        return;
      }
    }
    this.pendingSpike = null;
    const speed = this.lastQ ? quatAngle(this.lastQ, q) / Math.max(0.001, (t - this.lastT) / 1000) : 0;
    this.lastQ = q;
    this.lastT = t;

    if (this.settling) {
      if (speed > SETTLE_SPEED) this.slowSince = null;
      else this.slowSince ??= t;
      const still = this.slowSince != null && t - this.slowSince >= SETTLE_STILL_MS;
      if (t < this.settleUntil && !still) {
        this.recenter(q, t);
        return;
      }
      this.settling = false;
    }

    // The barrel direction comes from the full rotation (quaternion), so it
    // stays stable when the phone is upright. Only the differences from the
    // locked reference are used.
    const a = barrelAngles(q);
    const { sensX, sensY } = this.config;
    let rawX = wrap180(a.heading - this.ref.heading) * sensX;
    let rawY = (a.elevation - this.ref.elevation) * sensY;
    // Past the edge of the scene, drag the reference along instead of pinning
    // the crosshair, so turning back moves it back immediately.
    if (Math.abs(rawX) > AIM_LIMIT.x) {
      const over = rawX - Math.sign(rawX) * AIM_LIMIT.x;
      this.ref.heading = wrap180(this.ref.heading + over / sensX);
      rawX -= over;
    }
    if (Math.abs(rawY) > AIM_LIMIT.y) {
      const over = rawY - Math.sign(rawY) * AIM_LIMIT.y;
      this.ref.elevation += over / sensY;
      rawY -= over;
    }
    this.raw = { x: rawX, y: rawY };
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
