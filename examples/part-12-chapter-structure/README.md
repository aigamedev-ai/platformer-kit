# Part 12: From 34 rooms in a row to a journey: rest spots, side challenges and a storm chase

Post: https://aigamedev.ai/tutorials/chapter-structure-journey/

Recorded with Phaser 3.80.1 · Claude Code 2.1.312. Skills installed in that session: platformer-levels, platformer-feel, game-juice, game-sound, pixel-art, character-animation, game-music.

## Start from

`template-stages/part-12-start/`. The chapter with pixel art from part 11: 34 rooms on the main path plus 2 side rooms.

```sh
cp -r template-stages/part-12-start ~/pk-part-12 && cd ~/pk-part-12
npm install && npx playwright install chromium
claude
```

## The prompt

```text
The chapter is 34 short rooms in a row, with almost no room to breathe and no real ending. Turn it into a journey: a calm rest spot at the start of each section, rooms of different lengths with easier stretches after hard ones, a few optional side challenges with a collectible, a chapter map between sections, and a chase finale at the end instead of a boss fight. Don't change how the character moves.
```

## What you should get

The chapter split into sections, each opening with a rest spot: no hazards, a campfire, the chapter map and a far-off view of what's next. Hard rooms are followed by calm ones, a few rooms become long runs, side rooms behind bonus doors each hold a star (counted on the HUD, the map and the end screen, never required), and the finale is a storm wall that chases you through three segments on a fixed schedule before a calm walk at sunrise. Rooms get a `kind` in the level data (`main`, `rest`, `optional`, `chase`). The movement constants must not change.

In the recorded session: five sections and 53 rooms, 6 new calm rooms, 4 long runs, 3 new side rooms, storm margins of 1.65 s, 1.16 s and 0.72 s (pass rates 98%, 94% and 89%), all 53 routes passing, the playthrough reaching the end without entering a side room, and 29 of 29 tests passing. The estimated first play went from 5.3 to 7.4 minutes. It took 86 minutes and $9.20.

## What the session missed

- The map fades as soon as a key is held, so walking in through the door you see it for about 0.4 s.
- A storm's warning is invisible while it's off screen, and weak (dark on dark) at the start of a segment.
- Storms 1 and 2 measure too easy (98% and 94%); the session went by the margins.
- Most rooms are still 2 to 4 seconds long.
- Sections and areas don't line up ("Section 5 · Area 6 · Room 1/4").
- The star in Orb ladder sits under the HUD's star count.
- Sunrise is still drawn as night.
- One sound test is flaky (a peak of 1.007).

The current skill has rules for all of these, so a replay should do better there.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
