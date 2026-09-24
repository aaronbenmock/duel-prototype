// Detects holster, draw (aiming pose) and the reload flick from sensor data.
import type { MotionSample, OrientationSample } from './motion';
import { barrelInEarthFrame, quatRotate, upInPhoneFrame, type Quat } from './quat';

export interface GestureConfig {
  /** Holstered when the phone's top points down at least this much (0..1, 1 = straight down). */
  holsterDown: number;
  /** Holster must be held this long (ms) before it counts. */
  holsterHoldMs: number;
  /** Leaves the holster once pointing down drops below this (smaller than holsterDown, to avoid flicker). */
  unholsterDown: number;
  /** Ignore holster while the phone is spinning faster than this (deg/s). */
  holsterMaxSpin: number;
  /** Aiming pose: top of phone points up at least this much (0..1). */
  aimUpright: number;
  /** Aiming pose: back of phone within this many degrees of level. */
  aimMaxTilt: number;
  /** Reload flick: vertical acceleration (m/s^2) needed in each direction. */
  reloadAccel: number;
  /** Reload flick: both directions must happen within this window (ms). */
  reloadWindowMs: number;
}

export const DEFAULT_GESTURES: GestureConfig = {
  holsterDown: 0.7,
  holsterHoldMs: 400,
  unholsterDown: 0.4,
  holsterMaxSpin: 150,
  aimUpright: 0.4,
  aimMaxTilt: 40,
  reloadAccel: 10,
  reloadWindowMs: 400,
};

export class GestureDetector {
  holstered = false;
  aimPose = false;
  /** Latest orientation quaternion, for use by the aim tracker. */
  q: Quat | null = null;
  private holsterSince: number | null = null;
  private spin = 0;
  private lastDown = -Infinity;
  private lastUp = -Infinity;
  private lastFlick = -Infinity;

  constructor(public config: GestureConfig = { ...DEFAULT_GESTURES }) {}

  /** Clears holster state, e.g. at the start of a new round. */
  reset() {
    this.holstered = false;
    this.holsterSince = null;
  }

  updateOrientation(s: OrientationSample) {
    const c = this.config;
    this.q = s.q;
    const up = upInPhoneFrame(s.q);
    // up[1] is how much the phone's top edge points up (+1) or down (-1).
    const down = -up[1];

    if (!this.holstered) {
      if (down >= c.holsterDown && this.spin <= c.holsterMaxSpin) {
        this.holsterSince ??= s.t;
        if (s.t - this.holsterSince >= c.holsterHoldMs) this.holstered = true;
      } else {
        this.holsterSince = null;
      }
    } else if (down < c.unholsterDown) {
      this.holstered = false;
      this.holsterSince = null;
    }

    const barrel = barrelInEarthFrame(s.q);
    const tilt = (Math.asin(Math.max(-1, Math.min(1, barrel[2]))) * 180) / Math.PI;
    this.aimPose = up[1] >= c.aimUpright && Math.abs(tilt) <= c.aimMaxTilt;
  }

  /** Returns true when a reload flick (a sharp down-and-up jerk) is detected. */
  updateMotion(s: MotionSample): boolean {
    if (s.rot) this.spin = Math.hypot(s.rot.alpha, s.rot.beta, s.rot.gamma);
    if (!s.acc || !this.q) return false;
    // Vertical acceleration in the earth frame. Down then up (or up then down,
    // since browsers disagree on the sign) within a short window = flick.
    const az = quatRotate(this.q, [s.acc.x, s.acc.y, s.acc.z])[2];
    const c = this.config;
    if (az <= -c.reloadAccel) this.lastDown = s.t;
    if (az >= c.reloadAccel) this.lastUp = s.t;
    if (
      Math.abs(this.lastDown - this.lastUp) <= c.reloadWindowMs &&
      s.t - Math.min(this.lastDown, this.lastUp) <= c.reloadWindowMs &&
      s.t - this.lastFlick > 800
    ) {
      this.lastFlick = s.t;
      this.lastDown = this.lastUp = -Infinity;
      return true;
    }
    return false;
  }
}
