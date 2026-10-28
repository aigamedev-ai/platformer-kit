#!/usr/bin/env node
// render-music.mjs: render a music.js song to WAV in headless Chromium (muted) and check what you can't hear
// (part of the game-music skill).
//
//   node render-music.mjs <song.js|song.json> [options]
//     <song>             a .js file that defines the song (const SONG = {...}) or a .json file
//     --name SONG        the variable the .js file defines (default SONG)
//     --track NAME       render only this track (default: every track)
//     --loops N          loops per track (default 2)
//     --timeline "camp@0 explore@8 stinger:found@12 duck@14 chase@16 camp@24"
//                        instead of tracks, play this script of states and events (stinger:NAME, duck, mute,
//                        unmute, volume:V, stop) and check that each one changes the music when it should
//     --seconds S        length of the timeline render (default: last event + 8)
//     --volume V         music volume (default 1, the song as written)
//     --out DIR          where the files go (default ./music-renders)
//     --preview mp3|ogg|both|none   short listenable copies made with ffmpeg (default mp3)
//     --no-png           skip the waveform pictures
//     --no-layers        skip rendering each layer alone (balance check)
//     --ffmpeg PATH      ffmpeg to use (default: /usr/local/bin/ffmpeg if it exists, else ffmpeg on the PATH)
//     --music PATH       music.js to use (default: the one next to this script)
//
// For each render it writes NAME.wav (+ .mp3/.ogg, .png) and prints length, peak, RMS, loudness (LUFS, from ffmpeg),
// clipped samples, each layer's loudness alone, quiet bars, the loop seam (jump at each loop start compared with
// ordinary bar starts, and how much of one loop rings into the next), whether a second render matches (to -100 dB),
// and for a timeline, when each change was asked for, when the music actually changed, and how big the change is.
// results.json has everything.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const USAGE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(3, 26).map(l => l.replace(/^\/\/ ?/, '')).join('\n');

// ---------------------------------------------------------------- options
const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) { console.log(USAGE); process.exit(args.length ? 0 : 2); }
const opt = { name: 'SONG', loops: 2, layers: true, volume: 1, out: 'music-renders', preview: 'mp3', png: true, rate: 44100 };
let songFile = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i], v = () => args[++i];
  if (a === '--name') opt.name = v();
  else if (a === '--track') opt.track = v();
  else if (a === '--loops') opt.loops = Math.max(1, parseInt(v(), 10));
  else if (a === '--timeline') opt.timeline = v();
  else if (a === '--seconds') opt.seconds = parseFloat(v());
  else if (a === '--volume') opt.volume = parseFloat(v());
  else if (a === '--out') opt.out = v();
  else if (a === '--preview') opt.preview = v();
  else if (a === '--no-png') opt.png = false;
  else if (a === '--no-layers') opt.layers = false;
  else if (a === '--ffmpeg') opt.ffmpeg = v();
  else if (a === '--music') opt.music = v();
  else if (a === '--rate') opt.rate = parseInt(v(), 10);
  else if (a.startsWith('--')) { console.error(`Unknown option ${a}\n\n${USAGE}`); process.exit(2); }
  else songFile = a;
}
if (!songFile) { console.error(USAGE); process.exit(2); }
const FFMPEG = opt.ffmpeg || (fs.existsSync('/usr/local/bin/ffmpeg') ? '/usr/local/bin/ffmpeg' : 'ffmpeg');
const MUSIC_JS = fs.readFileSync(opt.music || path.join(HERE, 'music.js'), 'utf8');
fs.mkdirSync(opt.out, { recursive: true });

// ---------------------------------------------------------------- browser
async function loadPlaywright() {
  const tries = [() => import('playwright')];
  const fromDir = (dir) => () => import(pathToFileURL(createRequire(path.join(dir, 'x.js')).resolve('playwright')).href);
  tries.push(fromDir(process.cwd()));
  for (const p of (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)) tries.push(fromDir(p));
  tries.push(fromDir(path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules')));
  try { tries.push(fromDir(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim())); } catch { /* no npm */ }
  for (const t of tries) {
    try { const m = await t(); const pw = m.chromium ? m : m.default; if (pw && pw.chromium) return pw; } catch { /* next */ }
  }
  console.error('Playwright is not installed. In the game\'s folder run:\n\n  npm install --save-dev playwright\n  npx playwright install chromium\n');
  process.exit(3);
}

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: ['--mute-audio'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto('about:blank');
await page.addScriptTag({ content: MUSIC_JS });
const songSrc = fs.readFileSync(songFile, 'utf8');
if (songFile.endsWith('.json')) await page.evaluate(s => { window.__song = JSON.parse(s); }, songSrc);
else { await page.addScriptTag({ content: songSrc }); await page.evaluate(n => { window.__song = (0, eval)(n); }, opt.name); }
if (pageErrors.length) fail(pageErrors.join('\n'));

let summary;
try { summary = await page.evaluate(() => GameMusic.check(window.__song)); } catch (e) { fail(String(e.message).replace(/^.*?music: /, 'music: ')); }

// Render in the page; samples come back as base64 Float32 per channel
async function render(state, seconds, timeline = [], solo = null) {
  const res = await page.evaluate(async ({ state, seconds, timeline, volume, rate, solo }) => {
    const { buffer, log } = await GameMusic.render(window.__song, { state, seconds, timeline, volume, sampleRate: rate, solo });
    const enc = (f32) => {
      const u8 = new Uint8Array(f32.buffer);
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const ch = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) ch.push(enc(buffer.getChannelData(c)));
    return { ch, log, rate: buffer.sampleRate };
  }, { state, seconds, timeline, volume: opt.volume, rate: opt.rate, solo });
  const ch = res.ch.map(b => { const buf = Buffer.from(b, 'base64'); return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4); });
  return { ch, log: res.log, rate: res.rate };
}

// ---------------------------------------------------------------- measuring
const db = (x) => x > 0 ? 20 * Math.log10(x) : -Infinity;
const fmt = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '-inf';
function rms(ch, a, b) {
  let s = 0, n = 0;
  for (const c of ch) for (let i = Math.max(0, a); i < Math.min(c.length, b); i++) { s += c[i] * c[i]; n++; }
  return n ? Math.sqrt(s / n) : 0;
}
function peak(ch) { let p = 0; for (const c of ch) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > p) p = v; } return p; }
function jump(ch, at, half) {  // biggest sample-to-sample step near a time (a click shows up as a big step)
  let j = 0;
  for (const c of ch) for (let i = Math.max(1, at - half); i < Math.min(c.length, at + half); i++) j = Math.max(j, Math.abs(c[i] - c[i - 1]));
  return j;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
function diffRms(A, B, a, b) {
  let s = 0, n = 0;
  for (let c = 0; c < A.length; c++) for (let i = Math.max(0, a); i < Math.min(A[c].length, B[c].length, b); i++) { const d = A[c][i] - B[c][i]; s += d * d; n++; }
  return n ? Math.sqrt(s / n) : 0;
}
// Two renders of the same thing should match; Chromium's audio math can differ in the last bit (about -140 dB)
function same(A, B) {
  let d = 0;
  for (let c = 0; c < A.length; c++) { const x = A[c], y = B[c]; for (let i = 0; i < x.length; i++) d = Math.max(d, Math.abs(x[i] - y[i])); }
  return db(d) < -100;
}

function writeWav(file, ch, rate) {
  const n = ch[0].length, nc = ch.length, buf = Buffer.alloc(44 + n * nc * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * nc * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(nc, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * nc * 2, 28); buf.writeUInt16LE(nc * 2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36);
  buf.writeUInt32LE(n * nc * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, ch[c][i])) * 32767), o); o += 2; }
  fs.writeFileSync(file, buf);
}

function ffmpeg(argv) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-y', ...argv], { encoding: 'utf8' });
  if (r.error) return { ok: false, err: String(r.error) };
  return { ok: r.status === 0, err: r.stderr };
}
let warnedFfmpeg = false;
function loudness(wav) {
  const r = ffmpeg(['-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  if (!r.ok) { if (!warnedFfmpeg) console.error(`(ffmpeg not usable, no LUFS or previews: ${String(r.err).slice(0, 200)})`); warnedFfmpeg = true; return {}; }
  const sum = r.err.slice(r.err.lastIndexOf('Summary:'));
  const I = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(sum), TP = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(sum), LRA = /LRA:\s+([\d.]+) LU/.exec(sum);
  return { lufs: I ? parseFloat(I[1]) : null, truePeak: TP ? parseFloat(TP[1]) : null, lra: LRA ? parseFloat(LRA[1]) : null };
}
function extras(base, seconds, marks) {
  const wav = base + '.wav', made = [];
  if (opt.preview !== 'none') {
    if (opt.preview === 'mp3' || opt.preview === 'both') if (ffmpeg(['-i', wav, '-codec:a', 'libmp3lame', '-q:a', '4', base + '.mp3']).ok) made.push(base + '.mp3');
    if (opt.preview === 'ogg' || opt.preview === 'both') if (ffmpeg(['-i', wav, '-codec:a', 'libvorbis', '-q:a', '4', base + '.ogg']).ok) made.push(base + '.ogg');
  }
  if (opt.png) {
    const W = 1600, H = 300;
    const boxes = marks.map(m => `drawbox=x=${Math.round(m.t / seconds * W)}:y=0:w=2:h=ih:color=${m.color}@0.9:t=fill`);
    // Waveform (peaks, so loud and quiet parts show) over a spectrogram (each note is a line, the bass at the bottom)
    const fc = `[0:a]asplit[a][b];[a]showwavespic=s=${W}x${H}:colors=0x7aa2f7:filter=peak[w];` +
               `[b]showspectrumpic=s=${W}x400:legend=0:fscale=log:stop=6000[s];[w][s]vstack,${boxes.join(',') || 'null'}`;
    if (ffmpeg(['-i', wav, '-filter_complex', fc, '-frames:v', '1', base + '.png']).ok) made.push(base + '.png');
    else if (ffmpeg(['-i', wav, '-filter_complex', [`showwavespic=s=${W}x${H}:colors=0x7aa2f7:filter=peak`, ...boxes].join(','), '-frames:v', '1', base + '.png']).ok) made.push(base + '.png');
  }
  return made;
}

function measure(r, from, to) {  // whole-render numbers; from/to in s limit RMS to the music, not the tail
  const p = peak(r.ch);
  const R = rms(r.ch, Math.round(from * r.rate), Math.round(to * r.rate));
  let clipped = 0;
  for (const c of r.ch) for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) >= 0.999) clipped++;
  return { peakDb: db(p), rmsDb: db(R), clipped };
}

function fail(msg) { console.error(msg); browser?.close(); process.exit(1); }

// ---------------------------------------------------------------- tracks
const results = { song: songFile, volume: opt.volume, summary, renders: [] };
const songName = path.basename(songFile).replace(/\.(js|json)$/, '');
const spBar = await page.evaluate(() => { const S = GameMusic.compile(window.__song); return S.spBar; });

if (!opt.timeline) {
  const names = opt.track ? [opt.track] : Object.keys(summary.tracks);
  console.log(`${songFile}: ${names.length} track(s), volume ${opt.volume}\n`);
  for (const name of names) {
    const t = summary.tracks[name];
    if (!t) fail(`No track named ${name} (tracks: ${Object.keys(summary.tracks).join(', ')})`);
    const loopS = t.loopSeconds, seconds = loopS * opt.loops + 2;
    const r = await render(name, seconds);
    const again = await render(name, seconds);
    const base = path.join(opt.out, `${songName}-${name}`);
    writeWav(base + '.wav', r.ch, r.rate);
    const m = measure(r, 0, loopS * opt.loops);
    const L = loudness(base + '.wav');
    // Seam: loop starts compared with ordinary bar starts (both have notes starting on them)
    const barS = loopS / t.bars, half = Math.round(0.003 * r.rate);
    const barJumps = [], loopJumps = [];
    for (let b = 1; b < t.bars * opt.loops; b++) (b % t.bars ? barJumps : loopJumps).push(jump(r.ch, Math.round(b * barS * r.rate), half));
    const seamRatio = loopJumps.length ? Math.max(...loopJumps) / Math.max(1e-9, median(barJumps)) : null;
    const L1 = Math.round(loopS * r.rate), w = Math.round(0.25 * r.rate);
    const stepAt = (i) => db(rms(r.ch, i, i + w)) - db(rms(r.ch, i - w, i));
    const levelStep = loopJumps.length ? stepAt(L1) : null;
    const barSteps = [];
    for (let b = 1; b < t.bars; b++) barSteps.push(stepAt(Math.round(b * barS * r.rate)));
    const barStepMedian = median(barSteps);
    // How much of loop 1 rings on into loop 2 (what a single exported loop file would lose at its start)
    let tailDb = null;
    if (opt.loops >= 2) {
      const head = Math.round(Math.min(1, loopS) * r.rate);
      const A = r.ch.map(c => c.subarray(0, head)), B = r.ch.map(c => c.subarray(L1, L1 + head));
      tailDb = db(diffRms(B, A, 0, head)) - db(rms(B, 0, head));
    }
    // Quiet bars (an empty bar is usually a mistake in a pattern)
    const quiet = [];
    for (let b = 0; b < t.bars; b++) if (db(rms(r.ch, Math.round(b * barS * r.rate), Math.round((b + 1) * barS * r.rate))) < -50) quiet.push(b + 1);
    // Balance: each layer alone, one loop, loudness compared with the whole mix
    const layers = {};
    if (opt.layers && t.layers.length > 1) {
      const whole = loudness(base + '.wav').lufs;
      for (const l of t.layers) {
        const s = await render(name, loopS, [], l), f = `${base}.solo-${l}.wav`;
        writeWav(f, s.ch, s.rate);
        const ls = loudness(f);
        layers[l] = { lufs: ls.lufs, vsMix: ls.lufs - whole, peakDb: db(peak(s.ch)) };
        fs.unlinkSync(f);
      }
    }
    const marks = Array.from({ length: opt.loops + 1 }, (_, k) => ({ t: k * loopS, color: 'red' }));
    const files = [base + '.wav', ...extras(base, seconds, marks)];
    const row = { track: name, bpm: t.bpm, bars: t.bars, loopSeconds: loopS, seconds, ...m, ...L, seamRatio, levelStepDb: levelStep, barLevelStepDb: barStepMedian,
                  tailIntoNextLoopDb: tailDb, layers, quietBars: quiet, deterministic: same(r.ch, again.ch), files };
    results.renders.push(row);
    console.log(`${name}: ${t.bars} bars at ${t.bpm} BPM = ${fmt(loopS, 2)} s per loop, rendered ${opt.loops} loops`);
    console.log(`  peak ${fmt(m.peakDb)} dBFS (true peak ${fmt(L.truePeak)}), RMS ${fmt(m.rmsDb)} dBFS, loudness ${fmt(L.lufs)} LUFS, range ${fmt(L.lra)} LU, clipped samples ${m.clipped}`);
    console.log(`  seam: jump at loop start ${seamRatio === null ? '-' : fmt(seamRatio, 2) + 'x'} an ordinary bar start, level ${levelStep === null ? '-' : (levelStep >= 0 ? '+' : '') + fmt(levelStep) + ' dB'} across it (ordinary bar starts ${barStepMedian >= 0 ? '+' : ''}${fmt(barStepMedian)} dB); loop 1 rings into loop 2 at ${fmt(tailDb)} dB`);
    if (Object.keys(layers).length) console.log(`  layers alone: ${Object.entries(layers).map(([l, v]) => `${l} ${fmt(v.lufs)} LUFS (${fmt(v.vsMix)} vs mix)`).join(', ')}`);
    console.log(`  quiet bars: ${quiet.length ? quiet.join(', ') : 'none'}; second render matches: ${row.deterministic ? 'yes' : 'NO'}`);
    console.log(`  ${files.join('\n  ')}\n`);
  }
} else {
  // ---------------------------------------------------------------- timeline
  const events = [];
  let startState = null;
  for (const tok of opt.timeline.trim().split(/\s+/)) {
    const m = /^(.+)@([\d.]+)$/.exec(tok);
    if (!m) fail(`Cannot read "${tok}" in --timeline (write name@seconds)`);
    const what = m[1], t = parseFloat(m[2]);
    let e;
    if (what.startsWith('stinger:')) e = { t, stinger: what.slice(8) };
    else if (what === 'duck') e = { t, duck: true };
    else if (what === 'mute') e = { t, muted: true };
    else if (what === 'unmute') e = { t, muted: false };
    else if (what.startsWith('volume:')) e = { t, volume: parseFloat(what.slice(7)) };
    else if (what === 'stop') e = { t, stop: true };
    else e = { t, state: what };
    e.label = what;
    if (t === 0 && e.state && !startState) startState = e.state; else events.push(e);
  }
  if (!startState) fail('--timeline must start with a state at 0, e.g. "camp@0 explore@8"');
  events.sort((a, b) => a.t - b.t);
  const seconds = opt.seconds || (events.length ? events[events.length - 1].t : 0) + 8;
  const full = await render(startState, seconds, events);
  const again = await render(startState, seconds, events);
  const base = path.join(opt.out, `${songName}-timeline`);
  writeWav(base + '.wav', full.ch, full.rate);
  const m = measure(full, 0, seconds);
  const L = loudness(base + '.wav');
  console.log(`${songFile}: timeline, ${fmt(seconds, 1)} s, volume ${opt.volume}`);
  console.log(`  peak ${fmt(m.peakDb)} dBFS (true peak ${fmt(L.truePeak)}), RMS ${fmt(m.rmsDb)} dBFS, loudness ${fmt(L.lufs)} LUFS, clipped samples ${m.clipped}; second render matches: ${same(full.ch, again.ch) ? 'yes' : 'NO'}\n`);
  console.log('  event            asked at   music changed at   waited   before it   after it   ');
  const checks = [];
  const marks = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    // Render without this event (and everything after it): the difference is exactly what the event changed
    const prefix = await render(startState, Math.min(seconds, e.t + 8), events.slice(0, i));
    const rate = full.rate;
    const kind = e.stinger ? 'stinger' : e.duck ? 'duck' : e.muted !== undefined ? 'muted' : e.volume !== undefined ? 'volume' : e.stop ? 'stop' : null;
    const entries = full.log.filter(l => Math.abs(l.requested - e.t) < 1e-6 && (e.state ? l.state === e.state : l.type === kind));
    const entry = entries.find(l => l.type === 'track' || l.type === 'speed') || entries[0];
    const start = entries.length ? Math.max(...entries.map(l => l.start)) : e.t;
    const next = Math.min(i + 1 < events.length ? events[i + 1].t : seconds, start + 2);
    const [a0, a1, a2] = [e.t, start, next].map(x => Math.round(x * rate));
    const ref = Math.max(rms(full.ch, a1, a2), rms(prefix.ch, a1, a2), 1e-9);
    const before = a1 > a0 ? db(diffRms(full.ch, prefix.ch, a0, a1)) - db(ref) : -Infinity;
    const after = db(diffRms(full.ch, prefix.ch, a1, a2)) - db(ref);
    // A real change: clearly different afterwards; nothing changed before the bar/beat it waited for
    const changed = after > -30 && before < -60;
    checks.push({ event: e.label, asked: e.t, start, waited: start - e.t, type: entry?.type ?? null, beforeDb: before, afterDb: after, changed });
    marks.push({ t: e.t, color: 'yellow' }, { t: start, color: 'lime' });
    console.log(`  ${e.label.padEnd(16)} ${fmt(e.t, 2).padStart(7)} s  ${fmt(start, 2).padStart(10)} s  ${fmt(start - e.t, 2).padStart(8)} s  ${(fmt(before) + ' dB').padStart(9)}  ${(fmt(after) + ' dB').padStart(8)}   ${changed ? 'changed' : 'NO CHANGE'}`);
  }
  console.log('\n  before/after: how big the change is compared with the music (0 dB = all new, -inf = nothing changed)');
  const files = [base + '.wav', ...extras(base, seconds, marks)];
  results.renders.push({ timeline: opt.timeline, start: startState, seconds, ...m, ...L, deterministic: same(full.ch, again.ch), log: full.log, checks, files });
  console.log(`  ${files.join('\n  ')}  (picture: yellow = asked, green = changed)\n`);
  if (checks.some(c => !c.changed)) process.exitCode = 1;
}

fs.writeFileSync(path.join(opt.out, 'results.json'), JSON.stringify(results, null, 1));
if (pageErrors.length) { console.error('Errors in the page:\n' + pageErrors.join('\n')); process.exitCode = 1; }
await browser.close();
