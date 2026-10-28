# Part 1: Coyote time: the jump fix players never notice

Post: https://aigamedev.ai/tutorials/coyote-time/

Recorded with Phaser 3.80.1 · Claude Code 2.1.311. Skills installed in that session: platformer-feel.

## Start from

`template-stages/part-01-start/`. The double-jump game from the start-here series with coyote time switched off (`COYOTE_TIME = 0`). Nothing else changed.

```sh
cp -r template-stages/part-01-start ~/pk-part-01 && cd ~/pk-part-01
claude
```

## The prompt

```text
Add coyote time to the jump, so I can still jump for a moment after running off a ledge. Test it.
```

## What you should get

Claude finds the coyote code already in the game and turns it on with one number, `COYOTE_TIME = 100` (ms, to match the file's other timers). It writes a Playwright test that runs off a ledge and presses jump at set delays, and runs it with coyote time on and off.

| Press after leaving the ledge | Before | After |
|---|---|---|
| 0.05 s | Air jump (500 px/s up), double jump used up | Ground jump (560 px/s up), double jump kept |
| 0.20 s | Air jump, double jump used up | Air jump, double jump used up |

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
