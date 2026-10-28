#!/usr/bin/env node
// terrain-sheet.mjs: render a game's rooms with edge-terrain.js in headless Chromium (muted) and save a contact sheet,
// so you can judge the terrain style across every room before wiring it into the game. Needs Playwright (the game's
// devDependency is enough; run this from the game's folder).
//
//   node terrain-sheet.mjs --levels levels/section-1.js levels/section-2.js --preset N --out terrain-sheet.png
//   options: --rooms 3,18,34      only these rooms (1-based, in chapter order)
//            --tile 32            game tile size (art is tile/2 per tile, drawn at 2x)
//            --island             cut the ground off and float the rooms (preset N's look)
//            --player 28          player height in game px (headroom check); 0 = off
//            --each DIR           also save every room alone at 1x and 2x
//            --style style.json   your own style object instead of a preset
//            --cols 2 --scale 0.5 sheet layout
// Level files are loaded as plain scripts. Rooms are read from window.SECTIONS[].rooms (each { name, grid }),
// window.ROOMS or window.LEVELS (arrays of rooms or of grids). Grids are arrays of strings, '#' = solid.
// Objects are drawn as flat markers (^ spikes red, C crumble tan, S spring, O orb, D/G/B/K exits, P start) only so
// you can judge contrast against the terrain; they are not the game's art.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import { execSync } from 'child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const flag = (k) => args.includes('--' + k);
const levels = [];
{ const i = args.indexOf('--levels'); if (i >= 0) for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) levels.push(args[j]); }
if (!levels.length) { console.error('usage: node terrain-sheet.mjs --levels <level files...> [--preset N|B] [--out sheet.png]'); process.exit(2); }

async function loadPlaywright() {
  const tries = [() => import('playwright')];
  const fromDir = (dir) => () => import(pathToFileURL(createRequire(path.join(dir, 'x.js')).resolve('playwright')).href);
  tries.push(fromDir(process.cwd()));
  for (const p of (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)) tries.push(fromDir(p));
  try { tries.push(fromDir(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim())); } catch { /* no npm */ }
  for (const t of tries) {
    try { const m = await t(); const pw = m.chromium ? m : m.default; if (pw && pw.chromium) return pw; } catch { /* next */ }
  }
  console.error('Playwright is not installed. In the game folder: npm install --save-dev playwright && npx playwright install chromium');
  process.exit(3);
}

const conf = {
  preset: opt('preset', 'N'),
  style: opt('style') ? JSON.parse(fs.readFileSync(opt('style'), 'utf8')) : null,
  tile: Number(opt('tile', 32)),
  island: flag('island'),
  player: opt('player') != null ? Number(opt('player')) : null,
  rooms: opt('rooms') ? opt('rooms').split(',').map(Number) : null,
  cols: Number(opt('cols', 2)),
  scale: Number(opt('scale', 0.5)),
  each: !!opt('each'),
};
const out = path.resolve(opt('out', 'terrain-sheet.png'));
const eachDir = opt('each') ? path.resolve(opt('each')) : null;

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, args: ['--mute-audio'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.setContent('<!doctype html><html><body style="margin:0;background:#111"></body></html>');
  await page.addScriptTag({ content: 'window.module = undefined;' });
  await page.addScriptTag({ path: path.join(HERE, 'edge-terrain.js') });
  for (const f of levels) await page.addScriptTag({ path: path.resolve(f) });
  const result = await page.evaluate((c) => {
    const ET = window.EdgeTerrain;
    let rooms = (window.SECTIONS && [...window.SECTIONS].sort((a, b) => a.number - b.number).flatMap(s => s.rooms))
      || window.ROOMS || window.LEVELS || [];
    rooms = rooms.map((r, i) => (Array.isArray(r) ? { name: `room ${i + 1}`, grid: r } : r)).map((r, i) => ({ ...r, n: i + 1 }));
    if (c.rooms) rooms = rooms.filter(r => c.rooms.includes(r.n));
    const style = c.style || ET.presets[c.preset];
    const T = c.tile;
    const shots = [];
    const t0 = performance.now();
    for (const r of rooms) {
      const a = performance.now();
      const terr = ET.render({ grid: r.grid, style, art: T / 2, scale: 2, island: c.island, player: c.player ?? undefined, seed: 0 });
      const ms = performance.now() - a;
      const cv = document.createElement('canvas');
      cv.width = terr.width; cv.height = terr.height;
      const g = cv.getContext('2d');
      g.fillStyle = style.background || '#0a0f2a'; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(terr, 0, 0);
      r.grid.forEach((row, y) => [...row].forEach((ch, x) => {      // flat markers for objects
        const X = x * T, Y = y * T;
        if (ch === '^') { g.fillStyle = '#e03a5a'; for (const o of [0, T / 2]) { g.beginPath(); g.moveTo(X + o, Y + T); g.lineTo(X + o + T / 4, Y + 4); g.lineTo(X + o + T / 2, Y + T); g.fill(); } }
        else if (ch === 'C') { g.fillStyle = '#b87a40'; g.fillRect(X + 1, Y + 1, T - 2, T - 2); }
        else if (ch === 'S') { g.fillStyle = '#5fd36b'; g.fillRect(X + 1, Y + T - 8, T - 2, 8); }
        else if (ch === 'O') { g.fillStyle = '#6ff2e8'; g.fillRect(X + T / 2 - 6, Y + T / 2 - 6, 12, 12); }
        else if ('DGBK'.includes(ch)) { g.fillStyle = { D: '#c58b5c', G: '#ffe14d', B: '#b48cf0', K: '#6b7390' }[ch]; g.fillRect(X + 4, Y - T, T - 8, 2 * T); }
        else if (ch === 'P') { g.fillStyle = '#f2b134'; g.fillRect(X + 2, Y + T - 28, 28, 28); }
      }));
      shots.push({ n: r.n, name: r.name || '', w: cv.width, h: cv.height, ms, url: c.each ? cv.toDataURL('image/png') : null, cv });
    }
    const total = performance.now() - t0;
    // contact sheet: rows of rooms, wide rooms scaled to the same height
    const S = c.scale, cellW = 800 * S, labelH = 18, pad = 8;
    const colsN = c.cols;
    const items = shots.map(s => ({ ...s, dw: Math.round(s.w * S), dh: Math.round(s.h * S) }));
    let x = pad, y = pad, rowH = 0, sheetW = colsN * (cellW + pad) + pad;
    for (const it of items) {
      const span = Math.max(1, Math.ceil(it.dw / cellW));
      if (x + it.dw > sheetW - pad + 1 && x > pad) { x = pad; y += rowH + labelH + pad; rowH = 0; }
      if (it.dw > sheetW - 2 * pad) sheetW = it.dw + 2 * pad;
      it.x = x; it.y = y; x += span * (cellW + pad); rowH = Math.max(rowH, it.dh);
    }
    const sheet = document.createElement('canvas');
    sheet.width = sheetW; sheet.height = y + rowH + labelH + pad;
    const sg = sheet.getContext('2d');
    sg.fillStyle = '#16161c'; sg.fillRect(0, 0, sheet.width, sheet.height);
    sg.imageSmoothingEnabled = S < 1; sg.font = '13px sans-serif'; sg.fillStyle = '#ddd';
    for (const it of items) {
      sg.fillText(`${it.n}. ${it.name}  (${it.w / c.tile}x${it.h / c.tile} tiles, ${it.ms.toFixed(0)} ms)`, it.x, it.y + 13);
      sg.drawImage(it.cv, it.x, it.y + labelH, it.dw, it.dh);
    }
    return { sheet: sheet.toDataURL('image/png'), total, each: shots.map(s => ({ n: s.n, name: s.name, url: s.url, ms: s.ms })) };
  }, conf);
  fs.writeFileSync(out, Buffer.from(result.sheet.split(',')[1], 'base64'));
  if (eachDir) {
    fs.mkdirSync(eachDir, { recursive: true });
    for (const s of result.each) {
      const file = path.join(eachDir, `room${String(s.n).padStart(2, '0')}_1x.png`);
      fs.writeFileSync(file, Buffer.from(s.url.split(',')[1], 'base64'));
      // 2x for close inspection
      const p2 = await browser.newPage();
      const big = await p2.evaluate(async (u) => {
        const im = new Image(); im.src = u; await im.decode();
        const cv = document.createElement('canvas'); cv.width = im.width * 2; cv.height = im.height * 2;
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, cv.width, cv.height);
        return cv.toDataURL('image/png');
      }, s.url);
      await p2.close();
      fs.writeFileSync(file.replace('_1x', '_2x'), Buffer.from(big.split(',')[1], 'base64'));
    }
  }
  console.log(`rendered ${result.each.length} rooms in ${result.total.toFixed(0)} ms (slowest ${Math.max(...result.each.map(s => s.ms)).toFixed(0)} ms) -> ${out}`);
} finally {
  await browser.close();
}
