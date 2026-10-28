import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprites
from pixel import write_png
names = sys.argv[2].split(',') if len(sys.argv) > 2 else None
entries = [(n, s) for n, s in sprites.build() if not names or any(n.startswith(p) for p in names)]
k = int(sys.argv[3]) if len(sys.argv) > 3 else 8; pad = 6
W = sum(s.w * k + pad for _, s in entries) + pad; H = max(s.h for _, s in entries) * k + 2 * pad
bg = sprites.pal['stone1']; rows = [[bg] * W for _ in range(H)]
x = pad
for _, s in entries:
    img = s.scaled(k); y0 = H - pad - s.h * k
    for yy, r in enumerate(img):
        for xx, p in enumerate(r):
            if p[3]: rows[y0 + yy][x + xx] = p
    x += s.w * k + pad
write_png(sys.argv[1], W, H, rows)
