# Part 9: When the simulated player reacts late: re-measuring and refining the chapter

Post: https://aigamedev.ai/tutorials/difficulty-full-player-model/

Recorded with Phaser 3.80.1 · Claude Code 2.1.312. Skills installed in that session: platformer-levels, platformer-feel, game-juice.

## Start from

`template-stages/part-09-start/`. The juiced chapter from part 8.

```sh
cp -r template-stages/part-09-start ~/pk-part-09 && cd ~/pk-part-09
npm install && npx playwright install chromium
claude
```

## The prompt

```text
Our difficulty numbers so far only counted small timing errors. Measure the chapter again with the skill's full player model, marking which steps are reactions, then refine the rooms that now miss their targets. Don't change how the character moves or the effects.
```

## What you should get

Claude measures with the script's full player model (reaction time, busy hands, errors that run together), marks the reaction steps in the routes and changes the rooms that miss. In the recorded session four rooms changed:

| Room | What changed | Full model, before | After |
|---|---|---|---|
| 6 Goal | Door ledge one tile lower | 86% | 94% |
| 16 Spring to the crack | Door one tile lower | 58% | 78% |
| 17 Climbing stones | Wider first stone and top ledge | 46% | 68% |
| 34 The long way | Last orb two tiles closer, wider door ledge | 0% | 52% |

The recorded session took 32 minutes and $2.23. The skill has been fixed since (playthrough follows the game's own doors, shots cover wide rooms, a visible fixed timer is not a reaction), so expect different reaction marks and possibly different rooms.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
