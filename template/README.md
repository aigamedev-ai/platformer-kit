# Wick: Night Ruins

The finished game from the [make-a-platformer series](https://aigamedev.ai/series/make-a-platformer/): a Phaser chapter of 53 rooms in five sections, with rest spots, side rooms, a storm chase, character animation, music, juice, sound effects and pixel art. Every part of it was made by Claude Code with the skills in this repo. Use it as a starting point for your own game.

## Play

Open `index.html` in a browser. Phaser is in `vendor/`, so it works offline. Or run a small local server:

```sh
npm start        # http://localhost:8080
```

Arrow keys or A/D to move, Up, W or Space to jump, again in mid-air to double jump. Enter on the end screen plays again.

| Key | What it does |
|---|---|
| M | Mutes all sound, music included |
| N | Turns the music off and on (the Music button does the same) |
| J | Switches the effects (juice) off and on |

Both mutes are remembered. The music starts on your first key press or click. Add one of these to the address to see an earlier look: `?anim=0` for the hero before part 13, `?art=0` for the plain shapes from before part 11, `?juice=0` for no effects.

## What's in it

- **Five sections**: First steps, Crumbling ground, Refill orbs, All together and The storm. Each opens with a rest spot (a campfire, the chapter map and a far-off view of what comes next), and hard rooms are followed by calm ones (part 12).
- **Side rooms**: five optional rooms behind glowing bonus doors, each with a star. Stars are counted on the HUD, the map and the end screen, and never needed.
- **The storm chase**: three segments where a storm wall rolls in on a fixed schedule, then a calm walk at sunrise to the last flag.
- **Animation**: 21 poses for Wick, a scarf tail and hood tip on chains, and idle moments (part 13).
- **Music**: eight chiptune tracks on one theme, written as notes in `music/song.js`, that follow the rooms, switch on the bar and sit under the sound effects (part 14).
- **Juice, sound and art** from parts 8, 10 and 11.

## Check it

```sh
npm install
npx playwright install chromium    # on Linux CI: npx playwright install --with-deps chromium
npm run check          # plays every room's route once: 53 of 53 routes pass
npm run playthrough    # plays the whole chapter from room 1 to the end, skipping the side rooms
npm test               # mechanics, chapter shape, stars, map, chase, sound and music
npm run measure        # simulated new, average and skilled players; writes difficulty-report/
```

`npm test` takes a few minutes. One sound test is marked as a known problem (todo): with every sound playing at once, the mix can peak just over 1.0. Parts 10 and 12 list it under "What the session missed".

## What's where

- `index.html`: the whole game. Movement constants are at the top, the tile legend above `loadSections()`, the juice settings in `JUICE`, the animation settings in `ANIM`, the sounds in `SFX`, and `musicStateFor()` picks the music for each room.
- `levels/`: one file of rooms per section and one routes file per section. [levels/README.md](levels/README.md) explains the chapter's shape, the room kinds (`main`, `rest`, `optional`, `chase`) and how to add a section.
- `music/`: `music.js` is the game-music skill's sequencer as the session adapted it, and `song.js` is the soundtrack: patterns, tracks, layers and which state plays what.
- `art/`: the sprite sheet, the hero's chain anchors (`hero-anim.js`) and chain code (`secondary-motion.js`), the edge-band terrain renderer and the backgrounds, already generated. [art/README.md](art/README.md) has the prompts and how to rebuild them.
- `tools/measure-difficulty.mjs`: the platformer-levels skill's measuring script, copied here so the game checks itself without the plugin. Don't edit it here: the copy is kept in sync with the skill.
- `tools/sprites.py`, `tools/backgrounds.py`, `tools/bg_remap.py`: the art scripts. They need Python 3 and the pixel-art skill's `pixel.py` (found automatically inside this repo).
- `tests/`: Playwright tests on a fake clock, so every run is the same.

To render the music to MP3s and pictures, use the game-music skill's `scripts/render-music.mjs music/song.js` (it needs ffmpeg). To film the hero, use the character-animation skill's `scripts/anim-sheet.mjs`.

## Changes from the recorded sessions

Phaser loads from `vendor/` instead of jsDelivr, the test and screenshot browsers are muted, the clipping test is marked todo, the measuring script lives in `tools/`, and the art scripts look for `pixel.py` inside this repo. The music renders the session left in the game folder aren't included. The game itself is as Claude Code left it at the end of part 14.
