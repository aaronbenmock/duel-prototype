// Minimal quaternion helpers. A quaternion here is [w, x, y, z].
// Orientation is kept as a quaternion (never as raw angles) because raw
// alpha/beta/gamma angles become unstable when the phone is held upright.

export type Quat = [number, number, number, number];
export type Vec3 = [number, number, number];

const DEG = Math.PI / 180;

/**
 * Converts W3C DeviceOrientation angles (Z-X'-Y'' intrinsic order) to a
 * quaternion that rotates vectors from the phone's frame into the earth frame.
 * Phone frame: x = right edge, y = top edge, z = out of the screen.
 * Earth frame: z = up.
 */
export function quatFromDeviceOrientation(alpha: number, beta: number, gamma: number): Quat {
  const x = (beta * DEG) / 2;
  const y = (gamma * DEG) / 2;
  const z = (alpha * DEG) / 2;
  const cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z);
  const sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
  return [
    cX * cY * cZ - sX * sY * sZ,
    sX * cY * cZ - cX * sY * sZ,
    cX * sY * cZ + sX * cY * sZ,
    cX * cY * sZ + sX * sY * cZ,
  ];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

export function quatConjugate(q: Quat): Quat {
  return [q[0], -q[1], -q[2], -q[3]];
}

export function quatNormalize(q: Quat): Quat {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Rotates vector v by quaternion q. */
export function quatRotate(q: Quat, v: Vec3): Vec3 {
  const [w, x, y, z] = q;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

/** The earth's "up" direction expressed in the phone's own frame. */
export function upInPhoneFrame(q: Quat): Vec3 {
  return quatRotate(quatConjugate(q), [0, 0, 1]);
}

/** Direction the back of the phone points (like a gun barrel), in the earth frame. */
export function barrelInEarthFrame(q: Quat): Vec3 {
  return quatRotate(q, [0, 0, -1]);
}
