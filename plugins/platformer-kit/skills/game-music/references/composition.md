# Composing for a game

Practical defaults, not rules. Write your own melodies; never copy a tune from another game (if a line sounds famous to you, change its rhythm and one interval).

## Mood: mode, key and tempo

| State | Mode | Tempo | Texture |
| --- | --- | --- | --- |
| Rest, camp, safe room | major, Mixolydian, or a soft Dorian | 60 to 80 BPM | long notes, rounder lead (50% pulse or triangle), no drums |
| Exploring, wonder | Dorian or Lydian | 90 to 110 | steady bass, arpeggio chords, the motif |
| Tension, danger near | natural minor or Phrygian | same as exploring | add a layer (drums, a pulsing bass) instead of a new track |
| Chase, boss | minor (harmonic minor for extra pull) | 140 to 170 | driving 8th-note bass, full drums, the motif twice as fast |
| Victory | major or Lydian | any | short, rising, ends on a long tonic |
| Map, menu, title | the main theme in its plainest form | 80 to 110 | the motif stated clearly |

Modes from the white keys: start on C for major (Ionian), D for Dorian, E for Phrygian, F for Lydian, G for Mixolydian, A for natural minor (Aeolian), B for Locrian. Each mode has one note that gives its color:

- **Dorian**: minor with a raised 6th (in D: B natural). Dark with a hint of light; mysterious, hopeful, curious.
- **Lydian**: major with a raised 4th (in F: B natural). Floating, wonder, magic.
- **Mixolydian**: major with a lowered 7th. Relaxed, folk, adventurous.
- **Aeolian** (natural minor): serious, sad or tense.
- **Phrygian**: minor with a lowered 2nd. Menace, foreign, dread.
- **Locrian**: unstable; for a moment of unease, rarely a home key.

Tempo moves energy more than anything else: slow (60 to 76 BPM) reads calm, fast (above 120) reads excited. Major or minor moves the color (happy or sad), which is why the same motif can serve both a camp and a chase. Keep tracks that crossfade into each other in the same key (or its relative major or minor).

## Chord progressions

Roman numerals count chords from the key's first note; capitals are major chords, small letters minor.

- **i – IV** (Dorian vamp, Dm – G): the Dorian sound; curious, hopeful. Good for exploring.
- **I – II** (Lydian vamp, F – G in F Lydian): floating wonder.
- **I – vi – IV – V**: warm, nostalgic. **vi – IV – I – V**: bittersweet. **I – V – vi – IV**: bright and balanced (very common; fine for a menu or victory).
- **i – VI – VII – V** (Dm – Bb – C – A): heroic and urgent; the major V pulls hard back to i, so it is a strong loop ending.
- **i – VII – VI – VII**: driving and intense. **i – bII** (Dm – Eb): menace.

Give each chord a bar (calm) or half a bar (busy). End the loop on a chord that leads back to the first one (V to i, IV to I, VII to i), so the seam sounds like a phrase starting again instead of a cut.

## Motif and leitmotif

A motif is 4 to 6 notes, 1 or 2 bars, with a shape you can hum: a leap then steps back is easy to remember (the example song: D up to A, step down to G, up to B, back to A). Use the same motif across all tracks so the game has one voice, and change it to fit each mood while keeping its opening or contour:

- **Tempo and rhythm**: slower and longer notes for rest; twice as fast (half the lengths) for a chase; swing or syncopation for play.
- **Mode**: flatten or raise one note (Dorian B becomes minor Bb in the chase, Lydian G# in the victory stinger).
- **Register, instrument, harmony**: an octave up on a thin pulse, or low on the triangle; new chords under the same notes.
- **Fragment**: the first two or three notes alone make a stinger or a menu sound.

Undertale is the well-known example: a handful of short themes return all through the game slowed down, decorated, in other keys and other styles, and later tracks combine earlier ones, while the opening shape stays recognizable.

## Structure of a loop

- **8 or 16 bars, A A B A.** A states the motif, A' starts the same and ends differently, B contrasts (other chords, longer or higher notes, fewer notes), A returns and leads back to bar 1. This is the 32-bar song form shrunk to 2 or 4 bars per section.
- **Length**: loops that play for minutes want 20 to 60 seconds before they repeat; chase and boss loops can be shorter (6 to 15 seconds) because they don't last.
- **Tracks that switch between each other** are easier with the same bar count and harmony; then `sync: true` keeps the bar position across the switch.
- **Leave space.** Rests in the lead, a quiet accompaniment. Sound effects need gaps to sit in, and background music should never be busier than the game.
- **Bass and chords agree.** The bass plays the chord's root on the strong beats; melody notes on the strong beats are chord notes, notes between them can pass.

## Example (from examples/example-song.js)

Camp, 72 BPM, D Dorian, 8 bars as A A' B A'' (two bars each):

```js
motif:   'D5*4 A5*4 G5*2 B5*2 A5*4 | G5*4 F5*2 E5*2 D5*8',    // A   over Dm | G
answer:  'D5*4 A5*4 C6*2 B5*2 A5*4 | B5*4 A5*2 G5*2 A5*8',    // A'  over Dm | G
bridge:  'F5*8 D5*4 F5*4 | E5*8 G5*4 E5*4',                    // B   over Bb | C
turn:    'D5*4 A5*4 G5*2 B5*2 A5*4 | G5*4 E5*4 C#5*8',         // A'' over Dm | A, leads back to Dm
campBass: 'D3*8 A2*8 | G2*8 D3*8 | D3*8 A2*8 | G2*8 B2*8 | Bb2*8 F2*8 | C3*8 G2*8 | D3*8 A2*8 | A2*8 E3*4 C#3*4',
// track: { bpm: 72, parts: [{ inst: 'soft', layer: 'lead', seq: 'motif answer bridge turn' }, ...] }
```

Chase plays the same motif twice as fast in D minor, over i – VI – VII – V:

```js
chLead: 'D5*2 A5*2 G5 Bb5 A5*2 D5*2 A5*2 G5 Bb5 A5*2 | F5*2 D5*2 F5 G5 A5*2 Bb5*4 A5*4 | ...'
```
