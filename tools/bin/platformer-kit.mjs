#!/usr/bin/env node
// platformer-kit <tool> [args]: lets `npx github:aigamedev-ai/platformer-kit measure-difficulty ...` pick a tool.
const tools = { 'measure-difficulty': '../lib/measure-difficulty.mjs', 'terrain-sheet': '../lib/terrain-sheet.mjs' };
const name = process.argv[2];
if (!tools[name]) {
  console.log(`usage: platformer-kit <tool> [args]

  measure-difficulty <game.html|url> <routes> [--check | --playthrough | --shots DIR | ...]
      simulated players for a browser platformer (from the platformer-levels skill)
  terrain-sheet --levels <level files...> [--preset N|B] [--out sheet.png]
      edge-band terrain for every room on one sheet (from the pixel-art skill)

Run a tool with no arguments to see all its options. Both need Playwright with Chromium:
  npm install --save-dev playwright && npx playwright install chromium`);
  process.exit(name ? 2 : 0);
}
process.argv.splice(2, 1);
await import(tools[name]);
