# Checking rooms with numbers and a scripted run

## 1. Work out the jump from the game's constants

Read run speed, gravity and jump speed (and double jump speed if any) from the game. Compute:

- **Max jump height** = jump speed² ÷ (2 × gravity). Add the second jump's height for a double jump.
- **Max gap at the same height** = run speed × total air time. Air time for one jump = 2 × jump speed ÷ gravity.
- For a target higher or lower than the take-off, solve the arc for that height difference.

Measure these in the running game once (one scripted full jump) and use the measured numbers if they differ.

## 2. Grade every jump in every room

For each jump the intended route needs, give it as a share of the maximum (distance and height):

- **Up to about 70%:** comfortable. Good for teaching rooms.
- **70–90%:** a real challenge. Use for "use it" and "test it" rooms.
- **Over 90%:** too precise unless precision is the room's story.

Also list **tempting wrong jumps**: gaps or ledges off the route at 90–115% of the maximum. Players will keep trying these. Move them clearly out of reach (over 130%) or bring them in reach.

Check the head room too: a ceiling lower than the jump height above a jump makes the player bonk.

## 3. Play every room with a scripted route

Write each room's route as inputs tied to moments (e.g. hold right, jump at the edge of the gap, release on landing). Run it in the real game and check that the player reaches the exit without dying: for browser games, write the routes in the format of [measuring.md](measuring.md) and run `scripts/measure-difficulty.mjs --check`; for Godot, a headless script. Run it for every room after every change. A room whose route fails is broken, whatever the numbers say.

## 4. Before you finish

For browser games, with `scripts/measure-difficulty.mjs` (see [measuring.md](measuring.md)):

- **Routes and the whole game.** `--check` must pass for every room. `--playthrough` plays the game from room 1, entering each room through the previous one's exit and following wherever the exit leads, and must reach the end without missing a main room. It catches a door that leads to the wrong room, a room that starts badly when entered at speed, and an end that doesn't trigger.
- **Near-edge rooms.** A verdict marked "near edge" can flip between runs. Measure those rooms again with `--runs 200 --seeds 1,2 --rooms N`. If the two seeds still disagree, the room sits on its band edge: nudge it into the band, or say so in the report.
- **Look at the rooms.** `--shots DIR` saves `07-spring-start.png` and `07-spring-mid.png` for each room (the start, and halfway through its route), at the game's own size; a room wider than the screen gets one picture per screen along the route and an `-end` picture. Open every new room's pictures and check: nothing covers the HUD or is hidden under it; spikes, pits and pickups are readable against the background; the exit is on screen or clearly signposted; a new element looks different from everything else. Fix what fails and take the pictures again.
- **New elements must matter.** For each room that brings in a new element, make a temporary copy of the game with that element removed from the room (e.g. the spring tile replaced by empty space or floor), and run `--check --rooms N` on the copy. The route must fail. If it still passes, the room doesn't need the element: change the room so it does. Delete the copy afterwards.

- **Structure** (a chapter with sections, [structure.md](structure.md)): every section opens with a rest spot that measures 100% for every player; no more than 3 hard rooms in a row without an easier one; room lengths vary (the `--check` times); `--playthrough` reaches the end without the optional rooms; each optional room's route passes with its collectible; `--shots` of every rest spot and the end screen show the right map and counts. For a chase, each segment's margin is in its target ([finale.md](finale.md)) and `--check` plays it the same twice.

## 5. Report

One line per room: story, what it teaches, hardest jump as % of max, tempting wrong jumps (none / fixed), scripted route passed. For a chapter with sections, one line per section too: its rest spot, room count and lengths, optional rooms and collectibles; and each chase segment's margin. Then list anything you left unfixed and why.
