#!/usr/bin/env node
// measure-difficulty.mjs: simulated players for a browser platformer (part of the platformer-levels skill).
//
// Plays each room's scripted route many times in headless Chromium with a Gaussian timing error on every press
// and release, for a new, an average and a skilled player and for "the player who has reached this room".
// The game runs on a virtual clock in fixed 1/60 s steps, as fast as the machine allows. How to add the hook
// and write routes: references/measuring.md.
//
//   node measure-difficulty.mjs <game> <routes> [options]
//     <game>            path to the game's .html (served over http from its folder) or an http(s) URL
//     <routes>          routes file (.json, or .mjs/.js with a default export)
//     --check           play each route once with no timing error and report (fast; do this first)
//     --runs N          attempts per room per player (default 50)
//     --sigmas A,B,C    timing error in seconds of the new, average and skilled player (default 0.10,0.05,0.02)
//     --rooms LIST      only these rooms: numbers as in the table (1-based) or ids, e.g. 3,5-7 or pit-run
//     --model full|simple
//                       full (default): reaction delay on "react" steps, more error when inputs come close
//                       together or switch keys, and errors that carry over from one input to the next.
//                       simple: independent errors of the same size on every press and release.
//                       Full-model numbers are starting guesses; tune them with real players:
//                       --react-new 0.30 --react-avg 0.22 --react-skilled 0.18 (mean delay, s, by player)
//                       --react-spread 0.25 --react-min 0.1 --load-gap 0.2 --load-gain 0.5 --switch-gain 1.25 --rho 0.5
//     --skill-start S, --skill-end S, --skill-rooms R
//                       the player who has reached a room: timing error S(n) = end + (start - end) * exp(-n / R)
//                       after n rooms played (optional rooms not counted); defaults 0.10, 0.05, 12
//     --seed N          random seed (default 1); the same draws are used for every player
//     --seeds 1,2       measure with each seed and show both; "near edge" when they disagree on the verdict
//     --shots DIR       save a picture of each room at its start and halfway through its route, then stop;
//                       a room the route crosses by more than a view width also gets -end (and -mid1, -mid2, ...)
//     --playthrough     play every route in a row from room 1 through each exit to the end, then stop
//                       (needs state().room and state().finished in the hook)
//     --out DIR         where to write results.json, table.txt and report.html (default ./difficulty-report)
//     --workers N       browser pages in parallel (default: one per CPU core, at most 4)
//     --timeout S       an attempt fails after S seconds of game time (default 20)
//     --trace ROOM      play one room's route once and print the player's state and each step, frame by frame
//                       (no timing error; add --sigma S to use the first measured attempt at that error)
//     --tune            first move each trigger (x/y positions, "after" times) to the value the new player passes
//                       most often, write routes.tuned.json to --out and measure with it (slower)
//   A chase (a hazard that moves on a fixed schedule): state() also returns ahead (px from the player to the
//   hazard's front, positive while safe) and hazardSpeed (px/s, 0 while it waits). Every mode then reports the
//   margin: the fewest seconds the route stays ahead of the hazard. Rooms with kind 'rest' must pass for every
//   player; kind 'chase' gets a 60-90% target and margin checks; kind 'optional' is the same as beat 'optional'.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const FPS = 60;
const USAGE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(6, 42).map(l => l.replace(/^\/\/ ?/, '')).join('\n');

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const a = { runs: 50, sigmas: [0.10, 0.05, 0.02], model: 'full', reactNew: 0.30, reactAvg: 0.22, reactSkilled: 0.18, reactSpread: 0.25,
    reactMin: 0.1, loadGap: 0.2, loadGain: 0.5, switchGain: 1.25, rho: 0.5, skillStart: 0.10, skillEnd: 0.05, skillRooms: 12, seed: 1, out: 'difficulty-report', timeout: 20, check: false,
    workers: Math.max(1, Math.min(4, os.cpus().length)) };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => { if (i + 1 >= argv.length) die(`${k} needs a value`); return argv[++i]; };
    if (k === '--check') a.check = true;
    else if (k === '--runs') a.runs = posInt(v(), k);
    else if (k === '--sigmas') { a.sigmas = v().split(',').map(Number); if (a.sigmas.length !== 3 || a.sigmas.some(s => !(s > 0))) die('--sigmas needs three positive numbers: new,average,skilled'); }
    else if (k === '--rooms') a.rooms = v();
    else if (k === '--model') { a.model = v(); if (!['full', 'simple'].includes(a.model)) die('--model is full or simple'); }
    else if (k === '--react-new') a.reactNew = posNum(v(), k);
    else if (k === '--react-avg') a.reactAvg = posNum(v(), k);
    else if (k === '--react-skilled') a.reactSkilled = posNum(v(), k);
    else if (k === '--react-spread') a.reactSpread = nonNeg(v(), k);
    else if (k === '--react-min') a.reactMin = nonNeg(v(), k);
    else if (k === '--load-gap') a.loadGap = posNum(v(), k);
    else if (k === '--load-gain') a.loadGain = nonNeg(v(), k);
    else if (k === '--switch-gain') a.switchGain = posNum(v(), k);
    else if (k === '--rho') { a.rho = +v(); if (!(a.rho >= 0 && a.rho < 1)) die('--rho is between 0 and 1'); }
    else if (k === '--skill-start') a.skillStart = posNum(v(), k);
    else if (k === '--skill-end') a.skillEnd = posNum(v(), k);
    else if (k === '--skill-rooms') a.skillRooms = posNum(v(), k);
    else if (k === '--seed') a.seed = Math.trunc(+v());
    else if (k === '--seeds') { a.seeds = v().split(',').map(x => Math.trunc(+x)); if (a.seeds.some(x => !Number.isFinite(x))) die('--seeds needs a list of numbers, e.g. 1,2'); }
    else if (k === '--shots') a.shots = v();
    else if (k === '--playthrough') a.playthrough = true;
    else if (k === '--out') a.out = v();
    else if (k === '--workers') a.workers = posInt(v(), k);
    else if (k === '--timeout') a.timeout = +v();
    else if (k === '--tune') a.tune = true;
    else if (k === '--trace') a.trace = v();
    else if (k === '--sigma') { a.sigma = +v(); if (!(a.sigma >= 0)) die('--sigma needs a number of seconds'); }
    else if (k === '-h' || k === '--help') { console.log(USAGE); process.exit(0); }
    else if (k.startsWith('--')) die(`unknown option ${k}\n\n${USAGE}`);
    else pos.push(k);
  }
  if (pos.length !== 2) die(USAGE);
  [a.game, a.routes] = pos;
  return a;
}
function nonNeg(s, k) { const n = +s; if (!(n >= 0)) die(`${k} needs a number, 0 or more`); return n; }
function posNum(s, k) { const n = +s; if (!(n > 0)) die(`${k} needs a positive number`); return n; }
function posInt(s, k) { const n = Math.trunc(+s); if (!(n > 0)) die(`${k} needs a positive number`); return n; }
function die(msg) { console.error(msg); process.exit(2); }

// ---------------------------------------------------------------- routes
// A route is a list of steps. Each step has a moment; its key event (if any) fires at that moment plus the
// player's timing error. Fields: press | release: key name; when: condition; after: seconds.
//   no when/after: same moment as the previous step (the room start for the first step)
//   when: the first moment the condition holds, checked from the previous step's moment on
//   after: that many seconds after the previous step's moment (or after the `when` moment, if both)
// Steps at the very start (before any when/after) and steps without a key get no timing error.
const KEY_ALIASES = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Space' };
const NAMED = ['land', 'apex', 'falling'];
const CMP = /^(x|y|vx|vy)(>=|<=)$/;

function keyInfo(code) {
  const m = { ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40],
    Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9],
    ShiftLeft: ['Shift', 16], ShiftRight: ['Shift', 16], ControlLeft: ['Control', 17], ControlRight: ['Control', 17], AltLeft: ['Alt', 18] };
  if (m[code]) return { code, key: m[code][0], keyCode: m[code][1] };
  let r = /^Key([A-Z])$/.exec(code); if (r) return { code, key: r[1].toLowerCase(), keyCode: r[1].charCodeAt(0) };
  r = /^Digit([0-9])$/.exec(code); if (r) return { code, key: r[1], keyCode: 48 + +r[1] };
  return null;
}

async function loadRoutes(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) die(`routes file not found: ${abs}`);
  let data;
  if (/\.json$/i.test(abs)) {
    try { data = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { die(`${file}: ${e.message}`); }
  } else data = (await import(pathToFileURL(abs).href + '?t=' + Date.now())).default;
  if (!data || typeof data.rooms !== 'object') die(`${file}: expected { "keys": {...}, "rooms": { "<room id>": [steps] } }`);
  const keys = { ...KEY_ALIASES, ...(data.keys || {}) };
  const compiled = {};
  for (const [id, steps] of Object.entries(data.rooms)) compiled[id] = compileRoute(id, steps, keys);
  return { keys, keysRaw: data.keys || {}, rooms: compiled, raw: data.rooms };
}

function compileRoute(id, steps, keys) {
  const bad = (i, msg) => die(`route "${id}", step ${i + 1}: ${msg}\n  ${JSON.stringify(steps[i])}`);
  if (!Array.isArray(steps) || !steps.length) die(`route "${id}" must be a non-empty list of steps`);
  let started = false;
  return steps.map((s, i) => {
    if (typeof s !== 'object' || !s) bad(i, 'each step is an object such as {"press": "right"}');
    for (const k of Object.keys(s)) if (!['press', 'release', 'when', 'after', 'react', 'note'].includes(k)) bad(i, `unknown field "${k}"`);
    if (s.press !== undefined && s.release !== undefined) bad(i, 'use either press or release, not both');
    const name = s.press ?? s.release ?? null;
    let key = null;
    if (name !== null) {
      const code = keys[name] || name;
      key = keyInfo(code);
      if (!key) bad(i, `unknown key "${name}" (use left/right/up/down/jump, a name from "keys", or a KeyboardEvent code like "KeyZ")`);
      key.jump = code === keys.jump;
      key.dir = code === keys.left ? 'L' : code === keys.right ? 'R' : null;
    }
    let when = null;
    if (s.when !== undefined) {
      if (typeof s.when === 'string') { if (!NAMED.includes(s.when)) bad(i, `unknown condition "${s.when}" (use ${NAMED.join(', ')} or {"x>=": 200})`); when = { name: s.when }; }
      else if (typeof s.when === 'object' && s.when && Object.keys(s.when).length === 1) {
        const [k, v] = Object.entries(s.when)[0], m = CMP.exec(k);
        if (!m || typeof v !== 'number') bad(i, `bad condition (use e.g. {"x>=": 200}, {"x<=": 90}, {"y<=": 150}, {"vy<=": -700})`);
        when = { field: m[1], op: m[2], value: v };
      } else bad(i, 'bad condition');
    }
    let after = 0;
    if (s.after !== undefined) { if (typeof s.after !== 'number' || s.after < 0) bad(i, '"after" is a number of seconds, 0 or more'); after = Math.round(s.after * FPS); }
    if (when || s.after !== undefined) started = true;
    if (s.react !== undefined && typeof s.react !== 'boolean') bad(i, '"react" is true or false');
    if (s.react && (!key || !started)) bad(i, '"react" needs a key step after the start (it responds to something happening in the room)');
    return { key, down: s.press !== undefined, when, after, react: !!s.react, exact: !started || !key, text: stepText(s, i) + (s.react ? ' (reaction)' : '') };
  }).map((st, k, all) => {
    let j = k - 1;
    while (j >= 0 && !(all[j].key && all[j].key.jump && all[j].down)) j--;
    return { ...st, lastJump: j };
  });
}
function stepText(s, i) {
  const what = s.press !== undefined ? `press ${s.press}` : s.release !== undefined ? `release ${s.release}` : 'wait';
  const w = s.when === undefined ? '' : typeof s.when === 'string' ? ` on ${s.when}` : ' when ' + Object.entries(s.when).map(([k, v]) => k + ' ' + v).join('');
  const sec = s.after !== undefined ? `${+s.after.toFixed(3)} s` : '';
  if (w) return what + w + (sec ? `, then ${sec}` : '');
  if (sec) return `${what} ${sec} after step ${i}`;
  return i ? `${what} with step ${i}` : `${what} at the start`;
}

// ---------------------------------------------------------------- virtual clock (runs in the page before its scripts)
function virtualClock() {
  if (window.__vclock) return;
  const realSetTimeout = window.setTimeout.bind(window);
  // One frame = 1/60 s, rounded up to a multiple of 2^-25 ms: every frame time is then exact in floating point and
  // every delta the game sees is identical, so fixed-step accumulators (Phaser Arcade, most hand-written loops) take
  // exactly one step per frame instead of now and then 0 or 2 depending on how long the page has been running.
  const FRAME = Math.ceil(1000 / 60 * 2 ** 25) / 2 ** 25;
  const dateBase = Date.now();
  let now = 0, nextId = 1, frameNo = 0;
  const timers = new Map(), rafs = new Map();
  const add = (fn, ms, args, repeat) => {
    const id = nextId++;
    const d = Math.max(0, +ms || 0);
    timers.set(id, { at: now + d, fn, args, every: repeat ? Math.max(1, d) : 0 });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => add(fn, ms, args, false);
  window.setInterval = (fn, ms, ...args) => add(fn, ms, args, true);
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (cb) => { const id = nextId++; rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };
  performance.now = () => now;
  Date.now = () => dateBase + Math.floor(now);
  const call = (fn, args) => { try { typeof fn === 'function' ? fn(...args) : (0, eval)(String(fn)); } catch (e) { setTimeoutReport(e); } };
  const setTimeoutReport = (e) => realSetTimeout(() => { throw e; }, 0);
  // advance one 1/60 s frame: due timers (in time order), then animation frame callbacks
  const frame = () => {
    now = ++frameNo * FRAME;
    if (frameNo % 300 === 0) { for (const c of document.querySelectorAll('canvas')) { const g = c.__gl; if (g) g.finish(); } }
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
  const clock = window.__vclock = { frame, manual: false, now: () => now };
  // While measuring, skip WebGL drawing and image/canvas texture uploads (e.g. a text label redrawn on every room
  // load): thousands of frames a second would otherwise pile up in the GPU process and slow everything down.
  // Game logic never depends on them; nobody sees these frames.
  { const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { const r = gc.call(this, t, ...a); if (r && /webgl/.test(t)) this.__gl = r; return r; }; }
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    for (const m of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear']) {
      const orig = C.prototype[m];
      if (orig) C.prototype[m] = function (...args) { if (!clock.manual || clock.draw) return orig.apply(this, args); };
    }
    for (const m of ['texImage2D', 'texSubImage2D']) {
      const orig = C.prototype[m];
      if (orig) C.prototype[m] = function (...args) {
        const src = args[args.length - 1];
        if (clock.manual && !clock.draw && src && typeof src === 'object' && !ArrayBuffer.isView(src) && args.length <= 7) return;
        return orig.apply(this, args);
      };
    }
  }
  // until the measuring script takes over, the game runs on its own (about 4x real time) so it can load and boot
  const pump = () => { if (!clock.manual) { frame(); realSetTimeout(pump, 4); } };
  realSetTimeout(pump, 0);
}

// ---------------------------------------------------------------- in-page runner (stringified into the page)
function pageRunner() {
  const L = window.__levels, clock = window.__vclock;
  clock.manual = true;
  const step = () => clock.frame();
  // warm up 5 s of game time: engines smooth or clamp their frame delta for a while after booting (Phaser: about
  // 2 s), and an attempt played during that time would not repeat exactly
  for (let i = 0; i < 300; i++) step();
  const held = new Map();
  const send = (k, down) => {
    const e = new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k.key, code: k.code, bubbles: true, cancelable: true });
    Object.defineProperty(e, 'keyCode', { get: () => k.keyCode });
    Object.defineProperty(e, 'which', { get: () => k.keyCode });
    (document.activeElement || document.body || document).dispatchEvent(e);
  };
  const press = (k, down) => { const h = held.get(k.code); if (!!(h && h.down) !== down) { send(k, down); held.set(k.code, { k, down }); } };
  const releaseAll = () => { for (const { k, down } of held.values()) if (down) send(k, false); held.clear(); };
  const state = () => {
    const s = L.state();
    if (!s || typeof s.x !== 'number' || typeof s.y !== 'number') throw new Error('__levels.state() must return {x, y, onGround, dead, done}; got ' + JSON.stringify(s));
    return s;
  };

  // seeded normal draws: the same z for the same (seed, room, run, step) at every timing error
  const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const normals = (seed, n) => { const r = rng(seed); const out = [];
    while (out.length < n) { const u = Math.max(r(), 1e-12), v = r(); const m = Math.sqrt(-2 * Math.log(u));
      out.push(m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)); } return out.slice(0, n); };

  let settleAfter = 0;      // frames to run before the next goto (lets a pending death restart fire harmlessly)
  const start = (i) => {
    releaseAll();
    for (; settleAfter > 0; settleAfter--) step();
    L.goto(i);
    for (let k = 0; k < 3; k++) step();
  };

  // One simulated play of a room. `known[k]` holds the frame of an early (negative error) key event that has to
  // fire before its own moment arrives; when the run meets such an event for the first time it returns
  // {needs: k, at: frame} and the caller replays the room from the start with that frame known (the game is
  // deterministic on the virtual clock, so the replay is identical up to that frame).
  let tracing = false, trace = null;     // --trace: one row per frame of the last play
  const sim = (room, route, O, known, cap, through) => {
    if (through) releaseAll(); else start(room);
    trace = tracing ? [] : null;
    let evs = [];
    const n = route.length;
    const anchorT = new Array(n).fill(null), condT = new Array(n).fill(null), fired = new Array(n).fill(null);
    let a = 0, f = 0, outcome = 'timeout', lastAir = -1e9;
    // a chase: the fewest seconds the player stays ahead of the hazard (ahead / hazardSpeed while it moves)
    let margin = null, marginAt = null, caught = false;
    const watch = (s) => {
      if (typeof s.ahead !== 'number' || !(s.hazardSpeed > 0)) return null;
      const m = s.ahead / s.hazardSpeed;
      if (margin === null || m < margin) { margin = m; marginAt = [Math.round(s.x), Math.round(s.y), f]; }
      return m;
    };
    let s = state(), px = s.x, py = s.y, vx = 0, vy = 0, stallX = null, stallY = null, failStep = -1;
    const cond = (c, k) => {
      if (c.name === 'land' || c.name === 'apex') {
        // wait for the latest jump press before this step (in route order) to have fired and taken off
        const j = route[k].lastJump, jf = j >= 0 ? fired[j] : -1e9;
        if (jf === null) return false;
        if (c.name === 'apex') return vy >= 0 && f >= jf + 3;
        return s.onGround && f >= jf + 5 && lastAir >= Math.max(k ? anchorT[k - 1] : 0, jf);
      }
      if (c.name === 'falling') return vy > 0 && !s.onGround;
      const v = c.field === 'x' ? s.x : c.field === 'y' ? s.y : c.field === 'vx' ? vx : vy;
      return c.op === '>=' ? v >= c.value : v <= c.value;
    };
    for (; f < cap; f++) {
      if (!s.onGround) lastAir = f;
      // resolve moments in order
      while (a < n) {
        const ev = route[a], prev = a ? anchorT[a - 1] : 0;
        if (ev.when) {
          if (f < prev) break;                         // (a reaction step's moment can lie ahead)
          if (condT[a] === null) { if (cond(ev.when, a)) condT[a] = f; else break; }
          if (f < condT[a] + ev.after) break;
        } else if (f < prev + ev.after) break;
        anchorT[a] = f + (O.late ? O.late(a) : 0);     // a reaction step happens later than the event it answers
        if (trace) evs.push(['moment', a]);
        const o = O(a, anchorT[a], anchorT);
        if (o < 0 && known[a] === null && fired[a] === null && ev.when) {
          const at = Math.max(prev, anchorT[a] + o);
          if (at < f) return { needs: a, at };
          known[a] = at;
        }
        a++;
      }
      // fire key events that are due
      for (let k = 0; k < n; k++) {
        if (fired[k] !== null) continue;
        const ev = route[k];
        let due;
        if (known[k] !== null) due = f >= known[k];
        else if (!ev.when) {                            // a pure delay: its moment is known as soon as the previous one is
          const prev = k ? anchorT[k - 1] : 0;
          if (prev === null) due = false;
          else {
            const m = prev + ev.after + (O.late ? O.late(k) : 0), o = O(k, m, anchorT);
            due = o < 0 ? f >= Math.max(prev, m + o) : anchorT[k] !== null && f >= anchorT[k] + o;
          }
        } else due = anchorT[k] !== null && f >= anchorT[k] + O(k, anchorT[k], anchorT);
        if (!due) continue;
        if (ev.key) {                                   // same key: keep press/release order, at least one frame apart
          let blocked = false;
          for (let j = 0; j < k; j++) if (route[j].key && route[j].key.code === ev.key.code && (fired[j] === null || fired[j] >= f)) { blocked = true; break; }
          if (blocked) continue;
          press(ev.key, ev.down);
        }
        fired[k] = f;
        if (trace) evs.push(['fire', k]);
        failStep = Math.max(failStep, k);
      }
      if (trace) { trace.push([f, s.x, s.y, vx, vy, !!s.onGround, evs, watch(s)]); evs = []; } else watch(s);
      step();
      s = state();
      vx = typeof s.vx === 'number' ? s.vx : (s.x - px) * 60;
      vy = typeof s.vy === 'number' ? s.vy : (s.y - py) * 60;
      px = s.x; py = s.y;
      if (through ? through(s) : s.done) { outcome = 'pass'; settleAfter = 2; break; }
      if (s.dead) { outcome = 'died'; caught = typeof s.ahead === 'number' && s.ahead <= 1; settleAfter = 60; break; }
      // every key event done and no movement for 0.75 s: stuck (e.g. fell short at the foot of a wall)
      if (f % 45 === 0) {
        if (fired.every(v => v !== null) && stallX !== null && Math.abs(s.x - stallX) < 2 && Math.abs(s.y - stallY) < 2) { outcome = 'stuck'; break; }
        stallX = s.x; stallY = s.y;
      }
    }
    if (outcome === 'timeout' || outcome === 'stuck') settleAfter = 2;
    releaseAll();
    if (outcome !== 'died') watch(s);
    return { outcome, frames: f, x: Math.round(s.x), y: Math.round(s.y), step: failStep, fired: fired.filter(v => v !== null).length, waiting: fired.indexOf(null),
      margin: margin === null ? null : +margin.toFixed(3), marginAt, caught };
  };
  const attempt = (room, route, O, cap) => {
    const known = route.map(() => null);
    for (let it = 0; it <= route.length; it++) {
      const r = sim(room, route, O, known, cap);
      if (r.needs === undefined) return r;
      known[r.needs] = r.at;
    }
    throw new Error('internal: early-event replay did not settle');
  };

  const ZERO = () => 0;
  // The simulated player's error (in frames) for each step of one attempt, worked out when the step's moment is
  // known. simple: independent Gaussian error N(0, σ). full: the same draws, made correlated (AR(1), ρ), scaled up
  // when inputs come close together or switch keys, plus a reaction delay on steps marked "react".
  const player = (route, sigma, model, seed) => {
    const n = route.length, z = normals(seed, n);
    if (!model || model.kind === 'simple') { const pre = route.map((ev, k) => ev.exact ? 0 : Math.round(z[k] * sigma * 60)); const O = (k) => pre[k]; O.used = pre; return O; }
    const z2 = normals((seed ^ 0x2c1b3c6d) | 0, n), M = model;
    const e = new Array(n).fill(0);
    let prevE = null;
    for (let k = 0; k < n; k++) {
      if (route[k].exact) continue;
      e[k] = prevE === null ? z[k] : M.rho * prevE + Math.sqrt(1 - M.rho * M.rho) * z[k];
      prevE = e[k];
    }
    const used = new Array(n).fill(null);
    const O = (k, m, A) => {
      if (used[k] !== null) return used[k];
      const ev = route[k];
      if (ev.exact) return (used[k] = 0);
      let mult = 1, j = k - 1;
      while (j >= 0 && !route[j].key) j--;
      if (j >= 0 && A[j] !== null) mult *= 1 + M.loadGain * Math.max(0, (M.loadGap - (m - A[j]) / 60) / M.loadGap);
      if (ev.down) {
        let sw = false;
        if (ev.key.dir) for (let i = k - 1; i >= 0; i--) { const p = route[i]; if (p.key && p.key.dir && p.down) { sw = p.key.dir !== ev.key.dir; break; } }
        for (let i = k - 1; !sw && i >= 0; i--) {
          const p = route[i];
          if (!p.key || A[i] === null) continue;
          if ((m - A[i]) / 60 > M.loadGap) break;
          if (!p.down && p.key.code !== ev.key.code) sw = true;
        }
        if (sw) mult *= M.switchGain;
      }
      return (used[k] = Math.round(e[k] * sigma * mult * 60));
    };
    // reaction delay (frames) of a "react" step: it moves the step's moment, and every step timed from it
    O.late = (k) => route[k].react ? Math.round(Math.max(M.reactMin, M.react * (1 + M.reactSpread * z2[k])) * 60) : 0;
    O.used = used;
    return O;
  };

  window.__lvRun = {
    // all attempts for one room at one timing error
    measure: (room, route, sigma, runs, seed, cap, model) => {
      const counts = { pass: 0, died: 0, stuck: 0, timeout: 0 }, failSteps = {}, margins = [];
      let caught = 0;
      for (let r = 0; r < runs; r++) {
        const res = attempt(room, route, player(route, sigma, model, (seed * 1000003 + room * 7919 + r * 104729) | 0), cap);
        counts[res.outcome]++;
        if (res.outcome !== 'pass') { const key = res.step + ':' + res.outcome; failSteps[key] = (failSteps[key] || 0) + 1; }
        if (res.outcome === 'pass' && res.margin !== null) margins.push(res.margin);
        if (res.caught) caught++;
      }
      return { counts, failSteps, margins, caught };
    },
    clean: (room, route, cap) => attempt(room, route, ZERO, cap),
    // a picture of the room after `frames` frames of its clean route (0 = the start), drawn for real
    shot: (room, route, frames) => {
      clock.draw = true;
      try {
        if (frames > 0) attempt(room, route, ZERO, frames);
        else { start(room); for (let k = 0; k < 30; k++) step(); }   // the start: 0.5 s in with no input, after any fade-in
        const cs = [...document.querySelectorAll('canvas')].sort((p, q) => q.width * q.height - p.width * p.height);
        return cs.length ? cs[0].toDataURL('image/png') : null;
      } finally { clock.draw = false; releaseAll(); }
    },
    // the whole game from room 1, the way a player goes: after each exit, the next room is the one the game puts
    // the player in (state().room), so doors that skip optional rooms are followed (no goto between rooms)
    playthrough: (routes, cap) => {
      const rooms = typeof L.rooms === 'function' ? L.rooms() : L.rooms;
      start(0);
      if (typeof state().room !== 'number') return { unsupported: true };
      const log = [], seen = new Set();
      let finished = false;
      while (!finished) {
        const i = state().room;
        if (!(i >= 0 && i < rooms.length)) { log.push({ i, ok: false, why: `the game put the player in room ${i + 1}, which is not in __levels.rooms` }); break; }
        if (seen.has(i)) { log.push({ i, ok: false, why: 'this room was already played: the exits go round in a loop' }); break; }
        seen.add(i);
        if (!routes[i]) { log.push({ i, ok: false, why: 'no route' }); break; }
        const r = sim(i, routes[i], ZERO, routes[i].map(() => null), cap, (s) => !!s.finished || s.room !== i);
        const after = state();
        finished = r.outcome === 'pass' && !!after.finished;
        log.push({ i, ok: r.outcome === 'pass', seconds: r.frames / 60, why: r.outcome === 'pass' ? '' : `${r.outcome} at x ${r.x}, y ${r.y}` });
        if (r.outcome !== 'pass') break;
      }
      const opt = (r) => String(r.beat || '').toLowerCase() === 'optional' || String(r.kind || '').toLowerCase() === 'optional';
      const missed = rooms.map((r, i) => i).filter(i => !seen.has(i) && !opt(rooms[i]));
      return { log, finished, missed, skipped: rooms.map((r, i) => i).filter(i => !seen.has(i) && opt(rooms[i])) };
    },
    // one play with every frame logged; with a timing error it uses the first measured attempt's random draws
    trace: (room, route, sigma, seed, cap, model) => {
      const O = sigma ? player(route, sigma, model, (seed * 1000003 + room * 7919) | 0) : ZERO;
      tracing = true;
      try { const res = attempt(room, route, O, cap); return { res, off: O.used || route.map(() => 0), late: route.map((_, k) => O.late ? O.late(k) : 0), rows: trace }; } finally { tracing = false; }
    },
    rooms: () => (typeof L.rooms === 'function' ? L.rooms() : L.rooms).map(r => ({ id: String(r.id), area: r.area ?? null, beat: r.beat ?? null, kind: r.kind ?? null })),
  };
  return true;
}

// ---------------------------------------------------------------- targets (references/progression.md)
const BEATS = { introduce: [0.9, 1], develop: [0.6, 0.9], twist: [0.6, 0.9], test: [0.4, 0.7], rest: [0.9, 1] };
// kind (references/structure.md): main (default), rest (a rest spot: no hazards, every player passes), optional
// (off the main path, same as beat 'optional'), chase (a segment of a chase: references/finale.md)
const kindOf = (r) => String(r.kind || '').toLowerCase();
const isOptional = (r) => String(r.beat || '').toLowerCase() === 'optional' || kindOf(r) === 'optional';
const CHASE_BAND = [0.6, 0.9], MARGIN_MIN = 0.6, MARGIN_MAX = 2.5;   // seconds ahead of the hazard on the clean route
function targetFor(room, firstArea) {
  let beat = (room.beat || '').toLowerCase();
  beat = { intro: 'introduce', conclude: 'test' }[beat] || beat;
  if (isOptional(room)) return null;
  if (kindOf(room) === 'rest') return [1, 1];
  if (room.area !== null && room.area === firstArea) return [0.9, 1];
  if (kindOf(room) === 'chase') return CHASE_BAND;
  return BEATS[beat] || null;
}

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
  console.error(`Playwright is not installed. In the game's folder run:

  npm install --save-dev playwright
  npx playwright install chromium

then run this command again. (On Linux, if Chromium then fails to start: npx playwright install --with-deps chromium)`);
  process.exit(3);
}

function serveFolder(file) {
  const root = path.dirname(file);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain' };
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

async function openPage(browser, url, errors) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 640 } });
  await ctx.addInitScript(`(${virtualClock.toString()})()`);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.add(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.add(m.text()); });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  const t0 = Date.now();
  while (!(await page.evaluate(() => !!window.__levels))) {
    if (Date.now() - t0 > 30000) {
      throw new Error(`window.__levels was not found 30 s after the page loaded. Add the hook (references/measuring.md).` +
        (errors.size ? '\nPage errors:\n  ' + [...errors].join('\n  ') : ''));
    }
    await new Promise(r => setTimeout(r, 100));
  }
  const problem = await page.evaluate(() => {
    const L = window.__levels;
    if (typeof L.goto !== 'function') return '__levels.goto(i) is missing';
    if (typeof L.state !== 'function') return '__levels.state() is missing';
    const rooms = typeof L.rooms === 'function' ? L.rooms() : L.rooms;
    if (!Array.isArray(rooms) || !rooms.length) return '__levels.rooms must be a non-empty list of {id, area, beat}';
    const ids = rooms.map(r => r && r.id);
    if (ids.some(id => id === undefined || id === null || id === '')) return 'every room in __levels.rooms needs an id';
    if (new Set(ids.map(String)).size !== ids.length) return 'room ids in __levels.rooms must be unique';
    return '';
  });
  if (problem) throw new Error(problem);
  await page.evaluate(`(${pageRunner.toString()})()`);
  return page;
}

// ---------------------------------------------------------------- output
const pct = (v) => v === null || v === undefined ? '  -' : String(Math.round(v * 100)).padStart(3) + '%';
const band = (t) => t ? (t[0] >= 1 ? 'all 100%' : `${Math.round(t[0] * 100)}-${Math.round(t[1] * 100)}%`) : '-';
const pad = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n); };

function verdictFor(r, i, list) {
  const notes = [];
  let verdict = 'no target', nearEdge = false;
  if (r.target && r.target[0] >= 1) {
    // a rest spot: safe for everyone, so every player passes every time
    verdict = r.reached >= 1 && r.pass.every(p => p >= 1) ? 'OK' : 'too hard';
    if (verdict !== 'OK') notes.push(`a rest spot must be safe for every player (new ${pct(r.pass[0]).trim()}, average ${pct(r.pass[1]).trim()}, skilled ${pct(r.pass[2]).trim()}): remove its hazards and pits`);
  } else if (r.target) {
    const v = r.reached, [lo, hi] = r.target;
    verdict = v < lo ? 'too hard' : hi < 1 && v > hi ? 'too easy' : 'OK';
    const edge = Math.min(Math.abs(v - lo), hi < 1 ? Math.abs(v - hi) : 1);
    const bySeed = r.reachedBySeed || [];
    const seedVerdicts = new Set(bySeed.map(x => x < lo ? 'hard' : hi < 1 && x > hi ? 'easy' : 'ok'));
    if (bySeed.length > 1 && seedVerdicts.size > 1) { nearEdge = true; notes.push(`the seeds disagree (${bySeed.map(x => Math.round(x * 100) + '%').join(' vs ')}): the room sits on its band edge`); }
    else if (edge <= 0.03 && bySeed.length < 2) { nearEdge = true; notes.push(`within 3 points of its band edge, so the verdict can flip between runs: check with --runs 200 --seeds 1,2 --rooms ${r.n}`); }
  } else if (!isOptional(r)) notes.push('no beat: give the room a beat in the hook to get a target');
  const skilled = r.pass[2];
  if (!isOptional(r) && skilled < 0.95) notes.push(`skilled player only ${Math.round(skilled * 100)}% (should be 95%+)`);
  if (kindOf(r) === 'chase' && (r.margin === null || r.margin === undefined)) notes.push('a chase room, but state() reports no hazard: also return ahead and hazardSpeed (references/measuring.md)');
  if (r.margin !== null && r.margin !== undefined) {
    if (!isOptional(r) && r.margin < MARGIN_MIN) notes.push(`the clean route stays only ${r.margin.toFixed(2)} s ahead of the hazard (main path: ${MARGIN_MIN} s or more; see finale.md)`);
    if (r.margin > MARGIN_MAX) notes.push(`the hazard never gets close (${r.margin.toFixed(2)} s ahead at the closest): it adds no pressure`);
    const fails = Object.values(r.failSteps || {}).reduce((t, n) => t + n, 0);
    if (fails && r.caught) notes.push(`${r.caught} of ${fails} failures of the player who has reached it were caught by the hazard`);
  }
  const prev = list[i - 1];
  // (chase segments tighten one after another; the release after the last one is the easier room)
  if (prev && (prev.beat || '').toLowerCase() === 'test' && prev.n === r.n - 1 && r.reached <= prev.reached && !(kindOf(r) === 'chase' && kindOf(prev) === 'chase')) notes.push('not easier than the test room before it');
  return { verdict, nearEdge, notes };
}

// the beat column: the beat, or the room's kind when it isn't a main room (rest spot, chase, optional)
function beatLabel(r) {
  const k = kindOf(r);
  if (k === 'rest') return 'rest spot';
  if (k === 'chase' || k === 'optional') return r.beat && r.beat !== k ? `${k}:${r.beat}` : k;
  return r.beat || '-';
}

function failText(r) {
  const entries = Object.entries(r.failSteps || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  const total = entries.reduce((s, e) => s + e[1], 0);
  const [key, cnt] = entries[0];
  const [k, how] = key.split(':');
  const st = r.steps[+k];
  return `most failures (${cnt} of ${total}) ${how === 'died' ? 'die' : how === 'stuck' ? 'get stuck' : 'run out of time'} after step ${+k + 1}${st ? ` (${st})` : ''}`;
}

function textTable(res) {
  const S = res.sigmas;
  const lines = [];
  const multi = res.seeds.length > 1;
  lines.push(`Difficulty: ${res.rooms.length} room(s), ${res.runs} attempts per player${multi ? ` per seed (seeds ${res.seeds.join(', ')}; rates are pooled)` : ''}, timing error new ±${S[0]} s, average ±${S[1]} s, skilled ±${S[2]} s`);
  lines.push(res.model.description);
  const K = res.reached;
  lines.push(`"reached" = the player who has reached the room: better with every room played, timing error ±${K.start} s in room 1, levelling out near ±${K.end} s (σ = ${K.end} + ${+(K.start - K.end).toFixed(4)} × exp(−rooms played / ${K.rooms}); optional rooms not counted).`);
  lines.push('');
  const chase = res.rooms.some(r => r.margin !== null && r.margin !== undefined);
  lines.push(`${' #'.padStart(3)}  ${pad('room', 24)} ${pad('area', 5)}${pad('beat', 10)}  new  avg  skl   reached (±s)  ${multi ? pad('by seed', 12) : ''}${chase ? 'margin  ' : ''}  target   verdict`);
  for (const r of res.rooms) {
    const mg = chase ? (r.margin === null || r.margin === undefined ? '     -  ' : `${r.margin.toFixed(2).padStart(5)} s `) : '';
    lines.push(`${String(r.n).padStart(3)}  ${pad(r.id, 24)} ${pad(r.area ?? '-', 5)}${pad(beatLabel(r), 10)} ${pct(r.pass[0])} ${pct(r.pass[1])} ${pct(r.pass[2])}  ${pct(r.reached)} (${r.reachedSigma.toFixed(3)})${multi ? '  ' + pad(r.reachedBySeed.map(x => pct(x).trim()).join(' '), 12) : ''}${mg}  ${pad(band(r.target), 8)} ${r.verdict}${r.nearEdge ? ' (near edge)' : ''}`);
  }
  if (chase) lines.push(`\nmargin: the fewest seconds the clean route stays ahead of the hazard. Median for passing attempts (new / average / skilled): ` +
    res.rooms.filter(r => r.margin !== null && r.margin !== undefined).map(r => `${r.n} ${r.marginByPlayer.map(m => m === null ? '-' : m.toFixed(2)).join(' / ')} s`).join(', ') + '.');
  const notes = res.rooms.flatMap(r => {
    const out = r.notes.map(t => `  ${r.n} ${r.id}: ${t}`);
    const f = failText(r);
    if (f && r.verdict !== 'OK') out.unshift(`  ${r.n} ${r.id}: ${f}`);
    return out;
  });
  if (notes.length) { lines.push(''); lines.push('Notes:'); lines.push(...notes); }
  const failedClean = res.rooms.filter(r => !r.cleanPass);
  if (failedClean.length) { lines.push(''); lines.push('WARNING: these routes fail even with no timing error, so their numbers mean nothing: ' + failedClean.map(r => `${r.n} ${r.id}`).join(', ') + '. Run --check.'); }
  lines.push('');
  lines.push('Simulated players measure timing precision only, not whether a room is confusing or fun.');
  return lines.join('\n');
}

function reportHtml(res) {
  const data = JSON.stringify({
    game: res.game, measured: res.measured, runs: res.runs, sigmas: res.sigmas, seconds: res.seconds,
    seeds: res.seeds, model: res.model.name, rooms: res.rooms.map(r => ({ n: r.n, id: r.id, bySeed: r.reachedBySeed, area: r.area, beat: beatLabel(r) === '-' ? r.beat : beatLabel(r), margin: r.margin ?? null, pass: r.pass, reached: r.reached, rs: r.reachedSigma,
      target: r.target, verdict: r.verdict, near: r.nearEdge, notes: r.notes, fail: failText(r), clean: r.cleanPass, outcomes: r.outcomes })),
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Difficulty report</title>
<style>
:root{--bg:#f7f7f5;--surface:#fff;--ink:#16181d;--ink-2:#4a505b;--muted:#737985;--line:#e4e4e0;--accent:#2347c5;--ok:#2f8a4f;--bad:#c23b31;--warn:#b4540a;
  --c-new:#a3a8b1;--c-avg:#737985;--c-sk:#3b4049;--band:color-mix(in srgb,var(--ok) 13%,transparent);--band-edge:color-mix(in srgb,var(--ok) 45%,transparent);color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#111215;--surface:#1a1b20;--ink:#eeeef0;--ink-2:#babec7;--muted:#8c919b;--line:#2a2b31;--accent:#8aa4ff;--ok:#5cc27f;--bad:#ff7d70;--warn:#f0a35e;
  --c-new:#5f646e;--c-avg:#8c919b;--c-sk:#d3d6dc;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1100px;margin:0 auto;padding:20px 16px 40px}
h1{font-size:22px;margin:0 0 2px;letter-spacing:-.01em}
.sub{color:var(--muted);font-size:13px;margin:0 0 14px}
.summary{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.pill{border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:3px 12px;font-size:13px;font-weight:600}
.pill.ok{color:var(--ok)} .pill.hard{color:var(--bad)} .pill.easy{color:var(--warn)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.legend{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12.5px;color:var(--ink-2);padding:2px 2px 6px}
.legend span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.legend .bandkey{width:12px;height:12px;border-radius:2px;background:var(--band);border:1px solid var(--band-edge)}
.chart{position:relative;height:360px}
.chart svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.chart text{font-size:11px;fill:var(--muted)}
.chart .rn{fill:var(--ink-2);font-weight:700;font-size:12px}
.chart .an{fill:var(--ink-2);font-weight:700;font-size:11.5px}
.chart .tst{fill:var(--ink-2);font-weight:700}
.tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:7px 9px;font-size:12px;line-height:1.45;color:var(--ink-2);box-shadow:0 4px 14px rgba(0,0,0,.14);opacity:0;transition:opacity .1s;max-width:260px;z-index:2}
.tip b{color:var(--ink)} .tip .r{display:flex;justify-content:space-between;gap:14px;font-variant-numeric:tabular-nums}
.tablewrap{overflow-x:auto;margin-top:16px}
table{border-collapse:collapse;width:100%;min-width:760px;font-size:13px;font-variant-numeric:tabular-nums;background:var(--surface);border:1px solid var(--line);border-radius:12px}
th,td{padding:6px 9px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap}
td.n{text-align:right} td.room{min-width:200px} td.num{text-align:right;white-space:nowrap}
td.reach{font-weight:700}
.v-ok{color:var(--ok);font-weight:700} .v-hard{color:var(--bad);font-weight:700} .v-easy{color:var(--warn);font-weight:700} .v-none{color:var(--muted)}
.note{color:var(--muted);font-size:12px;line-height:1.35}
.foot{color:var(--muted);font-size:12.5px;margin-top:14px}
@media (max-width:600px){.chart{height:300px} h1{font-size:19px}}
</style>
</head>
<body>
<main>
<h1>Difficulty report</h1>
<p class="sub" id="sub"></p>
<div class="summary" id="summary"></div>
<div class="card">
  <div class="legend" id="legend"></div>
  <div class="chart" id="chart" role="img"><svg id="svg" aria-hidden="true"></svg><div class="tip" id="tip"></div></div>
</div>
<div class="tablewrap"><table id="table"></table></div>
<p class="foot">Each room's route is played ${res.runs} times per player with a Gaussian timing error on every press and release (standard deviation = the player's timing error), the same random draws for every player. Simulated players measure timing precision only: they can't tell whether a room is confusing or fun, so also watch a real person play the first area.</p>
</main>
<script id="data" type="application/json">${data}</script>
<script>
'use strict';
const D = JSON.parse(document.getElementById('data').textContent), R = D.rooms, N = R.length;
const $ = (id) => document.getElementById(id);
const pct = (v) => Math.round(v * 100) + '%';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SER = [
  { i: 0, label: 'new ±' + D.sigmas[0], c: 'var(--c-new)', dash: '2 3' },
  { i: 1, label: 'average ±' + D.sigmas[1], c: 'var(--c-avg)', dash: '6 3' },
  { i: 2, label: 'skilled ±' + D.sigmas[2], c: 'var(--c-sk)', dash: '' },
];
$('sub').textContent = D.game + ' · measured ' + new Date(D.measured).toLocaleString() + ' · ' + D.model + ' player model · ' + D.runs + ' attempts per player per room' + (D.seeds.length > 1 ? ' per seed (seeds ' + D.seeds.join(', ') + ')' : '') + ' · ' + Math.round(D.seconds) + ' s';
const cnt = (v) => R.filter(r => r.verdict === v).length;
$('summary').innerHTML = [['OK', 'ok'], ['too hard', 'hard'], ['too easy', 'easy']].filter(([v]) => cnt(v)).map(([v, c]) => '<span class="pill ' + c + '">' + cnt(v) + ' ' + v + '</span>').join('') +
  (R.some(r => !r.clean) ? '<span class="pill hard">' + R.filter(r => !r.clean).length + ' route(s) fail with no error</span>' : '');
$('legend').innerHTML = '<span><svg width="26" height="10"><line x1="1" y1="5" x2="25" y2="5" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/><circle cx="13" cy="5" r="3.6" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.5"/></svg><b>player who has reached the room</b></span>' +
  SER.map(s => '<span><svg width="22" height="10"><line x1="1" y1="5" x2="21" y2="5" stroke="' + s.c + '" stroke-width="1.5" stroke-dasharray="' + s.dash + '"/></svg>' + s.label + ' s</span>').join('') +
  '<span><i class="bandkey"></i>target</span>';
const yMin = (() => { let lo = 1; R.forEach(r => { lo = Math.min(lo, r.reached, ...r.pass, r.target ? r.target[0] : 1); }); return lo >= 0.55 ? 0.5 : Math.max(0, Math.floor((lo - 0.05) * 10) / 10); })();
let G = null, hover = -1;
function draw() {
  const el = $('chart'), W = el.clientWidth, H = el.clientHeight;
  const multi = R.some(r => r.area !== R[0].area);
  const m = { l: 40, r: 8, t: multi ? 26 : 10, b: 40 }, pw = W - m.l - m.r, ph = H - m.t - m.b, cw = pw / N;
  const X = (i) => m.l + cw * (i + 0.5), Y = (v) => m.t + ph * (1 - (v - yMin) / (1 - yMin));
  G = { m, cw };
  let s = '';
  if (hover >= 0) s += '<rect x="' + (m.l + cw * hover + 1) + '" y="' + (m.t - 4) + '" width="' + (cw - 2) + '" height="' + (ph + m.b) + '" rx="6" fill="var(--line)" opacity=".5"/>';
  for (let v = yMin; v <= 1.0001; v += 0.1) { const y = Y(v); s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)"/><text x="' + (m.l - 6) + '" y="' + (y + 3.5) + '" text-anchor="end">' + Math.round(v * 100) + '%</text>'; }
  R.forEach((r, i) => {
    if (!r.target) return;
    const p = Math.min(10, cw * 0.14), y1 = Y(Math.min(1, r.target[1])), y0 = Y(Math.max(yMin, r.target[0]));
    s += '<rect x="' + (m.l + cw * i + p) + '" y="' + y1 + '" width="' + (cw - 2 * p) + '" height="' + (y0 - y1) + '" fill="var(--band)"/>';
    s += '<line x1="' + (m.l + cw * i + p) + '" x2="' + (m.l + cw * (i + 1) - p) + '" y1="' + y0 + '" y2="' + y0 + '" stroke="var(--band-edge)" stroke-width="1.5"/>';
  });
  R.forEach((r, i) => {
    if (i > 0 && r.area !== R[i - 1].area) s += '<line x1="' + (m.l + cw * i) + '" x2="' + (m.l + cw * i) + '" y1="' + (m.t - 22) + '" y2="' + (H - 4) + '" stroke="var(--muted)" stroke-dasharray="3 3"/>';
    if (multi && r.area !== null && (i === 0 || r.area !== R[i - 1].area)) s += '<text class="an" x="' + (m.l + cw * i + 6) + '" y="' + (m.t - 12) + '">Area ' + esc(r.area) + '</text>';
  });
  const path = (f) => R.map((_, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(f(i)).toFixed(1)).join(' ');
  for (const se of SER) s += '<path d="' + path(i => R[i].pass[se.i]) + '" fill="none" stroke="' + se.c + '" stroke-width="1.5" stroke-dasharray="' + se.dash + '" stroke-linejoin="round"/>';
  s += '<path d="' + path(i => R[i].reached) + '" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
  R.forEach((r, i) => {
    const off = r.verdict === 'too hard' || r.verdict === 'too easy';
    s += '<circle cx="' + X(i) + '" cy="' + Y(r.reached) + '" r="' + (off ? 5.5 : 4.5) + '" fill="' + (off ? (r.verdict === 'too hard' ? 'var(--bad)' : 'var(--warn)') : 'var(--accent)') + '" stroke="var(--surface)" stroke-width="2"/>';
  });
  const showName = cw >= 64;
  R.forEach((r, i) => {
    const nm = showName ? (r.id.length * 6.6 + 18 > cw ? r.id.split(/[ _-]/)[0] : r.id) : '';
    s += '<text class="rn" x="' + X(i) + '" y="' + (H - m.b + 17) + '" text-anchor="middle">' + r.n + (nm ? ' ' + esc(nm) : '') + '</text>';
    const bt = r.beat || '', show = cw >= 44 || (bt === 'test' && cw >= 22) ? (cw < 60 && bt === 'introduce' ? 'intro' : bt) : '';
    s += '<text class="' + (bt === 'test' ? 'tst' : '') + '" x="' + X(i) + '" y="' + (H - m.b + 31) + '" text-anchor="middle">' + esc(show) + '</text>';
  });
  const svg = $('svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = s;
  el.setAttribute('aria-label', 'Pass rate per room. ' + R.map(r => 'Room ' + r.n + ' ' + r.id + ': player who has reached it ' + pct(r.reached) + ', ' + r.verdict).join('. '));
}
function tipAt(e) {
  const el = $('chart'), tip = $('tip'), b = el.getBoundingClientRect();
  const i = G ? Math.floor((e.clientX - b.left - G.m.l) / G.cw) : -1;
  if (i !== hover) { hover = i >= 0 && i < N ? i : -1; draw(); }
  if (hover < 0) { tip.style.opacity = 0; return; }
  const r = R[hover], row = (l, v) => '<div class="r"><span>' + l + '</span><b>' + pct(v) + '</b></div>';
  tip.innerHTML = '<b>' + r.n + ' · ' + esc(r.id) + '</b>' + (r.beat ? ' · ' + esc(r.beat) : '') + '<br>target ' + (r.target ? (r.target[0] >= 1 ? 'all 100%' : pct(r.target[0]) + (r.target[1] < 1 ? '–' + pct(r.target[1]) : '+')) : 'none') + ' · ' + esc(r.verdict) + (r.near ? ' (near edge)' : '') +
    row('reached (±' + r.rs.toFixed(3) + ')', r.reached) + SER.map(se => row(se.label.split(' ')[0], r.pass[se.i])).join('') +
    (r.margin !== null ? '<div class="r"><span>margin</span><b>' + r.margin.toFixed(2) + ' s</b></div>' : '');
  tip.style.opacity = 1;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = e.clientX - b.left + 14; if (x + tw > b.width - 4) x = e.clientX - b.left - tw - 14;
  tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, Math.min(b.height - th - 4, e.clientY - b.top - th / 2)) + 'px';
}
$('chart').addEventListener('pointermove', tipAt);
$('chart').addEventListener('pointerleave', () => { hover = -1; $('tip').style.opacity = 0; draw(); });
const vc = (v) => v === 'OK' ? 'v-ok' : v === 'too hard' ? 'v-hard' : v === 'too easy' ? 'v-easy' : 'v-none';
$('table').innerHTML = '<thead><tr><th>#</th><th>Room</th><th>Area</th><th>Beat</th><th class="num">New</th><th class="num">Average</th><th class="num">Skilled</th><th class="num">Reached</th>' + (R.some(r => r.margin !== null) ? '<th class="num">Margin</th>' : '') + '<th>Target</th><th>Verdict</th></tr></thead><tbody>' +
  R.map(r => '<tr><td class="n">' + r.n + '</td><td class="room">' + esc(r.id) + ([r.fail && r.verdict !== 'OK' ? r.fail : '', ...r.notes, r.clean ? '' : 'route fails with no timing error'].filter(Boolean).map(t => '<div class="note">' + esc(t) + '</div>').join('')) +
    '</td><td>' + esc(r.area ?? '–') + '</td><td>' + esc(r.beat || '–') + '</td>' + r.pass.map(v => '<td class="num">' + pct(v) + '</td>').join('') +
    '<td class="num reach">' + pct(r.reached) + ' <span class="note">±' + r.rs.toFixed(3) + '</span>' + (D.seeds.length > 1 ? '<div class="note">seeds ' + r.bySeed.map(pct).join(' · ') + '</div>' : '') + '</td>' + (R.some(q => q.margin !== null) ? '<td class="num">' + (r.margin !== null ? r.margin.toFixed(2) + ' s' : '–') + '</td>' : '') + '<td>' + (r.target ? (r.target[0] >= 1 ? 'all 100%' : pct(r.target[0]) + (r.target[1] < 1 ? '–' + pct(r.target[1]) : '+')) : '–') + '</td><td class="' + vc(r.verdict) + '">' + esc(r.verdict) + (r.near ? ' <span class="note">(near edge)</span>' : '') + '</td></tr>').join('') + '</tbody>';
draw();
addEventListener('resize', draw);
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- player model
// The model object handed to the page for timing error σ; the reaction delay is interpolated between the three players.
function modelFor(A, sigma) {
  if (A.model === 'simple') return { kind: 'simple' };
  const pts = [[A.sigmas[2], A.reactSkilled], [A.sigmas[1], A.reactAvg], [A.sigmas[0], A.reactNew]].sort((p, q) => p[0] - q[0]);
  let react = sigma <= pts[0][0] ? pts[0][1] : pts[2][1];
  for (let i = 1; i < pts.length; i++) if (sigma >= pts[i - 1][0] && sigma <= pts[i][0]) {
    const t = (sigma - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); react = pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]); break;
  }
  return { kind: 'full', react: +react.toFixed(4), reactSpread: A.reactSpread, reactMin: A.reactMin, loadGap: A.loadGap, loadGain: A.loadGain, switchGain: A.switchGain, rho: A.rho };
}
function modelText(A) {
  if (A.model === 'simple') return 'Model: simple (independent Gaussian error of the player\'s size on every press and release).';
  return `Model: full. Reaction steps: delay ${A.reactNew} / ${A.reactAvg} / ${A.reactSkilled} s (new / average / skilled) ±${Math.round(A.reactSpread * 100)}%, at least ${A.reactMin} s. ` +
    `Error ×(1 + ${A.loadGain} × (${A.loadGap} − gap) / ${A.loadGap}) when an input comes less than ${A.loadGap} s after the previous one, ×${A.switchGain} on a key switch. ` +
    `Errors carry over (ρ ${A.rho}). These numbers are starting guesses, not measured from real players.`;
}

// ---------------------------------------------------------------- tuning
// Like a designer finding the most forgiving way through: each trigger value in turn is moved to where the new
// player passes most often (separate random draws from the measurement); ties go to the middle of the tied values.
async function tuneRoom(page, i, id, raw, keys, sigma, seed, cap, model) {
  const steps = JSON.parse(JSON.stringify(raw));
  const knobs = [];
  steps.forEach((s, k) => {
    if (s.when && typeof s.when === 'object') {
      const f = Object.keys(s.when)[0];
      if (/^[xy]/.test(f)) knobs.push({ k, label: f, get: () => s.when[f], set: (v) => { s.when[f] = v; }, cands: (v) => Array.from({ length: 13 }, (_, j) => v - 48 + 8 * j) });
    }
    if (typeof s.after === 'number') knobs.push({ k, label: 'after', get: () => s.after, set: (v) => { s.after = v; },
      cands: (v) => [...new Set(Array.from({ length: 13 }, (_, j) => Math.max(0, Math.round(v * FPS) - 6 + j)))].map(n => +(n / FPS).toFixed(4)) });
  });
  const RUNS = 40;
  const score = async () => (await page.evaluate(([i, r, s, n, sd, c, m]) => window.__lvRun.measure(i, r, s, n, sd, c, m),
    [i, compileRoute(id, steps, keys), sigma, RUNS, seed + 999, cap, model])).counts.pass;
  const before = await score();
  const changes = [];
  for (const kn of knobs) {
    const v0 = kn.get(), cands = kn.cands(v0), sc = [];
    for (const v of cands) { kn.set(v); sc.push(await score()); }
    const best = Math.max(...sc), tied = cands.filter((_, j) => sc[j] === best);
    const pick = tied[Math.floor(tied.length / 2)];
    kn.set(pick);
    if (pick !== v0) changes.push(`step ${kn.k + 1} ${kn.label} ${v0} -> ${pick}`);
  }
  return { steps, changes, before: before / RUNS, after: (await score()) / RUNS };
}

// ---------------------------------------------------------------- main
function pickRooms(spec, rooms) {
  if (!spec) return rooms.map((_, i) => i);
  const out = [];
  for (const part of spec.split(',').map(s => s.trim()).filter(Boolean)) {
    const m = /^(\d+)-(\d+)$/.exec(part);
    if (m) { for (let n = +m[1]; n <= +m[2]; n++) out.push(n - 1); continue; }
    if (/^\d+$/.test(part) && !rooms.some(r => r.id === part)) { out.push(+part - 1); continue; }
    const i = rooms.findIndex(r => r.id === part);
    if (i < 0) die(`--rooms: no room "${part}" (ids: ${rooms.map(r => r.id).join(', ')})`);
    out.push(i);
  }
  for (const i of out) if (i < 0 || i >= rooms.length) die(`--rooms: there are ${rooms.length} rooms`);
  return [...new Set(out)].sort((a, b) => a - b);
}

async function main() {
  const A = parseArgs(process.argv.slice(2));
  const routes = await loadRoutes(A.routes);
  const pw = await loadPlaywright();
  let url = A.game, server = null;
  if (!/^https?:\/\//.test(A.game)) {
    const file = path.resolve(A.game.replace(/^file:\/\//, ''));
    if (!fs.existsSync(file)) die(`game not found: ${file}`);
    ({ server, url } = await serveFolder(fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file));
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-difficulty-'));
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], env: { ...process.env, TMPDIR: tmp } });
  } catch (e) {
    console.error(String(e.message).split('\n').slice(0, 6).join('\n'));
    console.error('\nChromium for Playwright is missing or cannot start. Run:\n\n  npx playwright install chromium\n\n(on Linux, if it still fails: npx playwright install --with-deps chromium)');
    process.exit(3);
  }
  const errors = new Set();
  const t0 = Date.now();
  try {
    const first = await openPage(browser, url, errors);
    const rooms = await first.evaluate(() => window.__lvRun.rooms());
    const unknown = Object.keys(routes.rooms).filter(id => !rooms.some(r => r.id === id));
    if (unknown.length) console.error(`routes for unknown room ids (ignored): ${unknown.join(', ')}\n  room ids from the hook: ${rooms.map(r => r.id).join(', ')}`);
    const wanted = pickRooms(A.rooms, rooms);
    const missing = wanted.filter(i => !routes.rooms[rooms[i].id]);
    if (missing.length) console.error(`no route for: ${missing.map(i => `${i + 1} ${rooms[i].id}`).join(', ')} (skipped)`);
    const todo = wanted.filter(i => routes.rooms[rooms[i].id]);
    if (!todo.length) die('nothing to measure');
    const cap = Math.round(A.timeout * FPS);
    const [sNew] = A.sigmas;
    // the player who has reached room i: better with every room played, quickly at first, then levelling out.
    // n = main-path rooms played before it (rest spots teach nothing, so they don't count); an optional room uses
    // the n of the room it branches from.
    const reachedSigma = (i) => {
      const before = rooms.slice(0, i).filter(r => !isOptional(r) && kindOf(r) !== 'rest').length;
      const n = isOptional(rooms[i]) ? Math.max(0, before - 1) : before;
      return +(A.skillEnd + (A.skillStart - A.skillEnd) * Math.exp(-n / A.skillRooms)).toFixed(4);
    };
    const firstArea = rooms[0].area;

    const pages = [first];
    for (let w = 1; w < Math.min(A.workers, todo.length); w++) pages.push(await openPage(browser, url, errors));

    if (A.shots) {
      const dir = path.resolve(A.shots);
      fs.mkdirSync(dir, { recursive: true });
      const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'room';
      const saved = [];
      const viewW = await first.evaluate(() => Math.max(0, ...[...document.querySelectorAll('canvas')].map(c => c.width))) || 800;
      for (const i of todo) {
        const route = routes.rooms[rooms[i].id];
        // where the player is on each frame of the clean route: a room the route crosses by more than one view
        // width gets an -end picture too, and past two widths one picture per view width travelled (-mid1, -mid2, ...)
        const t = await first.evaluate(([i, r, c]) => window.__lvRun.trace(i, r, 0, 1, c, null), [i, route, cap]);
        const rows = t.rows, last = Math.max(1, rows.length - 1), x0 = rows.length ? rows[0][1] : 0;
        const xs = rows.map(r => r[1]), span = rows.length ? Math.max(...xs) - Math.min(...xs) : 0;
        const plan = [['start', 0]];
        if (span <= viewW) plan.push(['mid', Math.max(1, Math.floor(last / 2))]);
        else if (span <= 2 * viewW) plan.push(['mid', Math.max(1, Math.floor(last / 2))], ['end', last]);
        else {
          let k = 1;
          for (const [f, x] of rows) if (Math.abs(x - x0) >= k * viewW && f < last) { plan.push([`mid${k}`, Math.max(1, f)]); k++; }
          plan.push(['end', last]);
        }
        for (const [tag, frames] of plan) {
          const url = await first.evaluate(([i, r, f]) => window.__lvRun.shot(i, r, f), [i, route, frames]);
          const file = path.join(dir, `${String(i + 1).padStart(2, '0')}-${slug(rooms[i].id)}-${tag}.png`);
          if (url) fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
          else await first.screenshot({ path: file });
          saved.push(path.basename(file));
        }
      }
      console.log(`Saved ${saved.length} pictures to ${dir}:\n  ${saved.join('\n  ')}\nLook at each one: the HUD is clear, hazards and pickups are readable, the exit is visible or signposted, new elements stand out.`);
      return;
    }

    if (A.playthrough) {
      const list = rooms.map(r => routes.rooms[r.id] || null);
      const p = await first.evaluate(([l, c]) => window.__lvRun.playthrough(l, c), [list, cap]);
      if (p.unsupported) die('--playthrough needs state() to also return room (index of the room the player is in) and finished (the end of the game was reached). See references/measuring.md.');
      console.log('Playthrough (from room 1, each route in turn, going wherever each exit leads):\n');
      for (const l of p.log) console.log(`${String(l.i + 1).padStart(3)}  ${pad(rooms[l.i] ? rooms[l.i].id : '?', 24)} ${l.ok ? `pass  ${l.seconds.toFixed(2)} s` : 'FAIL  ' + l.why}`);
      if (p.skipped.length) console.log(`\nOptional rooms not on the way (as intended): ${p.skipped.map(i => `${i + 1} ${rooms[i].id}`).join(', ')}`);
      if (p.missed.length) console.log(`\nMain rooms the exits never led to: ${p.missed.map(i => `${i + 1} ${rooms[i].id}`).join(', ')}`);
      const ok = p.finished && !p.missed.length;
      console.log(ok ? `\nReached the end in ${p.log.reduce((t, l) => t + l.seconds, 0).toFixed(1)} s of play.` : p.finished ? '\nReached the end, but skipped main rooms.' : '\nThe playthrough did not reach the end.');
      process.exitCode = ok ? 0 : 1;
      return;
    }

    if (A.trace !== undefined) {
      const i = pickRooms(A.trace, rooms)[0], id = rooms[i].id, route = routes.rooms[id];
      if (!route) die(`no route for room ${i + 1} ${id}`);
      const sg = A.sigma || 0;
      const t = await first.evaluate(([i, r, s, sd, c, m]) => window.__lvRun.trace(i, r, s, sd, c, m), [i, route, sg, A.seed, cap, modelFor(A, sg)]);
      console.log(`Trace: room ${i + 1} ${id}, ${sg ? `timing error ±${sg} s, ${A.model} model (seed ${A.seed}, first attempt)` : 'no timing error'}`);
      route.forEach((st, k) => console.log(`  step ${k + 1}: ${st.text}${t.late[k] ? `  (reacts ${t.late[k]} frames late)` : ''}${t.off[k] ? `  (off by ${t.off[k] > 0 ? '+' : ''}${t.off[k]} frames)` : ''}`));
      const hz = t.rows.some(row => row[7] !== null);
      console.log('\n  time  frame      x       y      vx      vy  ground' + (hz ? '  margin' : ''));
      const f1 = (v) => v.toFixed(1).padStart(7);
      for (const [f, x, y, vx, vy, g, evs, m] of t.rows) {
        if (f % 6 && !evs.length) continue;
        const notes = evs.map(([what, k]) => what === 'moment' ? `moment of step ${k + 1}` : `step ${k + 1} fires: ${route[k].text}`).join('; ');
        console.log(`${(f / FPS).toFixed(2).padStart(6)} ${String(f).padStart(6)} ${f1(x)} ${f1(y)} ${f1(vx)} ${f1(vy)}  ${g ? 'yes' : ' no'}${hz ? (m === null ? '       -' : (m.toFixed(2) + ' s').padStart(8)) : ''}   ${notes}`);
      }
      const r = t.res;
      if (r.margin !== null) console.log(`\nMargin: ${r.margin.toFixed(2)} s ahead of the hazard at the closest (x ${r.marginAt[0]}, y ${r.marginAt[1]}, ${(r.marginAt[2] / FPS).toFixed(2)} s in)${r.caught ? '; caught by the hazard' : ''}.`);
      console.log(`\nResult: ${r.outcome === 'pass' ? 'reached the exit' : r.outcome === 'died' ? 'died' : r.outcome === 'stuck' ? 'stuck' : 'timed out'} after ${(r.frames / FPS).toFixed(2)} s at x ${r.x}, y ${r.y}` +
        (r.waiting >= 0 && r.outcome !== 'pass' ? `; step ${r.waiting + 1} (${route[r.waiting].text}) never fired` : ''));
      return;
    }

    if (A.check) {
      const out = [];
      let next = 0;
      await Promise.all(pages.map(async (page) => {
        while (next < todo.length) {
          const i = todo[next++], route = routes.rooms[rooms[i].id];
          const a = await page.evaluate(([i, r, c]) => window.__lvRun.clean(i, r, c), [i, route, cap]);
          const b = await page.evaluate(([i, r, c]) => window.__lvRun.clean(i, r, c), [i, route, cap]);
          out.push({ i, a, same: a.outcome === b.outcome && a.frames === b.frames && a.x === b.x && a.y === b.y && a.margin === b.margin });
        }
      }));
      out.sort((p, q) => p.i - q.i);
      console.log('Route check (each route played with no timing error):\n');
      let bad = 0, nondet = 0;
      for (const { i, a, same } of out) {
        const route = routes.rooms[rooms[i].id];
        const ok = a.outcome === 'pass';
        if (!ok) bad++;
        if (!same) nondet++;
        const where = ok ? `${(a.frames / FPS).toFixed(2)} s` :
          `${a.outcome === 'died' ? 'died' : a.outcome === 'stuck' ? 'stuck' : 'timed out'} at x ${a.x}, y ${a.y} after ${(a.frames / FPS).toFixed(2)} s; last step fired: ${a.step + 1} (${route[a.step] ? route[a.step].text : '-'})` +
          (a.waiting >= 0 && a.outcome !== 'died' ? `; still waiting for step ${a.waiting + 1} (${route[a.waiting].text})` : '');
        const mg = a.margin === null ? '' : `; margin ${a.margin.toFixed(2)} s (closest at x ${a.marginAt[0]}, y ${a.marginAt[1]}, ${(a.marginAt[2] / FPS).toFixed(2)} s in)${a.caught ? '; caught by the hazard' : ''}`;
        console.log(`${String(i + 1).padStart(3)}  ${pad(rooms[i].id, 24)} ${ok ? 'pass' : 'FAIL'}  ${where}${mg}${same ? '' : '  (NOT REPEATABLE: two identical runs ended differently)'}`);
        if (kindOf(rooms[i]) === 'chase' && a.margin === null) console.log(`     a chase room, but state() reports no hazard: also return ahead and hazardSpeed`);
      }
      console.log(`\n${out.length - bad} of ${out.length} routes pass.`);
      if (nondet) console.log(`${nondet} room(s) did not play the same twice: goto(i) must restart the room exactly (position, speed, double jump, pending timers, and a moving hazard), or the numbers are noise.`);
      if (errors.size) console.log('\nPage errors:\n  ' + [...errors].join('\n  '));
      process.exitCode = bad || nondet ? 1 : 0;
      return;
    }

    if (A.tune) {
      const tuned = { ...routes.raw };
      let next = 0;
      const log = [];
      console.error(`tuning triggers at ±${sNew} s ...`);
      await Promise.all(pages.map(async (page) => {
        while (next < todo.length) {
          const i = todo[next++], id = rooms[i].id;
          const t = await tuneRoom(page, i, id, routes.raw[id], routes.keys, sNew, A.seed, cap, modelFor(A, sNew));
          tuned[id] = t.steps;
          routes.rooms[id] = compileRoute(id, t.steps, routes.keys);
          log.push({ i, text: `${String(i + 1).padStart(3)}  ${pad(id, 24)} ${t.changes.length ? t.changes.join(', ') : 'no change'}  (new player ${pct(t.before).trim()} -> ${pct(t.after).trim()})` });
        }
      }));
      const outDir = path.resolve(A.out);
      fs.mkdirSync(outDir, { recursive: true });
      const file = path.join(outDir, 'routes.tuned.json');
      fs.writeFileSync(file, '{\n "keys": ' + JSON.stringify(routes.keysRaw || {}) + ',\n "rooms": {\n' + Object.entries(tuned).map(([id, st]) =>
        `  ${JSON.stringify(id)}: [\n` + st.map(x => '   ' + JSON.stringify(x)).join(',\n') + '\n  ]').join(',\n') + '\n }\n}\n');
      console.log('Tuned triggers (most forgiving for the new player, 40 tries per value):\n' + log.sort((p, q) => p.i - q.i).map(l => l.text).join('\n') + `\nWrote ${file}; measuring with it.\n`);
    }

    // full measurement: three players plus the player who has reached the room
    const results = [];
    let next = 0, done = 0;
    await Promise.all(pages.map(async (page) => {
      while (next < todo.length) {
        const i = todo[next++], room = rooms[i], route = routes.rooms[room.id];
        const rs = reachedSigma(i);
        const sig = [...A.sigmas];
        if (!sig.includes(rs)) sig.push(rs);
        const clean = await page.evaluate(([i, r, c]) => window.__lvRun.clean(i, r, c), [i, route, cap]);
        const per = {};
        const seeds = A.seeds || [A.seed];
        for (const s of sig) {
          per[s] = { counts: { pass: 0, died: 0, stuck: 0, timeout: 0 }, failSteps: {}, bySeed: [], margins: [], caught: 0 };
          for (const seed of seeds) {
            const m = await page.evaluate(([i, r, s, n, seed, c, m]) => window.__lvRun.measure(i, r, s, n, seed, c, m), [i, route, s, A.runs, seed, cap, modelFor(A, s)]);
            for (const k in m.counts) per[s].counts[k] += m.counts[k];
            for (const k in m.failSteps) per[s].failSteps[k] = (per[s].failSteps[k] || 0) + m.failSteps[k];
            per[s].margins.push(...m.margins);
            per[s].caught += m.caught;
            per[s].bySeed.push(+(m.counts.pass / A.runs).toFixed(3));
          }
        }
        const rate = (s) => +(per[s].counts.pass / (A.runs * seeds.length)).toFixed(3);
        const r = { n: i + 1, index: i, id: room.id, area: room.area, beat: room.beat, steps: route.map(s => s.text), cleanPass: clean.outcome === 'pass',
          cleanSeconds: +(clean.frames / FPS).toFixed(2), pass: A.sigmas.map(rate), reachedSigma: rs, reached: rate(rs), reachedBySeed: per[rs].bySeed,
          outcomes: Object.fromEntries(sig.map(s => [s, per[s].counts])), failSteps: per[rs].failSteps, target: targetFor(room, firstArea) };
        if (room.kind) r.kind = room.kind;
        if (clean.margin !== null) {
          // a chase: the clean route's margin, and the median margin of each player's passing attempts
          const median = (a) => { if (!a.length) return null; const b = [...a].sort((p, q) => p - q), h = b.length >> 1; return +(b.length % 2 ? b[h] : (b[h - 1] + b[h]) / 2).toFixed(3); };
          Object.assign(r, { margin: clean.margin, marginAt: clean.marginAt, marginByPlayer: A.sigmas.map(s => median(per[s].margins)), marginReached: median(per[rs].margins), caught: per[rs].caught });
        }
        results.push(r);
        done++;
        console.error(`[${done}/${todo.length}] ${i + 1} ${room.id}: ${clean.outcome === 'pass' ? '' : 'ROUTE FAILS WITH NO ERROR; '}new ${pct(r.pass[0]).trim()}, avg ${pct(r.pass[1]).trim()}, skilled ${pct(r.pass[2]).trim()}, reached ${pct(r.reached).trim()} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      }
    }));
    results.sort((p, q) => p.index - q.index);
    results.forEach((r, k) => Object.assign(r, verdictFor(r, k, results)));
    const res = { game: A.game, measured: new Date().toISOString(), seconds: +((Date.now() - t0) / 1000).toFixed(1), runs: A.runs, seed: A.seed, seeds: A.seeds || [A.seed],
      sigmas: A.sigmas, fps: FPS, noise: 'Gaussian N(0, σ) on every press and release, around its ideal moment; same draws for every σ',
      model: { name: A.model, description: modelText(A), ...(A.model === 'full' ? { react: { new: A.reactNew, average: A.reactAvg, skilled: A.reactSkilled, spread: A.reactSpread, min: A.reactMin },
        loadGap: A.loadGap, loadGain: A.loadGain, switchGain: A.switchGain, rho: A.rho } : {}) },
      reached: { start: A.skillStart, end: A.skillEnd, rooms: A.skillRooms, rule: 'σ(n) = end + (start - end) × exp(-n / rooms), n = main-path rooms played before this one (optional rooms use the room they branch from)' }, rooms: results, pageErrors: [...errors] };
    const outDir = path.resolve(A.out);
    fs.mkdirSync(outDir, { recursive: true });
    const table = textTable(res);
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(res, null, 1));
    fs.writeFileSync(path.join(outDir, 'table.txt'), table + '\n');
    fs.writeFileSync(path.join(outDir, 'report.html'), reportHtml(res));
    console.log(table);
    console.log(`\nWrote ${path.join(outDir, 'report.html')}, table.txt and results.json (${res.seconds} s).`);
    if (errors.size) console.log('\nPage errors:\n  ' + [...errors].join('\n  '));
  } finally {
    await browser.close();
    if (server) { server.closeAllConnections?.(); server.close(); }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e && e.message ? e.message : e); process.exit(1); });
