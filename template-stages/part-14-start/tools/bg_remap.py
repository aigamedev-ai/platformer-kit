#!/usr/bin/env python3
"""bg_remap.py: pixelize a model background by brightness rank, so it keeps its composition but lands on the dark
end of the palette (nearest-colour mapping lets a bright model sky jump to the cloud shades).
    python3 tools/bg_remap.py raw.png out.png --colours bg0,bg1,bg2,bg3,cloud0,cloud1 --cuts 0.30,0.55,0.75,0.9,0.985
cuts: brightness quantiles between consecutive colours. Ordered 4x4 dithering across each boundary.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.claude', 'skills', 'pixel-art', 'scripts'))
from pixel import Palette, read_png, write_png
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
a = sys.argv[1:]
opt = lambda k, d=None: a[a.index('--' + k) + 1] if '--' + k in a else d
pal = Palette.load('N')
cols = [pal[n] for n in opt('colours').split(',')]
cuts = [float(x) for x in opt('cuts').split(',')]
W, H = 400, 240
sw, sh, src = read_png(a[0])
lum = []
for y in range(H):
    row = []
    for x in range(W):
        x0, x1, y0, y1 = x * sw // W, (x + 1) * sw // W, y * sh // H, (y + 1) * sh // H
        t = n = 0
        for yy in range(y0, y1, 2):
            for xx in range(x0, x1, 2):
                r, g, b, _ = src[yy][xx]; t += 0.3 * r + 0.55 * g + 0.15 * b; n += 1
        row.append(t / n)
    lum.append(row)
flat = sorted(v for r in lum for v in r)
th = [flat[min(len(flat) - 1, int(c * len(flat)))] for c in cuts]
soft = float(opt('soft', '3'))
out = []
for y in range(H):
    row = []
    for x in range(W):
        v = lum[y][x] + (BAYER[y % 4][x % 4] / 15 - 0.5) * 2 * soft   # dither across each threshold
        k = sum(v > t for t in th)
        row.append(cols[k])
    out.append(row)
write_png(a[1], W, H, out)
print(a[1])
