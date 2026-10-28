# Part 5: Growing a game: adding a spring pad across six rooms with Claude Code

Post: https://aigamedev.ai/tutorials/new-mechanics-across-a-game/

Recorded with Phaser 3.80.1 · Claude Code 2.1.311. Skills installed in that session: platformer-levels, platformer-feel.

## Start from

`template-stages/part-05-start/`. Part 4's six-room level, as Claude left it.

```sh
cp -r template-stages/part-05-start ~/pk-part-05 && cd ~/pk-part-05
claude
```

## The prompt

```text
Add a second area of about six rooms that brings in one new thing: a spring pad that bounces the player high. Teach it the way the first area teaches the jump, mix it with the double jump, and end the area with a room that tests both.
```

## What you should get

A spring pad (tile `S`) and rooms 7 to 12 taking it through introduce, develop, twist and test. In the recorded session the bounce went from 1000 to 900 px/s so a double jump at the top no longer hit the ceiling, and Claude fixed Phaser's symmetric velocity cap so it only limits falling. The bounce rises about 280 px. Room 12, the test, landed at 62% for a player who has reached it (target 40 to 70%), and skilled players passed it 98% of the time.

The recorded session took 2 hours 4 minutes and $3.83, mostly waiting for a simulation harness Claude wrote itself. The current platformer-levels skill ships that harness (`scripts/measure-difficulty.mjs`), so a replay should be much faster.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
