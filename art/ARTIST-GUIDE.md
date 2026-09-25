# High Moon: artist guide

Plain-English rules for drawing art that can go straight into the game. Claude handles the technical
side (resizing, compressing, working out hit areas, animation). Your job is the drawing, plus following
the size and layout rules below.

## The look

- Western frontier on an alien planet: purple night sky, dusty mauve street, three moons.
- Cute, non-human aliens dressed as cowboys: hats, bandannas, vests, belts, boots.
- Nothing realistically violent: the guns shoot **paint**. No blood, no realistic weapons.
- Match the current art: **thick dark outline**, flat colors with a little soft shading, chunky shapes.
- Colors that fit: dusk purples and mauves, sage green, dusty blue, golden yellow, coral red,
  warm leather browns. Paint is bright yellow.

Current examples in the project: the sage one-eyed alien, the star revolver, the yellow paint splats
and the frontier street background.

## Two kinds of image files

| Kind | What it is | Made in | Send as |
|---|---|---|---|
| **Raster** (pixels) | A grid of colored dots, like a photo. Blurs if enlarged. | Procreate, Photoshop, most drawing apps | **PNG** |
| **Vector** (shapes) | Shapes and lines stored as math. Stays sharp at any size and each part stays editable. | Adobe Illustrator, Affinity Designer, Inkscape, Figma | **SVG** (plus a PNG copy) |

**Either is fine.** Vector is a bonus, not a requirement: it makes later animation easier (arms,
eyes and so on can move separately). If you draw in Procreate or similar, just follow the size rules
and export PNG.

## Rules for every image (except backgrounds)

1. **Transparent background.** Only the item itself; everything around it see-through. In
   Procreate: hide the background layer before exporting, then export as PNG. JPG can't do this.
2. **No ground, shadow, or scribbles under the feet.** The game adds its own shadow.
3. **Nothing cut off at the edges** of the canvas, and leave a little breathing room.
4. **One item per file.** No sheets with several things on them (sheets are fine for sketches).
5. **Use the exact canvas size** from the table below, even if the item is small. Don't crop.

## Sizes and layout

| What | Canvas (width x height, pixels) | Layout rules |
|---|---|---|
| **Alien, full body** | **1024 x 1024** square | Facing the viewer, standing. Centered left to right. **Soles of the feet on a line 80 px up from the bottom** (y = 944). Hat top no higher than about 60 px from the top. Tails and ears can stick out to the sides. |
| **Clothing and accessories** (hats, bandannas, vests, shirts, belts, boots) | **1024 x 1024**, the same canvas as the alien | Draw each item **exactly where it sits on the alien**, then hide the alien and export the item alone. That way items line up automatically when swapped. |
| **Alien body for dress-up** (later) | 1024 x 1024 | The alien with no clothes, body drawn completely (even where clothes would cover it), so any outfit can go on top. |
| **Moving parts for animation** (later: arms, eyes, mouth) | 1024 x 1024, same canvas | Same idea: each part in place, exported on its own. |
| **Gun, in your own hand** (what the player sees) | **1024 x 1024** | Seen from behind, held in the alien's hand. Hand and wrist come in from the **bottom-right corner**; the gun points **up and to the left** toward the screen middle. Muzzle tip roughly in the top-middle area. One version per alien skin color. |
| **Gun, held by the opponent** | 512 x 512 | Facing the viewer, pointing toward the camera and slightly left. No hand. |
| **Gun, side view** (for a gun-picking menu) | 512 x 512 | Side-on, muzzle pointing right. No hand. |
| **Paint effects** | 512 x 512 | Splats (a few different ones), a blob in flight (pointing right), a burst from the muzzle (pointing right), an impact burst. Draw them yellow with a darker yellow outline; Claude recolors them in the game. |
| **Background** | **1290 x 2796** (tall, portrait: an iPhone screen) | **No transparency needed.** Horizon about 43% of the way down. The opponent stands on the street about **54% of the way down**, so keep the middle of the street clear and draw no characters. Keep anything important within the middle 70% of the width, because phones with other shapes trim the sides. |
| **Buttons and icons** (later) | 128 x 128, or SVG | Simple, bold shapes. |

**Keep the aliens the same size as each other.** An easy way: put the existing sage alien image
(`art/exports/creatures/creature_desert-sage_front.png`) on a faded layer underneath as a size guide,
draw on top, then hide it before exporting. Aim for a similar head size and the same foot line.

**Hit areas are worked out from your drawing**, so there's nothing extra to draw. Just keep the
face clearly visible and not hidden under the hat brim, and make the body, arms, legs and tail easy
to tell apart. The hat counts as a miss, so keep it clearly separate from the face.

## File names

Lowercase, words joined with hyphens, no spaces:

- `creature_cactus-kid_front.png`
- `clothing_cactus-kid_vest.png`, `acc_cactus-kid_hat.png`
- `weapon_star-revolver_sage_pov.png` (pov = held in your hand)
- `fx_paint_splat-c.png`
- `bg_saloon-street.png`

Don't worry if a name is slightly off. Claude renames files on the way in.

## Sending the art

1. Put the finished files for one item in a folder, and add a short note that says what it is and
   anything special (for example: "vest for the blue alien" or "tip of the gun is at the star").
2. Give the folder to Aaron. He drops it in `art/ready-for-production/<item-name>/` in the project
   and asks Claude to add it.
3. Claude checks the sizes and see-through areas, converts and compresses, maps the hit areas,
   puts it in the game and reports back.

Rough drafts and ideas are welcome too. Label them as drafts, and they'll be used for discussion only.

## Before sending: checklist

- [ ] Background is see-through (except backgrounds)
- [ ] Canvas is the size in the table; nothing cropped
- [ ] Alien feet sit on the line 80 px from the bottom; similar size to the other aliens
- [ ] Clothing is drawn in place on the 1024 canvas, exported alone
- [ ] One item per file, saved as PNG (and SVG if vector)
- [ ] Original artwork. The project is public on GitHub, so don't copy other games or artists.
