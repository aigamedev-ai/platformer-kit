---
name: platformer-levels
description: Design and check levels for a 2D platformer (Phaser, Godot, Unity or canvas). Use when building, extending or fixing platformer levels or rooms, or when the user says a level is too hard, confusing, boring or impossible.
---

# Platformer levels

You can't see or play a level the way a player does, so design each room around one clear idea and then prove with numbers and a scripted playthrough that it works. These rules come from studying how Celeste was designed (see [references/sources.md](references/sources.md)).

## Always do

1. **Keep levels as data.** Put each room in a small grid or list (tiles, hazards, pickups, start, exit) that is separate from the game code, so rooms can be added, changed and checked.
2. **Write each room's one-line story first.** One sentence about the single thing the room asks of the player, e.g. "Jump the spike pit, then double jump up to the ledge." Build only what serves that sentence. If you can't write it, the room has no reason to exist. See [references/room-rules.md](references/room-rules.md).
3. **Teach in order, without text.** Each new move or object goes through: show it safely, use it, combine it, test it. See [references/teaching.md](references/teaching.md).
4. **Check every room with the jump numbers.** Work out from the game's own constants how far and how high the player can jump, then check every required jump and every tempting wrong jump. Then play each room with a scripted route. See [references/checking.md](references/checking.md).
5. **Plan the whole game, not just a room.** Bring in one new element per area through introduce, develop, twist and test, and measure every room's difficulty so the curve rises in waves as the player improves. See [references/progression.md](references/progression.md). For browser games, measure with `scripts/measure-difficulty.mjs` in this skill's folder (`${CLAUDE_SKILL_DIR}/scripts/measure-difficulty.mjs`; its default is `--model full`): add its small hook to the game, write a route per room and mark the steps that are reactions (`"react": true`); don't write your own harness. See [references/measuring.md](references/measuring.md).
6. **Give the chapter a shape, not just a row of rooms.** Open each section with a rest spot (safe, a checkpoint, a view of what's ahead), vary room lengths and follow hard rooms with an easy one, put hard extras in optional side rooms with a collectible that is counted but never required, and show a map between sections. Keep it in the room data (`kind: main | rest | optional | chase`). See [references/structure.md](references/structure.md). For a finale in a game with no attack, use a chase: [references/finale.md](references/finale.md).
7. **Report like a level designer.** For each room give its one-line story, what it teaches, its hardest jump as a share of the maximum, and whether the scripted route finished. Keep it short.

## Before you finish

1. Run `--check` on all rooms and `--playthrough` once: every route passes and the whole game plays through to the end.
2. Re-measure every room marked "near edge" with `--runs 200 --seeds 1,2`.
3. Take `--shots` and look at every new room yourself: nothing covers the HUD, hazards and pickups are readable, the exit is visible or clearly signposted, and new elements are easy to tell apart.
4. For each room that brings in a new element, remove the element in a temporary copy and confirm its route fails. If it still passes, the element is decoration.
5. In a chapter with sections, check its structure: every section opens with a rest spot that passes 100% for everyone, no more than 3 hard rooms in a row without an easier one, optional rooms really optional (`--playthrough` skips them) with reachable collectibles, the map and counts right in the `--shots`, and each chase segment's margin in its target. See [references/structure.md](references/structure.md).
6. Then report, listing anything you left unfixed and why. Details: [references/checking.md](references/checking.md).

## Rules for every room

- **Short rooms, restart at the room start.** A death costs a few seconds, not a level.
- **One idea per room.** The part that is not the idea (getting onto the first platform, walking to the exit) is easy and forgiving.
- **Wrong routes must look wrong.** A gap that is just barely too far is the worst thing in a level: players keep trying it. Make impossible jumps obviously impossible, or make them possible.
- **Safe spots set the pace.** Solid ground with no danger is a rest. Find out what else counts as safe in this game: a wall cling, a ledge hang or a spare air jump is a partial rest that runs out. If the game has none, the only rests are platforms. Hard moves with rests between them feel slow and tense; easy moves with no rest feel fast. If a room has a fully safe spot in the middle, consider ending the room there.
- **Hazards are readable.** Spikes and pits look dangerous, pickups stand out from the background, and anything that will move or fall warns the player first.
- **Leave room for more than one way.** Don't require an exact pixel or input unless that precision is the room's story. With few moves, the variety comes from timing: a short hop or a full jump, and when to spend a limited move such as the double jump.

## Not now

Don't add secret areas, collectibles, moving platforms, enemies, bosses or chases unless the user asks (asking for chapter structure or a finale counts); each needs its own teaching steps. Keep any the game already has, and place them in the new rooms.
