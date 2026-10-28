// Routes for the difficulty measurer (tools/measure-difficulty.mjs, from the platformer-levels skill):
// every levels/section-N.routes.json (room name -> steps), merged in section order.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir)
  .map(f => ({ f, n: +(/^section-(\d+)\.routes\.json$/.exec(f) || [])[1] }))
  .filter(x => x.n)
  .sort((a, b) => a.n - b.n);
const rooms = {};
for (const { f } of files) {
  for (const [id, steps] of Object.entries(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))) {
    if (id in rooms) throw new Error(`${f}: room "${id}" already has a route in an earlier section`);
    rooms[id] = steps;
  }
}

export default { keys: { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp' }, rooms };
