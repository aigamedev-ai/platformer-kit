# Part 10: Sound effects in one prompt: 17 sounds made in code, no audio files

Post: https://aigamedev.ai/tutorials/game-sound-effects/

Recorded with Phaser 3.80.1 · Claude Code 2.1.312. Skills installed in that session: game-sound, game-juice, platformer-feel, platformer-levels.

## Start from

`template-stages/part-10-start/`. The refined chapter from part 9.

```sh
cp -r template-stages/part-10-start ~/pk-part-10 && cd ~/pk-part-10
npm install && npx playwright install chromium
claude
```

## The prompt

```text
The game is silent. Add sound effects for everything that happens: jumps, landings, springs, crumbling blocks, orbs, deaths, doors and the finish, with a way to mute them. Don't change how anything plays.
```

## What you should get

About 17 sounds generated with Web Audio (no audio files), called from the same places as the visual effects, a remembered mute (M and a button), and new sound tests. In the recorded session: jump is a square wave sliding 300 to 600 Hz in 0.12 s with ±5% pitch, the orb two notes at 880 and 1320 Hz, death a square wave falling 400 to 80 Hz plus noise, and the chapter finish a four-note arpeggio and a held chord. Gameplay must be unchanged.

The recorded session took 13.5 minutes and $1.48. The current skill adds the six things it missed (muted test browsers, never killing browsers by name, one audio context, a real worst-case render, and more), so a replay should do better there.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
