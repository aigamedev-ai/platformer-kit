# Chip instrument recipes

The NES had five voices: two pulse waves, one triangle, one noise and a low-quality sample channel. Most of its music used the first four in fixed roles, and those limits are a good default: three to five parts per track sound full and leave room for the sound effects.

| Voice | Role | In music.js |
| --- | --- | --- |
| Pulse 1 | lead melody | `{ wave: 'pulse', duty: 0.25 }` |
| Pulse 2 | harmony, arpeggio chords, or an echo of pulse 1 | `{ wave: 'pulse', duty: 0.125, arp: 0.05 }` |
| Triangle | bass (and a pitched "drum" thump) | `{ wave: 'triangle' }` |
| Noise | drums | `{ wave: 'drums' }` |

## Pulse and its duty cycle

A pulse wave is high for part of each cycle; that part is the duty cycle. The NES had 12.5%, 25%, 50% and 75% (75% sounds the same as 25%).

- **12.5%**: thin, nasal, buzzy. Good for arpeggios and quiet accompaniment that must not cover the lead.
- **25%**: bright and full; the classic lead.
- **50%** (a square wave): hollow, round, softer. Calm leads, echoes, lower parts.

Changing the duty changes the color, and the ear also hears it as a change in loudness: rebalance with `vol` after you change it.

## Triangle bass

Soft, round, and on the NES without volume control, so chip bass lines are steady and even. Keep it in octaves 2 and 3. A triangle is quieter to the ear than its numbers suggest in the lows but carries a lot of energy: in the example song a bass `vol` equal to the lead's made the bass layer 14 dB louder than the melody. Start the bass near `vol: 0.2` when the lead is at 0.3, then measure each layer alone.

Bass patterns: whole or half notes on the chord root for calm tracks; root and octave in 8th notes (`D3*2 D4*2 A3*2 D4*2`) for movement; repeated 8th-note roots for drive.

## Noise drums

- **Kick**: a short tone falling fast, about 160 to 45 Hz in 0.1 to 0.13 s (triangle or sine). `k: { tone: [160, 45], toneDur: 0.13, vol: 0.9 }`
- **Snare**: noise through a band-pass around 1.8 kHz, 0.1 to 0.15 s, plus a short tone near 200 Hz for body.
- **Closed hat**: noise through a high-pass at about 7 kHz, 0.03 s. **Open hat**: the same, about 0.2 s.
- **Tom**: a falling tone, 220 to 110 Hz.

The kick's attack is usually the highest peak in a track; keep its `vol` where the render's peak stays below -3 dBFS.

Beats, one token per 16th step: `k - h - s - h k - k h - s - h h?` (light groove), `k - h k s - h - k - h k s - s? h` (chase). Use `?` for softer ghost notes.

## Chords as arpeggios

A chip voice plays one note at a time, so chords are played by cycling their notes fast. One to three video frames per note (0.017 to 0.05 s) blurs into a buzzing chord; 0.06 to 0.1 s sounds like a shimmer you can follow. In music.js a chord token on an instrument with `arp` does this: `D4+F4+A4*16` with `arp: 0.05`. Keep arpeggios quiet and thin (12.5% pulse) or soft (triangle).

## Echo

Chip composers faked an echo by playing the lead again on the second pulse a few steps later, softer and a little detuned; removing it makes the melody sound flat. `echo: { steps: 3, vol: 0.35 }` does the same with note copies (a 16th or dotted 8th later is typical; `repeats: 2` for a longer tail on slow, calm tracks). Because the copies are scheduled with the notes, the echo of the last bar carries over the loop seam correctly.

## Vibrato

A slow pitch wobble on long notes: 4.5 to 6 Hz, 10 to 20 cents. Start it late (`delay: 0.15` to `0.3` s) so short notes stay clean and long notes "bloom", which is how most chip leads sound. Calm tracks: slower and shallower.

## Envelopes

- **Lead**: attack 5 to 10 ms (a tiny click reads as "chip"), decay 0.2 s to a sustain of 0.6, release 0.08 s.
- **Soft lead or pad**: attack 30 to 50 ms, sustain 0.5 to 0.8, release 0.25 to 0.3 s.
- **Pluck or bell**: sustain 0 to 0.3, short decay; good for stingers.
- **Bass**: fast attack, sustain 0.9, `gate` 0.85 so repeated notes are separated.
- **Stabs**: `gate` 0.5 to 0.6 for detached chords that push the rhythm.

Avoid attacks shorter than 2 ms and hard cuts: those click. music.js ramps every note in and out.

## Starting values (from the example song, measured)

```js
soft:  { wave: 'pulse', duty: 0.5, vol: 0.2, attack: 0.03, decay: 0.4, sustain: 0.55, release: 0.25,
         vibrato: { rate: 4.5, depth: 10, delay: 0.3 }, echo: { steps: 6, vol: 0.3, repeats: 2 } },     // calm lead
lead:  { wave: 'pulse', duty: 0.25, vol: 0.3, attack: 0.008, decay: 0.2, sustain: 0.6, release: 0.08,
         vibrato: { rate: 5.5, depth: 14, delay: 0.2 }, echo: { steps: 3, vol: 0.35 }, pan: -0.1 },     // lead
bass:  { wave: 'triangle', vol: 0.2, attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.05, gate: 0.85 },
pad:   { wave: 'triangle', arp: 0.08, vol: 0.07, attack: 0.05, sustain: 0.8, release: 0.3, gate: 0.97, pan: 0.15 },
arp:   { wave: 'pulse', duty: 0.125, arp: 0.05, vol: 0.04, decay: 0.15, sustain: 0.5, release: 0.04, gate: 0.6, pan: 0.2 },
drums: { wave: 'drums', vol: 0.5 },
bell:  { wave: 'pulse', duty: 0.25, vol: 0.16, decay: 0.15, sustain: 0.3, release: 0.2, echo: { steps: 2, vol: 0.4 } },
```

With these, each track renders at about -14 to -16 LUFS with peaks between -7 and -3 dBFS, lead and base layers within about 3 dB of each other.
