# Mixing music under the sound effects

## One chain, one context

notes → layer gains → track gain (crossfades) → ducker → music volume → the game's sound master → limiter → speakers

Use the game's audio context (one context per page) and feed the music into the same master and limiter as the sound effects. The game's main mute then silences everything, and the limiter catches the rare moment when music and effects peak together. The limiter is a safety net; the levels below should keep it from working at all.

## Levels

Measure, don't guess: `render-music.mjs` for the song, an offline render of each sound effect for the effects (the same way game-sound checks them).

- **The song as written** (music volume 1): peaks between -7 and -3 dBFS, no clipped samples, about -16 to -12 LUFS. All tracks within about 2 LU of each other, so a switch never jumps in loudness.
- **In the game** (music volume about 0.2): music RMS around -30 dBFS and peaks below -15 dBFS. The jump sound's short-term level (RMS over 50 ms at its peak) at least 6 dB above the music's RMS, and the music's peak at least 6 dB below the loudest effect. Measured in the prototype for a Phaser platformer: effects peak at about -17 to -8 dBFS (jump -14.7, death about -8); music at 0.2 peaked at -20.5 to -16.8 and sat at RMS -32.4 to -30.6, about 7 dB under the jump's level (-23.3) and 14 dB under the death sound's (-16.3). The soft landing thump (-31) sits at the music's level; it is felt more than heard.
- Big studio games often level music and effects about the same and put dialogue on top. A small action game has no dialogue; its effects carry the feel, so music sits lower.

## Balance inside the song

Render each layer alone (`render-music.mjs` does) and compare with the whole mix:

- **Lead and base layer within about 3 dB.** The melody must be heard. The example song's first draft had the base layer 14 dB over the lead because the triangle bass carried most of the energy; lowering the bass and arpeggio fixed it.
- **Drums 8 to 14 dB under the mix**: a texture, not the foreground.
- **Arpeggios and pads quiet** (`vol` 0.04 to 0.08): they fill, they don't lead.

## Room for the effects

Sound effects live mostly between about 300 Hz and 3 kHz, the same range as a pulse lead. Leave rests in the melody, keep accompaniment thin (12.5% pulse, triangle), and don't put the lead an octave above where it needs to be. Dip the music under big effects (see adaptive.md), not under frequent ones.

## Player controls

- A separate music volume and music mute, with its own key (for example N) and button, remembered in `localStorage` (wrap reads and writes in try/catch). The game's main mute (M) still mutes everything.
- "Music off" means no notes are made, not just a volume of zero: `setMuted(true)` stops scheduling while the loop's position keeps moving, so turning it back on continues instead of restarting.
- The first input starts the music; nothing plays before it.
