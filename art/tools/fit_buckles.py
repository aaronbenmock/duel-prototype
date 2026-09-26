r"""Fit the wardrobe-worlds belt buckles over each alien's painted buckle on the aiming sprites.

For each alien the painted buckle is found by colour (gold oval; Gold's is a grey plate) on the belt, then each
new buckle design is scaled (never distorted) and centred so it hides the old buckle and its outline completely:
coverage is measured (old buckle grown by 5 px must sit under opaque new-buckle pixels) and the scale is raised in
2% steps until it is 100%. The designs are copied unchanged; only placement is computed.

Outputs art/ready-for-production/high-moon-buckles/: the two designs (PNG + WebP), fit.json (placement in sprite
canvas pixels) and review/BUCKLE-FIT.jpg.

Usage: "C:\Program Files\Inkscape\bin\python.exe" art\tools\fit_buckles.py
"""

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

from build_skins import label, rgb_hsv

ROOT = Path(__file__).resolve().parents[2]
DRAFT = ROOT / 'art' / 'drafts' / 'high-moon-wardrobe-worlds' / 'v01' / 'accessories'
OUT = ROOT / 'art' / 'ready-for-production' / 'high-moon-buckles'
ALIENS = ['sage', 'blue', 'gold', 'violet']
DESIGNS = ['ringed-moon', 'meteor']


def painted_buckle(alien, a):
    h, s, v = rgb_hsv(a)
    Y, X = np.mgrid[:1024, :1024]
    region = (Y > 600) & (Y < 740) & (X > 400) & (X < 640) & (a[:, :, 3] > 200)
    cand = region & ((s < 0.15) & (v > 0.5) if alien == 'gold' else (h > 0.08) & (h < 0.17) & (s > 0.35) & (v > 0.6))
    lab = label(cand)
    best = None
    for k, n in zip(*np.unique(lab[cand], return_counts=True)):
        xs = np.nonzero(lab == k)[1]
        score = n - abs(xs.mean() - 512) * 20
        if best is None or score > best[0]:
            best = (score, k)
    m = lab == best[1]
    for _ in range(5):  # include the dark outline
        p = np.pad(m, 1)
        m = m | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return m


def place(design, m, k):
    bx = design.getbbox()
    ys, xs = np.nonzero(m)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    size = int(round(512 * k))
    px = int(round(cx - (bx[0] + bx[2]) / 2 * k))
    py = int(round(cy - (bx[1] + bx[3]) / 2 * k))
    layer = Image.new('RGBA', (1024, 1024))
    layer.alpha_composite(design.resize((size, size), Image.LANCZOS), (px, py))
    covered = float((np.array(layer)[:, :, 3][m] > 200).mean())
    return {'x': px, 'y': py, 'size': size}, covered, layer


def main():
    (OUT / 'review').mkdir(parents=True, exist_ok=True)
    designs = {}
    for d in DESIGNS:
        src = DRAFT / f'buckle_{d}.png'
        img = Image.open(src).convert('RGBA')
        designs[d] = img
        img.save(OUT / f'acc_buckle-{d}.png', optimize=True)
        img.save(OUT / f'acc_buckle-{d}.webp', quality=90, alpha_quality=100, method=6)
    fit = {}
    sheet = Image.new('RGB', (4 * 300, 3 * 300), '#e7dfd3')
    for i, alien in enumerate(ALIENS):
        a = np.array(Image.open(ROOT / 'art' / 'exports' / 'creatures' / f'creature_desert-{alien}_revolver_front.png').convert('RGBA'))
        m = painted_buckle(alien, a)
        ys, xs = np.nonzero(m)
        cx, cy = int((xs.min() + xs.max()) / 2), int((ys.min() + ys.max()) / 2)
        base = Image.new('RGBA', (1024, 1024), '#e7dfd3')
        base.alpha_composite(Image.fromarray(a))
        sheet.paste(base.crop((cx - 150, cy - 150, cx + 150, cy + 150)).convert('RGB'), (i * 300, 0))
        fit[f'desert-{alien}'] = {}
        for j, d in enumerate(DESIGNS):
            bx = designs[d].getbbox()
            k = max((xs.max() - xs.min() + 6) / (bx[2] - bx[0]), (ys.max() - ys.min() + 6) / (bx[3] - bx[1]))
            for _ in range(10):
                spot, covered, layer = place(designs[d], m, k)
                if covered >= 0.999:
                    break
                k *= 1.02
            assert covered >= 0.999, f'{alien} {d}: only {covered:.3f} of the old buckle hidden'
            fit[f'desert-{alien}'][d] = {**spot, 'covered': round(covered, 4)}
            comp = base.copy()
            comp.alpha_composite(layer)
            sheet.paste(comp.crop((cx - 150, cy - 150, cx + 150, cy + 150)).convert('RGB'), (i * 300, (j + 1) * 300))
    sheet.save(OUT / 'review' / 'BUCKLE-FIT.jpg', quality=90)
    (OUT / 'fit.json').write_text(json.dumps(fit, indent=1) + '\n')
    exports = ROOT / 'art' / 'exports' / 'accessories'
    for d in DESIGNS:
        for ext in ('png', 'webp'):
            shutil.copy2(OUT / f'acc_buckle-{d}.{ext}', exports / f'acc_buckle-{d}.{ext}')
    print(json.dumps(fit))


if __name__ == '__main__':
    main()
