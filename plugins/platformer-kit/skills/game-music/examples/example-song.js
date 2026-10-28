// An example song for music.js (game-music skill): original, written for this skill.
// Moods: camp (calm, 72 BPM), explore (wonder, 100 BPM, drums as a layer for "tension"), chase (minor, 144 BPM).
// One leitmotif runs through all three: D up to A, step down to G, up to B, back to A ("D A G B A").
// Camp plays it slowly, explore plays it with a lighter rhythm, chase plays it twice as fast in D minor (Bb for B).
// Key: D Dorian (D E F G A B C), the raised 6th (B) gives the hopeful, curious color; chase uses D minor.
// Grid: 4 steps per beat, 4 beats per bar = 16 steps per bar. Note*N lasts N steps, - is a rest, | checks the bar.
const SONG = {
  stepsPerBeat: 4,
  beatsPerBar: 4,
  fade: 1,          // s crossfade when the track changes (on a bar)
  layerFade: 1.5,   // s fade when a layer goes in or out
  mix: 1,

  instruments: {
    soft:  { wave: 'pulse', duty: 0.5, vol: 0.2, attack: 0.03, decay: 0.4, sustain: 0.55, release: 0.25,
             vibrato: { rate: 4.5, depth: 10, delay: 0.3 }, echo: { steps: 6, vol: 0.3, repeats: 2 } },
    lead:  { wave: 'pulse', duty: 0.25, vol: 0.3, attack: 0.008, decay: 0.2, sustain: 0.6, release: 0.08,
             vibrato: { rate: 5.5, depth: 14, delay: 0.2 }, echo: { steps: 3, vol: 0.35 }, pan: -0.1 },
    bass:  { wave: 'triangle', vol: 0.2, attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.05, gate: 0.85 },
    pad:   { wave: 'triangle', arp: 0.08, vol: 0.07, attack: 0.05, sustain: 0.8, release: 0.3, gate: 0.97, pan: 0.15 },
    arp:   { wave: 'pulse', duty: 0.125, arp: 0.05, vol: 0.04, decay: 0.15, sustain: 0.5, release: 0.04, gate: 0.6, pan: 0.2 },
    drums: { wave: 'drums', vol: 0.5 },
    bell:  { wave: 'pulse', duty: 0.25, vol: 0.16, decay: 0.15, sustain: 0.3, release: 0.2, echo: { steps: 2, vol: 0.4 } },
  },

  patterns: {
    // The leitmotif and its answer (2 bars each), used by camp
    motif:   'D5*4 A5*4 G5*2 B5*2 A5*4 | G5*4 F5*2 E5*2 D5*8',
    answer:  'D5*4 A5*4 C6*2 B5*2 A5*4 | B5*4 A5*2 G5*2 A5*8',
    bridge:  'F5*8 D5*4 F5*4 | E5*8 G5*4 E5*4',
    turn:    'D5*4 A5*4 G5*2 B5*2 A5*4 | G5*4 E5*4 C#5*8',
    campBass: 'D3*8 A2*8 | G2*8 D3*8 | D3*8 A2*8 | G2*8 B2*8 | Bb2*8 F2*8 | C3*8 G2*8 | D3*8 A2*8 | A2*8 E3*4 C#3*4',
    campPad: 'D4+F4+A4*16 | D4+G4+B4*16 | D4+F4+A4*16 | D4+G4+B4*16 | D4+F4+Bb4*16 | C4+E4+G4*16 | D4+F4+A4*16 | C#4+E4+A4*16',

    // Explore: the same motif with a lighter, pushed rhythm over the same 8 bars of harmony
    exLead: 'D5*2 -*2 A5*3 G5 B5*2 A5*6 | G5*2 A5*2 G5*2 F5*2 E5*2 D5*6 | D5*2 -*2 A5*3 C6 B5*2 A5*6 | B5*3 A5*3 G5*2 A5*8 |' +
            'F5*3 D5*3 F5*2 Bb5*4 A5*4 | G5*3 E5*3 G5*2 C6*4 B5*4 | D5*2 -*2 A5*3 G5 B5*2 A5*6 | E5*2 A5*2 G5*2 E5*2 C#5*4 E5*4',
    walk: 'D3*2 D4*2 A3*2 D4*2 D3*2 D4*2 A3*2 D4*2',          // one bar, transposed per chord in the sequence
    cDm: 'D4+F4+A4*6 D4+F4+A4*6 D4+F4+A4*4',
    cG:  'D4+G4+B4*6 D4+G4+B4*6 D4+G4+B4*4',
    cBb: 'D4+F4+Bb4*6 D4+F4+Bb4*6 D4+F4+Bb4*4',
    cC:  'C4+E4+G4*6 C4+E4+G4*6 C4+E4+G4*4',
    cA:  'C#4+E4+A4*6 C#4+E4+A4*6 C#4+E4+A4*4',
    beat: 'k - h - s - h k - k h - s - h h?',

    // Chase: the motif twice as fast, in D minor, over i - VI - VII - V
    chLead: 'D5*2 A5*2 G5 Bb5 A5*2 D5*2 A5*2 G5 Bb5 A5*2 | F5*2 D5*2 F5 G5 A5*2 Bb5*4 A5*4 |' +
            'G5*2 E5*2 G5 A5 Bb5*2 C6*4 Bb5*4 | A5*4 G5*2 F5*2 E5*4 C#5*4',
    drive: 'D3*2 D3*2 D4*2 D3*2 D3*2 D4*2 D3*2 D4*2',
    sDm: 'D4+F4+A4*2x8', sBb: 'D4+F4+Bb4*2x8', sC: 'C4+E4+G4*2x8', sA: 'C#4+E4+A4*2x8',
    chBeat: 'k - h k s - h - k - h k s - s? h',
  },

  tracks: {
    camp: { bpm: 72, parts: [
      { inst: 'soft', layer: 'lead', seq: 'motif answer bridge turn' },
      { inst: 'bass', layer: 'base', seq: 'campBass' },
      { inst: 'pad',  layer: 'base', seq: 'campPad' },
    ] },
    explore: { bpm: 100, layers: { drums: 0 }, parts: [
      { inst: 'lead',  layer: 'lead',  seq: 'exLead' },
      { inst: 'bass',  layer: 'base',  seq: 'walk walk:+5 walk walk:+5 walk:-4 walk:-2 walk walk:-5' },
      { inst: 'arp',   layer: 'base',  seq: 'cDm cG cDm cG cBb cC cDm cA' },
      { inst: 'drums', layer: 'drums', seq: 'beat' },
    ] },
    chase: { bpm: 144, parts: [
      { inst: 'lead',  layer: 'lead',  seq: 'chLead' },
      { inst: 'bass',  layer: 'base',  seq: 'drive drive:-4 drive:-2 drive:-5' },
      { inst: 'arp',   layer: 'base',  seq: 'sDm sBb sC sA' },
      { inst: 'drums', layer: 'drums', seq: 'chBeat' },
    ] },
  },

  // What the game asks for. Same track = only layers fade; another track = switch on the next bar.
  states: {
    camp:    { track: 'camp', sync: true },
    explore: { track: 'explore', sync: true, layers: { drums: 0 } },
    tension: { track: 'explore', layers: { drums: 1 } },
    hurry:   { track: 'explore', layers: { drums: 1 }, speed: 1.2 },   // time running out: same tune, faster
    chase:   { track: 'chase', at: 'beat', fade: 0.15 },
  },

  stingers: {
    found: { inst: 'bell', notes: 'D5 A5 D6*2', duck: 0.5 },                       // motif head, quick
    clear: { parts: [{ inst: 'lead', notes: 'D5*2 A5*2 G#5 B5 A5*2 D6*8' },        // motif in D Lydian (G#)
                     { inst: 'bass', notes: 'D3*8 A2*8' }], duck: 0.2 },
  },
};
