# Art workspace (Fast Hand / Quick Draw)

Everything visual for the game starts here. Editable masters are SVG files made in Inkscape. The game only ever uses the exported files in `exports/`.

Art direction and ideas live in `../docs/ART-DIRECTION.md`. Current hit zones (what the art has to cover) are `BODY` in `../src/game/duel.ts`.

## Where things go

| Folder | What goes in it | Committed to GitHub? |
|---|---|---|
| `art-bible/` | Style rules, finished style decisions, approved concept boards | Yes |
| `references/` | Mood boards, screenshots, other people's images | **No** (the repo is public, and these aren't ours to publish) |
| `creatures/` | Editable SVG masters, one subfolder per creature | Yes |
| `creatures/_template/` | Blank reference sheet. Copy it, never draw in it | Yes |
| `weapons/` `clothing/` `accessories/` | Editable SVG masters for gear | Yes |
| `backgrounds/` | Editable SVG masters for scenes | Yes |
| `ui/` | Editable SVG masters for buttons, icons, meters | Yes |
| `palettes/` | Color palettes (hex lists, Inkscape `.gpl` swatch files) | Yes |
| `exports/<type>/` | Game-ready PNG and WebP (and optimized SVG) files only | Yes |

Rule of thumb: if you can edit it, it lives outside `exports/`. If the game loads it, it lives inside `exports/`. Never edit a file in `exports/`; fix the master and export again.

Anything committed is public, because the GitHub repo is public.

## Starting a new creature

1. Make a folder: `creatures/<creature-slug>/` (for example `creatures/cactus-kid/`).
2. Copy `creatures/_template/creature_TEMPLATE_refsheet.svg` into it and rename it `creature_<creature-slug>_refsheet.svg`.
3. Open it in Inkscape. Draw only on the `ART ...` layers. The frame and blue hit-zone guides are locked so you can't move them by accident.
4. The reference sheet is for design. It never gets exported into `exports/`.

## Naming

`<type>_<name>[_<part>][_<view>].<ext>`

- All lowercase, words joined with hyphens, fields joined with underscores. No spaces, no capitals, no version numbers (git keeps history).
- Types: `creature`, `weapon`, `clothing`, `acc` (accessory), `bg`, `ui`.
- Views: `front`, `side`, `three-quarter`.
- Exports keep exactly the same name as their master, only the extension changes.

| Master (SVG) | Exports |
|---|---|
| `creatures/cactus-kid/creature_cactus-kid_front.svg` | `exports/creatures/creature_cactus-kid_front.png` and `.webp` |
| `creatures/cactus-kid/creature_cactus-kid_front.svg` (arm layer only) | `exports/creatures/creature_cactus-kid_front_arm-left.png` and `.webp` |
| `weapons/weapon_goo-blaster.svg` | `exports/weapons/weapon_goo-blaster.png` and `.webp` |
| `ui/ui_icon-reload.svg` | `exports/ui/ui_icon-reload.svg` (optimized) |
| `backgrounds/bg_main-street.svg` | `exports/backgrounds/bg_main-street.webp` |

Why lowercase: Windows ignores capitals in file names but GitHub Pages doesn't. `Cactus.png` and `cactus.png` work on this PC and break on the live site.

## Export sizes

| Asset | Canvas (Inkscape page) | Export size | Notes |
|---|---|---|---|
| Creatures | 1024 × 1024 px | 1024 × 1024 | Feet on a baseline near the bottom, centred. On a phone a creature shows at roughly 180 to 550 screen pixels tall, so 1024 covers sharp 3x screens with headroom. |
| Moving creature parts (arms, eyes, weak spot) | Same 1024 × 1024 canvas as the body | 1024 × 1024 | Export each part on the full canvas so everything lines up with no position math. |
| Weapons, clothing, accessories (standalone) | 512 × 512 px | 512 × 512 | Pieces worn by a creature use the creature's 1024 canvas instead, same as parts. |
| UI icons | 64 × 64 px (draw on a whole-pixel grid) | Optimized SVG, or 128 × 128 PNG/WebP | SVG preferred. |
| Backgrounds | 1290 × 2796 px (portrait) | 1290 × 2796 WebP | Opaque, no transparency needed. The game crops edges on differently shaped phones, so keep important things in the middle. |

Size targets: creatures under about 150 KB as WebP, backgrounds under about 400 KB. These are starting targets, not hard limits.

## Exporting a transparent PNG or WebP from Inkscape 1.4

1. Open the layers panel (**Layer > Layers and Objects**, or Ctrl+Shift+L). Hide any guide, sketch or reference layers (click the eye).
2. **File > Document Properties** (Ctrl+Shift+D). Make sure the background color's alpha (the **A** value) is **0**. Turning on **Checkerboard** shows transparency on screen; it never appears in the export.
3. Open **File > Export** (Ctrl+Shift+E), tab **Single Image**.
4. Pick **Page** for a whole creature, or **Selection** for one object (tick **Export Selected Only** so nothing behind it sneaks in).
5. Set **Width** in pixels from the table above. Height follows.
6. Pick **PNG** in the file type dropdown, set the file name to `art/exports/<type>/<name>.png`, and click **Export**.
7. Switch the dropdown to **WebP**, same name with `.webp`, and export again. Use lossless for creatures, parts and gear; quality 80 lossy is fine for backgrounds.
8. For an SVG the game will load directly: **File > Save a Copy**, type **Optimized SVG**, into `exports/<type>/`. Save masters themselves as **Inkscape SVG** (plain SVG throws away layers).

## Which format the game uses

| Format | Use it for | Why |
|---|---|---|
| SVG | UI icons, meters, simple flat shapes, anything the code animates or recolors | Sharp at any size, tiny files. The game already draws its scene as SVG. |
| WebP | What the game loads for creatures, gear and backgrounds | Much smaller than PNG with the same transparency. Supported by every phone browser this game targets. |
| PNG | Lossless backup of every raster export, and a fallback if WebP ever causes trouble | Universal, lossless, easy to open anywhere. |

## For Claude (technical notes)

- Game code imports exports directly, for example `import url from '../../art/exports/creatures/creature_cactus-kid_front.webp'`. Vite copies and fingerprints only files that are imported, so unused exports never ship. No Vite config change needed; `base: './'` already handles GitHub Pages paths.
- Masters in `art/` other than `exports/` are never imported by game code.
- `art/references/` is ignored by git (its own `.gitignore`).
- The reference-sheet template's hit-zone guides use 40 px = 1 game unit, drawn from `BODY` in `src/game/duel.ts`. If `BODY` changes, update the guides.
