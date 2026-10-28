# Art: night ruins above the clouds

Palette N from the pixel-art skill (`.claude/skills/pixel-art/scripts/palettes.json`); light from the top left;
16 art px per tile, drawn at 2x. All of it is visual only; `?art=0` in the address gives back the plain shapes.

- `sheet.js` (+ `sheet.png`, `sheet.json`): the hero, objects and props, drawn in code by `tools/sprites.py`
  (`python3 tools/sprites.py`). The 2x is baked in.
- `bg.js`: the background layers as data URLs, built by `tools/backgrounds.py` from `bg/far.png` and `bg/islands.png`.
  Those came from a local image model (ComfyUI, FLUX.2-klein) via the skill's `comfy_bg.py`:
  - far (seed 11): "a dark deep navy night sky full of tiny stars, a small pale moon high on the upper right, far below
    on the horizon a wide sea of soft moonlit cloud tops, two distant ruined stone towers rising from the clouds",
    reduced by brightness rank to bg0-bg4, cloud1, cloud2 with `tools/bg_remap.py`
    (`--cuts 0.25,0.5,0.7,0.86,0.975,0.995`);
  - islands (seed 5, keyed): "five small floating rock islands with crumbling ruined stone towers, arches and bare trees,
    spread out in a row", cut apart and given a moonlit rim.
- `edge-terrain.js`: the skill's edge-band terrain renderer (preset N), one picture per room behind the hidden collision.

`node tools/shot.mjs OUT 1,5,34` screenshots rooms; `node tools/contact.mjs DIR OUT.png` makes a contact sheet.
