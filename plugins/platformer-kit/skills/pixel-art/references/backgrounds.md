# Backgrounds

Backgrounds are the only place for an image model. They hold mood and depth and must stay dark, soft and low contrast so the play layer reads on top. Make them 400×240 art px (800×480 at 2×) and reduce them to the background colours only.

## With a local image model (ComfyUI + FLUX.2-klein)

```
python3 <skill>/scripts/comfy_bg.py "a calm night sky full of small stars over a sea of soft moonlit clouds, \
   a few distant ruined towers" --name far --seed 3 --palette N --colours bg0,bg1,bg2,bg3,bg4,cloud1,cloud2 \
   --method mean --dither --out art/bg
python3 <skill>/scripts/comfy_bg.py "four small floating rock islands, ruined towers and bare trees" \
   --name islands --seed 5 --palette N --ramps bg --key --out art/bg
```
- This takes about 10 s per image on the Mac (1280×768, 4 steps). It writes `<name>_raw.png` and `<name>.png` (reduced to 400×240), plus `<name>_2x.png` for checking.
- Exit code 2 means ComfyUI isn't running and 3 means the model is missing. Then use the procedural fallback and tell the user.
- `--colours` picks exact shades. Leave out the light end of the ramps so the background never competes with the hero.
- `--method mode` (the default) keeps crisp shapes for silhouettes and clouds. `--method mean --dither` suits smooth skies; `mode` turns a smooth sky into hard bands.
- `--key` generates shapes on flat magenta and cuts them out to transparency. Use it for a mid layer of separate silhouettes that you place yourself (floating islands, far ruins).
- The prompt is wrapped in a fixed style sentence (pixel art background layer, flat colours, no characters, no text, no frame). Use `--raw` to send your prompt as it is. Change the subject and the seed, and keep the template the same across layers.
- FLUX.2-klein is distilled: 4 steps and cfg 1.0. Negative prompts do nothing, so say what you want, not what you don't.

## Without an image model

```
python3 <skill>/scripts/pixel.py procbg art/bg/far.png --palette N --kind night    # sky bands, stars, moon, ruins, cloud sea
python3 <skill>/scripts/pixel.py procbg art/bg/far.png --palette B --kind cave     # stalactites, far ridge
```
These use the background ramps with dithered transitions. Build more from the helpers in `pixel.py` (`sky`, `dither_band`, `ridge`, `stepped`, `blob_row`). Say in the report that the backgrounds are procedural.

## Layers and parallax

- **far** (sky, moon, distant shapes): static, or scrolled very slowly.
- **mid** (silhouettes, keyed islands): a little faster, and still darker than the terrain.
- **near** (cloud tops or stalactites framing the room): the darkest values. Never put it in front of the play area.
- For wide rooms the layer must cover the camera's travel: a layer of width `bgW` scrolls with factor `(bgW - 800) / (roomW - 800)`. Use 0 (static) for a one-screen-wide far layer, or a `tileSprite` for layers that can repeat.
- Put the images in a `.js` file as data URLs (like `sheet.js`) if the game runs from `file://`, and load them in `preload()`.

## Don't

- Don't generate the whole scene (background, terrain, hero) as one image. Characters and edges change between images, and object colours are ignored.
- Don't use SDXL pixel-art LoRAs for layouts; they break the composition.
- Don't use a colour from the hero, pickup or danger ramps in a background.
