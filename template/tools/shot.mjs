// node tools/shot.mjs OUT_DIR room,room,...  [query]  -> a screenshot of each room's start (1-based numbers)
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [out, list, query = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 900, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.resolve('index.html')).href + query);
await page.waitForFunction(() => window.__levels);
for (const n of list.split(',').map(Number)) {
  await page.evaluate(n => window.__levels.goto(n - 1), n);
  await page.waitForTimeout(700);
  await page.locator('canvas').screenshot({ path: path.join(out, `room${n}.png`) });
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
