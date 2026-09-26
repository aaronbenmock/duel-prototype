r"""Build the skin (colour variant) package for the aiming-revolver sprites and first-person hands.

The wardrobe-worlds draft (art/drafts/high-moon-wardrobe-worlds/v01) recoloured the OLD holstered sprites.
The game shows the aiming-revolver poses (v0.6.10+), so this applies the same palettes, with the same method
(masked HSV shift of skin pixels only; alpha and every non-skin pixel untouched), to the sprites and
hand pictures the game actually uses.

Masks:
  opponent sprites  skin-colour range (the draft's rules) split into connected regions, minus regions
                    that aren't skin (Blue's hat band, Gold's chaps / boots / embroidery / tongue / gun
                    cylinder, Violet's grey-pink gun), listed per alien below
  first-person      the hand pictures of the four aliens are pixel-aligned recolours of each other, so the
                    hand is exactly the pixels that differ between them (the gun is the same in all four)

Outputs art/ready-for-production/high-moon-skins/ (PNG + WebP, masks, review sheets, manifest.json).
Checks (asserted): alpha identical to the source, every pixel outside the mask identical, files decode.

Usage (Inkscape's Python has Pillow + numpy):
  "C:\Program Files\Inkscape\bin\python.exe" art\tools\build_skins.py
"""

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
EXPORTS = ROOT / 'art' / 'exports'
OUT = ROOT / 'art' / 'ready-for-production' / 'high-moon-skins'
ALIENS = ['sage', 'blue', 'gold', 'violet']
GUNS = ['star-revolver', 'wrapped-scattergun', 'desert-raygun']

# (name, target hue 0..1, saturation multiplier, value multiplier): from the draft's prepare_skins.py.
PALETTES = {
    'sage': [('dusty-coral', 0.012, 0.95, 0.98), ('glacier-blue', 0.55, 1.0, 1.0), ('moon-lilac', 0.755, 0.90, 0.98)],
    'blue': [('mint', 0.38, 0.80, 0.97), ('peach', 0.06, 0.80, 1.0), ('orchid', 0.79, 0.75, 0.98)],
    'gold': [('celadon', 0.36, 0.40, 0.86), ('periwinkle', 0.625, 0.45, 0.90), ('rose', 0.93, 0.40, 0.90)],
    'violet': [('seafoam', 0.43, 0.95, 1.02), ('ice-blue', 0.565, 0.9, 1.06), ('apricot', 0.075, 1.05, 1.10)],
}


def rgb_hsv(a):
    rgb = a[:, :, :3].astype(float) / 255
    mx = rgb.max(2)
    mn = rgb.min(2)
    d = mx - mn
    s = np.divide(d, mx, out=np.zeros_like(d), where=mx != 0)
    h = np.zeros_like(mx)
    nz = d > 0
    for k in range(3):
        m = nz & (rgb[:, :, k] == mx)
        if k == 0:
            h[m] = ((rgb[:, :, 1][m] - rgb[:, :, 2][m]) / d[m]) % 6
        elif k == 1:
            h[m] = (rgb[:, :, 2][m] - rgb[:, :, 0][m]) / d[m] + 2
        else:
            h[m] = (rgb[:, :, 0][m] - rgb[:, :, 1][m]) / d[m] + 4
    return h / 6, s, mx


def hsv_rgb(h, s, v):
    i = np.floor(h * 6).astype(int)
    f = h * 6 - i
    i = i % 6
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    out = np.zeros((*h.shape, 3))
    for k, ch in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k
        for c in range(3):
            out[:, :, c][m] = ch[c][m]
    return np.uint8(np.clip(np.rint(out * 255), 0, 255))


def label(m):
    """Connected regions (8-neighbour) of a boolean mask: each pixel gets its region's smallest index."""
    H, W = m.shape
    big = H * W + 1
    lab = np.where(m, np.arange(H * W).reshape(H, W), big)
    while True:
        p = np.pad(lab, 1, constant_values=big)
        n = lab.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                n = np.minimum(n, p[1 + dy:1 + dy + H, 1 + dx:1 + dx + W])
        n = np.where(m, n, big)
        flat = n.ravel()
        ok = flat < big
        for _ in range(3):
            flat[ok] = np.minimum(flat[ok], flat[flat[ok]])
        n = flat.reshape(H, W)
        if np.array_equal(n, lab):
            return lab
        lab = n


def sprite_mask(alien, a):
    h, s, v = rgb_hsv(a)
    R, B = a[:, :, 0].astype(float), a[:, :, 2].astype(float)
    valid = a[:, :, 3] > 32
    if alien == 'sage':
        m = valid & (h > 0.14) & (h < 0.34) & (s > 0.13) & (v > 0.20)
    elif alien == 'blue':
        m = valid & (h > 0.49) & (h < 0.65) & (s > 0.12) & (v > 0.20)
    elif alien == 'violet':
        # s > 0.15 drops her revolver, which is tinted pink-grey (saturation about 0.01).
        m = valid & (h > 0.75) & (h < 0.97) & (R > 118) & (B > 105) & (v > 0.45) & (s > 0.15)
    else:
        main = (h > 0.07) & (h < 0.15) & (s > 0.35) & (v > 0.48)
        coral = ((h < 0.075) | (h > 0.97)) & (s > 0.32) & (v > 0.45)
        m = valid & (main | coral)
    lab = label(m)
    keep = np.zeros_like(m)
    removed = []
    for i in np.unique(lab[m]):
        region = lab == i
        ys, xs = np.nonzero(region)
        box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        why = None
        if alien == 'blue' and box[3] < 225:
            why = 'hat band (above the head)'
        if alien == 'gold':
            if np.median(s[region]) < 0.6:
                why = 'chaps, boots, embroidery or hat band (less saturated than skin)'
            elif 455 <= xs.mean() <= 510 and 405 <= ys.mean() <= 450:
                why = 'tongue'
            elif box[2] < 240 and box[3] < 390:
                why = 'revolver cylinder'
        if why:
            if len(ys) > 50:
                removed.append({'pixels': int(len(ys)), 'bbox': box, 'reason': why})
        else:
            keep |= region
    return keep, removed


def hand_masks(gun):
    ims = {c: np.array(Image.open(EXPORTS / 'weapons' / f'weapon_{gun}_{c}_pov.png').convert('RGBA')) for c in ALIENS}
    st = np.stack([ims[c][:, :, :3].astype(int) for c in ALIENS])
    d = np.zeros(st.shape[1:3])
    for i in range(4):
        for j in range(i + 1, 4):
            d = np.maximum(d, np.abs(st[i] - st[j]).sum(2))
    return ims, {c: (d > 80) & (ims[c][:, :, 3] > 40) for c in ALIENS}


def recolour(a, mask, target, smul, vmul):
    h, s, v = rgb_hsv(a)
    median = float(np.median(h[mask]))
    nh = (h + (target - median)) % 1.0
    out = a.copy()
    out[mask, :3] = hsv_rgb(nh, np.clip(s * smul, 0, 1), np.clip(v * vmul, 0, 1))[mask]
    assert np.array_equal(out[:, :, 3], a[:, :, 3]), 'alpha changed'
    assert np.array_equal(out[~mask], a[~mask]), 'pixels outside the mask changed'
    return out, target - median


def save(arr, path):
    img = Image.fromarray(arr)
    img.save(path.with_suffix('.png'), optimize=True)
    img.save(path.with_suffix('.webp'), quality=90, alpha_quality=100, method=6)
    for ext in ('.png', '.webp'):
        back = Image.open(path.with_suffix(ext))
        back.load()
        assert back.size == img.size
    return {
        'png': path.with_suffix('.png').relative_to(OUT).as_posix(),
        'webp': path.with_suffix('.webp').relative_to(OUT).as_posix(),
        'webp_bytes': path.with_suffix('.webp').stat().st_size,
        'sha256_png': hashlib.sha256(path.with_suffix('.png').read_bytes()).hexdigest(),
    }


def main():
    for sub in ('creatures', 'weapons', 'masks', 'review'):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    manifest = {'source_package': 'art/drafts/high-moon-wardrobe-worlds/v01 (skins, palettes)', 'palettes': PALETTES, 'creatures': [], 'hands': [], 'masks': {}}
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 20)
    sheet = Image.new('RGB', (4 * 300, 4 * 330), '#e7dfd3')
    dr = ImageDraw.Draw(sheet)
    masks_sheet = Image.new('RGB', (4 * 300, 330), '#e7dfd3')
    for row, alien in enumerate(ALIENS):
        src = np.array(Image.open(EXPORTS / 'creatures' / f'creature_desert-{alien}_revolver_front.png').convert('RGBA'))
        mask, removed = sprite_mask(alien, src)
        Image.fromarray(np.uint8(mask) * 255).save(OUT / 'masks' / f'skin_{alien}_revolver_front.png')
        manifest['masks'][alien] = {'pixels': int(mask.sum()), 'removed_regions': removed}
        vis = src.copy()
        vis[mask] = [255, 0, 160, 255]
        cell = Image.new('RGBA', (1024, 1024), '#ddd5c9')
        cell.alpha_composite(Image.fromarray(vis))
        masks_sheet.paste(cell.convert('RGB').resize((300, 300)), (row * 300, 30))
        ImageDraw.Draw(masks_sheet).text((row * 300 + 8, 4), f'{alien}: pink = recoloured', font=font, fill='#312735')
        cells = [('original', src)]
        for name, target, smul, vmul in PALETTES[alien]:
            out, shift = recolour(src, mask, target, smul, vmul)
            ident = f'creature_desert-{alien}_{name}_revolver_front'
            info = save(out, OUT / 'creatures' / ident)
            manifest['creatures'].append({'id': ident, 'alien': f'desert-{alien}', 'skin': name, 'hue_shift': round(shift, 4), **info})
            cells.append((name, out))
        for col, (name, arr) in enumerate(cells):
            cell = Image.new('RGBA', (1024, 1024), '#e7dfd3')
            cell.alpha_composite(Image.fromarray(arr))
            sheet.paste(cell.convert('RGB').resize((300, 300)), (col * 300, row * 330 + 30))
            dr.text((col * 300 + 8, row * 330 + 6), f'{alien} / {name}', font=font, fill='#312735')
    sheet.save(OUT / 'review' / 'SKINS-REVOLVER-REVIEW.jpg', quality=90)
    masks_sheet.save(OUT / 'review' / 'SKIN-MASKS-REVIEW.jpg', quality=90)

    hands = Image.new('RGB', (4 * 260 * 3, 4 * 280), '#e7dfd3')
    hd = ImageDraw.Draw(hands)
    for g, gun in enumerate(GUNS):
        ims, masks = hand_masks(gun)
        for row, alien in enumerate(ALIENS):
            Image.fromarray(np.uint8(masks[alien]) * 255).save(OUT / 'masks' / f'hand_{gun}_{alien}.png')
            for col, (name, target, smul, vmul) in enumerate(PALETTES[alien]):
                out, shift = recolour(ims[alien], masks[alien], target, smul, vmul)
                ident = f'weapon_{gun}_{alien}-{name}_pov'
                info = save(out, OUT / 'weapons' / ident)
                manifest['hands'].append({'id': ident, 'gun': gun, 'alien': f'desert-{alien}', 'skin': name, 'hue_shift': round(shift, 4), **info})
                cell = Image.new('RGBA', (1024, 1024), '#e7dfd3')
                cell.alpha_composite(Image.fromarray(out))
                hands.paste(cell.convert('RGB').resize((260, 260)), ((g * 4 + col) * 260, row * 280 + 20))
                hd.text(((g * 4 + col) * 260 + 6, row * 280), f'{alien}-{name}', font=font, fill='#312735')
    hands.save(OUT / 'review' / 'HANDS-REVIEW.jpg', quality=85)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'creatures': len(manifest['creatures']), 'hands': len(manifest['hands']),
                      'mask_pixels': {a: m['pixels'] for a, m in manifest['masks'].items()},
                      'removed': {a: [r['reason'] for r in m['removed_regions']] for a, m in manifest['masks'].items()}}, indent=1))


if __name__ == '__main__':
    main()
