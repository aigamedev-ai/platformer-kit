#!/usr/bin/env python3
"""sprites.py: the play layer of "night ruins above the clouds", drawn in code (palette N, light from the top left).

    python3 tools/sprites.py            -> art/sheet.png/.json/.js (2x baked in) and art/preview_4x.png

The hero is Wick, a small lantern-bearer in a cream hooded cloak with a floppy hood tip and a red scarf. The lantern
at the hip and the scarf are the double-jump gauge: warm while it's ready, cold blue once it's spent.
Every frame is stamped from shared parts (one hood, one lantern), so the face can't drift between frames.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
# pixel.py comes from the pixel-art skill: in the game's .claude/skills, or in the platformer-kit repo next to this game
for _p in (os.path.join(HERE, '..', '..', 'plugins', 'platformer-kit', 'skills', 'pixel-art', 'scripts'),
           os.path.join(HERE, '..', '.claude', 'skills', 'pixel-art', 'scripts')):
    sys.path.insert(0, _p)
from pixel import Palette, Sprite, save_sheet, write_png

pal = Palette.load('N')

# ---------------------------------------------------------------- hero: 16x18 art, facing right, feet on row 17
L = {'o': 'ink', 'W': 'cloth1', 'w': 'cloth0', 'k': 'hair0', 'K': 'hair1', 'e': 'white', 'c': 'cyan3',
     'r': 'scarf1', 'R': 'scarf0', 'y': 'scarf2', 'b': 'tan1', 'B': 'tan0', 's': 'skin1', 'S': 'skin0',
     'm': 'stone3', 'M': 'stone2', 'f': 'lamp3', 'F': 'lamp2', 'g': 'lamp1'}
SPENT = {'r': 'spent1', 'R': 'spent0', 'y': 'spent2', 'f': 'spent2', 'F': 'spent1', 'g': 'spent0'}

HOOD = [            # 11x10; the tip flops back over the left shoulder
    "ooo........",
    "oWWoo......",
    ".oWWWoooo..",
    "..oWWWWWWo.",
    ".oWWWWWWWWo",
    ".oWWkkkkkWo",
    ".owkkEkkEko",
    ".owkkkkkkko",
    "..owwkkkwo.",
    "...ooooo...",
]
EYES = {'open': 'e', 'blink': 'K', 'up': 'e'}

def hood(look):
    rows = [r.replace('E', 'k') for r in HOOD]
    if look == 'blink':
        rows[6] = rows[6][:5] + 'K' + rows[6][6:8] + 'K' + rows[6][9:]
    elif look == 'up':                              # gazing at the moon
        rows[5] = rows[5][:6] + 'e' + rows[5][7:9] + 'e' + rows[5][10:]
    else:
        rows[6] = rows[6][:5] + 'e' + rows[6][6:8] + 'e' + rows[6][9:]
    return rows

LANTERN = [         # 3x6, hangs from the front hand
    ".s.",
    ".o.",
    "omo",
    "ofo",
    "oFo",
    ".o.",
]

CLOAK = {           # 10 wide, stamped at x=3; the scarf wraps the neck
    'stand': ["oyrrrrrRo.", "oyrRrrRRRo", "oWWWWWWwwo", "oWWWWWWwwo", "oWWWWWwwwo", "oWWWWwwwwo", ".owwwwwwo."],
    'lean':  [".oyrrrrrRo", "oyrRrrRRRo", "oWWWWWWwwo", "oWWWWWWwwo", "oWWWWWwwwo", ".oWWWwwwo.", "..owwwwo.."],
    'puff':  ["oyrrrrrRo.", "oyrRrrRRRo", "oWWWWWWwwo", "oWWWWWWwwo", "oWWWWWWwwo", "oWWWWWwwwwo"[:10], "owwwwwwwwo"],
}
LEGS = {            # 10 wide, stamped at x=3
    'stand': ["..obo.obo.", "..obo.obo.", "..oBo.oBo."],
    'run0':  [".obo...obo", "obo.....oB", "oB......o."],
    'run1':  ["...obobo..", "...obobo..", "...oBoBo.."],
    'run2':  ["..obo.obo.", ".obo...obo", ".oBo...oB."],
    'run3':  ["...obbo...", "...obBo...", "....oo...."],
    'tuck':  ["..obbobbo.", "...oBoBo..", ".........."],
    'dangle': ["..obo..obo", "..oBo..oBo", ".........."],
}
TAILS = {           # scarf tail behind the neck: (x, y, rows)
    'hang':  (0, 10, ["oyo.", "oRro", ".oRo", "..o."]),
    'sway':  (0, 10, ["oyyo", "oRro", "oRo.", ".o.."]),
    'fly':   (0, 9, ["oo...", "yyyro", "oRRro", ".oo.."]),
    'flyb':  (0, 10, ["ooo..", "yyrro", ".oRRo", "..o.."]),
    'up':    (1, 4, ["o..", "yo.", "ryo", "oRo", ".oo"]),
    'down':  (1, 11, ["oyo", "oro", "oRo", "oo."]),
}
# frame: hood (dx, dy), cloak, legs, tail, lantern (x, y)
FRAMES = {
    'idle0': ((3, 0), 'stand', 'stand', 'hang', (12, 11)),
    'idle1': ((3, 1), 'stand', 'stand', 'sway', (12, 12)),
    'run0':  ((4, 1), 'lean', 'run0', 'fly', (11, 12)),
    'run1':  ((4, 0), 'lean', 'run1', 'flyb', (11, 11)),
    'run2':  ((4, 1), 'lean', 'run2', 'fly', (11, 12)),
    'run3':  ((4, 0), 'lean', 'run3', 'flyb', (11, 11)),
    'jump':  ((3, 0), 'stand', 'tuck', 'down', (12, 10)),
    'fall':  ((3, 1), 'puff', 'dangle', 'up', (12, 10)),
}

def hero(name, look='open', spent=False):
    (hx, hy), cloak, legs, tail, (lx, ly) = FRAMES[name]
    leg = dict(L, **(SPENT if spent else {}))
    s = Sprite(16, 18, pal)
    tx, ty, trows = TAILS[tail]
    s.stamp(trows, leg, tx, ty)
    s.stamp(hood(look), leg, hx, hy)
    body_y = 8 + hy
    s.stamp(CLOAK[cloak], leg, 3, body_y)
    s.stamp(LEGS[legs], leg, 3, 15)
    s.stamp(LANTERN, leg, lx, ly)
    return s

HERO = [('idle0', 'open'), ('idle1', 'open'), ('blink', 'blink'), ('look', 'up'),
        ('run0', 'open'), ('run1', 'open'), ('run2', 'open'), ('run3', 'open'), ('jump', 'open'), ('fall', 'open')]

def hero_entries():
    out = []
    for spent in (False, True):
        for name, look in HERO:
            frame = {'blink': 'idle0', 'look': 'idle0'}.get(name, name)
            out.append((f"hero_{name}{'_spent' if spent else ''}", hero(frame, look, spent)))
    return out


# ---------------------------------------------------------------- objects that matter to play (16 art px per tile)
def spikes():
    """two rose spikes per tile on a dark base; only the danger ramp (plus ink)."""
    s = Sprite(16, 16, pal)
    for ox in (0, 8):
        for y in range(2, 16):
            half = (y - 1) * 4 // 14                         # 0 at the tip, 4 at the base
            for x in range(ox + 4 - half, ox + 4 + half):
                c = 'rose2'
                if x < ox + 4 - half + 1: c = 'rose3'        # lit left edge
                if x >= ox + 4 + half - 1: c = 'rose1'       # shadow right edge
                s.px(x, y, c)
        s.px(ox + 3, 1, 'rose4'); s.px(ox + 3, 2, 'rose4'); s.px(ox + 4, 2, 'rose3')
    s.rect(0, 14, 15, 15, 'rose0'); s.rect(0, 14, 15, 14, 'rose1')
    return s

def crumble(variant):
    """cracked tan block: keeps its block shape so it reads as an object that will break."""
    s = Sprite(16, 16, pal)
    s.rect(0, 0, 15, 15, 'tan0')
    s.rect(1, 1, 14, 14, 'tan2')
    s.rect(1, 1, 14, 2, 'tan3'); s.rect(1, 1, 2, 14, 'tan3'); s.px(1, 1, 'tan4'); s.px(2, 1, 'tan4')
    s.rect(1, 13, 14, 14, 'tan1'); s.rect(13, 1, 14, 14, 'tan1')
    cracks = [[(4, 3), (5, 4), (6, 5), (6, 6), (7, 7), (9, 8), (10, 9), (11, 10), (11, 11)],
              [(10, 2), (10, 3), (9, 4), (8, 5), (8, 6), (5, 9), (6, 8), (7, 7), (4, 10), (4, 11), (3, 12)]][variant]
    for x, y in cracks:
        s.px(x, y, 'tan0'); s.px(x + 1, y, 'tan1') if (x + 1, y) not in cracks else None
    for x, y in [(12, 4), (3, 7)][variant:variant + 1]: s.px(x, y, 'tan4')
    return s

def spring_pad():                                    # 16x4: a mossy bounce pad (green ramp, its own material)
    s = Sprite(16, 4, pal)
    s.rect(0, 0, 15, 3, 'ink')
    s.rect(1, 0, 14, 2, 'green1'); s.rect(1, 0, 14, 0, 'green2'); s.rect(2, 1, 4, 1, 'green2')
    s.rect(1, 3, 14, 3, 'green0')
    for x in (4, 8, 12): s.px(x, 1, 'green0')
    return s

def spring_coil():                                   # 10x3 copper coil under the pad
    s = Sprite(10, 3, pal)
    s.rect(0, 0, 9, 2, 'ink')
    for x in range(1, 9): s.px(x, 0 if x % 2 else 1, 'tan3'); s.px(x, 1 if x % 2 else 0, 'tan1')
    s.rect(1, 2, 8, 2, 'tan0')
    return s

ORB = ["....o....", "...oeo...", "..oecDo..", ".oecccDo.", "oeccccDDo", ".oDcccdo.", "..oDcdo..", "...odo...", "....o...."]
def orb(ghost=False):
    s = Sprite(9, 9, pal)
    if ghost:
        for y, r in enumerate(ORB):
            for x, ch in enumerate(r):
                if ch == 'o' and (x + y) % 2 == 0: s.px(x, y, 'cyan1')
        return s
    return s.stamp(ORB, {'o': 'cyan0', 'e': 'cyan4', 'c': 'cyan3', 'D': 'cyan2', 'd': 'cyan1'})

def door():
    """16x32 stone arch with a warm lit doorway: the exit is the brightest warm shape in the room."""
    s = Sprite(16, 32, pal)
    for y in range(32):
        for x in range(16):
            dx = x - 7.5
            if y < 8 and dx * dx + (y - 8) ** 2 > 8 * 8: continue
            s.px(x, y, 'stone2')
    for y in range(32):                               # stone frame, lit on the left
        for x in range(16):
            dx = x - 7.5
            if y < 8 and dx * dx + (y - 8) ** 2 > 8 * 8: continue
            inner = (y >= 8 and 3 <= x <= 12) or (y < 8 and dx * dx + (y - 8) ** 2 <= 5 * 5)
            if inner:
                c = 'lamp1'
                if (y < 8 and dx * dx + (y - 8) ** 2 <= 3 * 3) or (y >= 8 and 5 <= x <= 10 and y < 26): c = 'lamp2'
                if (5 <= x <= 10 and 6 <= y <= 18 and abs(dx) < 2.5): c = 'lamp3'
                if y >= 28: c = 'lamp0'
                s.px(x, y, c)
            elif x <= 3 or (y < 8 and dx < 0): s.px(x, y, 'stone3')
            elif x >= 12: s.px(x, y, 'stone1')
    for y in (11, 19, 26): s.rect(0, y, 2, y, 'stone1'); s.rect(13, y + 2, 15, y + 2, 'stone0')
    for x, y in ((2, 2), (3, 1), (4, 1), (1, 3), (0, 6), (0, 7), (1, 5)): s.px(x, y, 'moss3')
    s.px(5, 0, 'moss2'); s.px(2, 3, 'moss2'); s.px(0, 8, 'moss2'); s.px(0, 9, 'moss1'); s.px(3, 0, 'grass1')
    s.rect(0, 31, 15, 31, 'stone1')
    return s

def bonus_door(crown):
    """16x32 violet door with a gold star; on the main path a crown of danger-red spikes above it says 'hard'."""
    s = Sprite(16, 40, pal)
    oy = 8
    s.rect(1, oy, 14, oy + 31, 'violet0')
    s.rect(2, oy + 1, 13, oy + 31, 'violet1'); s.rect(2, oy + 1, 3, oy + 31, 'violet2'); s.rect(12, oy + 1, 13, oy + 31, 'violet0')
    s.rect(0, oy, 15, oy, 'violet3'); s.rect(0, oy, 0, oy + 31, 'violet2'); s.rect(15, oy, 15, oy + 31, 'ink')
    STAR = ["..y..", ".yYy.", "yYYYy", ".yYy.", ".y.y."]
    s.stamp(STAR, {'y': 'grass1', 'Y': 'grass2'}, 6, oy + 9)
    for y in range(oy + 16, oy + 31, 3): s.rect(5, y, 10, y, 'violet0')
    if crown:
        for ox in (1, 8):
            for k in range(7):
                for x in range(ox + 3 - k // 2, ox + 4 + k // 2):
                    s.px(x, 1 + k, 'rose3' if x <= ox + 3 - k // 2 else 'rose2')
    return s

def flag():
    """goal: a pole with a gold banner and a little lamp on top (16x32, the pole on the left like the original)."""
    s = Sprite(16, 32, pal)
    s.rect(2, 2, 3, 31, 'stone3'); s.rect(3, 2, 3, 31, 'stone1')
    s.rect(1, 0, 4, 1, 'lamp2'); s.px(2, 0, 'lamp3')
    BAN = ["gGGGGGGGgo....", "gGGGGGGGGGGo..", "gGYGGGGGGGGGGo", "gGYGGGGGGGGGo.", "gGGGGGGGGGgo..",
           "gGGGGGGGgo....", "ggggggggo....."]
    s.stamp(BAN, {'g': 'lamp1', 'G': 'lamp2', 'Y': 'lamp3', 'o': 'lamp0'}, 4, 1)
    s.rect(0, 31, 5, 31, 'stone2')
    return s

def cp_post():                                       # 6x26 checkpoint post (stone, with a brazier cup)
    s = Sprite(6, 26, pal)
    s.rect(2, 2, 3, 25, 'stone3'); s.rect(3, 2, 3, 25, 'stone1')
    s.rect(0, 0, 5, 1, 'stone3'); s.rect(1, 1, 4, 1, 'stone2'); s.px(5, 0, 'stone1')
    s.rect(1, 25, 4, 25, 'stone2')
    return s

def cp_flag(lit):                                    # 11x9 banner, cold slate before, bright green once lit
    s = Sprite(11, 9, pal)
    rows = ["dLLLLLo....", "dLLLLLLLLo.", "dLHLLLLLLLo", "dLHLLLLLLo.", "dLLLLLLo...", "dLLLo......", "do........."]
    rows += ["..........."] * 2
    leg = ({'d': 'green0', 'L': 'green1', 'H': 'green2', 'o': 'green0'} if lit
           else {'d': 'spent0', 'L': 'stone3', 'H': 'stone4', 'o': 'stone1'})
    return s.stamp(rows, leg)

def flame(i):                                        # 5x6 brazier flame on a lit checkpoint, 2 frames
    rows = [["..f..", ".fF..", ".FYf.", "fFYFf", ".fFf.", "....."],
            ["..f..", "..Ff.", ".fYF.", "fFYFf", ".fFf.", "....."]][i]
    return Sprite(5, 6, pal).stamp(rows, {'f': 'lamp1', 'F': 'lamp2', 'Y': 'lamp3'})


# ---------------------------------------------------------------- props (set dressing on ledges, never on the path)
LAMP = {'k': 'ink', '1': 'stone1', '2': 'stone2', '3': 'stone3', '4': 'stone4', 'c': 'lamp1', 'b': 'lamp2',
        'w': 'lamp3', 'r': 'lamp0'}
LANTERN_POST = (["....kk....", "...k43k...", "..k4332k..", ".k433322k.", "..kkkkkk..", "..kcbbrk..", "..kbwwck..",
                 "..kbwwck..", "..kcbbrk..", "..kkkkkk..", "...k32k...", "....31....", "....31....", "....31...."]
                + ["....31...."] * 12 + ["...k321k..", "..k33221k.", "..k32211k.", ".kkkkkkkkk"])
PLANT = ["......g.....", "..g...m..g..", "..m..mM..m..", "...m.M..mM..", ".g.mMM.mM.g.", ".m..MMmM..m.",
         "..mMMmMMmMm.", "...dMMMMd...", "..ddMddMdd..", ".dddddddddd."]
TUFT = ["..g...g.", ".gm..mg.", "..mMmM..", ".dMMMMd."]

def broken_pillar():
    s = Sprite(16, 32, pal)
    tops = [13, 11, 10, 12, 9, 11, 14, 16]
    for i, x in enumerate(range(4, 12)):
        for y in range(tops[i], 28):
            c = 'stone3' if x <= 5 else ('stone2' if x <= 8 else 'stone1')
            if x in (6, 9) and y > tops[i] + 1: c = 'stone1' if x == 6 else 'stone0'
            s.px(x, y, c)
        s.px(x, tops[i], 'stone4' if x <= 7 else 'stone3')
    s.rect(12, 15, 12, 27, 'ink')
    s.rect(2, 28, 13, 29, 'stone2'); s.rect(2, 28, 13, 28, 'stone3'); s.px(13, 29, 'ink')
    s.rect(1, 30, 14, 31, 'stone1'); s.rect(1, 30, 14, 30, 'stone2')
    for x, y, c in ((4, 12, 'moss3'), (5, 10, 'moss3'), (6, 9, 'moss4'), (7, 11, 'moss2'), (8, 8, 'moss3'),
                    (5, 11, 'moss2'), (4, 13, 'moss2'), (8, 9, 'moss2'), (6, 8, 'grass1'), (8, 7, 'grass2'),
                    (4, 14, 'moss1'), (4, 15, 'moss1'), (5, 14, 'moss1')):
        s.px(x, y, c)
    return s

def stub():                                          # a short broken column stump, 10x12
    s = Sprite(10, 12, pal)
    tops = [4, 3, 2, 3, 5, 4]
    for i, x in enumerate(range(2, 8)):
        for y in range(tops[i], 10): s.px(x, y, 'stone3' if x <= 3 else 'stone2' if x <= 5 else 'stone1')
        s.px(x, tops[i], 'stone4' if x <= 4 else 'stone3')
    s.rect(1, 10, 8, 11, 'stone1'); s.rect(1, 10, 8, 10, 'stone2')
    s.px(3, 2, 'moss3'); s.px(4, 1, 'grass1'); s.px(2, 4, 'moss2')
    return s


def build():
    e = hero_entries()
    e += [('spikes', spikes()), ('crumble0', crumble(0)), ('crumble1', crumble(1)),
          ('spring_pad', spring_pad()), ('spring_coil', spring_coil()), ('orb', orb()), ('orb_ghost', orb(True)),
          ('door', door()), ('bonus_door', bonus_door(True)), ('bonus_door_back', bonus_door(False)), ('flag', flag()),
          ('cp_post', cp_post()), ('cp_flag', cp_flag(False)), ('cp_flag_lit', cp_flag(True)),
          ('flame0', flame(0)), ('flame1', flame(1)),
          ('lantern_post', Sprite(10, 30, pal).stamp(LANTERN_POST, LAMP)),
          ('plant', Sprite(12, 10, pal).stamp(PLANT, {'g': 'grass2', 'm': 'moss3', 'M': 'moss2', 'd': 'moss1'})),
          ('tuft', Sprite(8, 4, pal).stamp(TUFT, {'g': 'grass1', 'm': 'moss3', 'M': 'moss2', 'd': 'moss1'})),
          ('pillar', broken_pillar()), ('stub', stub())]
    return e


if __name__ == '__main__':
    out = os.path.join(HERE, '..', 'art')
    entries = build()
    save_sheet(entries, os.path.join(out, 'sheet'), width=512, art_scale=2)
    k, pad = 4, 4
    W = sum(s.w * k + pad for _, s in entries) + pad; H = max(s.h for _, s in entries) * k + 2 * pad
    bg = pal['bg1']; rows = [[bg] * W for _ in range(H)]
    x = pad
    for _, s in entries:
        img = s.scaled(k); y0 = H - pad - s.h * k
        for yy, r in enumerate(img):
            for xx, p in enumerate(r):
                if p[3]: rows[y0 + yy][x + xx] = p
        x += s.w * k + pad
    write_png(os.path.join(out, '..', 'tools', 'preview_4x.png'), W, H, rows)
    print(len(entries), 'sprites')
