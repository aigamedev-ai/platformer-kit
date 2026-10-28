# Part 7: A full chapter with Claude Code: 34 rooms, two new mechanics and how they combine

Post: https://aigamedev.ai/tutorials/platformer-chapter/

Recorded with Phaser 3.80.1 · Claude Code 2.1.312. Skills installed in that session: platformer-levels, platformer-feel.

## Start from

`template-stages/part-07-start/`. The 12 rooms from the end of part 6's re-run, with the measuring hook and `levels/routes.json`.

```sh
cp -r template-stages/part-07-start ~/pk-part-07 && cd ~/pk-part-07
npm install && npx playwright install chromium
claude
```

## The prompts

The four section prompts are what a reader would send. The other two came from our checks after a session ended; skip them for a true replay.

Session 1, a fresh session:

```text
I want to turn this into a real chapter that takes a while to finish. First add two new things: crumbling blocks that shake and fall a moment after you land on them, then come back after a while, and refill orbs that give you your double jump back in mid-air and reappear after a few seconds. Keep each section's rooms in its own file so sections can be built separately, keep the rooms we already have as the first section, and add a death counter, a timer and an end screen that shows them. Test both new things. Don't build new rooms yet.
```

Session 2, a fresh session:

```text
Build the next section in its own file: about seven rooms about the crumbling blocks. Start with a safe first meeting, build up to a test room, and mix them with the jumps and springs the player already knows. Measure the new rooms with the skill's script and adjust them until they hit their targets.
```

Follow-up in the same session, from our own checks (a reader wouldn't have these numbers):

```text
Two problems from my own check. 1) Crumble test misses its band: with --runs 200 --rooms 18 the reached player passes 73% (seed 1) and 77% (seed 2), above the 40-70% target. Make it land inside the band at 200 runs, with more than one seed. 2) In Climbing stones the door sits in the top rows and covers the Deaths and time text in the top right corner. Move it so nothing overlaps the HUD, and check the other new rooms for the same thing. Then rerun --check and the full measurement.
```

Session 3, a fresh session:

```text
Build the next section in its own file: about seven rooms about the refill orbs. Start with a safe first meeting, build up to a test room, and mix them with the double jump, springs and crumbling blocks the player already knows. Measure the new rooms with the skill's script and adjust them until they hit their targets.
```

Session 4, a fresh session:

```text
Build the last section in its own file: about eight rooms where the crumbling blocks, refill orbs and springs work together, ending with one long climax room and a calm last room before the end screen. Also add two optional hard rooms for skilled players that new players can skip. Measure the whole chapter with the skill's script and adjust the new rooms until they hit their targets.
```

A fifth session, with fixes from our own checks of the whole chapter:

```text
We tested the whole chapter and found some problems. Please fix them: 1) A crumbling block starts to fall when you only brush its corner while jumping up past it; it should only start when you stand on it. 2) In Spring jump the door, and in Get it back the wall, cover the deaths and timer in the corner. 3) The bonus doors don't say they lead somewhere optional and hard; make that clear without text. 4) After finishing a bonus room you replay the room you came from; put the player in the next room instead. 5) The long way is long and a death sends you back to the very start; make the rest platform in the middle a checkpoint. Don't change the movement. Measure the whole chapter again afterwards and fix any room that moved off its target.
```

## What you should get

Give each section prompt to a fresh session in the same folder, in order. The first session adds crumbling blocks (`C`), refill orbs (`O`), one file per section (`levels/section-1.js` holds the old rooms), deaths, a timer, an end screen and tests. The next three each add a section: 7 rooms of crumbling blocks, 7 of refill orbs and 8 that combine everything, plus 2 optional bonus rooms.

In our final measurement all 34 main rooms land inside their target bands for a player who improves as they go. The four test rooms come out at 50%, 44%, 56% and 54%, and a clean run with no deaths takes 1 minute 47 seconds.

| Session | Time | Cost |
|---|---|---|
| 1, new mechanics and the end screen | 12 min | $2.47 |
| 2, crumbling blocks (final try, plus our follow-up) | 48 + 8 min | $8.23 |
| 3, refill orbs | 22 min | $2.97 |
| 4, all together | 41 min | $7.18 |
| 5, five fixes from our checks | 13 min | $2.62 |

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
