#!/usr/bin/env python3
"""backgrounds.py: build the background layers from the image-model output in art/bg and write art/bg.js
(data URLs, so the game loads them from file://).
  far:     art/bg/far.png (400x240 art, sky + moon + cloud sea), baked to 2x, static behind the room.
  islands: the keyed silhouettes in art/bg/islands.png, cut apart, given a moonlit rim, and laid out on a
           transparent 640x240 strip that repeats and scrolls slowly in wide rooms.
"""
import base64, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '.claude', 'skills', 'pixel-art', 'scripts'))
from pixel import Palette, read_png, write_png
pal = Palette.load('N')
ART = os.path.join(HERE, '..', 'art')

def scale2(rows): return [[p for p in r for _ in (0, 1)] for r in rows for _ in (0, 1)]

# ---- islands: connected components of the opaque pixels
w, h, src = read_png(os.path.join(ART, 'bg', 'islands.png'))
seen = [[False] * w for _ in range(h)]
shapes = []
for y in range(h):
    for x in range(w):
        if src[y][x][3] and not seen[y][x]:
            stack, pts = [(x, y)], []
            seen[y][x] = True
            while stack:
                cx, cy = stack.pop(); pts.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and src[ny][nx][3] and not seen[ny][nx]:
                            seen[ny][nx] = True; stack.append((nx, ny))
            if len(pts) > 40: shapes.append(pts)
shapes.sort(key=lambda p: min(x for x, _ in p))
def shape_mask(pts, half=False):
    x0, y0 = min(x for x, _ in pts), min(y for _, y in pts)
    sw, sh = max(x for x, _ in pts) - x0 + 1, max(y for _, y in pts) - y0 + 1
    m = [[False] * sw for _ in range(sh)]
    for x, y in pts: m[y - y0][x - x0] = True
    if half:
        m = [[m[y][x] or m[y][min(x + 1, sw - 1)] for x in range(0, sw, 2)] for y in range(0, sh, 2)]
    return m
def shade(m, far):
    """silhouette darker than the sky, with a thin moonlit rim on the upper left."""
    body, rim = ('bg1', 'bg2') if far else ('bg0', 'bg3')
    sh, sw = len(m), len(m[0])
    out = [[None] * sw for _ in range(sh)]
    for y in range(sh):
        for x in range(sw):
            if not m[y][x]: continue
            up = y == 0 or not m[y - 1][x]; left = x == 0 or not m[y][x - 1]
            out[y][x] = rim if (up or (left and y < sh * 0.6)) else body
    return out
print(len(shapes), 'island shapes')
SW, SH = 640, 240
strip = [[(0, 0, 0, 0)] * SW for _ in range(SH)]
def place(img, ox, oy):
    for y, r in enumerate(img):
        for x, c in enumerate(r):
            if c and 0 <= oy + y < SH: strip[oy + y][(ox + x) % SW] = pal[c]
r = random.Random(4)
# far (half size, dimmer) first, then near ones in front
for i, (ox, oy) in enumerate([(40, 96), (250, 84), (470, 100), (590, 90)]):
    place(shade(shape_mask(shapes[(i * 2 + 1) % len(shapes)], True), True), ox, oy)
for i, (ox, oy) in enumerate([(150, 78), (360, 62), (520, 104)]):
    place(shade(shape_mask(shapes[[0, 4, 2][i] % len(shapes)]), False), ox, oy)
write_png(os.path.join(ART, 'bg', 'islands_strip.png'), SW, SH, strip)

fw, fh, far = read_png(os.path.join(ART, 'bg', 'far.png'))
write_png(os.path.join(ART, 'bg', 'far_2x.png'), fw * 2, fh * 2, scale2(far))
write_png(os.path.join(ART, 'bg', 'islands_strip_2x.png'), SW * 2, SH * 2, scale2(strip))
url = lambda p: 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
with open(os.path.join(ART, 'bg.js'), 'w') as f:
    f.write('// written by tools/backgrounds.py: background layers (2x baked in) as data URLs, so they load from file://\n')
    f.write(f"window.PIXEL_BG = {{ far: '{url(os.path.join(ART, 'bg', 'far_2x.png'))}',\n"
            f"  islands: '{url(os.path.join(ART, 'bg', 'islands_strip_2x.png'))}' }};\n")
print('art/bg.js written')
