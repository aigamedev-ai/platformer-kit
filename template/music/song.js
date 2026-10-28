// The chapter's soundtrack, played by music.js (original, written for this game). Output only: nothing here touches
// play. The game only says which state it is in (see musicStateFor in index.html); music.js does the rest.
//
// One motif runs through every track, "the climb": a step up, a leap to the fifth, then down again (D E A ... G E).
// Everything is in D so tracks can crossfade into each other; each place gets its own mode and tempo:
//
//   rest      the rest spots          72 BPM  D Mixolydian  campfire: slow motif, soft lead, bass and a triangle pad
//   s1        First steps            104 BPM  D major       bouncy, off-beat chords
//   s2        Crumbling ground        96 BPM  D Dorian      syncopated, the motif breaks off (gaps like the floor)
//   s3        Refill orbs             92 BPM  D Lydian      floating, G# glow, shimmering arpeggios, long echo
//   s4        All together           112 BPM  D minor       heroic i - VI - VII - I, the motif at full strength
//   watch     Watchtower (rest)       72 BPM  D minor       the campfire tune darkened, a far-off heartbeat
//   storm     the chase              152 BPM  D harm. minor the motif twice as fast; layers pile on each segment
//   sunrise   Sunrise and the end     76 BPM  D major       the release: the motif broad and rising, Lydian E chord
//
// Section tracks have layers: base (bass), chords, lead, drums. A room's beat picks the mix: calm rooms drop to bass
// and lead, ordinary rooms add chords, test rooms and side rooms add drums. Every track is 8 bars, A A' B A'', and
// ends on the A chord so the loop leads back to D.
//
// Grid: 4 steps per beat, 4 beats per bar = 16 steps per bar. Note*N lasts N steps, - is a rest, | checks the bar.

const SONG = (() => {
// A chord pattern: the same rhythm for each chord (X = the chord), one bar per chord
const musicStabs = (rhythm, chords) => chords.map(c => rhythm.replace(/X/g, c)).join(' | ');

const CH = {
  D: 'D4+F#4+A4', Dm: 'D4+F4+A4', G: 'D4+G4+B4', Gm: 'D4+G4+Bb4', Bm: 'D4+F#4+B4', Em: 'E4+G4+B4', A: 'C#4+E4+A4',
  C: 'C4+E4+G4', Bb: 'D4+F4+Bb4', E: 'E4+G#4+B4',
};

const song = {
  stepsPerBeat: 4,
  beatsPerBar: 4,
  fade: 1.5,        // s crossfade when the track changes (on a bar)
  layerFade: 1.5,   // s fade when a layer goes in or out
  mix: 1,

  instruments: {
    soft:  { wave: 'pulse', duty: 0.5, vol: 0.17, attack: 0.03, decay: 0.4, sustain: 0.55, release: 0.25,
             vibrato: { rate: 4.5, depth: 10, delay: 0.3 }, echo: { steps: 6, vol: 0.3, repeats: 2 } },
    glow:  { wave: 'pulse', duty: 0.5, vol: 0.19, attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.3,
             vibrato: { rate: 5, depth: 12, delay: 0.25 }, echo: { steps: 3, vol: 0.4, repeats: 3 }, pan: -0.1 },
    lead:  { wave: 'pulse', duty: 0.25, vol: 0.3, attack: 0.008, decay: 0.2, sustain: 0.6, release: 0.08,
             vibrato: { rate: 5.5, depth: 14, delay: 0.2 }, echo: { steps: 3, vol: 0.35 }, pan: -0.1 },
    bass:  { wave: 'triangle', vol: 0.2, attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.05, gate: 0.85 },
    pad:   { wave: 'triangle', arp: 0.08, vol: 0.06, attack: 0.05, sustain: 0.8, release: 0.3, gate: 0.97, pan: 0.15 },
    arp:   { wave: 'pulse', duty: 0.125, arp: 0.05, vol: 0.11, decay: 0.15, sustain: 0.5, release: 0.04, gate: 0.6, pan: 0.2 },
    shimmer: { wave: 'triangle', arp: 0.06, vol: 0.06, attack: 0.02, sustain: 0.7, release: 0.2, gate: 0.95, pan: 0.2 },
    high:  { wave: 'pulse', duty: 0.125, vol: 0.12, decay: 0.08, sustain: 0.4, release: 0.03, gate: 0.7, pan: 0.25 },
    bell:  { wave: 'triangle', vol: 0.16, attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.3, gate: 0.6,
             echo: { steps: 4, vol: 0.4, repeats: 2 }, pan: 0.2 },
    drums: { wave: 'drums', vol: 0.45 },
    soft_drums: { wave: 'drums', vol: 0.35 },
    beat:  { wave: 'drums', vol: 0.4, kit: { t: { tone: [110, 55], toneDur: 0.2, vol: 0.7 } } },   // far-off heartbeat
  },

  patterns: {
    // ---- Rest spots: D Mixolydian, D | C | D | G | Bm | C | D | A
    restA:  'D5*2 E5*2 A5*6 G5*2 E5*4 | G5*6 E5*2 C5*8',
    restA2: 'D5*2 E5*2 A5*6 B5*2 A5*4 | G5*4 B5*4 D6*8',
    restB:  'B4*4 D5*4 F#5*8 | E5*4 G5*4 C6*4 B5*2 A5*2',
    restA3: 'D5*2 E5*2 A5*6 G5*2 E5*4 | G5*4 E5*4 C#5*4 E5*4',
    restBass: 'D3*8 A2*8 | C3*8 G2*8 | D3*8 A2*8 | G2*8 D3*8 | B2*8 F#2*8 | C3*8 G2*8 | D3*8 A2*8 | A2*8 E2*4 C#3*4',
    restPad: musicStabs('X*16', [CH.D, CH.C, CH.D, CH.G, CH.Bm, CH.C, CH.D, CH.A]),

    // ---- Watchtower: the same tune in D minor, Dm | C | Dm | Gm | Bb | C | Dm | A
    watchA:  'D5*2 E5*2 A5*6 G5*2 E5*4 | G5*6 E5*2 C5*8',
    watchA2: 'D5*2 E5*2 A5*6 Bb5*2 A5*4 | G5*4 Bb5*4 D6*8',
    watchB:  'Bb4*4 D5*4 F5*8 | E5*4 G5*4 C6*4 Bb5*2 A5*2',
    watchA3: 'D5*2 E5*2 A5*6 G5*2 E5*4 | G5*4 E5*4 C#5*4 E5*4',
    watchBass: 'D3*8 A2*8 | C3*8 G2*8 | D3*8 A2*8 | G2*8 D3*8 | Bb2*8 F2*8 | C3*8 G2*8 | D3*8 A2*8 | A2*8 E2*4 C#3*4',
    watchPad: musicStabs('X*16', [CH.Dm, CH.C, CH.Dm, CH.Gm, CH.Bb, CH.C, CH.Dm, CH.A]),
    heart: 't - - t? - - - - - - - - - - - -',

    // ---- Section 1, First steps: D major, D | G | Bm | A | D | G | Em | A
    s1Lead: 'D5*2 E5*2 A5*3 - G5*2 E5*2 -*4 | D5*2 B4*2 D5*2 G5*4 F#5*2 G5*4 |' +
            'F#5*2 E5*2 D5*3 - F#5*2 B5*2 -*4 | A5*3 G5 F#5*2 E5*2 C#5*4 -*4 |' +
            'D5*2 E5*2 A5*3 - B5*2 A5*2 -*4 | G5*2 B5*2 D6*4 B5*2 G5*2 -*4 |' +
            'E5*2 F#5*2 B5*3 - A5*2 F#5*2 -*4 | E5*2 F#5*2 G5*2 A5*2 C#5*4 E5*4',
    s1Bass: 'D3*4 A3*2 D3*2 -*2 D3*2 A2*4',
    s1Chords: musicStabs('-*2 X*2 -*2 X*2 -*2 X*2 -*2 X*2', [CH.D, CH.G, CH.Bm, CH.A, CH.D, CH.G, CH.Em, CH.A]),
    s1Beat: 'k - h - s - h - k - h k s - h -',

    // ---- Section 2, Crumbling ground: D Dorian, Dm | G | Dm | G | Bb | C | Dm | A
    s2Lead: 'D5*2 E5*2 A5*2 -*2 G5 E5 -*2 -*4 | -*2 B4*2 D5*2 E5*2 F5*4 E5*2 D5*2 |' +
            'D5*2 E5*2 A5*2 -*2 B5 A5 -*2 G5*4 | B5*3 A5*3 G5*2 D5*8 |' +
            'F5*3 D5*3 F5*2 Bb5*4 A5*4 | G5*3 E5*3 G5*2 C6*4 B5*2 A5*2 |' +
            'D5*2 E5*2 A5*2 -*2 G5 E5 -*2 D5*4 | E5*3 C#5*3 E5*2 A5*4 G5*2 E5*2',
    s2Bass: 'D3*3 D3*3 A2*2 -*2 D3*2 A2*2 D3*2',
    s2Chords: musicStabs('X*3 X*3 X*2 -*4 X*2 -*2', [CH.Dm, CH.G, CH.Dm, CH.G, CH.Bb, CH.C, CH.Dm, CH.A]),
    s2Beat: 'k - - h s - - h k - h k s - h? -',

    // ---- Section 3, Refill orbs: D Lydian, D | E/D | D | E/D | Bm | E | G | A
    s3Lead: 'D5*2 E5*2 A5*8 G#5*2 E5*2 | F#5*4 G#5*4 B5*8 | D5*2 E5*2 A5*8 B5*2 C#6*2 | B5*8 G#5*4 E5*4 |' +
            'B4*2 C#5*2 F#5*8 E5*2 C#5*2 | G#5*6 F#5*2 E5*8 | D5*2 E5*2 B5*8 A5*2 G5*2 | A5*8 E5*4 C#5*4',
    s3Bass: 'D3*8 A2*8',
    s3Chords: musicStabs('X*4 X*4 X*4 X*4', [CH.D, CH.E, CH.D, CH.E, CH.Bm, CH.E, CH.G, CH.A]),
    s3Beat: 'k - - - h? - h - - - k - h? - h -',

    // ---- Section 4, All together: D minor, Dm | Bb | C | D | Dm | Bb | C | A
    s4Lead: 'D5*2 E5*2 A5*4 G5*2 E5*2 D5*2 E5*2 | F5*4 D5*4 Bb4*4 D5*4 | E5*2 G5*2 C6*4 Bb5*2 G5*2 E5*4 | F#5*4 A5*4 D6*8 |' +
            'D5*2 E5*2 A5*4 G5*2 E5*2 F5*2 G5*2 | A5*4 F5*4 D5*4 F5*4 | G5*4 E5*4 C5*4 E5*4 | C#5*2 E5*2 A5*4 G5*2 E5*2 C#5*4',
    walk: 'D3*2 D4*2 D3*2 D4*2 D3*2 D4*2 A3*2 D4*2',
    s4Chords: musicStabs('X*2 -*2 X*2 X*2 -*2 X*2 X*4', [CH.Dm, CH.Bb, CH.C, CH.D, CH.Dm, CH.Bb, CH.C, CH.A]),
    s4Beat: 'k - h - s - h k k - h - s - h h?',

    // ---- The storm: D harmonic minor, the motif twice as fast, Dm | Bb | Gm | A | Dm | Bb | Gm | A
    stormLead: 'D5 E5 A5*2 G5 E5 D5*2 D5 E5 A5*2 Bb5 A5 G5 E5 | F5*2 D5*2 F5 G5 A5*2 Bb5*4 A5*4 |' +
               'G5 A5 D6*2 Bb5 A5 G5*2 Bb5*4 A5*4 | A5*2 C#6*2 E6*2 C#6*2 A5*4 G5*2 E5*2 |' +
               'D5 E5 A5*2 G5 E5 D5*2 D5 E5 A5*2 Bb5 A5 G5 E5 | F5*2 D5*2 F5 G5 A5*2 D6*4 Bb5*2 F5*2 |' +
               'G5*2 Bb5*2 D6*2 Bb5*2 G5*4 A5*4 | C#6*4 A5*2 E5*2 C#5*4 E5*4',
    drive: 'D3*2 D3*2 D4*2 D3*2 D3*2 D4*2 D3*2 D4*2',
    stormChords: musicStabs('X*2x8', [CH.Dm, CH.Bb, CH.Gm, CH.A, CH.Dm, CH.Bb, CH.Gm, CH.A]),
    ost: 'D5 A5 D6 A5 D5 A5 D6 A5 D5 A5 D6 A5 D5 A5 D6 A5',
    stormBeat: 'k - h k s - h - k - h k s - s? h',

    // ---- Sunrise: D major with a Lydian E chord, D | E/D | G | A | Bm | G | D | A
    sunLead: 'D5*4 E5*4 A5*8 | G#5*4 F#5*4 E5*8 | D5*4 G5*4 B5*8 | C#6*6 B5*2 A5*8 |' +
             'B4*4 C#5*4 F#5*8 | G5*4 F#5*4 D5*8 | D5*4 E5*4 A5*4 B5*4 | A5*8 G5*4 E5*4',
    sunBass: 'D3*8 A2*8',
    sunPad: musicStabs('X*16', [CH.D, CH.E, CH.G, CH.A, CH.Bm, CH.G, CH.D, CH.A]),
    sunBells: 'A6*2 -*6 F#6*2 -*6 | B6*2 -*6 G#6*2 -*6 | B6*2 -*6 G6*2 -*6 | C#7*2 -*6 A6*2 -*6 |' +
              'F#6*2 -*6 D6*2 -*6 | B6*2 -*6 G6*2 -*6 | A6*2 -*6 F#6*2 -*6 | E6*2 -*6 C#6*2 -*6',
  },

  tracks: {
    rest: { bpm: 72, parts: [
      { inst: 'soft', layer: 'lead', seq: 'restA restA2 restB restA3' },
      { inst: 'bass', layer: 'base', seq: 'restBass', vol: 0.85 },
      { inst: 'pad',  layer: 'base', seq: 'restPad' },
    ] },
    watch: { bpm: 72, parts: [
      { inst: 'soft', layer: 'lead', seq: 'watchA watchA2 watchB watchA3' },
      { inst: 'bass', layer: 'base', seq: 'watchBass', vol: 0.85 },
      { inst: 'pad',  layer: 'base', seq: 'watchPad' },
      { inst: 'beat', layer: 'heart', seq: 'heart' },
    ] },
    s1: { bpm: 104, parts: [
      { inst: 'lead',  layer: 'lead',   seq: 's1Lead' },
      { inst: 'bass',  layer: 'base',   seq: 's1Bass s1Bass:+5 s1Bass:-3 s1Bass:-5 s1Bass s1Bass:+5 s1Bass:+2 s1Bass:-5' },
      { inst: 'arp',   layer: 'chords', seq: 's1Chords' },
      { inst: 'drums', layer: 'drums',  seq: 's1Beat' },
    ] },
    s2: { bpm: 96, parts: [
      { inst: 'lead',  layer: 'lead',   seq: 's2Lead' },
      { inst: 'bass',  layer: 'base',   seq: 's2Bass s2Bass:+5 s2Bass s2Bass:+5 s2Bass:-4 s2Bass:-2 s2Bass s2Bass:-5' },
      { inst: 'arp',   layer: 'chords', seq: 's2Chords' },
      { inst: 'drums', layer: 'drums',  seq: 's2Beat' },
    ] },
    s3: { bpm: 92, parts: [
      { inst: 'glow',    layer: 'lead',   seq: 's3Lead' },
      { inst: 'bass',    layer: 'base',   seq: 's3Bass s3Bass s3Bass s3Bass s3Bass:-3 s3Bass:+2 s3Bass:+5 s3Bass:-5' },
      { inst: 'shimmer', layer: 'chords', seq: 's3Chords' },
      { inst: 'soft_drums', layer: 'drums', seq: 's3Beat' },
    ] },
    s4: { bpm: 112, parts: [
      { inst: 'lead',  layer: 'lead',   seq: 's4Lead' },
      { inst: 'bass',  layer: 'base',   seq: 'walk walk:-4 walk:-2 walk walk walk:-4 walk:-2 walk:-5' },
      { inst: 'arp',   layer: 'chords', seq: 's4Chords' },
      { inst: 'drums', layer: 'drums',  seq: 's4Beat' },
    ] },
    storm: { bpm: 152, layers: { chords: 0, high: 0 }, parts: [
      { inst: 'lead',  layer: 'lead',   seq: 'stormLead' },
      { inst: 'bass',  layer: 'base',   seq: 'drive drive:-4 drive:-7 drive:-5 drive drive:-4 drive:-7 drive:-5' },
      { inst: 'arp',   layer: 'chords', seq: 'stormChords' },
      { inst: 'high',  layer: 'high',   seq: 'ost ost:-4 ost:-7 ost:-5 ost ost:-4 ost:-7 ost:-5' },
      { inst: 'drums', layer: 'drums',  seq: 'stormBeat' },
    ] },
    sunrise: { bpm: 76, layers: { bells: 1 }, parts: [
      { inst: 'soft', layer: 'lead',  seq: 'sunLead' },
      { inst: 'bass', layer: 'base',  seq: 'sunBass sunBass sunBass:+5 sunBass:-5 sunBass:-3 sunBass:+5 sunBass sunBass:-5', vol: 0.85 },
      { inst: 'pad',  layer: 'base',  seq: 'sunPad' },
      { inst: 'bell', layer: 'bells', seq: 'sunBells' },
    ] },
  },

  // What the game asks for. Same track = only layers fade; another track = switch on the next bar.
  states: {
    rest:    { track: 'rest' },
    watch:   { track: 'watch', sync: true },                                          // same form as rest
    storm1:  { track: 'storm', at: 'beat', fade: 0.2, layers: { chords: 0, high: 0 } },
    storm2:  { track: 'storm', at: 'beat', fade: 0.2, layers: { chords: 1, high: 0 } },
    storm3:  { track: 'storm', at: 'beat', fade: 0.2, layers: { chords: 1, high: 1 }, speed: 1.07 },
    sunrise: { track: 'sunrise', fade: 3, layers: { bells: 0 } },                     // the storm fades out under it
    end:     { track: 'sunrise', layers: { bells: 1 } },                              // the end screen
  },
};

// Each section's states: calm rooms (bass and lead), ordinary rooms (+ chords), test and side rooms (+ drums)
for (const s of ['s1', 's2', 's3', 's4']) {
  song.tracks[s].layers = { chords: 1, drums: 0 };
  song.states[s + '-calm'] = { track: s, layers: { chords: 0, drums: 0 } };
  song.states[s] = { track: s, layers: { chords: 1, drums: 0 } };
  song.states[s + '-test'] = { track: s, layers: { chords: 1, drums: 1 } };
}
return song;
})();
