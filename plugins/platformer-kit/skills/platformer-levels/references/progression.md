# Across the whole game: new elements and a player who gets better

A demo is one good room. A game is many rooms in a row, played by someone who gets better as they go. Two things decide whether it holds together: when new elements arrive, and how hard each room is compared with how good the player is by then.

## 1. New elements: one at a time, with a full arc

Split the game into areas (worlds). Each area brings **one** new element: a new move, object or hazard. Inside the area, the element goes through four beats, often called kishōtenketsu after the four-part story structure Nintendo's designers use:

1. **Introduce:** meet it safely, where failure costs nothing.
2. **Develop:** use it with real risk, a little harder each time.
3. **Twist:** use it in a way the player didn't expect, or combine it with an older element.
4. **Conclude:** one room that tests it properly, then a short calm room.

**Rules**

- Keep a plan of the whole game as a table: rooms across, elements down, each cell marked with the beat (introduce, develop, twist, test). Write it before building an area and update it after.
- An element must be introduced before any room needs it. Never introduce two in one room.
- Older elements come back in later areas, mixed with the new one. An element used once and dropped is a wasted lesson, unless it is meant as a one-off surprise.
- Each new element should change how the player moves or thinks, not just how a room looks. If it doesn't, it is decoration, not a mechanic.
- Add an element as data the rooms can place (e.g. a tile letter), and give it its own test like any feel helper.

## 2. Difficulty: measure it, then shape it as a sawtooth

The player improves, so a room that is hard in area 1 is easy by area 3. Difficulty should rise overall, but in waves: harder through an area, a drop when a new element is introduced, a peak at the area's test room, then rest. This is the sawtooth curve.

**Measure each room with simulated players.** Play each room's scripted route many times (about 50) with a random timing error on every press and release, and record the pass rate. Each error comes from a normal (bell-curve) distribution whose standard deviation is the player's timing error below. For browser games, `scripts/measure-difficulty.mjs` does all of this and checks the targets below; don't write your own harness, because its numbers won't match. See [measuring.md](measuring.md). It uses three players:

- **New player:** about 0.10 s of timing error.
- **Average player:** about 0.05 s.
- **Skilled player:** about 0.02 s.

**Model a player who improves.** The player starts as a new player in room 1 and gets better with every room they play, quickly at first, then levelling out near average. For each room, take the pass rate of "the player who has reached this room". This depends only on how many rooms come before it, so adding rooms later in the game doesn't change the verdict on earlier ones. Optional rooms don't count as rooms played.

**Targets** (starting points, tune with real players):

- First area: at least 90% for the player who has reached that room.
- Introduce rooms: at least 90%.
- Develop and twist rooms: 60–90%.
- Test rooms: 40–70%, never below 30%.
- After a test room, the next room is easier.
- Skilled players should pass everything at 95% or more, except optional hard rooms.

**Report** the curve: quote the script's table (one line per room with its beat, the pass rates for all three players and for the player who has reached it, the target and the verdict) and point the user to its `report.html`. Fix rooms outside their target by changing gaps, heights, hazards or rests, not the movement numbers, then measure again.

## 3. Limits

The simulated player covers how precisely a player times inputs, how late they react to things they can't plan for, how much worse they get when inputs come thick and fast, and how one slip carries over to the next. It still can't read the room the way a person does, choose a different route, learn the room over several tries, or get nervous on the last jump, and it can't tell you whether a room is confusing, whether the player notices a new element, or whether it is fun. Its numbers are starting guesses until checked against real players. Say so in your report, and recommend watching a real person play the first area.

## 4. Hard content for skilled players

Keep the main path fair. Put the real hard rooms off the main path (an optional side room or a bonus at the end of an area), so skilled players have something to chase and new players aren't blocked.
