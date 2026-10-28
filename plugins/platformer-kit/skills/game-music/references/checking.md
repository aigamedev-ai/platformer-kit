# Checking music you can't hear

## Render and measure the song

```
node ${CLAUDE_SKILL_DIR}/scripts/render-music.mjs music/song.js --out music-renders
```

It loads `music.js` and the song into headless Chromium (muted), renders each track offline for two loops plus a tail, writes `NAME.wav`, an MP3 preview (`--preview ogg|both|none`) and `NAME.png`, and prints:

| Line | Good | If not |
| --- | --- | --- |
| peak, true peak | -7 to -3 dBFS, 0 clipped samples | lower instrument `vol` or the song's `mix` |
| loudness (LUFS) | -16 to -12, tracks within 2 LU of each other | lower the loud track; switches will jump |
| range (LU) | low (chip loops are even) | a big range means a part comes and goes |
| layers alone | lead within about 3 dB of the base layer; drums 8 to 14 dB under the mix | rebalance with `vol` |
| seam: jump at loop start | about 1x an ordinary bar start (under 1.5x) | a note is cut or starts hard at bar 1 |
| seam: level across it | close to the ordinary bar starts' number printed next to it | the loop ends much quieter or louder than it starts |
| loop 1 rings into loop 2 | any value; tells how much echo and release carry over | only matters if you export one loop as a file |
| quiet bars | none | a pattern has a hole or a layer starts at 0 |
| second render matches | yes | something reads `Math.random` or the clock |

The loops are seamless by construction (the sequencer keeps scheduling across the loop end, so echoes and releases carry over); the seam numbers catch mistakes in the song, like a bar 1 that starts with a hard jump.

Look at the picture: the waveform on top (red lines at loop starts), a spectrogram below where each note is a short horizontal line, the bass at the bottom. You should see the melody move, the bass under it, drum hits as vertical streaks, and nothing flat or empty.

## Check that states switch the music

```
node ${CLAUDE_SKILL_DIR}/scripts/render-music.mjs music/song.js --timeline "camp@0 explore@6 tension@14 hurry@22 chase@27 stinger:found@30 duck@32 explore@34 mute@38 unmute@40 stinger:clear@42" --seconds 48
```

The first state plays from 0; each later event is applied at its time. For each event the script renders the same timeline without it and compares: the difference must be nothing until the bar or beat it waited for ("before it" about -150 dB) and clear after it ("after it" above -30 dB). It prints when each change was asked for, when the music actually changed, how long it waited, and fails if an event changed nothing or changed too early. The picture marks asks in yellow and changes in green.

Example song, measured (2026-10-29): explore switched at the next bar 0.67 s after the ask, chase on the next beat (0.47 s), hurry's tempo on the next bar, the tension drums faded in at once (-16 dB of change in the first 2 s), stingers on the next beat, all ten events "changed", nothing before its bar.

## Check it in the game

Spy on the sequencer in a scripted playthrough (wrap `GameMusic.prototype._play` to count notes, tag `_instance` to tell loops apart) and check:

- nothing before the first input; notes after the first key press;
- the state follows the game (go to a rest room, a test room, a bonus room) and track switches start on a bar;
- death and respawn keep the same loop instance and add no track switch; a duck is logged under the death sound;
- the music mute stops notes from being made, is remembered across a reload, leaves the effects on; the main mute silences both;
- music peak and RMS (offline render at the game's music volume) well under the effects (see mixing.md).

Then run the game's own tests and gameplay measurements (for a platformer, `measure-difficulty.mjs --check`) with the music in: the numbers must be identical. Any browser your tests start must be muted (`--mute-audio`); never kill browser processes by name.

## What the numbers can't tell you

Whether the melody is memorable, whether the mood matches the art, whether it gets tiring after ten minutes. Say so in the report, give the MP3 previews, and ask the user to listen in the game.
