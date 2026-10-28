#!/usr/bin/env python3
"""example_sprites.py: a worked example of the play layer drawn in code (from the night-ruins prototype).
Shows the format to copy: a hero built from shared parts (the head is one part stamped at a per-frame offset, so
the face can't drift between frames), a palette swap for a game state, and set-dressing props.
Design your own hero and props for each game; this is the pattern, not the art to reuse.

    python3 example_sprites.py OUT_DIR [--palette N]
    -> OUT_DIR/sheet.png + sheet.json (Phaser atlas, 1x art; draw at 2x) + sheet.js (same, as a data URL for
       games opened from file://) and OUT_DIR/preview_4x.png
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixel import Palette, Sprite, save_sheet, write_png

# ---------------------------------------------------------------- hero: 12x16, facing right, light from top-left
# A small sky-runner: dark bob, cyan goggles pushed up, cream tunic, long scarf. The scarf is the memorable
# detail AND the double-jump gauge: warm when the jump is ready, cold blue once spent.
LEG = {'o': 'ink', 'h': 'hair0', 'H': 'hair1', 'g': 'cyan3', 'G': 'cyan1', 's': 'skin1', 'S': 'skin0',
       'e': 'ink', 'w': 'cloth1', 'W': 'cloth0', 'r': 'scarf1', 'R': 'scarf0', 'y': 'scarf2', 'b': 'tan1', 'B': 'tan0'}
SPENT = {'r': 'spent1', 'R': 'spent0', 'y': 'spent2'}

HEAD = [            # 9x8, shared by every frame
    "..oooooo.",
    ".ohHHhhho",
    "ohHhGgGgo",
    "ohhhhssso",
    "ohhhseseo",
    "ohhSsssso",
    ".ohSsssSo",
    "..oooooo.",
]
E = "............"
BODY = {            # (head offset), 16 rows; stamped after the head so the scarf covers the chin
    'idle0': ((2, 0), [E] * 7 + ["..oyrrrrrRo.", ".oyrRrrrRRo.", "oyrRowwwwWo.", "orRoowwwwWo.", ".oo.owwwWso.",
                                 "....oWWWWo..", "....obbobbo.", "....obbobbo.", "....oBBoBBo."]),
    'idle1': ((2, 1), [E] * 8 + ["..oyrrrrrRo.", "oyyrRrrrRRo.", "orRRowwwwWo.", ".oo.owwwWso.", "....oWWWWo..",
                                 "....obbobbo.", "....obbobbo.", "....oBBoBBo."]),
    'run0': ((3, 1), [E] * 8 + ["oyyyyrrrrRo.", ".orrRRrrRRo.", "..ooowwwwWso", "....owwwWWo.", "....oWWWWo..",
                                "...obbooobbo", "..obbo..obBo", "..oBo....oo."]),
    'run1': ((3, 0), [E] * 7 + [".oyyrrrrrRo.", "oyrrRrrrRRo.", "orRRowwwwWso", ".ooowwwwWWo.", "....owwwWWo.",
                                "....oWWWWo..", ".....obbbo..", ".....obBBo..", "......ooo..."]),
    'run2': ((3, 1), [E] * 7 + ["oo..........", "oyyyyrrrrRo.", ".oorRRrrRRo.", "...oowwwwWso", "....owwwWWo.",
                                "....oWWWWo..", "...obbooobbo", "..obBo..obbo", "..oo....oBo."]),
    'run3': ((3, 0), [E] * 7 + ["..oyrrrrrRo.", ".oyrRrrrRRo.", "oyrRowwwwWso", "orRoowwwWWo.", ".oo.owwwWWo.",
                                "....oWWWWo..", ".....obbbo..", ".....oBbbo..", "......ooo..."]),
    'jump': ((2, 0), [E] * 7 + ["..oyrrrrrRos", ".oyrRrrrRRso", ".oroowwwwWo.", ".oRowwwwwWo.", ".oyowwwwWWo.",
                                "..o.oWWWWo..", ".....obbbbo.", "....obBo.oBo", ".....oo...o."]),
    'fall': ((3, 1), [E, "oyo.........", "oyRo........", ".orRo.......", ".oro........", "..oR........",
                      "..oR........", "..oy........", "...oyrrrrrRo", ".ooowwwwwWoo", "osoowwwwWWso",
                      ".o..owwwWWo.", "....oWWWWo..", "....obbobbo.", "....obbobbo.", "....oBo.oBo."]),
}
ORDER = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall']


def hero(pal, name, spent=False):
    (hx, hy), rows = BODY[name]
    leg = dict(LEG, **(SPENT if spent else {}))
    return Sprite(12, 16, pal).stamp(HEAD, leg, hx, hy).stamp(rows, leg)


# ---------------------------------------------------------------- props (set dressing, on edges, never on hazards)
LAMP = {'k': 'ink', '1': 'stone1', '2': 'stone2', '3': 'stone3', '4': 'stone4',
        'c': 'lamp1', 'b': 'lamp2', 'w': 'lamp3', 'r': 'lamp0'}
LANTERN_POST = ["....kk....", "...k43k...", "..k4332k..", ".k433322k.", "..kkkkkk..", "..kcbbrk..", "..kbwwck..",
                "..kbwwck..", "..kcbbrk..", "..kkkkkk..", "...k32k...", "....31....", "....31....", "....31....",
                "...k31k..."] + ["....31...."] * 13 + ["...k321k..", "..k33221k.", "..k32211k.", ".kkkkkkkkk"]
HANGING_LANTERN = ["...k2...", "...2k..."] * 6 + ["...k2...", "...kk...", "..k43k..", ".k4332k.", ".kkkkkk.",
                   ".kcbbrk.", ".kbwwck.", ".kbwwck.", ".kbwwck.", ".kcbbrk.", ".kkkkkk.", "..k21k..", "...kk..."]
PLANT = ["......g.....", "..g...m..g..", "..m..mM..m..", "...m.M..mM..", ".g.mMM.mM.g.", ".m..MMmM..m.",
         "..mMMmMMmMm.", "...dMMMMd...", "..ddMddMdd..", ".dddddddddd."]


def broken_pillar(pal):
    s = Sprite(16, 32, pal)
    tops = [13, 11, 10, 12, 9, 11, 14, 16]                       # jagged break
    for i, x in enumerate(range(4, 12)):
        for y in range(tops[i], 28):
            c = 'stone3' if x <= 5 else ('stone2' if x <= 8 else 'stone1')
            if x in (6, 9) and y > tops[i] + 1: c = 'stone1' if x == 6 else 'stone0'      # fluting
            s.px(x, y, c)
        s.px(x, tops[i], 'stone4' if x <= 7 else 'stone3')
    s.rect(12, 15, 12, 27, 'ink')
    s.rect(2, 28, 13, 29, 'stone2'); s.rect(2, 28, 13, 28, 'stone3'); s.px(13, 29, 'ink')
    s.rect(1, 30, 14, 31, 'stone1'); s.rect(1, 30, 14, 30, 'stone2')
    s.rect(14, 27, 15, 27, 'stone2'); s.px(14, 26, 'stone3'); s.px(15, 26, 'stone1')     # rubble chunk at the foot
    for x, y, c in ((4, 12, 'moss3'), (5, 10, 'moss3'), (6, 9, 'moss4'), (7, 11, 'moss2'), (8, 8, 'moss3'),
                    (5, 11, 'moss2'), (4, 13, 'moss2'), (8, 9, 'moss2'), (6, 8, 'grass1'), (8, 7, 'grass2'),
                    (4, 14, 'moss1'), (4, 15, 'moss1'), (5, 14, 'moss1')):
        s.px(x, y, c)                                            # moss on the break, creeping down the lit side
    return s


def build(pal):
    e = [(f'hero_{n}', hero(pal, n)) for n in ORDER]
    e += [(f'hero_{n}_spent', hero(pal, n, True)) for n in ORDER]
    e += [('lantern_post', Sprite(10, 32, pal).stamp(LANTERN_POST, LAMP)),
          ('hanging_lantern', Sprite(8, 25, pal).stamp(HANGING_LANTERN, LAMP)),
          ('plant', Sprite(12, 10, pal).stamp(PLANT, {'g': 'grass2', 'm': 'moss3', 'M': 'moss2', 'd': 'moss1'})),
          ('broken_pillar', broken_pillar(pal))]
    return e


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'sprites_out'
    pal = Palette.load(sys.argv[sys.argv.index('--palette') + 1] if '--palette' in sys.argv else 'N')
    entries = build(pal)
    save_sheet(entries, os.path.join(out, 'sheet'))
    # preview: every sprite at 4x on the background colour, so you judge it the way the player sees it (bigger)
    k, pad = 4, 4; W = sum(s.w * k + pad for _, s in entries) + pad; H = max(s.h for _, s in entries) * k + 2 * pad
    bg = pal['bg1']; rows = [[bg] * W for _ in range(H)]
    x = pad
    for _, s in entries:
        img = s.scaled(k); y0 = H - pad - s.h * k
        for yy, r in enumerate(img):
            for xx, p in enumerate(r):
                if p[3]: rows[y0 + yy][x + xx] = p
        x += s.w * k + pad
    write_png(os.path.join(out, 'preview_4x.png'), W, H, rows)
    print(f'{len(entries)} sprites -> {out}/sheet.png, sheet.json, sheet.js, preview_4x.png')
