# Terrain: edge-band renderer

`scripts/edge-terrain.js` turns a room's tile grid into one picture: a dark interior with all the detail in an uneven band along the exposed edges. It only draws pictures; the game's collision stays the tile grid.

What it does (ported exactly from the prototype, with the same pixels for the same input):
- The solid tiles become one pixel mask at 16 art px per tile, so edges run across tiles with no seams.
- Top surfaces get caps 3–7 px thick, with bumps of 0–3 px above the walking line, heavier clumps, and grass tips.
- Outer corners get a 4–7 px overhanging lip with drips. At inner corners the cap climbs up the wall.
- Vertical faces get jittered by ±1 px. Undersides get roots and rock bits. Bottom corners are rounded.
- Platforms one tile thick get a tapered rocky underside, so they read as small floating islands.
- Every pixel is shaded by its distance to air: top line, cap, rim lit on the left, rim dark on the right, underside, then the interior, which is near the background value with rare pebbles.

## Use in Phaser

```html
<script src="art/edge-terrain.js"></script>   <!-- copy it into the game; it's a plain script -->
```
```js
// in loadRoom(), after the collision bodies are built:
for (const { c, r, w, h } of solidRects(grid))      // existing collision, unchanged ...
  this.platforms.add(this.add.rectangle(/* same as before */).setVisible(false));   // ... only hidden
const key = 'terrain:' + grid.join('/');              // cache per grid, not per index (test hooks load raw grids)
const tex = this.textures.exists(key) ? this.textures.get(key)
  : this.textures.addCanvas(key, EdgeTerrain.render({ grid, style: EdgeTerrain.presets.N,
                                                      art: TILE / 2, scale: 2, player: PLAYER_SIZE }));
tex.refresh();   // re-upload on every load: a headless measurer may have skipped the first upload
this.roomArt.add(this.add.image(0, 0, key).setOrigin(0).setDepth(-1));
```

- The output is grid size × 32 px for 32 px tiles, with the 2× upscale baked in using nearest neighbour, so the game doesn't need `pixelArt: true`.
- It takes about 10–110 ms per room (the longest is a 71-tile-wide room). Render each grid once and cache it, never every frame.
- Wide rooms work; the texture is simply wider (71 tiles = 2272 px).

## Options

| option | default | meaning |
|---|---|---|
| `grid` | – | rows of strings, or rows of booleans |
| `solid` | `'#'` | characters that are terrain. Crumbling blocks, springs and the like are objects, not terrain. |
| `art`, `scale` | 16, 2 | art px per tile and the integer upscale |
| `style` | `presets.N` | colours and shape settings (below) |
| `seed` | 0 | changes the random detail; the same input always gives the same pixels |
| `player` | 0.9 tile | the player's height in game px. Undersides and roots never hang lower than the top of a player standing below them. `0` turns this off. |
| `floors` | `'CS'` | other tiles the player stands on, for the `player` check |
| `island` | false | `true` or a tile row such as `13.5`: cut the ground off and float the room on a tapered underside. Only for rooms with nothing at the bottom of the screen. |

## Styles

`EdgeTerrain.presets.N` (night ruins: moss caps with gold tips over blue stone) and `.B` (crystal cavern: cyan crystal caps over grey-blue stone). To make your own, copy a preset and change:
- `cap`: 5 colours from light to dark (top line, lit, body, deep, shadow side);
- `tips`: grass or crystal tips on the top line (or null);
- `capMin` and `capMax`: cap thickness; `overhang`: [min, max] lip length in art px;
- `rim` (`lit`, `mid`, `mid2`, `dark`, `under`): the stone band down the sides and underneath;
- `fill`: the interior, then the pebble and lit pebble colours. Keep `fill[0]` one step above the background value;
- `hang`, `hangLit`, `hangTip`: roots; `underCap`: a band under the cap (or null); `speck`: a rare glint inside.

## Preview every room before wiring it in

```
node <skill>/scripts/terrain-sheet.mjs --levels levels/section-*.js --preset N --player 28 --scale 0.5 --out terrain.png
node <skill>/scripts/terrain-sheet.mjs --levels levels/section-*.js --rooms 3,18 --scale 1 --each shots/
```
This runs in headless Chromium with the sound muted. Playwright must be installed; run it from the game folder. Objects show as flat markers so you can judge how they contrast with the terrain.

## Objects stay objects

Crumbling blocks, springs, doors and checkpoints are drawn as their own sprites, on top of the terrain. A crumbling block keeps its block shape, in a material the terrain doesn't use (for example tan cracked stone against moss and blue stone), so the player can tell it will break.
