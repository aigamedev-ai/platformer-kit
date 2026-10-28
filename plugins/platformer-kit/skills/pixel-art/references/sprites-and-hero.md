# Sprites and the hero

Draw the play layer as pixel arrays in code: rows of characters plus a legend that maps each character to a palette colour name. Every frame uses the same palette and pixel size, so nothing changes from room to room. `scripts/example_sprites.py` is a complete worked example (a hero, a palette swap and props); copy the pattern, not the art.

```python
import sys; sys.path.insert(0, '<skill>/scripts')
from pixel import Palette, Sprite, save_sheet
pal = Palette.load('N')                       # or Palette.load('my_palette.json')
s = Sprite(12, 16, pal).stamp(HEAD, LEG, 2, 0).stamp(BODY_IDLE0, LEG)
save_sheet([('hero_idle0', s), ...], 'art/sheet')   # sheet.png + sheet.json + sheet.js
```

- `sheet.js` holds the sheet as a data URL plus the Phaser atlas, so a game opened from `file://` can load it without a server: add `<script src="art/sheet.js"></script>`, then in `preload()` call `this.load.atlas('art', PIXEL_ART.image, PIXEL_ART.atlas)`.
- Draw 1× art scaled by 2 and keep it crisp with `this.textures.get('art').setFilter(Phaser.Textures.FilterMode.NEAREST)`, or bake the 2× into the sheet (`save_sheet(..., art_scale=2)`).
- `pixel.py` runs on the standard library alone; Pillow is used for speed if it's installed. macOS's system python3 has no Pillow, and that's fine.

## The hero

- **Original.** Don't imitate a known character. Give it a distinct silhouette and one memorable detail that also does a job, e.g. a scarf that flutters behind and shows whether the double jump is still available.
- **Readable at 1×.** Check it at real size against the darkest and the busiest background. Keep it the brightest thing on screen, with an outline where it meets dark terrain.
- **Sized from the hitbox.** For a 28×28 px hitbox at 2×, draw a body about 12–14 art px wide and 14–16 tall. Hair, a scarf or a cape may stick out a little. The feet sit on the hitbox bottom: anchor the sprite at (0.5, 1) on the body's bottom centre. Never resize the body to fit the art.
- **Frames from shared parts.** idle (2 frames), run (4), jump (1) and fall (1). The head is one part stamped at a per-frame offset, so the face can't change between frames. Only the body, legs and scarf change.
- **Palette swap for state.** Draw a second set of frames with a few colours swapped (`Sprite.recolor({'scarf1': 'spent1', ...})`), e.g. a cold scarf once the double jump is spent. Keep any colour the game already uses for state readable.
- **Facing.** Draw it facing right and flip it in the game (`setFlipX`).
- **Visual only.** The sprite follows the invisible physics body. If the game already squashes a separate visual for juice, swap that visual for the sprite and keep the squash.

## Props and objects

- **Props** (set dressing): 1–2 tiles in size, on ledges and walls, a few per room: lanterns (warm light), plants with gold tips, broken pillars, ropes or chains under platforms. Never put them on or in front of hazards, pickups, exits or the jump path. Place them from the grid, e.g. on surface tiles away from objects, with a fixed seed per room.
- **Objects** that matter to play (spikes, crumbling blocks, springs, orbs, doors, checkpoints): give each its own clear shape and material and keep its hitbox. Spikes use only the danger ramp. Pickups are bright and cool against warm lights. Exits get a frame or a glow.
- **Selective outline:** a dark outline only where the sprite meets something of a similar value (`Sprite.outline('ink')` adds a full outline; remove the pixels you don't need).
