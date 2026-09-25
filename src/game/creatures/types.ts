/** Hit-zone map for one creature sprite, generated from its image by art/tools/build_hitzones.py. */
export interface CreatureZones {
  slug: string;
  /** Sprite canvas size in pixels (square). */
  canvas: number;
  /** The map is grid x grid cells covering the canvas. */
  grid: number;
  /** Sprite pixels per aim unit: set so every creature has the same hittable area. */
  pxPerUnit: number;
  /** Canvas pixel that sits at the game's target position (torso reference); puts every creature's feet on the same street line. */
  torsoPx: [number, number];
  /** Canvas y of the soles of the feet. */
  baselineY: number;
  /** One string per row, one digit per cell: 0 none, 1 face, 2 torso, 3 limb, 4 tail, 5 hat. */
  rows: string[];
}
