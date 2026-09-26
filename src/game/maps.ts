// Maps (backgrounds). Looks only: every map has the same street, distance and rules.
// Each round's map comes from its seed (see mapForSeed), so a logged seed shows which map it was.

/** Map ids, matching bg_<id>.webp in art/exports/backgrounds (placement data is in src/render/art.ts). */
export const MAPS = ['alien-frontier', 'moonlit-canyon', 'desert-outpost'];

/**
 * The map for a round seed. Hashes the seed instead of drawing from the round's random stream,
 * so the bot's choices for a given seed are the same as before maps existed.
 */
export function mapForSeed(seed: number): string {
  const h = Math.imul(seed >>> 0, 0x9e3779b1) >>> 0;
  return MAPS[(h >>> 16) % MAPS.length];
}
