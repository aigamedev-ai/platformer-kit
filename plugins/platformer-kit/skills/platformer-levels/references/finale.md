# A chase finale

A game where the player can't attack can't end with a fight. End it with a chase instead: something the player can't beat comes after them, and the only answer is to move well, using everything the chapter taught. Celeste's Old Site ends with a chase out of a dream, and each of Ori's dungeons ends with an escape from water, wind or lava. See [sources.md](sources.md).

## 1. The hazard

- **One hazard on a fixed schedule.** A storm front or cloud wall that rolls in from behind, water or darkness rising from below, a wall that collapses toward the player. Its position comes only from the time since the segment (re)started: no random numbers, no real time, and no speeding up or slowing down to match the player. Every attempt is the same, so the player can learn it and the measurer can time it.
- **Constant speed within a segment.** It can step up from one segment to the next.
- **Kills on touch,** like spikes. Its front edge is sharp and readable: a bright edge, particles, a growing sound. When it is off screen, show it at the screen edge (a glow or a band), never let it arrive unseen.
- **Another way: a pursuer that replays the player's own moves after a delay** (Celeste's dark double copies every input as she chases). The margin is then simply the delay, and any stop costs exactly that much. It suits a story about a rival; a scheduled hazard is easier to read and tune, so use that by default.

## 2. Shape

- **3–5 segments, each its own room** (`kind: 'chase'`), 1–2 screens wide and 8–20 seconds of clean route. The segment's start is the checkpoint: a death restarts that segment only, with the hazard back at its start. Ori's first game ran its escapes long with no saving, and its makers later said some players never got through; keep segments short.
- **Only elements already taught.** A chase is a test of the chapter, not a lesson. One older element leads each segment: running and jumping first, then crumbling ground, refill orbs, springs.
- **Easy first, tightest last, then release.** Segment 1 has a wide margin; the middle segments tighten; the last one is the tightest (and still fair). The end comes at a calm room (section 5).
- **One readable way forward.** No dead ends and no branch that traps the player; if there is a choice, both ways lead on. Lights, lanterns or a trail of pickups lead the eye. A tempting wrong route is worse here than anywhere, because there is no time to try it.
- **No blind jumps.** Every landing is on screen before the jump. Look ahead with the camera: keep the player left of centre when running right (below centre when climbing), so the way ahead is in view and the hazard behind is shown at the edge.
- **No forced waits.** A crumbling block's shake, an orb coming back or a pause on a ledge all eat the margin. Avoid them, or count them in the margin.
- **Prefer ground the player has seen.** Running back through a place they already crossed (changed by the hazard) reads faster than a new place.

## 3. Telegraph the start

Each segment starts with the hazard visible and still, warning for about 1–1.5 seconds (2 seconds for the first): a rumble, a sound, the sky darkening, the edge flaring. Then it moves. The player may move during the warning (a head start). The warning is part of the schedule (the hazard's `delay`), so it is the same on every attempt. The first segment's warning is the "run!" moment: the music starts here.

## 4. Tuning: speed and margin

**Margin** is how many seconds the player stays ahead of the hazard: the distance between them divided by the hazard's speed, i.e. how long the hazard would take to reach where the player stands now. A segment's margin is the smallest value along the route, usually right after the slowest part (a climb, a wait, a backtrack).

**Hazard speed** is a fraction of how fast the route moves the player along the hazard's direction:

- For a hazard coming from behind, that is close to the run speed (260 px/s in a game with that run speed) minus any waits.
- For a rising hazard, it is the route's climbing speed: height gained ÷ seconds of clean route. Much lower than the run speed.

Start at 0.6–0.7 of that speed in the first segment, 0.7–0.8 in the middle ones and 0.8–0.9 in the last. At 1.0 or more it catches any route given time. The speed sets how the margin changes along the segment; the warning `delay` and the hazard's start position set the margin at the start.

**Margin targets** for the clean (perfectly timed) route, by who must get through. These are starting guesses: the measurer's new player reacts about 0.3 s late to what it can't plan, and a real first-time player also pauses to read a new screen, which the measurer doesn't model.

| Segment | Must get through | Clean-route margin | Pass rate (player who has reached it) |
|---|---|---|---|
| First | a new player | 1.5–2.5 s | 60–90%, aim near the top |
| Middle | an average player | 1.0–1.5 s | 60–90% |
| Last (one) | the average player who got this far | 0.6–1.0 s | 60–90% |
| Optional chase (bonus) | a skilled player | 0.3–0.6 s | none |

Never under 0.6 s on the main path. Over 2.5 s the hazard adds no pressure. The skilled player should still pass every main segment at 95% or more.

## 5. The release

End with a release: the hazard stops at a clear line (a door slams behind, the storm breaks on a ridge), the music drops to silence or a soft theme, and the next room is calm (a rest spot or a calm room) with the goal or a view. Celeste's chase music fades out as the chase ends and the next part opens at a campfire with nothing dangerous in it; Celeste's last chapter closes with a long final screen built to start at its hardest and end at its easiest. Show the end screen after the release, not during the chase.

## 6. Music and juice

- Bring in a faster music layer when the hazard moves. On a death in the chase, keep the music playing instead of restarting the track, so retries feel like one run. Drop it at the release.
- With sound effects only: a rumble loop whose volume follows the margin.
- A small constant shake while the hazard moves (none with reduced motion), particles along its front, a flash when it catches the player. All visual only, like any juice.

## 7. In the game and the data

```js
{ name: 'Storm 1', area: 6, kind: 'chase', beat: 'test', chase: { from: -64, delay: 1.5, speed: 170 }, grid: [...] }
```

- Hazard front: `front = from + speed × max(0, roomTime − delay)` (for a rising hazard, `axis: 'y'` and `from − ...`). `roomTime` is the time since the room (re)started, added up in the game's update step from the frame delta (the way timed blocks usually are). Restarting the room resets it to 0.
- The player dies when their body crosses the front.
- In the measuring hook, `state()` also returns `ahead` (px from the player's body edge nearest the hazard to its front, positive while safe) and `hazardSpeed` (px/s while it moves, 0 during the warning). See [measuring.md](measuring.md).

## 8. Measuring

- `--check` plays each segment twice and prints its margin and where it is closest (e.g. `margin 1.21 s (closest at x 905, y 300, 3.40 s in)`). Both plays must match: if they don't, the hazard reads a clock or a random number it shouldn't.
- `--trace N` adds a margin column frame by frame, to see where the slack goes.
- The full run adds a margin column, the median margin of each player's passing attempts, and how many failures were the hazard catching the player. A chase room gets the 60–90% target, a note under 0.6 s or over 2.5 s, and a note if `state()` reports no hazard.
- Reading it: if the new player is mostly caught, slow the hazard or lengthen the warning; if they mostly die on a jump, fix the jump, not the hazard. The last segment's margin should be the smallest.
- Margin alone isn't enough: each segment must also land in its pass-rate band. If a segment passes 95%+ and almost no failure is the hazard catching the player, the chase is decoration: speed the hazard up or shorten the warning until the hazard causes a real share of failures.
- Check every warning is really visible: screenshot the moment before the hazard moves and while it's off-screen, and look at the pixels at the screen edge. A warning drawn at zero opacity, or dark on a dark background, doesn't exist.
- Then watch a person play the chase once: hesitation, looking around and panic are not in the numbers.
