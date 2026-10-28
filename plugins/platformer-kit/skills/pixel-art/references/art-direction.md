# Art direction: one key image first

Making assets one at a time (a tile here, a sprite there) without a direction gave an ugly, mismatched first pass. Decide the direction on one picture of a real room, then make every asset match it.

## Make the key image

1. Pick a typical room that has ground, a gap with a hazard, a floating platform, a pickup and the exit.
2. Pick a direction in one line, e.g. "night ruins above the clouds" or "crystal cavern". If the user named a theme, use it. Otherwise choose one that suits the game's mood and fits the game's existing colour for danger.
3. Build the mockup from the room's real grid, in code, at 1 art px = 2 game px:
   - background: one far layer (`comfy_bg.py` or `pixel.py procbg`);
   - terrain: `edge-terrain.js` with a preset (N = night ruins, B = crystal cavern) or your own style;
   - the hero, one hazard, one pickup, the exit and two props, drawn as pixel arrays.
   `scripts/terrain-sheet.mjs --rooms <n> --each DIR` gives the terrain over a flat background with simple markers for the objects. Composite the rest on top.
4. Look at it at 1× and 2×. If it doesn't work, change the direction (palette, light, materials), not small details. Only start on assets once the key image looks good.

## Palette

- Build ramps of 3–5 shades per material, from dark to light. Shift the hue as you go: darker shades are cooler (toward blue or violet) and more saturated, lighter shades are warmer and less saturated. Ramps that only change brightness look muddy.
- Start from `scripts/palettes.json` (N and B, about 60 colours each), or make your own in the same format. Each palette has a `roles` field that says which ramp is for what.
- When a generated mockup sets the mood, sample a few colours from it (or cluster them), then pick the ramps by hand. Don't use model colours directly.

## Value plan (check it in greyscale)

| layer | value | contrast |
|---|---|---|
| far background | darkest | very low: 2–3 neighbouring shades |
| near background / terrain interiors | dark, one step above the background | low |
| play layer edges (caps, rims, objects) | mid | clear |
| hero, pickups, the exit | brightest | highest |
| danger (spikes) | its own hue, used for nothing else | high |
| warm lights | bright but small | glow is added in code |

Convert a screenshot to greyscale. The hero and pickups should still be the brightest things, and spikes should still be visible. A bright moon or cloud in the background competes with the hero, so pull it down a value or two.

## Rules that keep it one style

- One art pixel size everywhere: 16 px of art per tile, drawn at 2× for 32 px tiles. Never mix scales, and never rotate or scale sprites to sizes that aren't whole multiples.
- One light direction (top-left): lit edges on the top and left, dark edges on the right and underneath.
- Outline selectively: the hero and important objects get a dark outline where they would otherwise blend in. Terrain gets none; its rims do that job.
- No anti-aliasing and no smooth gradients in the art. Use dithering or stepped bands instead.
