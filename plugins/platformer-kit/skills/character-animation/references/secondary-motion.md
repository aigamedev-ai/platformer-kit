# Secondary motion in code

Loose parts (a scarf, hair, a cape, ears, a tail, a hanging lantern) should lag behind the body and keep moving after it stops. Drawn frames can't do that well with 2–4 frames per state, and they repeat. A small chain in code does it every game frame and reacts to whatever the player does. Celeste draws Madeline's hair this way: the sprite has no hair, a short list of points follows her head (each point follows the one before, at a set offset), circles are drawn on the points, and each animation frame says where the hair attaches. Its colour also shows whether her dash is ready.

`<skill>/scripts/secondary-motion.js` has no dependencies. Load it with a `<script>` tag (it sets `window.SecondaryMotion`) or `require` it.

## How the chain works, in plain words

- **Points with memory (Verlet).** Each point remembers where it was last step. Where it is minus where it was is its speed, so a point keeps moving the way it was going (follow-through) without storing a velocity. Gravity pulls it down a little each step.
- **Drag.** Each step a point keeps only part of its speed, measured against still air. That's why the chain trails behind a running hero: the body moves through the air, the chain is held back by it. `drag` 0.05 is a heavy rope, 0.3 a light ribbon.
- **Rest shape.** Each point is pulled a little toward its rest place: one segment from the point before, in the rest direction (back and down for a scarf). `stiffness` 0 is a loose rope, 0.2–0.4 keeps the drawn shape readable, 1 is rigid. The rest direction bends against the hero's speed (`flow`), so the chain streams back when running, hangs below when rising and lifts when falling, which also tells the player the state.
- **Fixed lengths, outward from the anchor.** After moving, each point is put back at exactly one segment from the point before it, going from the anchor out (follow-the-leader). It's exact in one pass and can't blow up, unlike springs that are too stiff.
- **Fixed sub-steps.** The chain steps at 1/120 s however fast the game runs, so it moves the same at 30, 60 or 144 fps. During a hit pause, pass `dt = 0`.
- **No collision.** It's decoration: it never touches the level and the level never touches it. One cheap guard: `floor` (the feet's y) so the tip never sinks into the ground while idle. Keep chains short enough that passing through a wall for a moment doesn't show.
- **Teleports.** If the anchor jumps further than `teleport` px in one update (respawn, new room), the chain resets to its rest shape. Call `reset()` yourself on a room load.

## Use

```js
const scarf = SecondaryMotion.chain({ points: 5, segment: 4, gravity: 700, drag: 0.18, stiffness: 0.18,
                                      rest: [-0.35, 1], flow: 0.8, flowSpeed: RUN_SPEED });
// every frame, after physics and after the juice has placed the sprite:
const [ax, ay] = NECK[frameName];                       // art px in the frame, facing right
let ox = face * (ax * 2 - 16) * sx, oy = (ay * 2 - originY) * sy;   // 2x art, 32 px wide, origin at the feet line
// rotate (ox, oy) by the sprite's angle if it spins
const pts = scarf.update(dt, sprite.x + ox, sprite.y + oy, body.velocity, { facing: face, floor: feetY });
const px = SecondaryMotion.raster(pts, { pixel: 2, originX: Math.round(sprite.x) - 16, originY: Math.round(sprite.y) - 22,
                                         widths: [2, 1] });
g.clear();   // a Graphics object one depth below the hero
SecondaryMotion.paint(px, spent ? COLD : WARM, (x, y, w, h, c) => g.fillStyle(c, 1).fillRect(x, y, w, h));
```

- **Anchor per frame.** Keep a table of where the part leaves the body in each drawn frame (`NECK = { idle0: [3.5, 9], run0: [4.5, 10], crouch: [3.5, 11], ... }`). The chain then rides the head bob and the crouch. Mirror x when the sprite flips; scale by the juice's squash; rotate by its spin.
- **Remove the part from the frames.** Draw a second set of frames without the scarf tail (keep the knot), so the chain replaces it instead of doubling it. Keep the old frames for the off switch.
- **Pixel snapping.** `raster()` puts the chain on the sprite's own pixel grid (the same 2× pixels, lined up with the sprite's corner) and fills gaps between points with a line, so it looks drawn, not rendered. `widths` sets the thickness from root to tip in art px.
- **Colours and outline.** `paint()` uses `base`, `light` (open above, the lit side), `dark` (open below) and `outline` (the sprite's ink). Swap the colours with the hero's state palette (warm scarf when the double jump is ready, cold once spent).
- **Draw order.** Behind the body for a scarf tail or a cape; in front for a hanging prop held in front. Hide it whenever the hero is hidden, and clear it during a white hit flash.
- **Kicks.** `kick(vx, vy)` adds speed toward the tip: down on a spring bounce, a small push on a hit. Landing needs no kick; the anchor stopping is enough to make it flop.

## Starting numbers (game px, 2× art)

| Part | points × segment | gravity | drag | stiffness | rest | flow |
|---|---|---|---|---|---|---|
| Scarf tail | 5 × 4 | 700 | 0.18 | 0.18 | [-0.35, 1] | 0.8 |
| Short hair, ponytail | 4–5 × 4 | 900 | 0.12 | 0.3 | [-0.6, 1] | 0.5 |
| Cape (one chain per edge, fill between) | 4 × 6 | 900 | 0.1 | 0.35 | [-0.2, 1] | 0.6 |
| Long ribbon | 7–8 × 4 | 400 | 0.3 | 0.1 | [-1, 0.4] | 0.9 |

Too floppy or noisy: raise `stiffness` or lower `points`. Too stiff, like a stick: lower `stiffness` and point `rest` more downward. Keep it shorter than half the hero's height at idle, or it reads as a limb or a weapon.

## One number: a spring

For a single angle or offset (a lantern's swing, an antenna, ears), use `SecondaryMotion.spring({ hz, damping })`: `update(dt, target)` chases the target, lags and overshoots. 1–2 Hz is heavy, 4–6 Hz quick; damping 0.2 wobbles, 0.5 gives one small overshoot. Feed it something like `-body.velocity.x * 0.05` degrees.
