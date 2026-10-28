# Part 11: Pixel art with Claude Code and a local image model: from squares to night ruins

Post: https://aigamedev.ai/tutorials/pixel-art-claude-code/

Recorded with Phaser 3.80.1 · Claude Code 2.1.296 · FLUX.2-klein in ComfyUI. Skills installed in that session: pixel-art, game-juice, game-sound, platformer-feel, platformer-levels.

## Start from

`template-stages/part-11-start/`. The chapter with sound from part 10.

```sh
cp -r template-stages/part-11-start ~/pk-part-11 && cd ~/pk-part-11
npm install && npx playwright install chromium
claude
```

## The prompt

```text
Give the game real pixel art in this direction: night ruins above the clouds, with a starry sky and a moon, a sea of clouds below, mossy stone edges with warm lanterns and distant floating ruins. Make it look like a game people would want to play, and give the hero some personality. Don't change how anything plays.
```

## What you should get

Night ruins above the clouds: a hero drawn in code (in the recorded session, Wick, a hooded lantern-bearer whose scarf and lantern turn blue when the double jump is spent), edge-band terrain from the skill's `edge-terrain.js`, new looks for every object, props, glow, vignette and particles, and `?art=0` to get the old shapes back. The route check, the tests and the full difficulty table must match before and after.

The backgrounds need a local image model. The recorded session ran on a Mac with ComfyUI and FLUX.2-klein (13 minutes, $3.32). Without ComfyUI, the skill draws the backgrounds in code with `pixel.py procbg` and says so, so your sky will look different. The finished game, with the model's backgrounds already baked in, is `template/`.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
