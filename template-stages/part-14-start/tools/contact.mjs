// node tools/contact.mjs DIR OUT.png [from] [to] -> a grid of the screenshots in DIR at half size
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [dir, out, from = 0, to = 999] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(+from, +to);
const html = `<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(3,400px);gap:4px;font:11px sans-serif;color:#fff">` +
  files.map(f => `<div><img style="width:400px;display:block" src="data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}">${f}</div>`).join('') + '</body>';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1208, height: 400 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
