// music.js: a tiny sequencer for game music with the Web Audio API (part of the game-music skill).
// No dependencies, no audio files. Load it with a plain <script> tag; it defines window.GameMusic.
//
//   const music = new GameMusic(SONG, { ac, out, volume: 0.2 });  // ac: the game's AudioContext, out: a node
//   music.setState('explore');      // switch track and/or fade layers; track changes wait for a bar boundary
//   music.stinger('found');         // a short phrase on the next beat; the loop dips under it (one at a time)
//   music.duck();                   // dip the music under a big sound effect
//   music.setVolume(0.2); music.setMuted(true); music.stop(1); music.position();
//   GameMusic.render(SONG, { state: 'camp', seconds: 20 })  // offline: resolves to { buffer, log }
//
// The song format is described in references/format.md. Everything is deterministic: the same song and the same
// calls give the same samples, give or take Chromium's last-bit rounding (noise comes from a seeded generator,
// nothing reads Math.random). Notes are scheduled 0.12 s ahead on the audio clock from a 25 ms timer.
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- parsing
  const NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d)$/;
  const SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const midiOf = (tok) => {
    const m = NOTE_RE.exec(tok);
    if (!m) return null;
    return (parseInt(m[3], 10) + 1) * 12 + SEMI[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  };
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const fail = (msg) => { throw new Error('music: ' + msg); };

  const DEFAULT_KIT = {
    k: { tone: [160, 45], toneDur: 0.13, vol: 0.9 },                                    // kick: falling tone
    s: { tone: [210, 150], toneDur: 0.05, toneVol: 0.35, noise: 0.13, filter: 'bandpass', freq: 1800, q: 0.7, vol: 0.55 },
    h: { noise: 0.035, filter: 'highpass', freq: 7000, vol: 0.28 },                      // closed hat
    o: { noise: 0.2, filter: 'highpass', freq: 6000, vol: 0.22 },                        // open hat
    t: { tone: [220, 110], toneDur: 0.12, vol: 0.6 },                                    // tom / triangle drum
  };
  const INST_DEFAULTS = { wave: 'pulse', duty: 0.5, attack: 0.005, decay: 0.12, sustain: 0.7, release: 0.06,
                          vol: 0.3, gate: 0.9, pan: 0, detune: 0, arp: 0, vibrato: null, echo: null, kit: null };

  // One pattern: whitespace-separated tokens on a grid of steps. Returns { events, steps }.
  function parsePattern(src, spBar, kit, where, anyLength) {
    if (typeof src !== 'string') fail(`${where}: pattern must be a string`);
    const events = [];
    let step = 0, last = null;
    for (const raw of src.replace(/\|/g, ' | ').trim().split(/\s+/)) {
      if (!raw) continue;
      if (raw === '|') {
        if (step % spBar) fail(`${where}: bar line after ${step} steps is not on a bar (${spBar} steps per bar)`);
        continue;
      }
      let tok = raw, vel = 1, n = 1, reps = 1;
      const mark = () => {
        if (tok.endsWith('!')) { vel = 1.3; tok = tok.slice(0, -1); } else if (tok.endsWith('?')) { vel = 0.5; tok = tok.slice(0, -1); }
      };
      const x = /^(.+?)x(\d+)$/.exec(tok);                                // xN: the same token N times
      if (x) { tok = x[1]; reps = parseInt(x[2], 10); }
      mark();
      const m = /^(.+?)\*(\d+)$/.exec(tok);
      if (m) { tok = m[1]; n = parseInt(m[2], 10); if (!(n > 0)) fail(`${where}: bad length in "${raw}"`); }
      mark();
      if (tok === '.') { if (last) last.len += n * reps; step += n * reps; continue; }   // hold the last note longer
      if (tok === '-') { last = null; step += n * reps; continue; }                      // rest
      const names = tok.split('+');
      let notes;
      if (kit) {
        for (const p of names) if (!kit[p]) fail(`${where}: "${p}" is not in the drum kit (${Object.keys(kit).join(' ')})`);
        notes = names;
      } else {
        notes = names.map(midiOf);
        const bad = names.find((p, i) => notes[i] === null);
        if (bad !== undefined) fail(`${where}: "${bad}" is not a note (write C4, F#3, Bb5 ...)`);
      }
      for (let r = 0; r < reps; r++) {
        last = { step, len: n, notes, vel };
        events.push(last);
        step += n;
      }
    }
    if (step === 0) fail(`${where}: empty pattern`);
    if (step % spBar && !anyLength) fail(`${where}: ${step} steps is not a whole number of bars (${spBar} steps per bar)`);
    return { events, steps: step };
  }

  // A part's sequence: pattern names with optional transpose and repeat, e.g. "a a:+5 b*2 -*2" (- is a bar of rest)
  function parseSeq(src, patterns, spBar, where) {
    const out = [];
    let step = 0;
    for (const tok of String(src).trim().split(/\s+/)) {
      const m = /^([^:*]+)(?::([+-]?\d+))?(?:\*(\d+))?$/.exec(tok);
      if (!m) fail(`${where}: cannot read "${tok}" (write name, name:+5, name*2 or -*2)`);
      const reps = m[3] ? parseInt(m[3], 10) : 1;
      if (m[1] === '-') { step += spBar * reps; continue; }
      const pat = patterns[m[1]];
      if (!pat) fail(`${where}: no pattern named "${m[1]}"`);
      for (let r = 0; r < reps; r++) { out.push({ pat, transpose: m[2] ? parseInt(m[2], 10) : 0, at: step }); step += pat.steps; }
    }
    return { items: out, steps: step };
  }

  // Check the whole song and turn it into flat event lists. Throws with a readable message on any mistake.
  function compile(song) {
    if (song && song.__compiled) return song;
    if (!song || typeof song !== 'object') fail('song must be an object');
    const spBeat = song.stepsPerBeat || 4, beatsPerBar = song.beatsPerBar || 4, spBar = spBeat * beatsPerBar;
    const instruments = {};
    for (const [name, def] of Object.entries(song.instruments || {})) {
      const d = { ...INST_DEFAULTS, ...def, name };
      if (d.wave === 'drums') d.kit = { ...DEFAULT_KIT, ...(def.kit || {}) };
      else if (!['pulse', 'square', 'triangle', 'sine', 'sawtooth'].includes(d.wave)) fail(`instrument ${name}: unknown wave "${d.wave}"`);
      instruments[name] = d;
    }
    const patCache = {};
    const patternFor = (name, inst, anyLength) => {
      const key = name + (inst.kit ? '#drums#' + inst.name : '') + (anyLength ? '#any' : '');
      if (!patCache[key]) {
        const src = song.patterns && song.patterns[name];
        if (src === undefined) fail(`no pattern named "${name}"`);
        patCache[key] = parsePattern(src, spBar, inst.kit, `pattern ${name}`, anyLength);
      }
      return patCache[key];
    };
    const compilePart = (part, where, anyLength) => {
      const inst = instruments[part.inst];
      if (!inst) fail(`${where}: no instrument named "${part.inst}"`);
      const names = {};
      if (part.notes !== undefined) {   // notes written straight into the part instead of a named pattern
        names.__inline = parsePattern(part.notes, spBar, inst.kit, where, anyLength);
        part = { ...part, seq: '__inline' };
      } else {
        for (const tok of String(part.seq || '').trim().split(/\s+/)) {
          const n = tok.split(/[:*]/)[0];
          if (n && n !== '-') names[n] = patternFor(n, inst, anyLength);
        }
      }
      const seq = parseSeq(part.seq, names, spBar, where);
      const events = [];
      for (const it of seq.items) {
        for (const e of it.pat.events) {
          events.push({ step: it.at + e.step, len: e.len, vel: e.vel * (part.vol ?? 1), inst: inst.name,
                        layer: part.layer || 'main', notes: inst.kit ? e.notes : e.notes.map(m => m + it.transpose + (part.transpose || 0)) });
        }
      }
      return { events, steps: seq.steps, layer: part.layer || 'main' };
    };

    const tracks = {};
    for (const [name, tr] of Object.entries(song.tracks || {})) {
      const parts = (tr.parts || []).map((p, i) => compilePart(p, `track ${name}, part ${i + 1} (${p.inst})`));
      if (!parts.length) fail(`track ${name}: no parts`);
      const loopSteps = Math.max(...parts.map(p => p.steps));
      const events = [];
      parts.forEach((p, i) => {
        if (loopSteps % p.steps) fail(`track ${name}, part ${i + 1}: ${p.steps / spBar} bars does not fit ${loopSteps / spBar} bars evenly`);
        for (let off = 0; off < loopSteps; off += p.steps) for (const e of p.events) events.push({ ...e, step: e.step + off });
      });
      if (!events.length) fail(`track ${name}: no notes`);
      events.sort((a, b) => a.step - b.step);
      const layers = {};
      for (const p of parts) layers[p.layer] = 1;
      Object.assign(layers, tr.layers || {});
      tracks[name] = { name, bpm: tr.bpm || song.bpm || 100, loopSteps, events, layers, bars: loopSteps / spBar };
    }
    if (!Object.keys(tracks).length) fail('song has no tracks');

    const states = {};
    for (const [name, st] of Object.entries(song.states || {})) {
      if (!tracks[st.track]) fail(`state ${name}: no track named "${st.track}"`);
      for (const l of Object.keys(st.layers || {})) if (!(l in tracks[st.track].layers)) fail(`state ${name}: track ${st.track} has no layer "${l}"`);
      states[name] = st;
    }
    const stingers = {};
    for (const [name, sg] of Object.entries(song.stingers || {})) {
      const parts = (sg.parts || [{ inst: sg.inst, seq: sg.seq, notes: sg.notes }]).map((p, i) => compilePart(p, `stinger ${name}, part ${i + 1}`, true));
      const steps = Math.max(...parts.map(p => p.steps));
      stingers[name] = { ...sg, name, events: parts.flatMap(p => p.events).sort((a, b) => a.step - b.step), steps };
    }
    return { __compiled: true, spBeat, beatsPerBar, spBar, instruments, tracks, states, stingers,
             fade: song.fade ?? 1, layerFade: song.layerFade ?? 1.5, mix: song.mix ?? 1 };
  }

  // ---------------------------------------------------------------- sound helpers
  const waveCache = new WeakMap();
  function pulseWave(ac, duty) {
    let m = waveCache.get(ac);
    if (!m) waveCache.set(ac, m = {});
    if (!m[duty]) {
      const N = 64, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      m[duty] = ac.createPeriodicWave(re, im);
    }
    return m[duty];
  }
  const noiseCache = new WeakMap();
  function noiseBuffer(ac) {
    let b = noiseCache.get(ac);
    if (!b) {
      b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = b.getChannelData(0);
      let s = 0x9e3779b9;  // seeded (mulberry32), so renders are repeatable
      for (let i = 0; i < d.length; i++) {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        d[i] = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
      }
      noiseCache.set(ac, b);
    }
    return b;
  }
  // Move a parameter from wherever it is at time t to v over dur seconds. We keep our own copy of each parameter's
  // set/ramp events, because cancelAndHoldAtTime cannot be trusted here (with no event after t, a following ramp
  // starts from the last event, not from t).
  function valueAt(ev, t) {
    let i = 0;
    while (i + 1 < ev.length && ev[i + 1].t <= t) i++;
    const a = ev[i], b = ev[i + 1];
    if (b && b.lin && b.t > a.t) return a.v + (b.v - a.v) * (t - a.t) / (b.t - a.t);
    return a.v;
  }
  function rampTo(p, v, t, dur) {
    const ev = p.__ev || (p.__ev = [{ t: 0, v: p.value }]);
    const v0 = valueAt(ev, t);
    p.cancelScheduledValues(t);
    p.linearRampToValueAtTime(v0, t);   // redraws any ramp cut at t along the same line, so nothing jumps
    if (dur > 0) p.linearRampToValueAtTime(v, t + dur); else p.setValueAtTime(v, t);
    p.__ev = ev.filter(e => e.t < t).concat([{ t, v: v0, lin: true }, { t: t + Math.max(0, dur), v, lin: dur > 0 }]);
  }

  // ---------------------------------------------------------------- the player
  class GameMusic {
    constructor(song, opt = {}) {
      this.song = compile(song);
      this.ac = opt.ac;
      if (!this.ac) fail('pass { ac: yourAudioContext }');
      this.offline = !!opt.offline;
      this.ahead = opt.ahead ?? 0.12;             // s scheduled ahead of the clock (timer runs every 25 ms)
      this._t = 0;                                 // the clock while rendering offline
      this.volume = opt.volume ?? 1;
      this.muted = !!opt.muted;
      this.master = this.ac.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * this.song.mix;
      this.ducker = this.ac.createGain();          // dips the loops; stingers bypass it
      this.ducker.connect(this.master);
      this.master.connect(opt.out || this.ac.destination);
      this.cur = null;
      this.old = [];
      this.state = null;
      this.log = [];
      this.timer = null;
    }

    now() { return this.offline ? this._t : this.ac.currentTime; }

    // ---- what the game calls
    setState(name, opt = {}) {
      const S = this.song;
      const st = S.states[name] || (S.tracks[name] && { track: name });
      if (!st) fail(`no state or track named "${name}"`);
      const tr = S.tracks[st.track], now = this.now();
      const levels = { ...tr.layers, ...(st.layers || {}) };
      const speed = opt.speed ?? st.speed ?? 1;
      this.state = name;
      // A switch that has not started yet is replaced, not stacked (states can change twice within a bar)
      if (this.cur && this.cur.prev !== undefined && this.cur.t0 > now + this.ahead) {
        const pending = this.cur;
        pending.out.disconnect();
        this.cur = pending.prev;
        if (this.cur) {
          this.old = this.old.filter(o => o !== this.cur);
          this.cur.endAt = Infinity;
          rampTo(this.cur.out.gain, 1, now, 0.02);
        }
      }
      if (!this.cur || this.cur.track !== tr) {
        const at = opt.at ?? st.at ?? 'bar', fade = opt.fade ?? st.fade ?? S.fade;
        let start = now + (this.offline && !this.cur ? 0 : 0.05), startStep = 0;
        if (this.cur) {
          const b = this._boundary(this.cur, at, now);
          start = b.time;
          if (st.sync) startStep = Math.floor((b.step % tr.loopSteps) / S.spBar) * S.spBar;
        }
        const inst = this._instance(tr, start, startStep, speed, levels, this.cur && fade > 0);
        inst.prev = this.cur;
        if (this.cur) {
          const old = this.cur;
          old.endAt = start + fade;
          rampTo(old.out.gain, 0, start, fade);
          this.old.push(old);
          if (fade > 0) rampTo(inst.out.gain, 1, start, fade);
        }
        this.cur = inst;
        this.log.push({ type: 'track', state: name, track: tr.name, requested: now, start, bpm: tr.bpm * speed,
                        loopSeconds: tr.loopSteps * inst.stepDur, bars: tr.bars });
        this._run();
      } else {
        const fade = opt.layerFade ?? st.layerFade ?? S.layerFade;
        for (const [l, v] of Object.entries(levels)) this._fadeLayer(this.cur, l, v, now, fade);
        if (speed !== this.cur.speed) {
          const b = this._boundary(this.cur, opt.at ?? 'bar', now);
          this.cur.pendingSpeed = { step: b.step, speed };
          this.log.push({ type: 'speed', state: name, speed, requested: now, start: b.time });
        }
        this.log.push({ type: 'layers', state: name, track: tr.name, requested: now, start: now, levels });
      }
    }

    setLayer(layer, level, fade = this.song.layerFade) {
      if (this.cur) this._fadeLayer(this.cur, layer, level, this.now(), fade);
    }

    stinger(name, opt = {}) {
      const sg = this.song.stingers[name];
      if (!sg) fail(`no stinger named "${name}"`);
      if (this.muted) return;
      const now = this.now();
      const stepDur = sg.bpm ? 60 / sg.bpm / this.song.spBeat : this.cur ? this.cur.stepDur : 60 / 120 / this.song.spBeat;
      const start = this.cur ? this._boundary(this.cur, opt.at ?? sg.at ?? 'beat', now).time : now + 0.05;
      if (start < (this._stingerEnd || 0) && !opt.force) return;   // one at a time: a second one is dropped
      const out = this.ac.createGain();
      out.gain.value = sg.vol ?? 1;
      out.connect(this.master);
      for (const e of sg.events) this._play(e, start + e.step * stepDur, stepDur, out);
      const len = sg.steps * stepDur;
      this._stingerEnd = start + len;
      this._duckAt(start, sg.duck ?? 0.4, 0.05, len, 0.6);
      this.log.push({ type: 'stinger', name, requested: now, start, seconds: len });
    }

    duck({ amount = 0.5, attack = 0.03, hold = 0.2, release = 0.6 } = {}) {
      this._duckAt(this.now(), amount, attack, hold, release);
      this.log.push({ type: 'duck', requested: this.now(), start: this.now(), amount });
    }

    setVolume(v) {
      this.volume = v;
      if (!this.muted) rampTo(this.master.gain, v * this.song.mix, this.now(), 0.05);
      this.log.push({ type: 'volume', requested: this.now(), start: this.now(), volume: v });
    }

    setMuted(m) {
      this.muted = !!m;
      rampTo(this.master.gain, this.muted ? 0 : this.volume * this.song.mix, this.now(), 0.08);
      this.log.push({ type: 'muted', requested: this.now(), start: this.now(), muted: this.muted });
    }

    stop(fade = 0.5) {
      if (!this.cur) return;
      const now = this.now();
      this.log.push({ type: 'stop', requested: now, start: now });
      this.cur.endAt = now + fade;
      rampTo(this.cur.out.gain, 0, now, fade);
      this.old.push(this.cur);
      this.cur = null;
      this.state = null;
    }

    // Where the music is now (for syncing visuals to the beat)
    position() {
      const c = this.cur;
      if (!c) return null;
      const gs = Math.max(0, Math.floor(c.s0 + (this.now() - c.t0) / c.stepDur));
      const s = gs % c.track.loopSteps, S = this.song;
      return { state: this.state, track: c.track.name, bar: Math.floor(s / S.spBar), beat: Math.floor((s % S.spBar) / S.spBeat), step: s };
    }

    dispose() { clearInterval(this.timer); this.timer = null; this.stop(0.05); }

    // ---- inside
    _run() {
      if (this.offline || this.timer) return;
      this.timer = setInterval(() => this._pump(this.ac.currentTime + this.ahead), 25);
      this._pump(this.ac.currentTime + this.ahead);
    }

    _instance(tr, start, startStep, speed, levels, fadeIn) {
      const ac = this.ac, out = ac.createGain();
      out.gain.value = fadeIn ? 0 : 1;
      out.connect(this.ducker);
      const inst = { track: tr, out, layers: {}, silentAfter: {}, t0: start, s0: startStep, speed,
                     stepDur: 60 / (tr.bpm * speed) / this.song.spBeat, loop: Math.floor(startStep / tr.loopSteps), i: 0,
                     endAt: Infinity, pendingSpeed: null };
      const local = startStep % tr.loopSteps;
      while (inst.i < tr.events.length && tr.events[inst.i].step < local) inst.i++;
      if (inst.i >= tr.events.length) { inst.i = 0; inst.loop++; }
      for (const l of Object.keys(tr.layers)) {
        const g = ac.createGain();
        g.gain.value = levels[l] ?? 1;
        g.connect(out);
        inst.layers[l] = g;
        inst.silentAfter[l] = (levels[l] ?? 1) > 0 ? Infinity : -Infinity;
      }
      return inst;
    }

    _fadeLayer(inst, l, v, t, fade) {
      const g = inst.layers[l];
      if (!g) fail(`track ${inst.track.name} has no layer "${l}"`);
      rampTo(g.gain, v, t, fade);
      inst.silentAfter[l] = v > 0 ? Infinity : t + fade;   // after a fade to 0, stop making notes for that layer
    }

    _timeOf(inst, gs) { return inst.t0 + (gs - inst.s0) * inst.stepDur; }

    // The next bar (or beat, step, loop) at least `ahead` seconds from now: nothing after it is scheduled yet
    _boundary(inst, at, now) {
      const S = this.song;
      const unit = at === 'loop' ? inst.track.loopSteps : at === 'bar' ? S.spBar : at === 'beat' ? S.spBeat : 1;
      const gs = inst.s0 + Math.ceil((now + this.ahead - inst.t0) / inst.stepDur - 1e-9);
      const step = Math.max(inst.s0, Math.ceil(gs / unit) * unit);
      return { step, time: this._timeOf(inst, step) };
    }

    _pump(until) {
      if (this.cur && this.cur.prev && this.cur.t0 <= this.now()) this.cur.prev = null;   // switch done
      if (this.cur) this._schedule(this.cur, until);
      for (const o of this.old) this._schedule(o, until);
      const now = this.now();
      this.old = this.old.filter(o => {
        if (now < o.endAt + 3) return true;
        if (!this.offline) o.out.disconnect();   // offline, the graph plays later: leave it connected
        return false;
      });
    }

    _schedule(inst, until) {
      const tr = inst.track, ev = tr.events;
      for (let guard = 0; guard < 100000; guard++) {
        const e = ev[inst.i], gs = inst.loop * tr.loopSteps + e.step;
        if (inst.pendingSpeed && gs >= inst.pendingSpeed.step) {   // tempo change, applied on its bar
          const p = inst.pendingSpeed;
          inst.t0 = this._timeOf(inst, p.step);
          inst.s0 = p.step;
          inst.speed = p.speed;
          inst.stepDur = 60 / (tr.bpm * p.speed) / this.song.spBeat;
          inst.pendingSpeed = null;
        }
        const t = this._timeOf(inst, gs);
        if (t >= until || t >= inst.endAt) return;
        // Skip notes that are already late (tab was in the background) and layers that are faded out
        if (t >= this.now() - 0.01 && !this.muted && t < inst.silentAfter[e.layer]) {
          this._play(e, t, inst.stepDur, inst.layers[e.layer]);
        }
        if (++inst.i >= ev.length) { inst.i = 0; inst.loop++; }
      }
    }

    _duckAt(t, amount, attack, hold, release) {
      const p = this.ducker.gain;
      rampTo(p, Math.min(amount, valueAt(p.__ev || [{ t: 0, v: p.value }], t)), t, attack);
      rampTo(p, 1, t + attack + hold, release);
    }

    _play(e, t, stepDur, dest) {
      const d = this.song.instruments[e.inst], dur = e.len * stepDur;
      if (d.kit) { for (const p of e.notes) this._drum(d.kit[p], t, e.vel * d.vol, dest); return; }
      this._voice(d, e.notes, t, dur, e.vel, dest, 0);
      if (d.echo) {  // chip echo: the same notes again, later and softer (like a second channel copying the first)
        const { steps = 3, vol = 0.35, repeats = 1, detune = 6 } = d.echo;
        for (let k = 1; k <= repeats; k++) this._voice(d, e.notes, t + k * steps * stepDur, dur, e.vel * Math.pow(vol, k), dest, detune * k);
      }
    }

    _voice(d, notes, t, dur, vel, dest, detune) {
      const ac = this.ac;
      const a = Math.max(0.002, d.attack);
      const tOff = t + Math.max(a + 0.005, dur * d.gate);
      const peak = d.vol * vel / (d.arp ? 1 : Math.sqrt(notes.length));
      const env = ac.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + a);
      env.gain.setTargetAtTime(peak * d.sustain, t + a, Math.max(0.005, d.decay / 3));
      env.gain.setTargetAtTime(0, tOff, Math.max(0.004, d.release / 5));
      const end = tOff + Math.max(0.03, d.release * 1.3);
      let node = env;
      if (d.pan) { const p = ac.createStereoPanner(); p.pan.value = d.pan; env.connect(p); node = p; }
      node.connect(dest);
      const freqs = d.arp && notes.length > 1 ? [notes] : notes.map(n => [n]);
      for (const group of freqs) {
        const osc = ac.createOscillator();
        if (d.wave === 'pulse') osc.setPeriodicWave(pulseWave(ac, d.duty)); else osc.type = d.wave;
        osc.detune.value = d.detune + detune;
        if (group.length > 1) {   // arpeggio: cycle the chord's notes fast, one oscillator (how chips play chords)
          let k = 0;
          for (let tt = t; tt < tOff; tt += d.arp) osc.frequency.setValueAtTime(hz(group[k++ % group.length]), tt);
        } else osc.frequency.value = hz(group[0]);
        if (d.vibrato && dur > (d.vibrato.delay ?? 0.15)) {
          const lfo = ac.createOscillator(), depth = ac.createGain(), vd = d.vibrato.delay ?? 0.15;
          lfo.frequency.value = d.vibrato.rate ?? 5.5;
          depth.gain.setValueAtTime(0, t);
          depth.gain.setValueAtTime(0, t + vd);
          depth.gain.linearRampToValueAtTime(d.vibrato.depth ?? 15, t + vd + 0.15);   // cents
          lfo.connect(depth).connect(osc.detune);
          lfo.start(t); lfo.stop(end);
        }
        osc.connect(env);
        osc.start(t);
        osc.stop(end);
      }
    }

    _drum(p, t, vol, dest) {
      const ac = this.ac;
      if (p.tone) {
        const osc = ac.createOscillator(), g = ac.createGain(), dur = p.toneDur ?? 0.1;
        osc.type = p.wave || 'triangle';
        osc.frequency.setValueAtTime(p.tone[0], t);
        osc.frequency.exponentialRampToValueAtTime(p.tone[1], t + dur);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * (p.toneVol ?? p.vol ?? 1), t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(dest);
        osc.start(t); osc.stop(t + dur + 0.01);
      }
      if (p.noise) {
        const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        src.buffer = noiseBuffer(ac);
        f.type = p.filter || 'highpass';
        f.frequency.value = p.freq || 5000;
        if (p.q) f.Q.value = p.q;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * (p.vol ?? 1), t + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, t + p.noise);
        src.connect(f).connect(g).connect(dest);
        src.start(t); src.stop(t + p.noise + 0.01);
      }
    }

    // ---- checking
    // A summary of the song (tracks, bars, seconds per loop); throws on any mistake in the song.
    static check(song) {
      const S = compile(song);
      const tracks = {};
      for (const [n, t] of Object.entries(S.tracks)) {
        tracks[n] = { bpm: t.bpm, bars: t.bars, loopSeconds: t.loopSteps * 60 / t.bpm / S.spBeat, layers: Object.keys(t.layers), notes: t.events.length };
      }
      return { tracks, states: Object.keys(S.states), stingers: Object.keys(S.stingers) };
    }

    // Render offline: start in `state`, then apply the timeline ([{ t, state } | { t, stinger } | { t, duck: {} } |
    // { t, volume } | { t, muted }]). Resolves to { buffer, log }. Works in any page with OfflineAudioContext.
    // solo: play only this layer (to measure the balance between layers).
    static async render(song, { state, seconds, sampleRate = 44100, timeline = [], volume = 1, channels = 2, solo = null } = {}) {
      const ac = new OfflineAudioContext(channels, Math.ceil(seconds * sampleRate), sampleRate);
      const m = new GameMusic(song, { ac, offline: true, volume });
      const events = [{ t: 0, state }, ...timeline].sort((a, b) => a.t - b.t);
      for (const e of events) {
        m._pump(e.t + m.ahead);
        m._t = e.t;
        if (e.state) m.setState(e.state, e);
        if (e.state && solo) for (const l of Object.keys(m.cur.layers)) m._fadeLayer(m.cur, l, l === solo ? 1 : 0, e.t, 0);
        if (e.stinger) m.stinger(e.stinger);
        if (e.duck) m.duck(e.duck === true ? {} : e.duck);
        if (e.volume !== undefined) m.setVolume(e.volume);
        if (e.muted !== undefined) m.setMuted(e.muted);
        if (e.stop) m.stop(e.fade ?? 0.5);
      }
      m._pump(seconds + 1);
      const buffer = await ac.startRendering();
      return { buffer, log: m.log };
    }
  }

  GameMusic.compile = compile;
  GameMusic.midiOf = midiOf;
  root.GameMusic = GameMusic;
  if (typeof module === 'object' && module.exports) module.exports = GameMusic;
})(typeof window !== 'undefined' ? window : globalThis);
