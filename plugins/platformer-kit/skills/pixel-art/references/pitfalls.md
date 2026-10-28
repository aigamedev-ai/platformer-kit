# Known pitfalls

## Image models

- **Generating the whole scene changes things between images.** The hero, tile edges and object shapes come out different in every image, and requested object colours are ignored. Use the model for backgrounds only; draw the play layer in code.
- **SDXL pixel-art LoRAs break layouts.** They draw nice textures but ignore the room's structure. Don't use them on a level.
- **Reducing a sky to few colours makes bands.** A smooth gradient becomes hard stripes. Use `--method mean --dither` or hand-drawn dithered bands (`pixel.py sky`).
- **Model images are too bright and too contrasty for a background.** Leave the light end out with `--colours` and push the moon or sun down one or two values.
- **Without a keyed background, shapes can't be cut out.** Generate silhouettes on flat magenta (`--key`) and place them yourself.
- **FLUX.2-klein ignores negative prompts and CFG.** Use 4 steps and cfg 1.0, and describe what you want.
- **ComfyUI may not be running.** `comfy_bg.py` exits with code 2. Fall back to `procbg` and say so; don't download or install anything.

## Terrain

- **Block terrain looks cheap.** Filling tiles with brick or block textures repeats visibly and makes everything equally loud. Keep the interior dark and put the detail on the edge.
- **Visual edges that don't match collision.** Overhang lips reach 4–7 art px past outer corners, and undersides hang below platforms. Keep `overhang` small on precise platforms, and pass `player` so nothing hangs where the player walks or stands.
- **Islands over hazards.** `island: true` cuts the ground off above the screen bottom. Don't use it on rooms with spike rows or pits at the bottom.
- **An empty canvas texture in headless runs.** The platformer-levels measurer skips texture uploads while it measures, so a terrain texture first created during a measured room load stays empty in later screenshots. Call `tex.refresh()` on every room load.
- **Caching by room index.** Test hooks load raw grids (index -1). Cache by the grid's text.

## Sprites and loading

- **Images fail to load from `file://`.** A game opened from `file://` can't load PNGs by path. Use the `.js` data-URL files (`sheet.js`); Phaser's loader accepts data URLs.
- **Blurry 2× art.** WebGL smooths scaled textures. Use `setFilter(NEAREST)` per texture, or bake the 2× in. Avoid `pixelArt: true` if the game has smooth text and shapes you want to keep.
- **The face changes between frames.** Redrawing the head in every frame lets it drift. Use one shared head part.
- **A hero that disappears.** If the hero is a mid value on mid terrain, it gets lost. The hero is the brightest thing and gets an outline where it meets dark rock.
- **Changing the body to fit the art.** Never resize or move a physics body for a sprite. Change the sprite and its anchor instead.

## Process

- **Assets before direction.** The first pass, made asset by asset, was ugly and mismatched. Make the key image first.
- **Judging at 4× only.** Small details that look great at 4× are noise at 1×. Judge everything at the real size.
- **Moving tools across machines.** The scripts need only Node (for the browser tools) and Python 3 (standard library). macOS's system python3 is 3.9 with no Pillow, and the scripts work with that.
