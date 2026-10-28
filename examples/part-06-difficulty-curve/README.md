# Part 6: Difficulty that grows with the player: measuring every room with simulated players

Post: https://aigamedev.ai/tutorials/difficulty-curve-player-skill/

Recorded with Phaser 3.80.1 · Claude Code 2.1.311. Skills installed in that session: platformer-levels, platformer-feel.

## Start from

`template-stages/part-06-start/`. Part 5's 12-room game, plus a `package.json` with Playwright for the measuring script.

```sh
cp -r template-stages/part-06-start ~/pk-part-06 && cd ~/pk-part-06
npm install && npx playwright install chromium
claude
```

## The prompt

```text
Players get better as they go. Check how hard each room is for a new, an average and a skilled player, then adjust the rooms so the game gets harder in waves as the player improves. Don't change how the character moves.
```

## What you should get

Claude adds the measuring hook to the game, writes a route per room in `levels/routes.json`, runs the skill's script and reshapes the rooms so each area starts easy and rises to a test room. Only room data should change, never the movement constants.

The post's main table comes from the first recording, made before the script was part of the skill (1 hour 16 minutes, $4.52, 15 rooms in three areas). The re-run with the bundled script is the closer match for this kit: it had its first full table after about two and a half minutes, finished in 27 minutes for $2.89, and its reshaped spring area landed inside every target band. Part 7 starts from the end of that re-run.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
