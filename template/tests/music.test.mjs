// Music, checked without listening: it starts on the first key press, follows the rooms (rest spots, each section,
// the chase rising segment by segment, sunrise, the end screen), keeps its loop through a death (only a dip), and its
// own mute stops notes, is remembered and leaves the effects on. The song itself is checked by
// the game-music skill's scripts/render-music.mjs music/song.js.
//   npm test
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const GAME = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html')).href;

function fakeClock() {
  // Same fake clock as mechanics.test.mjs: the page only moves when a test steps it (the music runs on the audio clock)
  const FRAME = Math.ceil(1000 / 60 * 2 ** 25) / 2 ** 25;
  let now = 0, frameNo = 0;
  const rafs = new Map();
  let nextId = 1;
  window.requestAnimationFrame = (cb) => { const id = nextId++; rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };
  performance.now = () => now;
  window.__frame = () => {
    now = ++frameNo * FRAME;
    const cbs = [...rafs.values()];
    rafs.clear();
    for (const cb of cbs) cb(now);
  };
}

let browser, page;
const errors = [];
async function open() {
  await page.goto(GAME);
  await page.waitForFunction(() => window.__frame && (window.__frame(), window.__test), null, { polling: 20 });
  // Count every note the music makes
  await page.evaluate(() => {
    window.__notes = 0;
    const play = GameMusic.prototype._play;
    GameMusic.prototype._play = function (...a) { window.__notes++; return play.apply(this, a); };
  });
}
async function firstInput() {
  await page.keyboard.press('Shift');
  await page.waitForFunction(() => SOUND_OUT.ac?.state === 'running' && SOUND_OUT.music, null, { polling: 50 });
}
before(async () => {
  browser = await chromium.launch({ args: ['--mute-audio'] });
  page = await browser.newPage();
  await page.addInitScript(fakeClock);
  page.on('pageerror', e => errors.push(String(e)));
  await open();
});
afterEach(() => assert.deepEqual(errors.splice(0), [], 'errors in the page'));
after(() => browser?.close());

const roomIndex = (name) => page.evaluate(n => __levels.rooms.findIndex(r => r.id === n), name);
const goto = async (name) => { await page.evaluate(i => __test.goto(i), await roomIndex(name)); };
const music = () => page.evaluate(() => {
  const m = SOUND_OUT.music;
  return { state: m.state, track: m.cur?.track.name, muted: m.muted, log: m.log.map(e => ({ ...e })) };
});
// Wait until a track switch waiting for its bar has started (rooms here change faster than a bar; in play a switch
// that hasn't started yet is replaced by the next one)
const settle = () => page.waitForFunction(() => { const m = SOUND_OUT.music; return !m.cur || m.cur.t0 <= m.ac.currentTime; }, null, { polling: 50 });
const notesDuring = async (ms) => {
  const a = await page.evaluate(() => window.__notes);
  await page.waitForTimeout(ms);
  return (await page.evaluate(() => window.__notes)) - a;
};

test('nothing before the first input, then the rest spot music', async () => {
  assert.equal(await page.evaluate(() => SOUND_OUT.music), null, 'no music before a key press');
  assert.equal(await page.evaluate(() => SOUND_OUT.musicWanted), 'rest', 'the first room asks for the campfire tune');
  await firstInput();
  const m = await music();
  assert.equal(m.state, 'rest');
  assert.ok(await notesDuring(1500) > 0, 'notes after the first key press');
});

test('the music follows the rooms', async () => {
  const expect = {
    'Trailhead': 'rest', 'Jump': 's1', 'Goal': 's1-test', 'Meadow': 's1-calm', 'Sky steps': 's1-test',
    'Camp': 'rest', 'Cracked floor': 's2', 'Crumble test': 's2-test', 'Solid ground': 's2-calm',
    'Lantern rest': 'rest', 'Orb steps': 's3', 'Still pool': 's3-calm', 'Orb ladder': 's3-test',
    'Ruined gate': 'rest', 'The long way': 's4-test', 'Quiet ledge': 's4-calm', 'Thin air': 's4-test',
    'Watchtower': 'watch', 'Storm 1': 'storm1', 'Storm 2': 'storm2', 'Storm 3': 'storm3', 'Sunrise': 'sunrise',
  };
  for (const [room, state] of Object.entries(expect)) {
    await goto(room);
    assert.equal((await music()).state, state, room);
  }
  // Every room of the chapter has a state the song knows
  const unknown = await page.evaluate(() => ROOMS.map((r, i) => musicStateFor(i)).filter(s => !SONG.states[s]));
  assert.deepEqual(unknown, []);
});

test('track switches wait for the bar; the chase starts on the beat and rises by layers', async () => {
  await settle();
  await goto('Camp');
  await settle();
  await goto('Jump');
  const log = (await music()).log;
  const sw = log.filter(e => e.type === 'track').at(-1);
  assert.equal(sw.track, 's1');
  const bar = 60 / 72 * 4;   // the rest tune's bar
  assert.ok(sw.start - sw.requested <= bar + 0.15, 'switches within a bar');

  await goto('Watchtower');
  await settle();
  await goto('Storm 1');
  let m = await music();
  const chase = m.log.filter(e => e.type === 'track').at(-1);
  assert.equal(chase.track, 'storm', JSON.stringify(m.log.slice(-6)));
  assert.ok(chase.start - chase.requested <= 60 / 72 + 0.15, 'the chase starts within a beat');
  await page.waitForTimeout(1000);
  const switches = m.log.filter(e => e.type === 'track').length;
  await goto('Storm 2');
  await goto('Storm 3');
  m = await music();
  assert.equal(m.log.filter(e => e.type === 'track').length, switches, 'storm 2 and 3 stay on the same loop');
  const layers = m.log.filter(e => e.type === 'layers').slice(-2).map(e => e.levels);
  assert.deepEqual(layers.map(l => [l.chords, l.high]), [[1, 0], [1, 1]], 'a layer more each segment');
  assert.ok(m.log.some(e => e.type === 'speed' && e.speed > 1), 'the last segment a little faster');

  await goto('Sunrise');
  m = await music();
  assert.equal(m.log.filter(e => e.type === 'track').at(-1).track, 'sunrise');
});

test('a death dips the music but never restarts it', async () => {
  await goto('Storm 1');
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => { window.__inst = SOUND_OUT.music.cur; return SOUND_OUT.music.log.length; });
  await page.evaluate(() => __game.scene.scenes[0].die());
  await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__frame(); });   // past the death pause: respawn
  const after = await page.evaluate(() => ({ same: SOUND_OUT.music.cur === window.__inst, log: SOUND_OUT.music.log.slice(0) }));
  const added = after.log.slice(before);
  assert.ok(after.same, 'same loop after the respawn');
  assert.deepEqual(added.filter(e => e.type === 'track'), [], 'no track switch');
  assert.ok(added.some(e => e.type === 'duck'), 'ducked under the death sound');
});

test('the end screen gets the sunrise tune; playing again goes back to the campfire', async () => {
  await goto('Sunrise');
  const S = await page.evaluate(() => { const s = __game.scene.scenes[0]; s.reachExit({ isGoal: true }); return s.won; });
  assert.ok(S, 'the chapter is won');
  assert.equal((await music()).state, 'end');
  await page.evaluate(() => __game.scene.scenes[0].startChapter());
  assert.equal((await music()).state, 'rest');
});

test('music mute: its own key and button, no notes, remembered, effects stay on', async () => {
  await goto('Jump');
  assert.ok(await notesDuring(800) > 0);
  await page.keyboard.press('KeyN');
  let m = await music();
  assert.ok(m.muted);
  assert.equal(await page.evaluate(() => localStorage.getItem('musicMuted')), '1');
  assert.match(await page.textContent('#music'), /Music off/);
  await page.waitForTimeout(300);   // notes already scheduled
  assert.equal(await notesDuring(1000), 0, 'music off makes no notes');
  assert.equal(await page.evaluate(() => SOUND_OUT.muted), false, 'the effects are still on');

  // Remembered across a reload: the music starts muted
  await open();
  assert.match(await page.textContent('#music'), /Music off/);
  await firstInput();
  assert.ok((await music()).muted);
  assert.equal(await notesDuring(1000), 0);

  // The button turns it back on; the main mute (M) silences everything, music included
  await page.click('#music');
  assert.equal((await music()).muted, false);
  assert.ok(await notesDuring(1000) > 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('musicMuted')), '0');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => SOUND_OUT.out.gain.value < 0.01), 'the main mute covers the music');
  await page.keyboard.press('KeyM');
});
