# Light and effects (in code)

Painted light can't move and doubles the work. Keep the art flat, with the light direction built into the ramps, and add light at runtime. Everything here is visual only.

## Warm against cool

- The surroundings are cool (blue, violet, teal). Light sources are warm (lantern orange #ff9a3a to #ffd070) and few: 1–3 per room.
- Pickups glow cool and bright (cyan) so they read against warm lights.
- Danger keeps its own hue, and no glow changes it.

## Glow

- Use additive soft circles behind a light: a large faint one (radius 20–30 game px, alpha 0.25–0.4) and a small bright core (radius 6–8). In Phaser: `this.add.circle(x, y, r, color, alpha).setBlendMode(Phaser.BlendModes.ADD)`, or a pre-blurred radial-gradient texture drawn once to a canvas.
- Glow goes around the hero (faint, warm), pickups (cool), the exit and lit checkpoints, and the lanterns.
- A slow pulse (±10% alpha over 1.5–2 s) makes lights feel alive. Don't flicker hard.

## Vignette

- Draw a dark radial gradient over the edges on a canvas texture, fixed to the camera (`setScrollFactor(0)`), above the world and below the HUD. Keep the centre clear and darken the corners by about 40–60%.
- It must never hide a hazard or an exit near the screen edge. Check rooms whose exit is in a corner.

## Particles

- Use one-pixel motes on the art grid (2×2 game px): falling dust or snow (night), sparkles (cave), embers rising from lanterns. 30–70 on screen, slow, in background colours, so they read as atmosphere and never look like pickups or hazards.
- Gameplay particles (landing dust, death burst) belong to juice; keep them in the art palette.

## Order (back to front)

far background → mid → near → terrain image → props → objects (spikes, blocks, springs, orbs, doors) → hero → glow (additive) → ambient particles → vignette → HUD.

Put all of these effects behind one settings switch, so that turning them off gives back the plain art.
