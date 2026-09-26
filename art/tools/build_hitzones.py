r"""Build the hit-zone map for each creature sprite.

Only visible (opaque) pixels can be hit. Each opaque pixel is labelled with a
zone by simple region rules measured on the 1024 x 1024 sprite canvas, then the
canvas is reduced to a GRID x GRID map that the game rules use for hit tests.

Aliens are looks only, so they must be equally easy to hit. Every creature is
drawn at a scale (pixels per aim unit) that gives it the same hittable area
(TARGET_AREA), with its feet on the same street line.

Outputs:
  src/game/creatures/<slug>.ts            zone map + placement constants
  art/exports/creatures/<sprite>_hitzones.webp   translucent debug overlay

Usage (Inkscape's Python has Pillow):
  "C:\Program Files\Inkscape\bin\python.exe" art\tools\build_hitzones.py
"""

from math import sqrt
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
GRID = 128
CELL = 1024 // GRID

# Zone codes shared with src/game/duel.ts
NONE, FACE, TORSO, LIMB, TAIL, HAT = 0, 1, 2, 3, 4, 5
COLORS = {FACE: (255, 60, 60), TORSO: (255, 170, 0), LIMB: (60, 140, 255), TAIL: (40, 220, 120), HAT: (160, 160, 160)}

# Sizing: every creature is scaled so its hittable area (face + torso + limbs + tail, measured on
# the sprite's own pixels) is TARGET_AREA square aim units. 45.69 is what the v0.6.2 neutral-front sage
# had at 78 px per unit, so swapping in the aiming poses (v0.6.10) keeps the game exactly as hard.
# Feet stay on the same street line: soles at y = 944, torso reference FEET_BELOW_TORSO units above them.
TARGET_AREA = 45.69
REF_PX_PER_UNIT = 78
BASELINE_Y = 944
FEET_BELOW_TORSO = (BASELINE_Y - 600) / REF_PX_PER_UNIT  # aim units

# Zone rules below are measured on each 1024 sprite (art/exports/creatures/*_revolver_front.png).
# In the aiming poses the revolver is raised on the creature's right (left of the picture): the gun
# sticking out beyond the fist is a miss (code 5, like the hat); the fist holding the grip and the raised
# arm are limbs. The hat's lower edge is found from colour: in each pixel column, everything above the
# first skin pixel (face, ears, gills) is hat or hair, which never counts.


def in_ellipse(x, y, cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def is_hair(rgb) -> bool:
    """Violet's dark plum hair (about 82, 43, 57); her vest and boots are brown with less blue than green."""
    r, g, b = rgb
    return r < 130 and g < 85 and b >= g + 5 and r > b


def sage_skin(rgb) -> bool:
    r, g, b = rgb
    return g > 120 and g > r + 15 and g > b + 20


def blue_skin(rgb) -> bool:
    r, g, b = rgb
    return b > 150 and b > r + 50  # light blue skin and the darker floppy ears


def gold_skin(rgb) -> bool:
    r, g, b = rgb
    return r > 220 and b < 140  # yellow skin and the coral gills


def violet_skin(rgb) -> bool:
    r, g, b = rgb
    return (r > 170 and b > 140 and g < 160 and b > g) or is_hair(rgb)  # purple skin and ears; hair under the brim is her head


def sage_zone(x: int, y: int, rgb, brim) -> int:
    """creature_desert-sage_revolver_front: one eye, ear on the left, tail behind on the right."""
    if x < 300 and y < 345:
        return HAT  # raised revolver: miss
    if y < brim[x]:
        return HAT  # hat and brim
    if in_ellipse(x, y, 512, 345, 168, 128):
        return FACE
    if x >= 790 or (x >= 725 and 420 <= y < 590) or (x >= 740 and y >= 715):
        return TAIL
    if 350 <= x <= 695 and 420 <= y <= 760:
        return TORSO  # bandanna, vest, belt, belly
    return LIMB  # ear, raised arm and fist, other arm, holster, legs, boots


def blue_zone(x: int, y: int, rgb, brim) -> int:
    """creature_desert-blue_revolver_front: three eyes, floppy ears, no tail (the lasso counts as body)."""
    if x < 262 and y < 335:
        return HAT  # raised revolver: miss
    if y < brim[x]:
        return HAT  # hat, brim, feather
    if in_ellipse(x, y, 510, 335, 172, 125):
        return FACE
    if 318 <= x <= 690 and 420 <= y <= 770:
        return TORSO
    return LIMB  # ears, raised arm and fist, other arm, legs, boots


def gold_zone(x: int, y: int, rgb, brim) -> int:
    """creature_desert-gold_revolver_front: frilly gills, fringed chaps, tail on the right."""
    if x < 265 and y < 335:
        return HAT  # raised revolver: miss
    if y < brim[x]:
        return HAT
    if in_ellipse(x, y, 510, 335, 172, 122):
        return FACE
    if x >= 805 or (x >= 725 and y >= 715):
        return TAIL
    if 315 <= x <= 700 and 420 <= y <= 775:
        return TORSO  # vest, bolo, belt, chaps
    return LIMB  # gills, raised arm and fist, other arm, legs, boots


def violet_zone(x: int, y: int, rgb, brim) -> int:
    """creature_desert-violet_revolver_front: one eye, pointed ears, two braids. The hair framing her face
    under the brim is part of her head (face); the braids hanging below it are a miss, like the hat."""
    if x < 258 and y < 335:
        return HAT  # raised revolver: miss
    if y < brim[x]:
        return HAT
    if in_ellipse(x, y, 510, 318, 172, 118):
        return FACE
    # Braids: the hanging ends (with their ties and outlines) and any hair-coloured pixel outside the head.
    if (x < 312 and y >= 468) or (x >= 712 and 380 <= y <= 560) or is_hair(rgb):
        return HAT
    if 318 <= x <= 685 and 405 <= y <= 765:
        return TORSO  # bandanna, vest, belt, belly
    return LIMB  # ears, raised arm and fist, other arm, holster, legs, boots


# brim_scan: (first row to scan, last row) for the hat edge; the scan starts below blue's and gold's
# hat bands, whose colours are close to their skin.
CREATURES = [
    {"slug": "desert-sage", "sprite": "art/exports/creatures/creature_desert-sage_revolver_front.png", "zone": sage_zone, "skin": sage_skin, "brim_scan": (150, 345)},
    {"slug": "desert-blue", "sprite": "art/exports/creatures/creature_desert-blue_revolver_front.png", "zone": blue_zone, "skin": blue_skin, "brim_scan": (228, 335)},
    {"slug": "desert-gold", "sprite": "art/exports/creatures/creature_desert-gold_revolver_front.png", "zone": gold_zone, "skin": gold_skin, "brim_scan": (218, 335)},
    {"slug": "desert-violet", "sprite": "art/exports/creatures/creature_desert-violet_revolver_front.png", "zone": violet_zone, "skin": violet_skin, "brim_scan": (150, 320)},
]


def brim_line(px, c: dict) -> list:
    """Per column, the first row of skin (two skin pixels in a row) below the hat; the scan's last row if none."""
    y0, y1 = c["brim_scan"]
    out = []
    for x in range(1024):
        edge = y1
        for y in range(y0, y1):
            if c["skin"](px[x, y][:3]) and c["skin"](px[x, y + 1][:3]):
                edge = y
                break
        out.append(edge)
    return out


def label(c: dict):
    """Zone per opaque pixel, plus pixel counts per zone."""
    im = Image.open(ROOT / c["sprite"]).convert("RGBA")
    px = im.load()
    brim = brim_line(px, c)
    zones = {}
    counts = {z: 0 for z in COLORS}
    for y in range(1024):
        for x in range(1024):
            r, g, b, al = px[x, y]
            if al >= 128:
                z = c["zone"](x, y, (r, g, b), brim)
                zones[(x, y)] = z
                counts[z] += 1
    return zones, counts


def write(c: dict, zones: dict, ppu: float) -> None:
    counts = [[{} for _ in range(GRID)] for _ in range(GRID)]
    overlay = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    o = overlay.load()
    for (x, y), z in zones.items():
        cell = counts[y // CELL][x // CELL]
        cell[z] = cell.get(z, 0) + 1
        r, g, b = COLORS[z]
        o[x, y] = (r, g, b, 110)
    rows = []
    for gy in range(GRID):
        row = []
        for gx in range(GRID):
            cell = counts[gy][gx]
            opaque = sum(cell.values())
            # A cell is hittable when at least a quarter of it is visible.
            row.append(str(max(cell, key=cell.get)) if opaque >= CELL * CELL // 4 else "0")
        rows.append("".join(row))
    # Torso reference placed so the feet land on the same street line as the reference creature.
    torso_y = round(BASELINE_Y - FEET_BELOW_TORSO * ppu)
    slug = c["slug"]
    ts = ROOT / "src/game/creatures" / f"{slug}.ts"
    ts.write_text(
        "// GENERATED by art/tools/build_hitzones.py. Do not edit by hand.\n"
        f"// Hit zones for {Path(c['sprite']).name}: 0 none, 1 face, 2 torso, 3 limb, 4 tail, 5 hat (miss).\n"
        "import type { CreatureZones } from './types';\n\n"
        f"export const {slug.replace('-', '_').upper()}: CreatureZones = {{\n"
        f"  slug: '{slug}',\n"
        f"  canvas: 1024,\n  grid: {GRID},\n"
        f"  pxPerUnit: {ppu:.2f},\n"
        f"  torsoPx: [512, {torso_y}],\n"
        f"  baselineY: {BASELINE_Y},\n"
        "  rows: [\n" + "".join(f"    '{r}',\n" for r in rows) + "  ],\n};\n",
        encoding="utf-8",
    )
    out = ROOT / "art/exports/creatures" / (Path(c["sprite"]).stem + "_hitzones.webp")
    overlay.save(out, "WEBP", quality=70, method=6)
    print(f"wrote {ts.relative_to(ROOT)} and {out.relative_to(ROOT)}")


if __name__ == "__main__":
    labelled = [(c, *label(c)) for c in CREATURES]
    hittable = lambda n: n[FACE] + n[TORSO] + n[LIMB] + n[TAIL]
    print(f"{'creature':14} {'px/unit':>8} {'hittable':>9} {'face':>6} {'torso':>6} {'limb':>6} {'tail':>6}   (areas in square aim units)")
    for c, zones, n in labelled:
        ppu = sqrt(hittable(n) / TARGET_AREA)
        u = lambda z: n[z] / ppu ** 2
        print(f"{c['slug']:14} {ppu:8.2f} {hittable(n) / ppu ** 2:9.1f} {u(FACE):6.1f} {u(TORSO):6.1f} {u(LIMB):6.1f} {u(TAIL):6.1f}   miss {u(HAT):5.1f}")
        write(c, zones, ppu)
