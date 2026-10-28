#!/usr/bin/env node
// tools/sync.mjs: copy the scripts the skills ship to the places that run them outside Claude Code.
// The skills in plugins/platformer-kit/skills are the only source; never edit the copies.
//   node tools/sync.mjs           copy
//   node tools/sync.mjs --check   fail if any copy differs from its source (used in CI)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = 'plugins/platformer-kit/skills';
const copies = {
  [`${skills}/platformer-levels/scripts/measure-difficulty.mjs`]: ['tools/lib/measure-difficulty.mjs', 'template/tools/measure-difficulty.mjs'],
  [`${skills}/pixel-art/scripts/terrain-sheet.mjs`]: ['tools/lib/terrain-sheet.mjs'],
  [`${skills}/pixel-art/scripts/edge-terrain.js`]: ['tools/lib/edge-terrain.js', 'template/art/edge-terrain.js'],
};

const check = process.argv.includes('--check');
let bad = 0;
for (const [src, dests] of Object.entries(copies)) {
  const want = fs.readFileSync(path.join(root, src));
  for (const dest of dests) {
    const file = path.join(root, dest);
    const have = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (have && have.equals(want)) continue;
    if (check) { console.error(`out of date: ${dest} (source: ${src})`); bad++; continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, want);
    console.log(`copied ${src} -> ${dest}`);
  }
}
if (bad) { console.error(`\n${bad} copies differ from the skills. Run: node tools/sync.mjs`); process.exit(1); }
console.log(check ? 'All tool copies match the skills.' : 'Done.');
