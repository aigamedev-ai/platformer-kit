#!/usr/bin/env python3
"""pixel.py: small pixel-art helpers. Standard library only (uses Pillow for speed if it is installed).

As a library (put this folder on sys.path):
    from pixel import Palette, Sprite, save_sheet, pixelize, read_png, write_png
    pal = Palette.load('N')                         # ramps from palettes.json, or Palette({'moss': ['#..', ...]})
    s = Sprite(12, 16, pal)
    s.stamp(["..oo..", ".oHHo."], {'o': 'ink', 'H': 'hair1'})   # rows of characters -> colour names
    spent = s.recolor({'scarf1': 'spent1'})        # palette swap for a game state
    save_sheet([('hero_idle0', s), ...], 'out/sheet')   # sheet.png + sheet.json (Phaser atlas)

Command line:
    python3 pixel.py pixelize in.png out.png --size 400x240 --palette N --ramps bg,cloud [--method mode|mean] [--dither]
                     (or --colours bg0,bg1,bg2,cloud1 for exact shades: keep backgrounds to the dark end)
    python3 pixel.py procbg out.png --palette N --kind night|cave [--size 400x240] [--seed 1]
    python3 pixel.py swatch out.png --palette N
    python3 pixel.py scale in.png out.png 2          # nearest-neighbour upscale for checking at 2x / 4x
"""
import json, math, os, random, struct, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
try:
    from PIL import Image as _PIL  # optional, only for speed
    if os.environ.get('PIXEL_NO_PIL'): _PIL = None
except Exception:
    _PIL = None


# ------------------------------------------------------------------ PNG in/out (8-bit, non-interlaced)
def read_png(path):
    """-> (w, h, rows) where rows[y][x] = (r, g, b, a)."""
    if _PIL:
        im = _PIL.open(path).convert('RGBA'); w, h = im.size; b = im.tobytes()
        return w, h, [[tuple(b[i:i + 4]) for i in range(y * w * 4, (y + 1) * w * 4, 4)] for y in range(h)]
    data = open(path, 'rb').read()
    if data[:8] != b'\x89PNG\r\n\x1a\n': raise ValueError(f'{path}: not a PNG')
    pos, idat, plte, trns = 8, b'', None, None
    while pos < len(data):
        n, typ = struct.unpack('>I4s', data[pos:pos + 8]); body = data[pos + 8:pos + 8 + n]; pos += 12 + n
        if typ == b'IHDR': w, h, depth, ctype, _, _, inter = struct.unpack('>IIBBBBB', body)
        elif typ == b'PLTE': plte = body
        elif typ == b'tRNS': trns = body
        elif typ == b'IDAT': idat += body
        elif typ == b'IEND': break
    if depth != 8 or inter: raise ValueError(f'{path}: only 8-bit non-interlaced PNGs (install Pillow for others)')
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    raw = zlib.decompress(idat); stride = w * ch
    out, prev, p = [], bytearray(stride), 0
    for y in range(h):
        f = raw[p]; line = bytearray(raw[p + 1:p + 1 + stride]); p += 1 + stride
        if f == 1:
            for i in range(ch, stride): line[i] = (line[i] + line[i - ch]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride): line[i] = (line[i] + ((line[i - ch] if i >= ch else 0) + prev[i]) // 2) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0; b = prev[i]; c = prev[i - ch] if i >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        prev = line
        if ctype == 6: row = [tuple(line[i:i + 4]) for i in range(0, stride, 4)]
        elif ctype == 2: row = [(line[i], line[i + 1], line[i + 2], 255) for i in range(0, stride, 3)]
        elif ctype == 0: row = [(v, v, v, 255) for v in line]
        elif ctype == 4: row = [(line[i], line[i], line[i], line[i + 1]) for i in range(0, stride, 2)]
        else: row = [tuple(plte[v * 3:v * 3 + 3]) + ((trns[v] if trns and v < len(trns) else 255),) for v in line]
        out.append(row)
    return w, h, out


def write_png(path, w, h, rows):
    """rows[y][x] = (r, g, b, a)."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    if _PIL:
        im = _PIL.new('RGBA', (w, h)); im.putdata([px for r in rows for px in r]); im.save(path); return
    raw = b''.join(b'\x00' + bytes(v for px in r for v in px) for r in rows)
    chunk = lambda t, b: struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ------------------------------------------------------------------ palette
class Palette:
    """Named ramps -> colours. pal['moss3'] -> (r, g, b, 255). A bare ramp name means its first shade."""
    def __init__(self, ramps, roles=None, title=''):
        self.ramps, self.roles, self.title = ramps, roles or {}, title
        self.c = {f'{k}{i}': hexrgb(v) + (255,) for k, vs in ramps.items() for i, v in enumerate(vs)}

    @classmethod
    def load(cls, name_or_path):
        if os.path.exists(name_or_path):
            d = json.load(open(name_or_path))
        else:
            d = json.load(open(os.path.join(HERE, 'palettes.json')))[name_or_path]
        return cls(d['ramps'], d.get('roles'), d.get('title', ''))

    def __getitem__(self, k):
        return self.c[k] if k in self.c else self.c[k + '0']

    def names(self, ramps=None):
        return [n for n in self.c if ramps is None or n.rstrip('0123456789') in ramps]


# ------------------------------------------------------------------ sprite
class Sprite:
    """A w x h RGBA pixel grid drawn with palette names. None = transparent."""
    def __init__(self, w, h, pal):
        self.w, self.h, self.pal = w, h, pal
        self.a = [[(0, 0, 0, 0)] * w for _ in range(h)]

    def copy(self):
        s = Sprite(self.w, self.h, self.pal); s.a = [r[:] for r in self.a]; return s

    def px(self, x, y, col):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y][x] = (0, 0, 0, 0) if col is None else self.pal[col]

    def rect(self, x0, y0, x1, y1, col):            # inclusive
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.px(x, y, col)

    def stamp(self, rows, legend, ox=0, oy=0):
        """rows: equal-length strings; legend: char -> colour name. '.' and ' ' skip, '_' erases."""
        if len({len(r) for r in rows}) != 1: raise ValueError(f'rows differ in length: {[len(r) for r in rows]}')
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch in '. ': continue
                self.px(ox + x, oy + y, None if ch == '_' else legend[ch])
        return self

    def paste(self, other, ox, oy):
        for y in range(other.h):
            for x in range(other.w):
                if other.a[y][x][3] and 0 <= ox + x < self.w and 0 <= oy + y < self.h: self.a[oy + y][ox + x] = other.a[y][x]
        return self

    def recolor(self, mapping):
        """palette swap: {'scarf1': 'spent1', ...} -> new sprite."""
        m = {self.pal[k]: self.pal[v] for k, v in mapping.items()}
        s = self.copy(); s.a = [[m.get(p, p) for p in r] for r in self.a]; return s

    def flip(self):
        s = self.copy(); s.a = [r[::-1] for r in self.a]; return s

    def outline(self, col, where='outside'):
        """selective outline helper: put `col` on transparent pixels touching the sprite (4-neighbour)."""
        s = self.copy()
        for y in range(self.h):
            for x in range(self.w):
                if self.a[y][x][3]: continue
                if any(0 <= x + dx < self.w and 0 <= y + dy < self.h and self.a[y + dy][x + dx][3]
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): s.px(x, y, col)
        return s

    def scaled(self, k):
        return [[p for p in r for _ in range(k)] for r in self.a for _ in range(k)]

    def save(self, path, scale=1):
        write_png(path, self.w * scale, self.h * scale, self.scaled(scale))


def save_sheet(entries, out_base, width=256, gap=1, art_scale=1, js_var='PIXEL_ART'):
    """entries: [(name, Sprite)]. Writes <out_base>.png, <out_base>.json (Phaser JSON-hash atlas) and <out_base>.js,
    which sets window.<js_var> = { image: <PNG data URL>, atlas: <the JSON> } so a game opened from file:// can load
    it without a server: <script src="art/sheet.js"></script>, then in preload()
    this.load.atlas('art', PIXEL_ART.image, PIXEL_ART.atlas). art_scale=2 bakes the 2x upscale into the sheet."""
    x = y = rowh = 0; pos = {}
    for n, s in entries:
        w, h = s.w * art_scale, s.h * art_scale
        if x + w > width: x, y, rowh = 0, y + rowh + gap, 0
        pos[n] = (x, y, w, h); x += w + gap; rowh = max(rowh, h)
    H = y + rowh
    rows = [[(0, 0, 0, 0)] * width for _ in range(H)]
    for n, s in entries:
        px, py, w, h = pos[n]; img = s.scaled(art_scale)
        for yy in range(h):
            for xx in range(w):
                if img[yy][xx][3]: rows[py + yy][px + xx] = img[yy][xx]
    write_png(out_base + '.png', width, H, rows)
    frames = {n: {'frame': {'x': p[0], 'y': p[1], 'w': p[2], 'h': p[3]}, 'rotated': False, 'trimmed': False,
                  'spriteSourceSize': {'x': 0, 'y': 0, 'w': p[2], 'h': p[3]}, 'sourceSize': {'w': p[2], 'h': p[3]}}
              for n, p in pos.items()}
    atlas = {'frames': frames, 'meta': {'image': os.path.basename(out_base) + '.png', 'format': 'RGBA8888',
                                        'size': {'w': width, 'h': H}, 'scale': '1'}}
    json.dump(atlas, open(out_base + '.json', 'w'), indent=1)
    if js_var:
        import base64
        url = 'data:image/png;base64,' + base64.b64encode(open(out_base + '.png', 'rb').read()).decode()
        with open(out_base + '.js', 'w') as f:
            f.write(f'// written by pixel.py: sprite sheet as a data URL + Phaser atlas (works from file://)\n'
                    f'window.{js_var} = {json.dumps({"image": url, "atlas": atlas}, separators=(",", ":"))};\n')
    return pos


# ------------------------------------------------------------------ pixelize / palette snap
BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def _nearest(cols):
    w = (0.30 * 3, 0.59 * 3, 0.11 * 3); memo = {}
    def f(r, g, b):
        k = (int(r) >> 2, int(g) >> 2, int(b) >> 2)
        if k not in memo:
            memo[k] = min(range(len(cols)), key=lambda i: w[0] * (r - cols[i][0]) ** 2 + w[1] * (g - cols[i][1]) ** 2
                          + w[2] * (b - cols[i][2]) ** 2)
        return memo[k]
    return f


def _nearest2(cols):
    """-> f(r,g,b) = (i1, i2, t): the two nearest colours and where the colour sits between them (0 = on i1)."""
    w = (0.30 * 3, 0.59 * 3, 0.11 * 3); memo = {}
    def f(r, g, b):
        k = (int(r) >> 2, int(g) >> 2, int(b) >> 2)
        if k not in memo:
            d = sorted(range(len(cols)), key=lambda i: w[0] * (r - cols[i][0]) ** 2 + w[1] * (g - cols[i][1]) ** 2
                       + w[2] * (b - cols[i][2]) ** 2)
            i1 = d[0]; i2 = d[1] if len(d) > 1 else d[0]
            a, c = cols[i1], cols[i2]
            seg = [w[j] * (c[j] - a[j]) for j in range(3)]
            den = sum(seg[j] * (c[j] - a[j]) for j in range(3))
            t = 0.0 if den == 0 else max(0.0, min(1.0, sum(seg[j] * ((r, g, b)[j] - a[j]) for j in range(3)) / den))
            memo[k] = (i1, i2, t)
        return memo[k]
    return f


def pixelize(src_rows, sw, sh, w, h, colours, method='mode', dither=False):
    """Shrink an image to w x h and snap it to `colours` [(r,g,b,a)...].
    method 'mode': snap every source pixel, keep each cell's most common colour (crisp shapes, no in-between
    colours; best for silhouettes and clouds). 'mean': average each cell, then snap; with dither=True a 4x4 Bayer
    pattern mixes the two nearest colours where the image sits between them (smooth skies without hard bands;
    flat areas stay flat)."""
    near = _nearest([c[:3] for c in colours]); near2 = _nearest2([c[:3] for c in colours])
    fx, fy = sw / w, sh / h
    out = []
    for y in range(h):
        y0, y1 = int(y * fy), max(int(y * fy) + 1, int((y + 1) * fy))
        row = []
        for x in range(w):
            x0, x1 = int(x * fx), max(int(x * fx) + 1, int((x + 1) * fx))
            if method == 'mode':
                cnt = {}
                for yy in range(y0, y1, max(1, (y1 - y0) // 4)):        # sample up to 4x4 per cell
                    r_ = src_rows[yy]
                    for xx in range(x0, x1, max(1, (x1 - x0) // 4)):
                        p = r_[xx]; i = near(p[0], p[1], p[2]); cnt[i] = cnt.get(i, 0) + 1
                row.append(colours[max(cnt, key=cnt.get)])
            else:
                n = r = g = b = 0
                for yy in range(y0, y1):
                    for p in src_rows[yy][x0:x1]: r += p[0]; g += p[1]; b += p[2]; n += 1
                r, g, b = r / n, g / n, b / n
                if dither:
                    i1, i2, t = near2(r, g, b)
                    row.append(colours[i2 if (BAYER4[y % 4][x % 4] + 0.5) / 16 < t * 0.999 else i1])
                else:
                    row.append(colours[near(r, g, b)])
        out.append(row)
    return out


# ------------------------------------------------------------------ procedural backgrounds (no image model)
def stepped(vals, step=3):
    out = list(vals)
    for i in range(0, len(out), step):
        v = round(sum(out[i:i + step]) / len(out[i:i + step]))
        for j in range(i, min(i + step, len(out))): out[j] = v
    return out


def ridge(n, base, amp, seed, octaves=((60, 1.0), (23, 0.45), (9, 0.18))):
    r = random.Random(seed); ph = [r.random() * 6.28 for _ in octaves]
    return [base + amp * sum(a * math.sin(x / p * 6.28 + q) for (p, a), q in zip(octaves, ph)) for x in range(n)]


def dither_band(s, y0, y1, a, b):
    """vertical transition from colour a (top) to b (bottom) with a 4x4 Bayer pattern: no hard band, no hatching."""
    for y in range(y0, y1):
        t = (y - y0 + 0.5) / max(1, y1 - y0)
        for x in range(s.w):
            s.px(x, y, b if (BAYER4[y % 4][x % 4] + 0.5) / 16 < t else a)


def sky(s, ramp_names, y0=0, y1=None, blend=16):
    """vertical bands of ramp_names (top -> bottom), each joined to the next by a dithered blend."""
    y1 = s.h if y1 is None else y1
    n = len(ramp_names); edges = [y0 + (y1 - y0) * i // n for i in range(n + 1)]
    for i, c in enumerate(ramp_names): s.rect(0, edges[i], s.w - 1, edges[i + 1] - 1, c)
    for i in range(1, n): dither_band(s, edges[i] - blend // 2, edges[i] + blend // 2, ramp_names[i - 1], ramp_names[i])


def blob_row(s, y, body, rim, under, seed, rmin=6, rmax=13):
    """a row of round blobs (cloud tops, bushes, rubble) from x = 0 to w, filled down to the bottom."""
    r = random.Random(seed); x = -rmax
    while x < s.w + rmax:
        rad = r.randint(rmin, rmax); cy = y + r.randint(-3, 3)
        for yy in range(cy - rad, s.h):
            for xx in range(x - rad, x + rad + 1):
                inside = (xx - x) ** 2 + (yy - cy) ** 2 <= rad * rad or yy >= cy
                if inside and 0 <= xx < s.w and 0 <= yy < s.h and s.a[yy][xx] != s.pal[rim]:
                    s.px(xx, yy, body)
        for k in range(200, 290, 7):                              # lit rim on the upper left of each blob
            t = math.radians(k); s.px(int(x + rad * math.cos(t)), int(cy + rad * math.sin(t)), rim)
        x += int(rad * 1.4)
    for yy in range(y + rmax // 2, s.h):                          # deeper shade lower down, dithered in
        for xx in range(s.w):
            if s.a[yy][xx] == s.pal[body] and (yy - y > rmax * 1.5 or BAYER4[yy % 4][xx % 4] < 6): s.px(xx, yy, under)


def procbg(pal, kind='night', w=400, h=240, seed=1):
    """A far background layer from the background ramps only (no image model).
    'night' (palette N): dithered night sky, stars, a dim moon, dark distant ruins, a moonlit cloud sea.
    'cave' (palette B): dark cave air, far stalactites, a distant ridge with broken rim light."""
    s = Sprite(w, h, pal); r = random.Random(seed)
    if kind == 'night':
        sky(s, ['bg0', 'bg1', 'bg2', 'bg3'], 0, int(h * .8))
        s.rect(0, int(h * .8), w - 1, h - 1, 'bg3')
        for _ in range(w * h // 1300):
            x, y = r.randrange(w), r.randrange(int(h * .55)); s.px(x, y, 'cloud3' if r.random() < .8 else 'cloud4')
        mx, my, mr = int(w * .78), int(h * .2), max(6, h // 18)  # moon: a landmark, but dimmer than the hero
        for y in range(my - mr, my + mr + 1):
            for x in range(mx - mr, mx + mr + 1):
                d = (x - mx) ** 2 + (y - my) ** 2
                if d <= mr * mr: s.px(x, y, 'cloud2' if (x - mx + 3) ** 2 + (y - my + 3) ** 2 <= (mr + 1) ** 2 else 'cloud1')
        top = stepped(ridge(w, h * .70, h * .04, seed), 3)        # distant ruined skyline, darker than the sky
        for x in range(w):
            for y in range(int(top[x]), h): s.px(x, y, 'bg1')
        for i in range(3):
            tx = r.randint(20, w - 40); tw = r.randint(8, 14); th = r.randint(int(h * .08), int(h * .16))
            base = int(top[min(w - 1, tx + tw // 2)])
            s.rect(tx, base - th, tx + tw, base, 'bg1')
            for k in range(0, tw + 1, 4): s.rect(tx + k, base - th - 2, min(tx + tw, tx + k + 1), base - th - 1, 'bg1')
            s.rect(tx + tw // 2 - 1, base - th + 5, tx + tw // 2, base - th + 9, 'bg3')   # a lit window
        blob_row(s, int(h * .84), 'cloud1', 'cloud2', 'cloud0', seed + 7)
    else:
        sky(s, ['bg0', 'bg1', 'bg2', 'bg1'])
        for i in range(w // 26):
            x = 8 + i * 27 + r.randint(-6, 6); L = r.randint(int(h * .12), int(h * .38)); half = r.randint(5, 11)
            for k in range(L):
                hw = int(round(half * (1 - k / L) ** .75)); s.rect(x - hw, k, x + hw, k, 'bg0')
        top = stepped(ridge(w, h * .74, h * .07, seed), 3)
        for x in range(w):
            for y in range(int(top[x]), h): s.px(x, y, 'bg0')
            if (x // 5) % 3 == 0: s.px(x, int(top[x]), 'bg2')    # broken rim light, not a continuous stripe
        for i in range(w // 50):                                  # stalagmites on the ridge
            x = r.randrange(w); L = r.randint(8, 26); half = r.randint(3, 6); y0 = int(top[x])
            for k in range(L):
                hw = int(round(half * (1 - k / L) ** .75)); s.rect(x - hw, y0 - k, x + hw, y0 - k, 'bg0')
    return s


# ------------------------------------------------------------------ CLI
def _size(s):
    w, h = s.lower().split('x'); return int(w), int(h)


def main(argv):
    if len(argv) < 2 or argv[0] in ('-h', '--help'):
        print(__doc__); return 0
    cmd, a = argv[0], argv[1:]
    opt = lambda k, d=None: a[a.index('--' + k) + 1] if '--' + k in a else d
    if cmd == 'pixelize':
        pal = Palette.load(opt('palette', 'N'))
        ramps = opt('ramps'); cols = [pal[n] for n in (opt('colours').split(',') if opt('colours')
                                                       else pal.names(ramps.split(',') if ramps else None))]
        sw, sh, src = read_png(a[0]); w, h = _size(opt('size', '400x240'))
        out = pixelize(src, sw, sh, w, h, cols, opt('method', 'mode'), '--dither' in a)
        write_png(a[1], w, h, out); print(f'{a[1]}: {w}x{h}, {len(cols)} colours')
    elif cmd == 'procbg':
        pal = Palette.load(opt('palette', 'N')); w, h = _size(opt('size', '400x240'))
        s = procbg(pal, opt('kind', 'night'), w, h, int(opt('seed', 1))); s.save(a[0]); print(f'{a[0]}: {w}x{h}')
    elif cmd == 'swatch':
        pal = Palette.load(opt('palette', 'N'))
        rows = []
        for k, vs in pal.ramps.items():
            row = []
            for i in range(5): row += [pal[f'{k}{i}'] if i < len(vs) else (0, 0, 0, 0)] * 16
            rows += [row] * 16
        write_png(a[0], 80, len(rows), rows); print(a[0], ', '.join(pal.ramps))
    elif cmd == 'scale':
        w, h, src = read_png(a[0]); k = int(a[2])
        write_png(a[1], w * k, h * k, [[p for p in r for _ in range(k)] for r in src for _ in range(k)])
    else:
        print(__doc__); return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
