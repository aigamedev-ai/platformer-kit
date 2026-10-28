# Checking

## Gameplay is unchanged

1. Before you touch anything, run the game's measurement and keep the output. With the platformer-levels skill:
   ```
   node <skill>/../platformer-levels/scripts/measure-difficulty.mjs index.html levels/routes.mjs --check > before.txt
   node <skill>/../platformer-levels/scripts/measure-difficulty.mjs index.html levels/routes.mjs --rooms <a few> > before-m.txt
   ```
2. After the art is in, run the same commands and compare the room lines: they must be identical. Run the game's own tests too (`npm test`).
3. If anything differs, the art touched gameplay: a body was resized or removed, a depth or order change hid a trigger, or the loading order changed. Fix it, don't explain it away.

## Every room, at 1× and 2×

- Take a screenshot of every room (`measure-difficulty.mjs ... --shots DIR` gives the start and middle of each route). Look at all of them at true size, then crop a few at 2×.
- In each room, check:
  - hazards are readable at a glance and nothing covers them (props, particles, glow, roots);
  - pickups are the brightest things after the hero;
  - the exit is visible or clearly signposted;
  - the HUD text is readable over the brightest part of the background;
  - the player is never drawn inside rock (check undersides above walkways);
  - floating platforms' visual edges are within a few px of their collision edges;
  - wide rooms show no gap at the background's edge when the camera reaches the end.
- A greyscale pass on two or three rooms: the hero and pickups are still the brightest, and the danger stands out.

## Report

- The direction in one line, the palette (ramps and roles), and the key image.
- What is drawn in code (terrain, objects, hero, props) and what came from the image model, with prompts and seeds, or that no model was used and the backgrounds are procedural.
- The before and after measurements (identical), and the tests.
- Anything left unfixed and why.
