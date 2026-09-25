// Seeded randomness for the rules, so a round can be replayed from its seed and inputs.
import type { DuelState } from './types';

/** Small seeded random generator (mulberry32). Returns [0..1) and the next state. */
function rand(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** A random number in [min, max), advancing the round's random state. */
export function between(s: DuelState, min: number, max: number): number {
  const [r, next] = rand(s.rng);
  s.rng = next;
  return min + r * (max - min);
}
