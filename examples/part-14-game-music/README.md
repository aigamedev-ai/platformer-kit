# Part 14: An adaptive soundtrack in code: one theme, eight tracks, no DAW

Post: https://aigamedev.ai/tutorials/game-music-adaptive/

Recorded with Phaser 3.80.1 · Claude Code 2.1.312. Skills installed in that session: game-music, platformer-feel, platformer-levels, game-juice, game-sound, pixel-art, character-animation.

## Start from

`template-stages/part-14-start/`. The chapter with Wick's new animation from part 13: 53 rooms, 17 sound effects and no music.

```sh
cp -r template-stages/part-14-start ~/pk-part-14 && cd ~/pk-part-14
npm install && npx playwright install chromium
claude
```

The skill's render script also needs ffmpeg for the MP3 previews.

## The prompt

```text
The game has sound effects but no music. Write an original soundtrack for it in code: calm music for the rest spots, music for exploring each section, rising tension for the storm chase and a release at sunrise, all sharing one theme. It should follow what the player is doing, sit under the sound effects, and have its own mute. Don't change how anything plays.
```

## What you should get

An original chiptune soundtrack written as text patterns in `music/song.js` and played by the skill's sequencer (`music/music.js`): a calm track for rest spots, one per section, rising tension for the storm chase and a release at sunrise, all on one motif. Layers fade in and out within a track, other tracks switch on the next bar, the storm cuts in on the beat, and a death never restarts the loop. The music sits under the effects, starts on the first input, and has its own remembered mute (N and a Music button) while M still mutes everything. Gameplay must be unchanged.

In the recorded session: eight tracks, all in D and opening with the same figure (D, E, A, then down to G and E), from Rest at 72 BPM to Storm at 152 BPM (+7% in Storm 3); the music at 0.2 through the game's master, 7 to 9 dB under the jump sound peak for peak; the measurement identical with and without music for all 53 rooms, and 35 of 35 tests passing (6 new music tests). It took 48 minutes and $2.62.

## What the session missed

- The layers are so quiet (chords 17 to 20 dB down) that a section's versions differ by only 0.1 to 0.3 LU, and Storms 1 to 3 barely get louder.
- Its own timeline check flagged Storm 3 as "NO CHANGE", and it explained that away.
- It compared the jump sound's peak with the music's average and reported a 17 dB gap; peak for peak it's 7 to 9 dB.
- The modes are looser than its table says (B and B flat in Section 2, G and G sharp in Section 3).
- The Watchtower rest spot gets dark minor music instead of calm (a design choice you may want to change).
- It left 14 MB of MP3s and pictures in a music-renders folder inside the game.
- Section 1 and Section 4 loop every 18.5 and 17.1 seconds.

The current skill has rules for all of these, so a replay should do better there.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
