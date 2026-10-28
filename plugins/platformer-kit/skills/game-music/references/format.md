# The song format and the sequencer

`music.js` plays a song: a plain JavaScript object, usually in its own file (`music/song.js`) that defines `const SONG = { ... }`. Load `music.js` and the song with `<script>` tags before the game's code. Mistakes in the song throw a readable error when the player is made (`new GameMusic(SONG, ...)`) or with `GameMusic.check(SONG)`, which also returns each track's bars and loop length.

## Patterns

A pattern is a string of tokens on a grid of steps. With the defaults (`stepsPerBeat: 4`, `beatsPerBar: 4`) a step is a 16th note and a bar is 16 steps.

| Token | Means |
| --- | --- |
| `D5` `F#3` `Bb2` | a note (letter, optional `#` or `b`, octave; `C4` is middle C) lasting 1 step |
| `D5*4` | the note lasts 4 steps (a quarter note) |
| `D4+F4+A4*16` | a chord; on an instrument with `arp` it is played as a fast arpeggio |
| `-` `-*4` | rest for 1 or 4 steps |
| `.` | hold the previous note 1 step longer (`D5 . . .` = `D5*4`) |
| `\|` | bar line: checked, an error if it doesn't fall on a bar |
| `D5!` `h?` | louder (x1.3) or softer (x0.5) |
| `h*2x8` | the same token 8 times |
| `k` `s` `h` `o` `t` | on a drums instrument: kick, snare, closed hat, open hat, tom (`k+h` together) |

Every pattern used in a track must be a whole number of bars. Stingers can be any length.

```js
motif:  'D5*4 A5*4 G5*2 B5*2 A5*4 | G5*4 F5*2 E5*2 D5*8',   // 2 bars
walk:   'D3*2 D4*2 A3*2 D4*2 D3*2 D4*2 A3*2 D4*2',          // 1 bar of bass
beat:   'k - h - s - h k - k h - s - h h?',                  // 1 bar of drums, one token per step
```

## Instruments

```js
lead:  { wave: 'pulse', duty: 0.25, vol: 0.3, attack: 0.008, decay: 0.2, sustain: 0.6, release: 0.08,
         vibrato: { rate: 5.5, depth: 14, delay: 0.2 }, echo: { steps: 3, vol: 0.35 }, pan: -0.1 },
bass:  { wave: 'triangle', vol: 0.2, sustain: 0.9, gate: 0.85 },
arp:   { wave: 'pulse', duty: 0.125, arp: 0.05, vol: 0.04, gate: 0.6 },
drums: { wave: 'drums', vol: 0.5, kit: { k: { tone: [160, 45], toneDur: 0.13, vol: 0.9 } } },
```

- `wave`: `pulse` (with `duty` 0.125, 0.25 or 0.5), `triangle`, `square`, `sine`, `sawtooth`, or `drums`.
- Envelope in seconds: `attack`, `decay` (to `sustain`, a fraction of the peak), `release` after the note ends. `gate` is how much of the note's length it sounds (0.6 short and detached, 0.95 smooth).
- `vol` is the note's peak before the music volume. Chords without `arp` are scaled by 1/sqrt(notes).
- `arp`: seconds per arpeggio note. `vibrato`: rate in Hz, depth in cents, delay before it starts. `echo`: the note again `steps` later at `vol` (times `repeats`), slightly detuned. `detune` in cents, `pan` -1 to 1.
- Drum kit pieces: `tone: [from, to]` Hz with `toneDur`, and/or `noise` (seconds) through `filter` (`highpass`, `bandpass`, `lowpass`) at `freq` with `q`. Defaults exist for `k s h o t`; override any of them.

## Tracks, layers, states, stingers

```js
tracks: {
  explore: { bpm: 100, layers: { drums: 0 }, parts: [
    { inst: 'lead',  layer: 'lead',  seq: 'exLead' },
    { inst: 'bass',  layer: 'base',  seq: 'walk walk:+5 walk walk:+5 walk:-4 walk:-2 walk walk:-5' },
    { inst: 'drums', layer: 'drums', seq: 'beat' },              // 1 bar, repeats to fill the loop
  ] },
},
states: {
  explore: { track: 'explore', layers: { drums: 0 }, sync: true },
  tension: { track: 'explore', layers: { drums: 1 } },          // same track: only the layer fades in
  hurry:   { track: 'explore', layers: { drums: 1 }, speed: 1.2 },  // faster from the next bar
  chase:   { track: 'chase', at: 'beat', fade: 0.15 },          // urgent: switch on the next beat
},
stingers: {
  found: { inst: 'bell', notes: 'D5 A5 D6*2', duck: 0.5 },
},
```

- A part's `seq` lists pattern names in order. `name:+5` transposes by semitones (not on drums), `name*2` repeats, `-*2` is two bars of rest. A part can give `notes: '...'` instead of `seq`. `vol` and `transpose` on a part apply to all its notes.
- The loop is as long as the longest part; shorter parts repeat and must fit evenly (a 1-bar drum beat under an 8-bar melody).
- `layers` on a track sets starting levels (default 1). Each part plays on a layer; each layer has its own gain.
- A state names a track and optional `layers`, `at` (`bar` default, `beat`, `step`, `loop`), `fade` (crossfade seconds, default `fade` on the song or 1), `layerFade`, `speed`, and `sync` (start the new track at the same bar number, for tracks that share a form).
- A stinger has `inst` and `notes` (or `parts`), `duck` (loop level while it plays, default 0.4), `at` (default `beat`), optional `bpm` and `vol`. It plays at the loop's tempo through the music volume. A stinger asked for while another is still playing is dropped.
- Song-wide: `stepsPerBeat`, `beatsPerBar`, `bpm` (default for tracks), `fade`, `layerFade`, `mix` (overall gain).

## Using it in the game

```js
const music = new GameMusic(SONG, { ac, out: sfxMasterGain, volume: 0.2, muted: musicMuted });
music.setState('explore');   // call on every state change; the same state again does nothing
music.stinger('found');      // a big moment
music.duck({ amount: 0.35, hold: 0.3 });   // under a big sound effect
music.setMuted(true); music.setVolume(0.25); music.stop(1); music.position(); // { track, bar, beat, step }
```

`ac` is the game's AudioContext (create it on the first input), `out` the node the music feeds (the game's sound master, so the main mute and the limiter cover music too). The player schedules notes 0.12 s ahead from a 25 ms timer, on the audio clock, so a busy frame doesn't make it stumble; notes that are already late (tab in the background) are skipped, not bunched up. `music.log` lists every switch with the time it was asked for and the time it starts.

`GameMusic.render(SONG, { state, seconds, timeline, volume, solo })` renders offline in any page that has `OfflineAudioContext` and resolves to `{ buffer, log }`. `timeline` is a list of `{ t, state }`, `{ t, stinger }`, `{ t, duck: true }`, `{ t, muted }`, `{ t, volume }` or `{ t, stop: true }`. `render-music.mjs` uses this.
