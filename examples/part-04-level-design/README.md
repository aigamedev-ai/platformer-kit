# Part 4: Level design with Claude Code: six rooms that teach the jump, using Celeste's rules

Post: https://aigamedev.ai/tutorials/level-design-celeste-rules/

Recorded with Phaser 3.80.1 · Claude Code 2.1.311. Skills installed in that session: platformer-levels, platformer-feel.

## Start from

`template-stages/part-04-start/`. The game after parts 1 to 3: one room with coins, coyote time, the jump buffer fix, variable jump height and a double jump.

```sh
cp -r template-stages/part-04-start ~/pk-part-04 && cd ~/pk-part-04
claude
```

## The prompt

```text
Turn this into a short first level of about six rooms that teaches a new player to run, jump and double jump, then ends at a goal. Make sure every room can actually be finished.
```

## What you should get

Six one-screen rooms kept as text grids, each with a one-line story, played with a scripted route. Claude measured 107 px for a jump and about 188 px for a double jump, and changed two rooms after testing (room 4's wall from 5 to 4 tiles, room 6's pillar from 2 to 3 tiles wide). It may remove the coins (the post explains why; the skill's wording has been fixed since).

| Room | Teaches | Hardest jump (our measurement) |
|---|---|---|
| 1 | Running | None |
| 2 | Jumping, nothing to lose | 30% of a jump's height |
| 3 | Jumping, some risk | 54% of a jump's distance |
| 4 | Double jump, falling is safe | 67% of a double jump's height |
| 5 | All three together | 68% of a double jump's distance |
| 6 | Final test | 83% of a double jump's height |

The recorded session took 17 minutes and $1.19.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
