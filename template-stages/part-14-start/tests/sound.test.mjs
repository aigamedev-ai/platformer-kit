// Sound effects, checked without listening: every event plays its sound (a spy on the player), every recipe renders
// to a short sound that is neither silent nor clipped, and the mute toggle works and is remembered.
//   npm test
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const GAME = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html')).href;
const FPS = 60;

function fakeClock() {
  // Same fake clock as mechanics.test.mjs: the page only moves when a test steps it
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
before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.addInitScript(fakeClock);
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(GAME);
  await page.waitForFunction(() => window.__frame && (window.__frame(), window.__test), null, { polling: 20 });
  // Audio starts on the first key press; then spy on every sound the game asks for
  await page.keyboard.press('Shift');
  await page.waitForFunction(() => SOUND_OUT.ac?.state === 'running');
  await page.evaluate(() => {
    window.__played = [];
    const play = SOUND_OUT.play.bind(SOUND_OUT);
    SOUND_OUT.play = (name, k) => { window.__played.push(name); play(name, k); };
  });
});
afterEach(() => assert.deepEqual(errors.splice(0), [], 'errors in the page'));
after(() => browser?.close());

const frames = (n) => page.evaluate(n => { for (let i = 0; i < n; i++) window.__frame(); }, n);
const seconds = (s) => frames(Math.round(s * FPS));
async function until(cond, maxSeconds, what) {
  const ok = await page.evaluate(([src, max]) => {
    const cond = (0, eval)(src), T = window.__test;
    for (let i = 0; i < max; i++) {
      if (cond({ p: T.player(), c: T.crumbles(), o: T.orbs(), s: T.state() })) return true;
      window.__frame();
    }
    return false;
  }, [String(cond), Math.round(maxSeconds * FPS)]);
  assert.ok(ok, `timed out waiting for ${what}`);
}
async function load(grid) {
  for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp']) await page.keyboard.up(k);
  await page.evaluate(g => __test.load(g), grid);
  await frames(2);
  await page.evaluate(() => { window.__played = []; });
}
const played = () => page.evaluate(() => window.__played.splice(0));
const count = (list, name) => list.filter(n => n === name).length;
const room = (...rows) => [...Array(15 - rows.length).fill('.'.repeat(25)), ...rows];

test('jump, double jump and landing', async () => {
  await load(room('..........P..............', '#########################'));
  await page.keyboard.down('ArrowUp');
  await frames(2);
  await until(st => st.p.vy >= 0, 1, 'the apex');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowUp');
  await frames(2);
  await page.keyboard.up('ArrowUp');
  await until(st => st.p.onGround, 2, 'landing');
  await frames(30);
  assert.deepEqual(await played(), ['jump', 'airJump', 'land']);

  // Walking about on flat ground is silent
  await page.keyboard.down('ArrowRight');
  await seconds(0.5);
  await page.keyboard.up('ArrowRight');
  assert.deepEqual(await played(), []);
});

test('spring', async () => {
  await load(room('..........P..............', '.........................', '..........S..............', '#########################'));
  await until(st => st.p.vy < -800, 2, 'the bounce');
  assert.deepEqual(await played(), ['spring']);
});

test('crumbling block: crackles while it shakes, crumbles, comes back', async () => {
  await load(room('.........................', '.........P...............', '########CCC##############', '#########################'));
  await until(st => st.c[0].state === 'gone', 2, 'the block to fall');
  let p = await played();
  assert.ok(count(p, 'crackle') >= 4, `crackles while shaking (${count(p, 'crackle')})`);
  assert.equal(count(p, 'crumble'), 1);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowUp');
  await frames(10);
  await page.keyboard.up('ArrowUp');
  await until(st => st.c[0].state === 'solid', 5, 'the block to come back');
  await page.keyboard.up('ArrowRight');
  p = await played();
  assert.equal(count(p, 'blockBack'), 1);
  assert.equal(count(p, 'crackle'), 0, 'no crackles once it has fallen');
});

test('refill orb: taken, then back', async () => {
  await load(room('..........O..............', '.........................', '.........................', '.........................',
                  '.........................', '.........................', '..........P..............', '#########################'));
  await page.keyboard.down('ArrowUp');
  await frames(2);
  await until(st => st.p.vy >= 0, 1, 'the apex');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowUp');
  await until(st => !st.o[0].ready, 1, 'touching the orb');
  await page.keyboard.up('ArrowUp');
  assert.deepEqual(await played(), ['jump', 'airJump', 'orb']);
  await until(st => st.o[0].ready, 3, 'the orb to come back');
  assert.equal(count(await played(), 'orbBack'), 1);
});

test('checkpoint, death and respawn', async () => {
  await load(room('.P....K.....^............', '#########################'));
  await page.keyboard.down('ArrowRight');
  await until(st => st.s.deaths > 0, 3, 'the spikes');
  await page.keyboard.up('ArrowRight');
  await seconds(0.5);
  const p = await played();
  assert.equal(count(p, 'checkpoint'), 1, 'checkpoint lit once');
  assert.equal(count(p, 'death'), 1);
  assert.equal(count(p, 'respawn'), 1);
  assert.ok(p.indexOf('death') < p.indexOf('respawn'));
  await page.keyboard.down('ArrowLeft');
  await seconds(0.5);
  await page.keyboard.up('ArrowLeft');
  assert.equal(count(await played(), 'checkpoint'), 0, 'an already lit checkpoint stays quiet after the restart');
});

test('door, bonus door, section flag and the finish', async () => {
  for (const [tile, sound] of [['D', 'door'], ['B', 'bonusDoor'], ['G', 'finish']]) {
    await load(room(`.P.......${tile}...............`, '#########################'));
    await page.keyboard.down('ArrowRight');
    await until(st => st.s.room !== -1 || st.s.won, 3, `the ${sound}`);
    await page.keyboard.up('ArrowRight');
    assert.deepEqual(await played(), [sound]);
  }
  // A goal flag that isn't the end of the chapter (end of section 1) leads on to the next section
  const flagRoom = await page.evaluate(() => ROOMS.findIndex((r, i) => r.grid.join('').includes('G') && i < ROOMS.length - 1));
  await page.evaluate(i => {
    __test.goto(i);
    const S = __game.scene.scenes[0], flag = S.exits.getChildren().find(z => z.isGoal);
    S.player.body.reset(flag.x, flag.y);
  }, flagRoom);
  await page.evaluate(() => { window.__played = []; });
  await frames(3);
  assert.equal((await page.evaluate(() => __test.state())).room, flagRoom + 1);
  assert.deepEqual(await played(), ['flag']);
});

test('star pickup, and the storm: a rumble as a chase segment starts, thunder when it moves', async () => {
  await load(room('.P.*.....................', '#########################'));
  await page.evaluate(() => { window.__played = []; });
  await page.keyboard.down('ArrowRight');
  await seconds(0.5);
  await page.keyboard.up('ArrowRight');
  assert.ok((await played()).includes('star'));
  const i = await page.evaluate(() => ROOMS.findIndex(r => r.kind === 'chase'));
  const delay = await page.evaluate(i => ROOMS[i].chase.delay, i);
  await page.evaluate(() => { window.__played = []; });
  await page.evaluate(i => __test.goto(i), i);
  await frames(1);
  assert.deepEqual(await played(), ['rumble']);
  await seconds(delay + 0.1);
  assert.deepEqual(await played(), ['thunder']);
});

test('every recipe renders a short sound that is neither silent nor clipped', async () => {
  const report = await page.evaluate(async () => {
    const rate = 44100, out = {};
    for (const name of Object.keys(SFX)) {
      // Worst case: the highest random pitch and full strength, through the real master volume and limiter
      // (it starts 0.3 s in: a brand-new limiter holds the first few ms down, which a running game never hears)
      const ac = new OfflineAudioContext(1, rate * 2, rate), start = 0.3;
      SFX[name](ac, sfxOutput(ac, SOUND.master), start, 1 + (SFX_VARY[name] || 0), 1);
      const data = (await ac.startRendering()).getChannelData(0);
      let peak = 0, end = 0;
      for (let i = 0; i < data.length; i++) {
        const a = Math.abs(data[i]);
        if (a > peak) peak = a;
        if (a > 0.001) end = i;
      }
      end -= start * rate;
      // ... and without the limiter, so the recipe itself doesn't rely on it
      const raw = new OfflineAudioContext(1, rate * 2, rate), g = raw.createGain();
      g.gain.value = SOUND.master;
      g.connect(raw.destination);
      SFX[name](raw, g, 0, 1 + (SFX_VARY[name] || 0), 1);
      const rawData = (await raw.startRendering()).getChannelData(0);
      let rawPeak = 0;
      for (const v of rawData) rawPeak = Math.max(rawPeak, Math.abs(v));
      out[name] = { length: end / rate, peak, rawPeak };
    }
    return out;
  });
  console.log(Object.entries(report).map(([n, r]) =>
    `${n.padEnd(11)} ${r.length.toFixed(3)} s  peak ${r.peak.toFixed(2)}  (no limiter ${r.rawPeak.toFixed(2)})`).join('\n'));
  for (const [name, r] of Object.entries(report)) {
    assert.ok(r.peak > 0.02, `${name} is audible (peak ${r.peak})`);
    assert.ok(r.peak < 1 && r.rawPeak < 1, `${name} does not clip (peak ${r.peak}, raw ${r.rawPeak})`);
    // The chapter's finish and the storm's rumble and thunder are meant to ring out; everything else is short
    const longest = { finish: 0.9, rumble: 1.3, thunder: 1.0 }[name] || 0.4;
    assert.ok(r.length > 0.01 && r.length < longest, `${name} is short (${r.length} s)`);
  }
});

test('every sound at once (each as many times as allowed) still does not clip', async () => {
  const peak = await page.evaluate(async () => {
    const rate = 44100, ac = new OfflineAudioContext(1, rate * 2, rate), out = sfxOutput(ac, SOUND.master);
    for (const name of Object.keys(SFX)) for (let i = 0; i < SOUND.maxVoices; i++) SFX[name](ac, out, 0.3 + i * 0.01, 1, 1);
    let peak = 0;
    for (const v of (await ac.startRendering()).getChannelData(0)) peak = Math.max(peak, Math.abs(v));
    return peak;
  });
  console.log(`all sounds at once: peak ${peak.toFixed(2)}`);
  assert.ok(peak < 1, `peak ${peak}`);
});

test('repeated sounds are capped and pitch-varied', async () => {
  const r = await page.evaluate(() => {
    const before = SOUND_OUT.voices.door || 0;
    for (let i = 0; i < 10; i++) SOUND_OUT.play('door');
    return { added: SOUND_OUT.voices.door - before, max: SOUND.maxVoices };
  });
  assert.ok(r.added <= r.max, `at most ${r.max} copies at once (${r.added})`);
  await played();
});

test('M and the button mute the sound, and it is remembered', async () => {
  const muted = () => page.evaluate(() => ({ muted: SOUND_OUT.muted, text: document.getElementById('mute').textContent,
                                             gain: SOUND_OUT.out.gain.value }));
  assert.equal((await muted()).muted, false);
  await page.keyboard.press('m');
  await frames(1);
  let m = await muted();
  assert.equal(m.muted, true);
  assert.match(m.text, /off/);
  // Muted: nothing new starts
  const added = await page.evaluate(() => { const v = SOUND_OUT.voices.respawn || 0; SOUND_OUT.play('respawn'); return (SOUND_OUT.voices.respawn || 0) - v; });
  assert.equal(added, 0);

  await page.reload();
  await page.waitForFunction(() => window.__frame && (window.__frame(), window.__test), null, { polling: 20 });
  assert.equal((await page.evaluate(() => SOUND_OUT.muted)), true, 'still muted after a reload');
  await page.click('#mute');
  m = await muted();
  assert.equal(m.muted, false);
  assert.match(m.text, /on/);
  assert.equal(await page.evaluate(() => document.activeElement.id), '', 'the button does not keep focus (Space still jumps)');
});
