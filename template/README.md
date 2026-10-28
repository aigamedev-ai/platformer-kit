# Wick: Night Ruins

The finished game from the [make-a-platformer series](https://aigamedev.ai/series/make-a-platformer/): a 36-room Phaser chapter in four sections (34 main rooms and 2 bonus rooms), with juice, sound effects and pixel art. Every part of it was made by Claude Code with the skills in this repo. Use it as a starting point for your own game.

## Play

Open `index.html` in a browser. Phaser is in `vendor/`, so it works offline. Or run a small local server:

```sh
npm start        # http://localhost:8080
```

Arrow keys or A/D to move, Up, W or Space to jump, again in mid-air to double jump. J switches the effects, M mutes the sound. Add `?art=0` to the address for the plain shapes, or `?juice=0` for no effects.

## Check it

```sh
npm install
npx playwright install chromium    # on Linux CI: npx playwright install --with-deps chromium
npm run check          # plays every room's route once: 36 of 36 routes pass
npm run playthrough    # plays the whole chapter from room 1 to the end
npm test               # crumbling blocks, orbs, stats, bonus doors, wide rooms and sound
npm run measure        # simulated new, average and skilled players; writes difficulty-report/
```

`npm test` takes a few minutes. One sound test is marked as a known problem (todo): with every sound playing at once, the mix can peak just over 1.0. Part 10's post lists it under "What the session missed".

## What's where

- `index.html`: the whole game. Movement constants are at the top, the tile legend above `loadSections()`, the juice settings in `JUICE` and the sounds in `SFX`.
- `levels/`: one file of rooms per section and one routes file per section. [levels/README.md](levels/README.md) explains how to add a section.
- `art/`: the sprite sheet, the edge-band terrain renderer and the backgrounds, already generated. [art/README.md](art/README.md) has the prompts and how to rebuild them.
- `tools/measure-difficulty.mjs`: the platformer-levels skill's measuring script, copied here so the game checks itself without the plugin. Don't edit it here: the copy is kept in sync with the skill.
- `tools/sprites.py`, `tools/backgrounds.py`, `tools/bg_remap.py`: the art scripts the pixel-art session wrote. They need Python 3 and the pixel-art skill's `pixel.py` (found automatically inside this repo).
- `tests/`: Playwright tests on a fake clock, so every run is the same.

## Changes from the recorded session

Phaser loads from `vendor/` instead of jsDelivr, the test browsers are muted, the clipping test is marked todo, the measuring script lives in `tools/`, and the art scripts look for `pixel.py` inside this repo. The game itself is as Claude Code left it at the end of part 11.
