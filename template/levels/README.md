# Levels

The chapter is a list of sections. Each section's rooms live in their own file, so sections can be built separately.

- `section-N.js`: the rooms of section N. It adds `{ number, name, rooms }` to `window.SECTIONS`; each room is
  `{ name, area, beat, kind, grid }` (plus `vista` for a rest spot and `chase` for a chase room). The tile legend is
  in `index.html` (above `loadSections()`).
- `section-N.routes.json`: one scripted route per room in that section (room name -> steps), for the difficulty
  measurer. `routes.mjs` merges all of them.

To add section N:

1. Copy `section-1.js` to `section-N.js`, set `number: N` and a name, and replace the rooms.
2. Add `<script src="levels/section-N.js"></script>` to `index.html` after the other sections.
3. Write `section-N.routes.json`.

## The chapter's shape

Five sections, each a small journey: a **rest spot** to open it, rooms of different lengths with an easier room after
at most three hard ones, a **side room** with a star, and a **calm room** before the flag. The chapter map shows in
every rest spot.

| Section | Rest spot | Long run | Calm rooms | Side room (star) |
|---|---|---|---|---|
| 1 First steps | Trailhead | Spike run | Meadow, Ridge path, Overlook | Sky steps (off Meadow) |
| 2 Crumbling ground | Camp | Keep moving | Rubble path, Solid ground | Crumbling spire (off Rubble path) |
| 3 Refill orbs | Lantern rest | Orb steps | Still pool, Glow walk | Orb ladder (off Still pool) |
| 4 All together | Ruined gate | The long way | Quiet ledge, Homeward | Thin air, Last light |
| 5 The storm | Watchtower | Storm 1-3 (chase) | Sunrise (the release) | - |

- `kind` is `main` (default), `rest` (a section's rest spot: no spikes, crumbling blocks or chase; a campfire and the
  chapter map; `vista: 'spring' | 'crumble' | 'orb' | 'mix' | 'storm'` draws what lies ahead far off in the sky),
  `optional` (a side room; `beat: 'optional'` also counts) or `chase`. `beat` stays the teaching beat; calm rooms
  are `beat: 'rest'`.
- `*` is a **star**, the collectible: one in every optional room, at the end of its hardest part. It counts when the
  player leaves through the room's exit (`D`/`G`) holding it; a death drops it, and leaving by the bonus door back
  doesn't count it. Never needed for anything. The HUD shows found / total under the time; the map shows it per
  section and the end screen the total.
- A **chase** room has `chase: { from, delay, speed }`: a storm wall whose front (px) is
  `from + speed * max(0, time since the room (re)started - delay)`. It rumbles during the delay, then moves; touching
  it restarts the segment. Same every attempt, so it can be learned and measured. The three segments get tighter:
  clean-route margins 1.60 s, 1.09 s and 0.70 s (`--check` prints them).

Rules (checked when the game starts; problems are shown on the page):

- Sections are numbered 1, 2, 3, ... with no gaps, and every section's first room is a rest spot (`kind: 'rest'`)
  with no hazards.
- Every optional room holds a star `*`; every chase room has a `chase` schedule and no other room has one.
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
  from. The end screen counts the stars (one per bonus room). The measurer gives optional rooms no target; check their
  routes with `--trace` (they must end at `D`, since leaving through `B` also counts as "done").
- `K` is a checkpoint: a flag post standing on the tile below. Touching it lights it; after that a death restarts the
  room (rebuilt fresh) at the post instead of at `P`. A row of touching `K`s is one checkpoint, so it can cover a
  whole rest platform. Use it only in long rooms, on a fully safe rest. The measurer always plays a room from `P`
  without dying, so to see what a checkpoint changes, measure each part on its own in a scratch copy.

Check the routes, then measure (from the project folder):

```
node tools/measure-difficulty.mjs index.html levels/routes.mjs --check
node tools/measure-difficulty.mjs index.html levels/routes.mjs --rooms 49-53
```

(`npm run check` and `npm run measure` run the same script. It's the platformer-levels skill's
`scripts/measure-difficulty.mjs`, copied here so the game works on its own.)

`npm test` runs the tests for crumbling blocks, refill orbs, the chapter stats, bonus doors, wide rooms, the chapter
shape, stars, the map and the chase, plus the sounds.
