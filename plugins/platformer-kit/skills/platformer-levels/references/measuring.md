# Measuring difficulty with simulated players

`scripts/measure-difficulty.mjs` (in this skill's folder) does all the measuring: simulated players, pass rates, the player who has reached each room, the target check and a report. Don't write your own harness. Your part is a small hook in the game and one route per room.

It works for browser games (Phaser, plain canvas, anything in a web page). It runs the page in headless Chromium, muted, on its own clock in fixed 1/60 s steps as fast as the machine allows, and sends keyboard events. So the game must read input from keydown/keyup events (by `key`, `code` or `keyCode`) and time from `requestAnimationFrame`, `performance.now` or `Date.now`, which almost every web game does.

## 1. Install once

It needs Node 18 or newer and Playwright. In the game's folder:

```
npm install --save-dev playwright
npx playwright install chromium
```

If Playwright is missing, the script prints these commands and stops. On Linux, if Chromium then fails to start, run `npx playwright install --with-deps chromium`.

## 2. Add the hook

```js
window.__levels = {
  rooms: [{ id: 'Pit run', area: 1, beat: 'test' }, ...],   // every room, in play order
  goto(i) { /* restart room i from its start, as a fresh attempt */ },
  state() { return { x, y, onGround, dead, done }; },
};
```

- **rooms**: `id` is unique (the room's name is fine), `area` is the area number, `beat` is `introduce`, `develop`, `twist`, `test`, `rest` or `optional` (off the main path). Keep the beat in the room data next to the grid, so the plan and the game can't drift apart. If the chapter has structure ([structure.md](structure.md)), also pass `kind`: `main` (default), `rest` (a rest spot), `optional` or `chase` (a chase segment, [finale.md](finale.md)).
- **goto(i)**: put the player at room i's start, standing still, with any air jump back and no keys held. Cancel anything still pending from the last attempt, such as a restart timer after a death or a room change. Skip menus, fades and transitions.
- **state()**: `x`, `y` are the player's position in pixels (the centre, y down), in the same numbers the routes use. `onGround` is true when standing on something and not moving up. `dead` is true if the player died since the last `goto`, `done` if they reached the room's exit. Also return `vx`, `vy` in px/s if the game has them; otherwise they are worked out from the movement. For `--playthrough`, also return `room` (the index of the room the player is in now) and `finished` (true once the end of the game is reached). In a room with a moving hazard (a chase), also return `ahead` (px from the player's body edge nearest the hazard to the hazard's front, positive while safe) and `hazardSpeed` (its speed in px/s while it moves, 0 while it waits). The hazard must move on a fixed schedule from the room's start (no real time, no random numbers), so a restart replays it exactly.

The hook only reads and restarts. Don't change movement, timing or rooms to make it work.

**Phaser:** set the hook in the scene's `create()`. `goto` clears the scene's pending timers (`this.time.removeAllEvents()`), remembers the room index and the death count, then calls the game's own room loader. `state()` reads `this.player` and its Arcade body: `onGround` is `(body.blocked.down || body.touching.down) && body.velocity.y >= 0`, `dead` compares the death count with the one saved in `goto`, `done` is true when the room index has changed or the level is won. If each room is a scene restart, `goto` can call `this.scene.restart({ room: i })`; the script waits a few frames after `goto`. If falling into a pit respawns the player instead of killing them, count respawns and use that for `dead`.

**Plain canvas:** set the hook at the end of the game script. `goto` calls the game's load-room function, saves the room index and death count, and clears the table of held keys. `state()` returns the player object's fields.

## 3. Write a route for each room

One JSON file, for example `levels/routes.json`, keyed by room id:

```json
{
  "keys": { "left": "ArrowLeft", "right": "ArrowRight", "jump": "ArrowUp" },
  "rooms": {
    "Run": [{ "press": "right" }],
    "Pit run": [
      { "press": "right" },
      { "press": "jump", "when": { "x>=": 109 } },
      { "release": "jump", "after": 0.4 },
      { "press": "jump", "when": { "x>=": 324 } },
      { "release": "jump", "when": "land" }
    ]
  }
}
```

- **keys**: which key the game uses for each name. Defaults: arrow keys, and Space for `jump`. Any KeyboardEvent code works too, e.g. `"KeyZ"`.
- **Each step** presses or releases one key (or neither, to just mark a moment), at a moment:
  - no `when` or `after`: together with the previous step (the first steps: at the room start)
  - `"when"`: the first moment a condition holds, looked for from the previous step's moment on
  - `"after"`: seconds after the previous step's moment, or after the `when` moment if both are given
- **Conditions**: `{"x>=": 200}`, `{"x<=": 90}`, `{"y<=": 150}` (above), `{"y>=": 300}`, `{"vy<=": -700}` (rising faster than 700 px/s, e.g. a spring launch), `"land"` (back on the ground after the latest jump press), `"apex"` (the top of the jump: stopped rising), `"falling"`.
- **Timing error** goes on every press and release: a normal (bell-curve) random error with the player's timing error as standard deviation, the same random draws for every player. Steps at the very start and steps without a key get none. An early press really happens early: the script replays the room to find the moment it was aiming at.
- **`"react": true`** marks a step the player can only answer, not plan: its moment can't be read from the screen in advance, e.g. a block that drops with no warning, or something the camera reveals at the last moment. Anything the player can see coming on a fixed, visible timer is planned, not a reaction: a block that shakes for 0.5 s before it drops, once the player has seen it do that before, an orb that always comes back at the same speed. Planned steps also include gap edges, the tops of jumps and landings. Mark only real reactions.

**The simulated player** (`--model full`, the default) has three effects on top of the timing error:

- **Reaction delay.** A `react` step happens late: on average 0.30 s for a new player, 0.22 s for an average one and 0.18 s for a skilled one (±25%, never under 0.1 s), and steps timed from it move with it. So a reaction must have a generous window.
- **Busy hands.** An input that comes less than 0.2 s after the previous one gets up to 1.5 times the error, and a press that switches direction (left to right) or comes right after letting go of another key gets 1.25 times more.
- **Errors carry over.** A player who was late on one input tends to be late on the next (correlation 0.5), so the gap between two inputs is steadier than either input alone.

Never tune a room so that it only works for a late, reacting player (e.g. a jump that only clears because the press comes 0.3 s after the obvious moment): a player who reads the room and presses on time must pass too. Check such rooms with `--model simple` as well; the skilled player must pass in both models.

These numbers are starting guesses, not measured from real players; each is an option (`--react-new`, `--react-avg`, `--react-skilled`, `--react-spread`, `--react-min`, `--load-gap`, `--load-gain`, `--switch-gain`, `--rho`), so they can be set from real play later. `--model simple` turns all three off (only the timing error), for comparison with older numbers.

Write the way a careful player would take the room on purpose: trigger jumps where a player would look (the edge of a gap, the top of a jump), and use `after` for rhythm. A trigger a few pixels off makes the room look harder than it is; `--tune` (below) fixes that.

## 4. Run it

The script is at `scripts/measure-difficulty.mjs` in this skill's folder, written `<skill>` below: `.claude/skills/platformer-levels/` for a project skill, or the full path SKILL.md gives when the skill comes from a plugin. Run it from the game's folder, where Playwright is installed. The game is the path of its `.html` (served from its folder) or a URL such as a running dev server.

```
node <skill>/scripts/measure-difficulty.mjs index.html levels/routes.json --check
node <skill>/scripts/measure-difficulty.mjs index.html levels/routes.json --tune
```

- `--check` plays each route once with no timing error and says where a failing route dies or gets stuck, and whether each room plays the same twice. Fix every route (or `goto`) until all pass. It takes seconds. For a room with a hazard it also prints the margin (the fewest seconds the route stays ahead of it) and where that is, and says when a death was the hazard catching the player.
- `--playthrough` plays the game from room 1, each route in turn, going wherever each exit leads (so doors that skip optional rooms are followed), and says whether it reaches the end and whether any main room was never reached.
- `--shots DIR` saves a picture of each room at its start and halfway through its route (and for a room wider than the screen, one per screen along the route and one at its end), at the game's own size (only the game's canvas; HUD made of page elements is not in it). Look at them yourself.
- `--trace 4` plays room 4's route once and prints the player's position, speed and ground state over time (and the margin, in a room with a hazard), with the moment each step fires. Use it to see why a route fails instead of writing your own tracer. Add `--sigma 0.1` to replay the first measured attempt at that timing error.
- The full run plays every room 50 times for each player. `--tune` first moves each trigger to where the new player passes most often and writes `routes.tuned.json`; read the changes, and copy the file over your routes if they make sense.
- Keep the first measurement as the "before": run it with `--out difficulty-report/before` and later ones with `--out difficulty-report/after`, so the user can compare the two reports.
- Other options: `--rooms 6-8`, `--runs 200`, `--seeds 1,2` (measure with both and show both), `--sigmas 0.10,0.05,0.02`, `--seed N`, and `--skill-start 0.10 --skill-end 0.05 --skill-rooms 12` for how fast the player improves.
- On a laptop a 15-room game takes about 20 seconds, `--runs 200` about a minute and a half, `--tune` a few minutes.

## 5. Read the results

It prints a table and writes `table.txt`, `results.json` and `report.html` (a chart of the curve and the table) to `difficulty-report/`. Per room: beat, pass rate for the new (±0.10 s), average (±0.05 s) and skilled (±0.02 s) player, pass rate for the player who has reached the room (they get better with every room they play, quickly at first, then levelling out near average; the timing error used is shown next to it), the target band and a verdict: OK, too easy or too hard. Notes under the table say which step most failures happen after, which rooms sit near a band edge, and where a skilled player drops below 95%.

Rooms with a `kind` get their own targets: a rest spot must pass 100% for every player, and a chase segment gets 60–90% plus a `margin` column (the clean route's margin), the median margin of each player's passing attempts, a note when the margin is under 0.6 s or over 2.5 s, and how many failures were the hazard catching the player. Rest spots don't count as rooms played for "reached". See [finale.md](finale.md).

Quote the table to the user and give them the path of `report.html`. With 50 runs a pass rate is good to about ±5%, so a verdict marked "(near edge)" (within 3 points of the band edge) can flip between runs: check that room with `--runs 200 --seeds 1,2 --rooms N` before changing it. If the seeds disagree, the room sits on its band edge.

## 6. Fix rooms, then measure again

Fix rooms, not movement numbers: widen or narrow a gap, raise or lower a ledge, add or remove a rest, move a hazard. Use the failing step to find the jump that matters. Change one thing, run `--check`, then measure the changed rooms with `--rooms`; run all rooms again at the end. Only compare numbers measured with the same routes, players and runs. Don't edit the script to make a room pass.
