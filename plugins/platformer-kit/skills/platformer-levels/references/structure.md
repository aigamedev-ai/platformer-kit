# Chapter structure: from rooms in a row to a journey

Good rooms in a row are still just a row. A chapter feels like a journey when it has places to stop, rooms of different lengths, side trips the player chooses, a sense of where they are, and an ending that rises and then lets go. Celeste splits each chapter into a few named parts the player can resume from and branches off to optional challenges; Super Mario 3 puts different kinds of stage back to back on a map with houses and detours between them. See [sources.md](sources.md).

## 1. The shape

A chapter is a few sections. Each section brings one new element (see [progression.md](progression.md)) and has this order:

1. **Rest spot** (`kind: 'rest'`): the section's start. Safe, a checkpoint, a view of what's ahead.
2. **Rooms** through introduce, develop, twist and test, with room lengths that vary (section 3).
3. **Optional side rooms** branching off the way (section 4).
4. **A calm room** after the test (`beat: 'rest'`), then the exit to the next section's rest spot. The map shows on arrival (section 5).

The last section ends with the finale (a chase if the game has no attack, see [finale.md](finale.md)), then a release room, then the end screen.

## 2. Rest spots

A rest spot opens every section. It is where the player gets their breath back, sees how far they have come and what comes next.

- **Safe.** No spikes, no pits, no crumbling blocks, no moving hazard, nothing that can kill. Every player passes it every time (the measurer's target is 100% for every player).
- **A checkpoint.** The section starts here: if the game saves progress or has a "continue", it continues from the last rest spot reached.
- **A view of what's ahead.** Open space and something of the next section in sight but out of reach: the new element on a far ledge, the next area in the background, the finale's storm on the horizon. In a game that teaches without text, this is the "show it" before "show it safely".
- **Looks and sounds like a rest.** A camp, a lantern, a bench or a vista point; warm light, calm music or quiet. Show the section's name here.
- **Short.** One screen, walked through in a few seconds. Never make the player wait in it.

A rest spot is not the same as a calm room (`beat: 'rest'`). A calm room comes after a hard room inside a section and may have a gentle hazard (90%+ target). A rest spot has none and opens a section.

## 3. Room lengths

Rooms of the same length one after another feel like a list. Mix them:

- **Short bursts:** one idea in 3–8 seconds of play. Good for introduce rooms and for quick follow-ups.
- **Normal rooms:** one screen, about 5–15 seconds.
- **Long runs:** 2–3 screens wide (the camera follows), now and then, where flow is the story: a develop room that strings a move together, or a section's test. At most one or two per section. If a death in one costs more than about 15 seconds of replay, put a checkpoint on a fully safe rest in the middle.
- **An easy walk after a hard room.** After a test, a long run or a chase, give a short room with no new demand (a calm room or a rest spot). Don't put more than 3 hard rooms in a row (develop, twist, test or chase) without an easier one between them (a calm room, a rest spot or an introduce room).

The clean route times from `--check` are the room lengths. List them per section and check there is a mix.

## 4. Optional side challenges and collectibles

Hard extras belong off the main path, where skilled players choose them and nobody is blocked by them.

- **Branch off the way.** A side door or side path that looks like a side trip (and like a hard one), entered on purpose, never on the way forward.
- **One collectible each.** Put one collectible (a gem, a berry, a lantern flame) in each optional room, at the end of its hardest part. It counts when the player leaves through the room's exit with it, so dying in the room drops it. A few main rooms can also hold one in a tricky spot off the route.
- **Never required.** No door, gate, ending or score threshold needs collectibles. Missing one costs nothing but the count.
- **Shown, not pushed.** A small count on the HUD (e.g. `◆ 2 / 5`) in a corner that covers no play, the count per section on the map, and the total on the end screen.
- **Few.** One or two per section. Each one is its own small challenge; a handful of good ones beats many scattered ones.

## 5. The map between sections

When the player arrives at a section's rest spot, show where they are in the chapter:

- The sections as stops along a path (a line left to right, or up a mountain): finished ones lit, the current one marked, later ones dim, the finale marked at the end. Under each finished section: collectibles found / total.
- Show it as an overlay whenever a rest spot loads, fading as soon as the player moves (or after about 3 seconds). Don't block input or freeze the game: the rest spot is safe, so nothing is lost while the map is up. Because it never blocks play, the measuring hook doesn't need to skip it, `--playthrough` walks straight through, and the `--shots` start picture of a rest spot (taken 0.5 s in, before any input) shows it.
- The end screen repeats the map with every section lit, plus time, deaths and collectibles.

## 6. As data

Keep the structure in the room data, next to the grid and the beat:

```js
{ name: 'Camp', area: 3, kind: 'rest', grid: [...] },                 // a section's rest spot
{ name: 'Cracked floor', area: 3, beat: 'introduce', grid: [...] },     // kind 'main' is the default
{ name: 'Thin air', area: 5, kind: 'optional', grid: [...] },          // a side room ('beat: optional' also works)
{ name: 'Storm 2', area: 6, kind: 'chase', chase: { from: -64, delay: 1.2, speed: 190 }, grid: [...] },
```

- `kind` is `main` (default), `rest`, `optional` or `chase`. `beat` stays the teaching beat (introduce, develop, twist, test, rest).
- **Collectibles are a tile**, e.g. `*`, placed in the grid. The game totals them per section when it loads, and remembers the ones collected in a set (by room name and tile position) for this run of the chapter.
- **Check at load time**, the way the game checks its level data now: every section's first room is a rest spot; a rest spot has no hazard tiles (spikes, crumbling blocks, a chase); every optional room holds a collectible; every chase room has a hazard schedule.
- **In the measuring hook**, pass `kind` in `rooms` (the script reads it), and for a room with a collectible make `done` true only when the player leaves through the exit holding it. Then a passing route proves the collectible can be reached.

## 7. Checks

- Every section opens with a rest spot, and it measures 100% for every player.
- No more than 3 hard rooms in a row (develop, twist, test, chase) without an easier one.
- Room lengths really vary (from the `--check` times): besides the short bursts, each section has at least one room of 6–15 s and at least one short walk; if almost every room is 2–4 s, the pace is still flat.
- Sections and areas line up: each new element gets its own section opening with a rest spot, and the HUD label reads as one simple place name, not a pile of numbers.
- Optional rooms are really optional: `--playthrough` reaches the end without them and lists them as skipped.
- Every collectible is reachable: each optional room's route passes with the collectible in hand.
- The map and counts are right: take `--shots` of every rest spot and of the end screen, and look at them; give the map a small test that it marks the right section and counts. Test it the way a player arrives: walking in through the door with a direction key held. The map must stay readable for at least 2 s or until the player stops and dismisses it; a map that vanishes because a key is already held was never seen.
- Collectibles and HUD counters never overlap: check the screenshot of every room that holds a collectible.
- The release room after a finale looks different (e.g. dawn after a night storm) so the player feels the change.
