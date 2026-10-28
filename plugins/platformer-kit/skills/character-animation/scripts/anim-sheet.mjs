#!/usr/bin/env node
// anim-sheet.mjs: film a game's hero through a scripted input sequence, frame by frame, in headless Chromium
// (muted), using the game's own drawing. Part of the character-animation skill.
//
//   node anim-sheet.mjs <game.html | URL> --seq "SEQUENCE" [options]
//
//   SEQUENCE  comma-separated steps KEYS:SECONDS. KEYS is none, or key names joined by +
//             (left, right, up, down, jump), e.g.
//             "none:1, right:0.7, right+jump:0.35, right:0.6, none:0.8, left:0.15, none:0.5"
//             A key held in two steps in a row stays down; a tap is a short step ("jump:0.05").
//   --out DIR       where to write (default ./anim-sheet)
//   --every N       one contact-sheet cell every N game frames (default 3: 20 cells per second)
//   --onion N       earlier cells drawn faintly behind each cell, at their real offset (default 2)
//   --wrap N        at most N cells per line of the contact sheet (default 16)
//   --cell WxH      cell size in canvas px around the hero's feet (default 96x80)
//   --scale K       contact sheet and clip scale, nearest neighbour (default 2)
//   --slow K        clip plays K times slower than the game (default 4; 1 = real speed)
//   --clip-every N  film every Nth game frame for the clip (default 1); --no-clip for the contact sheet only.
//                   Frames that aren't filmed skip drawing; a 5 s sequence takes under a minute with the clip
//                   and a few seconds with --no-clip.
//   --room N        play in room N (1-based, via window.__levels.goto) instead of window.__anim.stage()
//   --keys MAP      key bindings, e.g. jump=KeyZ,left=KeyA (defaults: arrows, jump=Space)
//   --warmup S      seconds of game time before the sequence (default 5; Phaser smooths its delta for ~2 s)
//   --compare FILE  frames.json from an earlier run: report whether the body moved identically
//   --ffmpeg PATH   ffmpeg binary (default: $FFMPEG, /usr/local/bin/ffmpeg, then ffmpeg on PATH)
//
// Writes DIR/contact.png (one row per step, hero isolated on a flat background with onion skin, the drawn frame's
// name under each cell), DIR/clip.mp4 and DIR/clip.gif (the area the hero moved through, slowed down),
// DIR/frames.json (per game frame: hero state, drawn frame, position, and the body from __levels.state()).
//
// The game needs a small hook (references/checking.md):
//   window.__anim = {
//     stage(),          // optional: load a plain test room and put the hero on the floor
//     hero(),           // -> { x, y, state, frame, flip }: x = centre, y = feet, in CANVAS px
//     solo(on),         // optional: true = draw only the hero and its secondary parts on #ff00ff; false = undo
//     render(),         // optional: redraw the current frame without advancing time (needed with solo)
//   };
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execSync, execFileSync } from 'node:child_process';

const USAGE = (() => { const l = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
  return l.slice(0, l.findIndex(x => !x.startsWith('//'))).map(x => x.replace(/^\/\/ ?/, '')).join('\n'); })();
const die = (m) => { console.error(m); process.exit(2); };

function parseArgs(argv) {
  const a = { out: 'anim-sheet', every: 3, onion: 2, wrap: 16, cell: [96, 80], scale: 2, slow: 4, clipEvery: 1, clip: true, warmup: 5, keys: {} };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => { if (i + 1 >= argv.length) die(`${k} needs a value`); return argv[++i]; };
    if (k === '--seq') a.seq = v();
    else if (k === '--out') a.out = v();
    else if (k === '--every') a.every = Math.max(1, +v() | 0);
    else if (k === '--onion') a.onion = Math.max(0, +v() | 0);
    else if (k === '--wrap') a.wrap = Math.max(1, +v() | 0);
    else if (k === '--cell') { a.cell = v().split('x').map(Number); if (a.cell.length !== 2 || a.cell.some(n => !(n > 0))) die('--cell is WxH, e.g. 96x80'); }
    else if (k === '--scale') a.scale = Math.max(1, +v() | 0);
    else if (k === '--slow') a.slow = Math.max(1, +v());
    else if (k === '--clip-every') a.clipEvery = Math.max(1, +v() | 0);
    else if (k === '--no-clip') a.clip = false;
    else if (k === '--room') a.room = +v();
    else if (k === '--warmup') a.warmup = Math.max(0, +v());
    else if (k === '--compare') a.compare = v();
    else if (k === '--ffmpeg') a.ffmpeg = v();
    else if (k === '--keys') for (const kv of v().split(',')) { const [n, c] = kv.split('='); a.keys[n.trim()] = c.trim(); }
    else if (k === '-h' || k === '--help') { console.log(USAGE); process.exit(0); }
    else if (k.startsWith('--')) die(`unknown option ${k}\n\n${USAGE}`);
    else pos.push(k);
  }
  if (!pos[0] || !a.seq) { console.log(USAGE); process.exit(2); }
  a.game = pos[0];
  return a;
}

// "none:1, right:0.6, right+jump:0.3" -> [{ label, keys: ['right', 'jump'], frames }]
function parseSeq(s) {
  return s.split(',').map(t => t.trim()).filter(Boolean).map(t => {
    const m = /^([a-z+]+)\s*:\s*([\d.]+)$/i.exec(t);
    if (!m) die(`bad step "${t}": use KEYS:SECONDS, e.g. right+jump:0.3`);
    const keys = m[1].toLowerCase() === 'none' ? [] : m[1].toLowerCase().split('+');
    return { label: t, keys, frames: Math.max(1, Math.round(+m[2] * 60)) };
  });
}

const KEYS = {
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }, right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }, down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  jump: { key: ' ', code: 'Space', keyCode: 32 },
};
function keyFromCode(code) {
  if (/^Key[A-Z]$/.test(code)) return { key: code[3].toLowerCase(), code, keyCode: code.charCodeAt(3) };
  if (/^Digit\d$/.test(code)) return { key: code[5], code, keyCode: code.charCodeAt(5) };
  const named = { Space: [' ', 32], Enter: ['Enter', 13], ShiftLeft: ['Shift', 16], ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38],
    ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40], KeyX: ['x', 88] }[code];
  if (!named) die(`unknown key code ${code} (use KeyA..KeyZ, Digit0..9, Space, Enter, ShiftLeft or Arrow*)`);
  return { key: named[0], code, keyCode: named[1] };
}

// ---------------------------------------------------------------- virtual clock (runs in the page before its scripts)
// The same fixed 1/60 s clock as platformer-levels' measure-difficulty.mjs, so a run is repeatable frame by frame.
function virtualClock() {
  if (window.__vclock) return;
  const realSetTimeout = window.setTimeout.bind(window);
  const FRAME = Math.ceil(1000 / 60 * 2 ** 25) / 2 ** 25;
  const dateBase = Date.now();
  let now = 0, nextId = 1, frameNo = 0;
  const timers = new Map(), rafs = new Map();
  const add = (fn, ms, args, repeat) => { const id = nextId++; const d = Math.max(0, +ms || 0);
    timers.set(id, { at: now + d, fn, args, every: repeat ? Math.max(1, d) : 0 }); return id; };
  window.setTimeout = (fn, ms, ...args) => add(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => add(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (cb) => { const id = nextId++; rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };
  performance.now = () => now;
  Date.now = () => dateBase + Math.floor(now);
  const call = (fn, args) => { try { typeof fn === 'function' ? fn(...args) : (0, eval)(String(fn)); } catch (e) { realSetTimeout(() => { throw e; }, 0); } };
  const frame = () => {
    now = ++frameNo * FRAME;
    for (let guard = 0; guard < 10000; guard++) {
      let best = null, bestId = 0;
      for (const [id, t] of timers) if (t.at <= now && (!best || t.at < best.at || (t.at === best.at && id < bestId))) { best = t; bestId = id; }
      if (!best) break;
      if (best.every) best.at += best.every; else timers.delete(bestId);
      call(best.fn, best.args || []);
    }
    const cbs = [...rafs.values()];
    rafs.clear();
    for (const cb of cbs) call(cb, [now]);
  };
  const clock = window.__vclock = { frame, manual: false, draw: true, now: () => now };
  // On frames nobody films, skip WebGL drawing (software rendering is the slow part). Texture uploads still run.
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    for (const m of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear']) {
      const orig = C.prototype[m];
      if (orig) C.prototype[m] = function (...args) { if (!clock.manual || clock.draw) return orig.apply(this, args); };
    }
  }
  const pump = () => { if (!clock.manual) { frame(); realSetTimeout(pump, 4); } };
  realSetTimeout(pump, 0);
}

// ---------------------------------------------------------------- in-page helpers (stringified into the page)
function pageHelpers() {
  const A = window.__anim, clock = window.__vclock;
  const canvas = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const held = new Map();
  const send = (k, down) => {
    const e = new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k.key, code: k.code, bubbles: true, cancelable: true });
    Object.defineProperty(e, 'keyCode', { get: () => k.keyCode });
    Object.defineProperty(e, 'which', { get: () => k.keyCode });
    (document.activeElement || document.body || document).dispatchEvent(e);
  };
  const grab = (x, y, w, h, key) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(canvas, -x, -y);
    if (key) {     // #ff00ff -> transparent
      const d = g.getImageData(0, 0, w, h), p = d.data;
      for (let i = 0; i < p.length; i += 4) if (p[i] > 200 && p[i + 1] < 60 && p[i + 2] > 200) p[i + 3] = 0;
      g.putImageData(d, 0, 0);
    }
    return c.toDataURL('image/png');
  };
  window.__animRun = {
    canvasSize: () => [canvas.width, canvas.height],
    warm(frames) { clock.manual = true; clock.draw = false; for (let i = 0; i < frames; i++) clock.frame(); },
    setKeys(want) {           // want: [{key, code, keyCode}]
      const codes = new Set(want.map(k => k.code));
      for (const [code, k] of held) if (!codes.has(code)) { send(k, false); held.delete(code); }
      for (const k of want) if (!held.has(k.code)) { send(k, true); held.set(k.code, k); }
    },
    // one game frame: advance, read the hero; if filmed, grab the whole canvas (clip) and/or the hero's cell,
    // alone on a key colour when the game has solo()/render()
    step(cell, wantCell, wantFull) {
      const solo = !!(A.solo && A.render);
      clock.draw = wantFull || (wantCell && !solo);   // a solo cell is drawn on its own below
      clock.frame();
      const h = A.hero();
      const body = window.__levels?.state ? window.__levels.state() : null;
      const full = wantFull ? grab(0, 0, canvas.width, canvas.height, false) : null;
      let cellImg = null;
      if (wantCell) {
        const cx = Math.round(h.x - cell[0] / 2), cy = Math.round(h.y - cell[1] * 0.7);
        clock.draw = true;
        if (solo) { A.solo(true); A.render(); }
        cellImg = { x: cx, y: cy, url: grab(cx, cy, cell[0], cell[1], solo) };
        if (solo) A.solo(false);
      }
      clock.draw = false;
      return { hero: h, body, full, cell: cellImg };
    },
  };
  return !!(A.solo && A.render);
}

// ---------------------------------------------------------------- browser
async function loadPlaywright() {
  const tries = [() => import('playwright')];
  const fromDir = (dir) => () => import(pathToFileURL(createRequire(path.join(dir, 'x.js')).resolve('playwright')).href);
  tries.push(fromDir(process.cwd()));
  for (const p of (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)) tries.push(fromDir(p));
  try { tries.push(fromDir(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim())); } catch { /* no npm */ }
  for (const t of tries) {
    try { const m = await t(); const pw = m.chromium ? m : m.default; if (pw && pw.chromium) return pw; } catch { /* next */ }
  }
  die('Playwright is not installed. In the game\'s folder run:\n  npm install --save-dev playwright\n  npx playwright install chromium');
}

function serveFolder(file) {
  const root = path.dirname(file);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.readFile(fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p, (err, buf) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': types[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/${encodeURIComponent(path.basename(file))}` })));
}

function findFfmpeg(given) {
  for (const c of [given, process.env.FFMPEG, '/usr/local/bin/ffmpeg', 'ffmpeg'].filter(Boolean)) {
    try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c; } catch { /* next */ }
  }
  return null;
}

// ---------------------------------------------------------------- contact sheet (drawn in the browser)
async function contactSheet(page, rows, A, outFile) {
  const html = `<body style="margin:0;background:#11131c"><canvas id=c></canvas></body>`;
  await page.setContent(html);
  const png = await page.evaluate(async ({ rows, every, cell, scale, onion, wrap }) => {
    const load = (url) => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = url; });
    const W = cell[0] * scale, H = cell[1] * scale, label = 150, gap = 6, textH = 14;
    const cols = Math.min(wrap, Math.max(...rows.map(r => r.cells.length), 1));
    const lines = rows.reduce((n, r) => n + Math.max(1, Math.ceil(r.cells.length / wrap)), 0);
    const c = document.getElementById('c');
    c.width = label + cols * (W + gap) + gap; c.height = lines * (H + textH + gap) + gap + 22;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#11131c'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#c9d1e6'; g.font = '12px sans-serif';
    g.fillText(`one cell every ${every} game frames (${Math.round(1000 * every / 60)} ms); faint copies = the ${onion} cells before, at their real offset; line = feet`, gap, 15);
    let y = 22 + gap;
    for (const r of rows) {
      g.fillStyle = '#c9d1e6'; g.font = '12px sans-serif';
      g.fillText(r.label, gap, y + 14);
      g.fillStyle = '#7f88a6'; g.font = '10px sans-serif';
      g.fillText(`frames ${r.from}-${r.to}`, gap, y + 28);
      const imgs = await Promise.all(r.cells.map(k => load(k.url)));
      for (let i = 0; i < r.cells.length; i++) {
        if (i && i % wrap === 0) y += H + textH + gap;
        const k = r.cells[i], x = label + (i % wrap) * (W + gap);
        g.fillStyle = '#1d2133'; g.fillRect(x, y, W, H);
        g.save(); g.beginPath(); g.rect(x, y, W, H); g.clip();
        for (let j = Math.min(onion, i); j >= 1; j--) {        // earlier cells, faint, at their real offset
          const p = r.cells[i - j];
          g.globalAlpha = 0.45 / (j + 1);
          g.drawImage(imgs[i - j], x + (p.x - k.x) * scale, y + (p.y - k.y) * scale, W, H);
        }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(201,209,230,0.35)';
        g.fillRect(x, y + (k.feetY - k.y) * scale, W, 1);
        g.drawImage(imgs[i], x, y, W, H);
        g.restore();
        g.fillStyle = '#9aa4c0'; g.font = '10px sans-serif';
        g.fillText(`${k.f} ${k.frame ?? ''}`, x + 2, y + H + 11);
      }
      y += H + textH + gap;
    }
    return c.toDataURL('image/png');
  }, { rows, every: A.every, cell: A.cell, scale: A.scale, onion: A.onion, wrap: A.wrap });
  fs.writeFileSync(outFile, Buffer.from(png.split(',')[1], 'base64'));
}

// ---------------------------------------------------------------- main
const A = parseArgs(process.argv.slice(2));
const steps = parseSeq(A.seq);
const keyMap = { ...KEYS };
for (const [n, c] of Object.entries(A.keys)) keyMap[n] = keyFromCode(c);
for (const s of steps) for (const k of s.keys) if (!keyMap[k]) die(`unknown key "${k}" in "${s.label}" (left, right, up, down, jump, or set it with --keys ${k}=KeyX)`);
const out = path.resolve(A.out);
fs.mkdirSync(out, { recursive: true });
const framesDir = path.join(out, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir);

const pw = await loadPlaywright();
let server = null, url = A.game;
if (!/^https?:/.test(A.game)) {
  const file = path.resolve(A.game);
  if (!fs.existsSync(file)) die(`no such file: ${file}`);
  ({ server, url } = await serveFolder(file));
}
const browser = await pw.chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = new Set();
try {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await ctx.addInitScript(`(${virtualClock.toString()})()`);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.add(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.add(m.text()); });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  const t0 = Date.now();
  while (!(await page.evaluate(() => !!(window.__anim && typeof window.__anim.hero === 'function')))) {
    if (Date.now() - t0 > 30000) die('window.__anim.hero() was not found 30 s after the page loaded. Add the hook (references/checking.md).' +
      (errors.size ? '\nPage errors:\n  ' + [...errors].join('\n  ') : ''));
    await new Promise(r => setTimeout(r, 100));
  }
  const canSolo = await page.evaluate(`(${pageHelpers.toString()})()`);
  if (!canSolo) console.error('note: no __anim.solo()/render(), so cells show the scene behind the hero and onion skin is off');
  await page.evaluate(({ warm, room }) => {
    window.__animRun.warm(warm);
    if (room) window.__levels.goto(room - 1); else if (window.__anim.stage) window.__anim.stage(); else window.__levels?.goto(0);
    window.__animRun.warm(30);    // settle on the floor
  }, { warm: Math.round(A.warmup * 60), room: A.room });

  const frames = [], rows = [];
  let f = 0, filmed = 0;
  for (const s of steps) {
    await page.evaluate((keys) => window.__animRun.setKeys(keys), s.keys.map(k => keyMap[k]));
    const row = { label: s.label, from: f, to: f + s.frames - 1, cells: [] };
    for (let i = 0; i < s.frames; i++, f++) {
      const wantCell = f % A.every === 0, wantFull = A.clip && f % A.clipEvery === 0;
      const r = await page.evaluate(({ cell, wantCell, wantFull }) => window.__animRun.step(cell, wantCell, wantFull),
        { cell: A.cell, wantCell, wantFull });
      if (r.full) fs.writeFileSync(path.join(framesDir, `f${String(filmed++).padStart(5, '0')}.png`), Buffer.from(r.full.split(',')[1], 'base64'));
      frames.push({ f, step: s.label, keys: s.keys, hero: r.hero, body: r.body });
      if (wantCell) row.cells.push({ f, x: r.cell.x, y: r.cell.y, url: r.cell.url, feetY: r.hero.y, frame: r.hero.frame });
    }
    rows.push(row);
  }
  await page.evaluate(() => window.__animRun.setKeys([]));
  const [cw, ch] = await page.evaluate(() => window.__animRun.canvasSize());

  if (!canSolo) A.onion = 0;
  fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify({ game: A.game, seq: A.seq, frames }, null, 0).replace(/},{"f"/g, '},\n{"f"'));
  await contactSheet(page, rows, A, path.join(out, 'contact.png'));

  // clip: the area the hero moved through, with a margin, slowed down
  const xs = frames.map(fr => fr.hero.x), ys = frames.map(fr => fr.hero.y);
  const pad = 48;
  let x0 = Math.max(0, Math.floor(Math.min(...xs) - pad)), x1 = Math.min(cw, Math.ceil(Math.max(...xs) + pad));
  let y0 = Math.max(0, Math.floor(Math.min(...ys) - pad - 40)), y1 = Math.min(ch, Math.ceil(Math.max(...ys) + pad / 2));
  if ((x1 - x0) % 2) x1--;              // even sizes for yuv420p
  if ((y1 - y0) % 2) y1--;
  const ff = A.clip ? findFfmpeg(A.ffmpeg) : null;
  if (A.clip && !ff) console.error('ffmpeg not found: no clip.mp4 / clip.gif (the frames are in frames/)');
  if (ff) {
    const fps = 60 / A.slow / A.clipEvery;
    const crop = `crop=${x1 - x0}:${y1 - y0}:${x0}:${y0},scale=iw*${A.scale}:ih*${A.scale}:flags=neighbor`;
    const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(framesDir, 'f%05d.png')];
    execFileSync(ff, [...input, '-vf', `${crop},format=yuv420p`, '-c:v', 'libx264', '-crf', '12', '-preset', 'veryfast', path.join(out, 'clip.mp4')]);
    const gfps = Math.min(fps, 25);
    execFileSync(ff, [...input, '-vf', `fps=${gfps},${crop},split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none`, path.join(out, 'clip.gif')]);
  }

  const states = {};
  for (const fr of frames) states[fr.hero.state] = (states[fr.hero.state] || 0) + 1;
  console.log(`${frames.length} frames (${(frames.length / 60).toFixed(2)} s of game time), ${rows.reduce((n, r) => n + r.cells.length, 0)} cells`);
  console.log('frames per state: ' + Object.entries(states).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log(`wrote ${path.join(out, 'contact.png')}${ff ? ', clip.mp4, clip.gif' : ''}, frames.json${A.clip ? ' and frames/' : ''}`);

  if (A.compare) {
    const old = JSON.parse(fs.readFileSync(A.compare, 'utf8')).frames;
    const n = Math.min(old.length, frames.length);
    let first = -1;
    for (let i = 0; i < n && first < 0; i++) if (JSON.stringify(old[i].body) !== JSON.stringify(frames[i].body)) first = i;
    if (old.length !== frames.length) console.log(`compare: different lengths (${old.length} vs ${frames.length} frames)`);
    if (!frames[0].body) console.log('compare: no __levels.state() in this game, nothing to compare');
    else if (first < 0) console.log(`compare: body identical in all ${n} frames`);
    else { console.log(`compare: body DIFFERS from frame ${first}:\n  before ${JSON.stringify(old[first].body)}\n  after  ${JSON.stringify(frames[first].body)}`); process.exitCode = 1; }
  }
  if (errors.size) { console.log('page errors:\n  ' + [...errors].join('\n  ')); process.exitCode = process.exitCode || 1; }
} finally {
  await browser.close();
  server?.close();
}
