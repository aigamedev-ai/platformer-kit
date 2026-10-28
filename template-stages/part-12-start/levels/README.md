# Levels

The chapter is a list of sections. Each section's rooms live in their own file, so sections can be built separately.

- `section-N.js`: the rooms of section N. It adds `{ number, name, rooms }` to `window.SECTIONS`; each room is
  `{ name, area, beat, grid }`. The tile legend is in `index.html` (above `loadSections()`).
- `section-N.routes.json`: one scripted route per room in that section (room name -> steps), for the difficulty
  measurer. `routes.mjs` merges all of them.

To add section N:

1. Copy `section-1.js` to `section-N.js`, set `number: N` and a name, and replace the rooms.
2. Add `<script src="levels/section-N.js"></script>` to `index.html` after the other sections.
3. Write `section-N.routes.json`.

Rules (checked when the game starts; problems are shown on the page):

- Sections are numbered 1, 2, 3, ... with no gaps.
- Room names are unique across the whole chapter.
- Area numbers carry on from the previous section and never go back down.
- Every grid is 15 rows with exactly one `P`, and 25 tiles wide (one screen) or wider (the camera follows the player
  sideways; keep wide rooms rare, e.g. a climax). Each room has a door `D`, and a section's last main room ends at a
  goal flag `G`. The flag in the last section ends the chapter and shows the end screen.
- Optional rooms (beat `'optional'`) are side rooms for skilled players. List each one right after the room it
  branches from, and put a bonus door `B` in that room, behind its start and up on a one-tile step (entering takes
  a hop, not just walking back), so the way on never goes through it. The game draws it glowing with a crown of
  spikes, so it reads as a hard side trip. Main-path doors and flags skip optional rooms. In the optional room,
  `D` finishes it and goes on to the main room after the one it branched from (after the chapter's last room it
  ends the chapter); a `B` behind its start leaves without finishing, back to the start of the room it branched
  from. The end screen counts the bonus rooms finished. The measurer gives optional rooms no target; check their
  routes with `--trace` (they must end at `D`, since leaving through `B` also counts as "done").
- `K` is a checkpoint: a flag post standing on the tile below. Touching it lights it; after that a death restarts the
  room (rebuilt fresh) at the post instead of at `P`. A row of touching `K`s is one checkpoint, so it can cover a
  whole rest platform. Use it only in long rooms, on a fully safe rest. The measurer always plays a room from `P`
  without dying, so to see what a checkpoint changes, measure each part on its own in a scratch copy.

Check the routes, then measure (from the project folder):

```
node .claude/skills/platformer-levels/scripts/measure-difficulty.mjs index.html levels/routes.mjs --check
node .claude/skills/platformer-levels/scripts/measure-difficulty.mjs index.html levels/routes.mjs --rooms 27-36
```

`npm test` runs the tests for crumbling blocks, refill orbs, the chapter stats, bonus doors and wide rooms.
