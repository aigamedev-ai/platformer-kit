# Part 13: Animating the hero with Claude Code: anticipation, follow-through and a scarf that reacts

Post: https://aigamedev.ai/tutorials/character-animation/

Recorded with Phaser 3.80.1 · Claude Code 2.1.312. Skills installed in that session: character-animation, platformer-feel, platformer-levels, game-juice, game-sound, pixel-art, game-music.

## Start from

`template-stages/part-13-start/`. The chapter as a journey from part 12: 53 rooms in five sections. Wick has 10 drawings.

```sh
cp -r template-stages/part-13-start ~/pk-part-13 && cd ~/pk-part-13
npm install && npx playwright install chromium
claude
```

The skill's filming script also needs ffmpeg for the slowed clips.

## The prompt

```text
Wick moves like a sliding sticker. Give him real animation: anticipation, follow-through, a scarf and hood that react to movement, good run, jump, fall and landing poses, and small idle moments. The controls must stay exactly as responsive as they are now.
```

## What you should get

A pose for every state (idle, run, turn, brake, take-off, rise, apex, fall, landing, air jump, spring), a scarf tail and hood tip drawn as chains in code that trail, flop and settle, and small idle moments, with every setting in one `ANIM` object and `?anim=0` bringing back the old hero. The controls must not get slower: the session films the hero before and after with the skill's `anim-sheet.mjs`, and the body has to move identically.

In the recorded session: 21 new poses, a 6-drawing run advanced by distance, a take-off crouch of at most 50 ms while already rising, a 5-point scarf and 3-point hood tip, the juice's jump stretch lowered to 60% and landing squash to 55%, the body identical in all 312 filmed frames, every room measuring the same and 29 of 29 tests passing. It took 25 minutes and $3.33.

## What the session missed

- The scarf disappears during the air-jump spin and pops back.
- The scarf flicks out sideways on respawn.
- In falls the scarf stands straight up like a raised arm, and at about 20 px on a 28 px hero it's too long.
- The hood tip looks like a small white flag (noted in the report, left as is).
- The final film had no death, respawn, long idle or turn.
- It stopped the measuring script with `pkill -f measure-difficulty`, which stops every copy on the machine.

The current skill has rules for all of these, so a replay should do better there.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
