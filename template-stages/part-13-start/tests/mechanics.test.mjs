// Crumbling blocks, refill orbs and the chapter stats, played in the real game in headless Chromium.
// The page runs on a fake clock that only moves when a test steps it (1/60 s per frame), so every run is the same.
//   npm test
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const GAME = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html')).href;
const FPS = 60;

function fakeClock() {
  // Frame length rounded to a multiple of 2^-25 ms so every delta is exact and Arcade takes one step per frame
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
});
afterEach(() => assert.deepEqual(errors.splice(0), [], 'errors in the page'));
after(() => browser?.close());

const frames = (n) => page.evaluate(n => { for (let i = 0; i < n; i++) window.__frame(); }, n);
const seconds = (s) => frames(Math.round(s * FPS));
// Step until cond(state, arg) holds (state = { p: player, c: crumbles, o: orbs, s: room state }); fail after
// maxSeconds. cond runs in the page, so it gets outside values through arg only.
async function until(cond, maxSeconds = 5, what = String(cond), arg = null) {
  const ok = await page.evaluate(([src, max, arg]) => {
    const cond = (0, eval)(src);
    const T = window.__test;
    for (let i = 0; i < max; i++) {
      if (cond({ p: T.player(), c: T.crumbles(), o: T.orbs(), s: T.state() }, arg)) return true;
      window.__frame();
    }
    return false;
  }, [String(cond), Math.round(maxSeconds * FPS), arg]);
  assert.ok(ok, `timed out waiting for ${what}`);
}
const state = () => page.evaluate(() => ({ p: __test.player(), c: __test.crumbles(), o: __test.orbs(), s: __test.state() }));
async function load(grid) {
  for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp']) await page.keyboard.up(k);
  await page.evaluate(g => __test.load(g), grid);
  await frames(2);
}
const room = (...rows) => [...Array(15 - rows.length).fill('.'.repeat(25)), ...rows];

// ---------------------------------------------------------------- crumbling blocks

test('crumbling block: holds briefly after landing, shakes, falls, then comes back', async () => {
  // Start on solid ground, walk onto a crumbling bridge over a safe lower floor
  await load(room(
    '.P.......................',
    '####CCCC#################',
    '####....#################',
    '#########################',
  ));
  let s = await state();
  assert.deepEqual(s.c, [{ state: 'solid', solid: true }], 'one block for the 4-tile run');

  await frames(30);
  assert.equal((await state()).c[0].state, 'solid', 'standing on normal ground next to it does nothing');

  await page.keyboard.down('ArrowRight');
  await until(st => st.c[0].state === 'shaking', 2, 'the block to start shaking');
  await frames(12);
  await page.keyboard.up('ArrowRight');
  s = await state();
  assert.ok(s.p.x > 4 * 32 + 12 && s.p.x < 8 * 32, `walked onto the bridge without snagging on the seam (x ${s.p.x})`);

  // Still solid for a moment: the player has time to react
  await frames(8);
  s = await state();
  assert.equal(s.c[0].state, 'shaking');
  assert.equal(s.c[0].solid, true);
  assert.equal(s.p.onGround, true, 'still standing on it while it shakes');
  const yOnBridge = s.p.y;

  await until(st => st.c[0].state === 'gone', 0.3, 'the block to fall');
  assert.equal((await state()).c[0].solid, false);
  await until((st, y) => st.p.onGround && st.p.y > y + 20, 1, 'the player to drop to the floor below', yOnBridge);

  // Walk out from under it, then it comes back about CRUMBLE_RETURN (2.5 s) after falling
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowUp');
  await frames(10);
  await page.keyboard.up('ArrowUp');
  await until(st => st.p.x > 9.5 * 32 && st.p.onGround, 2, 'the player to climb out');
  await page.keyboard.up('ArrowRight');
  s = await state();
  assert.equal(s.c[0].state, 'gone', 'not back yet');
  await until(st => st.c[0].state === 'solid', 3, 'the block to come back');
  assert.equal((await state()).c[0].solid, true);
});

test('crumbling block: waits to come back while the player is in its space', async () => {
  // The player drops into the hole the block leaves and stays there, inside its space
  await load(room(
    '.........................',
    '.........P...............',
    '########CCC##############',
    '#########################',
  ));
  await until(st => st.c[0].state === 'gone', 2, 'the block to fall');
  await until(st => st.p.onGround, 1, 'the player to land in the pit');
  await seconds(3.5);
  let s = await state();
  assert.equal(s.c[0].state, 'gone', 'still gone: the player is standing where it would be');
  assert.equal(s.c[0].solid, false);

  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowUp');
  await frames(10);
  await page.keyboard.up('ArrowUp');
  await until(st => st.p.x > 13 * 32, 2, 'the player to climb out');
  await page.keyboard.up('ArrowRight');
  await until(st => st.c[0].state === 'solid', 0.2, 'the block to come back as soon as it is clear');
});

test('crumbling block: bumping it from below or the side does not start it', async () => {
  // Jump up into its underside (low ceiling), then walk into a wall made of it
  await load(room(
    '.........................',
    '.........................',
    '......CCC................',
    '.........................',
    '.......P...........C.....',
    '#########################',
  ));
  await page.keyboard.down('ArrowUp');
  await frames(25);
  await page.keyboard.up('ArrowUp');
  await until(st => st.p.onGround, 2, 'landing after the head bump');
  await page.keyboard.down('ArrowRight');
  await seconds(1.5);
  await page.keyboard.up('ArrowRight');
  const s = await state();
  assert.ok(s.p.x < 19 * 32, 'the side block stopped the player');
  assert.deepEqual(s.c.map(c => c.state), ['solid', 'solid']);
});

test('crumbling block: brushing its top corner while jumping up past it does not start it', async () => {
  // Jump up and right from beside the block: the player slides up its side face and past its top corner while still
  // rising. The feet pass the corner at a different height each try (the start height varies by 1/4 px), so some
  // tries collide with the side face while the feet are within 1 px of the top.
  const grid = room(
    '...C.....................',
    '.........................',
    '.P.......................',
    '#########################',
  );
  const started = await page.evaluate(grid => {
    const S = __game.scene.scenes[0], bad = [];
    for (let lift = 0; lift < 8; lift += 0.25) {
      __test.load(grid); __frame(); __frame();
      S.player.body.reset(48, 13 * 32 + 18 - lift);
      S.keys.RIGHT.isDown = true; S.keys.UP.isDown = true; S.jumpPressed = true;
      for (let i = 0; i < 40 && S.player.body.velocity.y < 0 || i === 0; i++) {
        __frame();
        if (S.crumbleBlocks[0].state !== 'solid' && S.player.body.velocity.y < 0) { bad.push(lift); break; }
      }
      S.keys.RIGHT.isDown = false; S.keys.UP.isDown = false;
    }
    return bad;
  }, grid);
  assert.deepEqual(started, [], 'start heights where rising past the corner started the block');

  // Landing on top afterwards does start it
  await load(grid);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowUp');
  await frames(25);
  await page.keyboard.up('ArrowUp');
  await until(st => st.p.onGround, 2, 'landing on top');
  await page.keyboard.up('ArrowRight');
  const s = await state();
  assert.ok(Math.abs(s.p.y + 14 - 11 * 32) < 1, `landed on the block (feet at ${s.p.y + 14})`);
  assert.equal(s.c[0].state, 'shaking');
});

test('crumbling block: restarting the room puts it back', async () => {
  await load(room(
    '.P.......................',
    '.CC......................',
    '^^^^^^^^^^^^^^^^^^^^^^^^^',
  ));
  await until(st => st.c[0].state === 'gone', 2, 'the block to fall');
  const deaths = (await state()).s.deaths;
  await until((st, d) => st.s.deaths > d, 2, 'the player to fall onto the spikes', deaths);
  // The player respawns standing on it, so it is solid again (and already shaking)
  await until(st => st.c[0].solid && st.p.onGround && st.p.y < 410, 1, 'the room to restart');
});

test('jump buffer counts a crumbling block as ground', async () => {
  // Fall onto a crumbling block and press jump just before landing: the press waits for the block and becomes a
  // ground jump, instead of spending the double jump in the air
  await load(room(
    '..........P..............',
    '.........................',
    '.........................',
    '.........................',
    '.........................',
    '.........................',
    '.........................',
    '.........................',
    '.........CCC.............',
    '.........................',
    '#########################',
  ));
  // Player centre is at y = 370 when standing on the block (top y = 384)
  await until(st => st.p.y >= 345, 2, 'nearly landing');
  await page.keyboard.down('ArrowUp');
  await frames(1);
  let s = await state();
  assert.ok(s.p.vy > 0 && s.p.airJumpsLeft === 1, 'no air jump just above the block');
  await until(st => st.p.vy < 0, 0.2, 'the ground jump');
  await page.keyboard.up('ArrowUp');
  s = await state();
  assert.equal(s.p.airJumpsLeft, 1);
  assert.ok(s.p.vy < -500, `full ground jump (vy ${s.p.vy})`);
});

// ---------------------------------------------------------------- refill orbs

// Ground jump peaks with the player's centre ~112 px up, the double jump ~89 px more. The floor top is at y = 416,
// so the player starts centred at y = 402. An orb in row 6 (centre y = 208) is out of reach of one jump.
const orbRoom = room(
  '..........O..............',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '..........P..............',
  '#########################',
  '#########################',
);

test('refill orb: gives the double jump back in mid-air, then reappears', async () => {
  await load(orbRoom);
  // A single full jump doesn't reach it
  await page.keyboard.down('ArrowUp');
  await frames(2);
  await until(st => st.p.vy >= 0, 1, 'the apex');
  let s = await state();
  assert.deepEqual(s.o, [{ ready: true }]);
  assert.equal(s.p.airJumpsLeft, 1);

  // Double jump up through it: the jump is spent, then given back
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowUp');
  await frames(1);
  assert.equal((await state()).p.airJumpsLeft, 0);
  await until(st => !st.o[0].ready, 1, 'touching the orb');
  s = await state();
  assert.equal(s.p.airJumpsLeft, 1, 'double jump given back');
  assert.equal(s.p.onGround, false);

  // ...and it can be used: a third jump in the same air time
  await page.keyboard.up('ArrowUp');
  await until(st => st.p.vy >= 0, 1, 'the second apex');
  const peak = (await state()).p.y;
  await page.keyboard.down('ArrowUp');
  await frames(1);
  s = await state();
  assert.ok(s.p.vy < -400, `the refilled jump fired (vy ${s.p.vy})`);
  await frames(20);  // hold it: releasing early cuts the jump
  assert.equal(s.p.airJumpsLeft, 0);
  await page.keyboard.up('ArrowUp');
  await until(st => st.p.vy >= 0, 1, 'the third apex');
  assert.ok((await state()).p.y < peak - 30, 'it lifted the player higher');

  // The orb stays gone for a few seconds (ORB_RETURN = 2.5 s from the touch), then comes back
  await until(st => st.p.onGround, 2, 'landing');
  await until(st => st.o[0].ready, 3, 'the orb to come back');
});

test('refill orb: comes back after about 2.5 s', async () => {
  await load(orbRoom);
  await page.keyboard.down('ArrowUp');
  await frames(2);
  await until(st => st.p.vy >= 0, 1, 'the apex');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowUp');
  await until(st => !st.o[0].ready, 1, 'touching the orb');
  await page.keyboard.up('ArrowUp');
  await seconds(2.4);
  assert.equal((await state()).o[0].ready, false, 'still gone at 2.4 s');
  await seconds(0.15);
  assert.equal((await state()).o[0].ready, true, 'back at 2.55 s');
});

test('refill orb: left alone when the double jump is not spent', async () => {
  // Orb in row 9 (centre y = 304): a single ground jump passes straight through it
  await load(room(
    '..........O..............',
    '.........................',
    '.........................',
    '..........P..............',
    '#########################',
    '#########################',
  ));
  await page.keyboard.down('ArrowUp');
  await frames(2);
  await until(st => st.p.vy >= 0, 1, 'the apex');
  await page.keyboard.up('ArrowUp');
  let s = await state();
  assert.ok(s.p.y < 304, 'jumped past the orb');
  assert.deepEqual(s.o, [{ ready: true }], 'orb not used up');
  assert.equal(s.p.airJumpsLeft, 1);

  // Spend the double jump on the way down, then fall back through the orb: now it refills
  await page.keyboard.down('ArrowUp');
  await frames(1);
  await page.keyboard.up('ArrowUp');
  assert.equal((await state()).p.airJumpsLeft, 0);
  await until(st => !st.o[0].ready, 2, 'falling back through the orb');
  assert.equal((await state()).p.airJumpsLeft, 1);
});

test('refill orb: restarting the room puts it back', async () => {
  await load(room(
    '..........O..............',
    '.........................',
    '.........................',
    '.........................',
    '.........................',
    '.........................',
    '..........P.^............',
    '#########################',
  ));
  await page.keyboard.down('ArrowUp');
  await frames(2);
  await until(st => st.p.vy >= 0, 1, 'the apex');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowUp');
  await until(st => !st.o[0].ready, 1, 'touching the orb');
  await page.keyboard.up('ArrowUp');
  await until(st => st.p.onGround, 2, 'landing');
  const deaths = (await state()).s.deaths;
  await page.keyboard.down('ArrowRight');
  await until((st, d) => st.s.deaths > d, 3, 'walking into the spikes', deaths);
  await page.keyboard.up('ArrowRight');
  await until(st => st.o[0].ready && st.p.onGround, 1, 'the room to restart with the orb back');
});

// ---------------------------------------------------------------- deaths, timer, end screen

test('death counter, timer and end screen', async () => {
  await page.evaluate(() => __levels.goto(0));
  await page.keyboard.press('Enter');  // nothing happens unless the end screen is up
  // A fresh chapter: restart from the end screen of a test room with a goal flag
  await load(room(
    '.P...........G...........',
    '#########################',
  ));
  await page.keyboard.down('ArrowRight');
  await until(st => st.s.won, 3, 'reaching the flag in the test room');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Enter');
  await frames(1);
  let st = await page.evaluate(() => __test.stats());
  assert.equal(st.deaths, 0);
  assert.ok(st.time < 0.05, 'timer reset');
  assert.equal(st.endScreen, null);
  assert.equal((await state()).s.room, 0);

  await seconds(2);
  st = await page.evaluate(() => __test.stats());
  assert.ok(Math.abs(st.time - 2) < 0.05, `timer counts game time (${st.time})`);
  assert.equal(st.hud, 'Deaths 0 · 0:02');

  // Die twice on spikes, then reach the flag
  await load(room(
    '.P.^.........G...........',
    '#########################',
  ));
  for (let i = 1; i <= 2; i++) {
    await page.keyboard.down('ArrowRight');
    await until((s, i) => s.s.deaths === i, 3, `death ${i}`, i);
    await page.keyboard.up('ArrowRight');
    await until(s => s.p.onGround && s.p.x < 60, 1, 'the room to restart');
  }
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await frames(20);
  await page.keyboard.up('ArrowUp');
  await until(s => s.s.won, 3, 'reaching the flag');
  await page.keyboard.up('ArrowRight');
  st = await page.evaluate(() => __test.stats());
  assert.equal(st.deaths, 2);
  assert.match(st.endScreen, /Deaths {2}2/);
  const shown = /Time {2}(\d+):(\d\d\.\d\d)/.exec(st.endScreen);
  assert.ok(shown, st.endScreen);
  assert.ok(Math.abs(+shown[1] * 60 + +shown[2] - Math.floor(st.time * 100) / 100) < 1e-6, st.endScreen);

  // The timer stops on the end screen
  await seconds(1);
  assert.equal((await page.evaluate(() => __test.stats())).time, st.time);
});

test('chapter shape: rest spots, calm rooms after hard runs, side rooms with stars, a chase finale', async () => {
  const rooms = await page.evaluate(() => ROOMS.map(r => ({ id: r.name, section: r.section, kind: r.kind, beat: r.beat,
                                                             grid: r.grid.join(''), chase: r.chase || null })));
  const sections = [...new Set(rooms.map(r => r.section))];
  for (const n of sections) {
    const own = rooms.filter(r => r.section === n);
    assert.equal(own[0].kind, 'rest', `section ${n} opens with a rest spot`);
    assert.doesNotMatch(own[0].grid, /[\^C]/, `section ${n}'s rest spot has no hazards`);
    const main = own.filter(r => r.kind !== 'optional');
    assert.ok(main.at(-1).grid.includes('G'), `section ${n} ends at a flag`);
    assert.ok(['rest'].includes(main.at(-1).beat), `section ${n} ends with a calm room`);
  }
  // No more than 3 hard rooms in a row on the main path
  let run = 0;
  for (const r of rooms.filter(r => r.kind !== 'optional')) {
    const hard = r.kind === 'chase' || ['develop', 'twist', 'test'].includes(r.beat);
    run = hard ? run + 1 : 0;
    assert.ok(run <= 3, `4 hard rooms in a row, ending at ${r.id}`);
  }
  // Every side room holds exactly one star; the finale is 3 chase rooms with a schedule, then a calm room
  for (const r of rooms.filter(r => r.kind === 'optional')) assert.equal(r.grid.split('*').length, 2, r.id);
  const last = rooms.filter(r => r.section === sections.at(-1) && r.kind !== 'optional');
  assert.deepEqual(last.map(r => r.kind), ['rest', 'chase', 'chase', 'chase', 'main']);
  assert.ok(last.slice(1, 4).every(r => r.chase.speed > 0));
  // Bad structure is refused when the game starts
  const problems = await page.evaluate(() => {
    const saved = window.SECTIONS;
    const row = '.'.repeat(25), floor = '#'.repeat(25);
    const grid = (...rows) => [...Array(15 - rows.length).fill(row), ...rows];
    window.SECTIONS = [{ number: 1, name: 'x', rooms: [
      { name: 'a', area: 1, beat: 'introduce', grid: grid('.P.......^.............D.', floor) },
      { name: 'b', area: 1, kind: 'chase', beat: 'test', grid: grid('.P.....................G.', floor) },
    ] }];
    try { loadSections(); return 'accepted'; } catch (e) { return e.message; } finally {
      window.SECTIONS = saved;
      document.querySelector('pre')?.remove();
    }
  });
  assert.match(problems, /opens with a rest spot/);
  assert.match(problems, /needs chase: \{ from, delay, speed \}/);
});

// ---------------------------------------------------------------- stars, the map, the chase

test('star: picked up, dropped on a death, counted only when leaving through the exit', async () => {
  const name = 'Crumbling spire';
  const i = await roomIndex(name);
  const at = await page.evaluate(i => { const g = ROOMS[i].grid; const r = g.findIndex(row => row.includes('*'));
                                        return [g[r].indexOf('*'), r]; }, i);
  const door = await page.evaluate(i => { const g = ROOMS[i].grid; const r = g.findIndex(row => row.includes('D'));
                                          return [g[r].indexOf('D'), r]; }, i);
  const stats = () => page.evaluate(() => __test.stats());
  await page.keyboard.press('Enter');
  await page.evaluate(() => __game.scene.scenes[0].startChapter());
  await gotoRoom(name);
  assert.equal((await stats()).starHud, '0 / 5');
  await teleport(at[0], at[1]);
  await frames(2);
  assert.ok((await stats()).holding, 'picked up');
  assert.deepEqual((await stats()).stars, [], 'not counted yet');
  // A death drops it: the room restarts with the star back in place
  await page.evaluate(() => __game.scene.scenes[0].die());
  await seconds(0.5);
  assert.equal((await stats()).holding, false);
  await teleport(at[0], at[1]);
  await frames(2);
  await teleport(door[0], door[1]);
  await frames(3);
  const st = await stats();
  assert.deepEqual(st.stars, [`${name}@${at[0]},${at[1]}`]);
  assert.equal(st.starHud, '1 / 5');
  // Back in the room, the banked star is only an outline that can't be taken again (the game's own loader: the
  // measurer's goto gives the star back for a fresh attempt)
  await page.evaluate(i => __test.goto(i), i);
  await frames(2);
  await teleport(at[0], at[1]);
  await frames(2);
  assert.equal((await stats()).holding, false);
  // Leaving by the bonus door back (not the exit) doesn't count a held star
  await gotoRoom('Orb ladder');
  const j = await roomIndex('Orb ladder');
  const at2 = await page.evaluate(i => { const g = ROOMS[i].grid; const r = g.findIndex(row => row.includes('*'));
                                         return [g[r].indexOf('*'), r]; }, j);
  await teleport(at2[0], at2[1]);
  await frames(2);
  assert.ok((await stats()).holding);
  await teleport(0, 11);  // its bonus door back
  await frames(3);
  assert.equal((await stats()).stars.length, 1);
});

test('map: shown in a rest spot with the right section and counts, gone once the player moves', async () => {
  const stats = () => page.evaluate(() => __test.stats());
  await gotoRoom('Lantern rest');  // section 3
  let st = await stats();
  assert.equal(st.map, 1, 'the map is up as the rest spot loads');
  assert.deepEqual(st.mapInfo.map(s => s.state), ['done', 'done', 'here', 'later', 'later']);
  assert.ok(st.mapInfo.at(-1).finale, 'the storm is marked at the end');
  assert.deepEqual(st.mapInfo.map(s => s.total), [1, 1, 1, 2, 0]);
  assert.equal(st.mapInfo[1].found, 1, 'the star found in section 2 (earlier test)');
  assert.match(st.room, /Section 3 · Refill orbs/);
  // It never blocks input: moving works at once and fades the map
  await page.keyboard.down('ArrowRight');
  await seconds(0.6);
  await page.keyboard.up('ArrowRight');
  st = await stats();
  assert.equal(st.map, 0);
  assert.ok((await state()).p.x > 100, 'the player moved while the map was up');
  // Left alone, it fades by itself after a few seconds
  await gotoRoom('Camp');
  await seconds(2);
  assert.ok((await stats()).map > 0);
  await seconds(2);
  assert.equal((await stats()).map, 0);
  // A main room shows no map
  await gotoRoom('Cracked floor');
  assert.equal((await stats()).map, 0);
});

test('chase: the storm waits, then moves on a fixed schedule; touching it restarts the segment', async () => {
  await gotoRoom('Storm 1');
  const c = await page.evaluate(() => ROOMS.find(r => r.name === 'Storm 1').chase);
  const chase = () => page.evaluate(() => __test.chase());
  assert.equal((await chase()).front, c.from, 'still during the warning');
  await seconds(c.delay - 0.2);
  assert.equal((await chase()).front, c.from);
  await seconds(0.4);
  const t = await page.evaluate(() => __game.scene.scenes[0].roomTime);
  assert.ok(Math.abs((await chase()).front - (c.from + c.speed * (t - c.delay))) < 1e-6, 'front = from + speed × (t − delay)');
  // Standing still, the storm catches the player: a death, and the segment restarts with the storm back at its start
  const deaths = (await state()).s.deaths;
  await until((st, d) => st.s.deaths > d, 4, 'the storm catching the player', deaths);
  await seconds(0.5);
  assert.equal((await chase()).front, c.from);
  assert.equal((await state()).s.room, await roomIndex('Storm 1'));
  // The measurer's hook reports how far ahead the player is and the storm's speed
  const hs = await page.evaluate(() => __levels.state());
  assert.ok(hs.ahead > 0 && hs.hazardSpeed === 0);
  // Other rooms have no storm
  await gotoRoom('Sunrise');
  assert.equal(await chase(), null);
});

// ---------------------------------------------------------------- bonus doors and wide rooms

const roomIndex = (name) => page.evaluate(n => ROOMS.findIndex(r => r.name === n), name);
// Put the player at the middle of tile (col, row) of the current room, standing still
const teleport = (col, row) => page.evaluate(([c, r]) => {
  __game.scene.scenes[0].player.body.reset(c * 32 + 16, r * 32 + 18);
}, [col, row]);
async function gotoRoom(name) {
  for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp']) await page.keyboard.up(k);
  await page.evaluate(i => __levels.goto(i), await roomIndex(name));
  await frames(2);
}

test('bonus door: a side trip that the main path skips', async () => {
  const branch = await roomIndex('Homeward'), bonus = await roomIndex('Last light');
  assert.equal(bonus, branch + 1, 'the optional room is listed right after the room it branches from');
  const room30 = await roomIndex('Spring, crack, spring'), thinAir = await roomIndex('Thin air');
  const bonusCount = async () => (await page.evaluate(() => __test.stats())).bonus;
  const doorOf = (i) => page.evaluate(i => { const g = ROOMS[i].grid; const r = g.findIndex(row => row.includes('D')); return [g[r].indexOf('D'), r]; }, i);

  // The bonus door behind the start sits on a one-tile step: walking left doesn't go in by accident, a hop does
  await gotoRoom('Spring, crack, spring');
  await page.keyboard.down('ArrowLeft');
  await seconds(1);
  assert.equal((await state()).s.room, room30, 'walked into the bonus room without meaning to');
  await page.keyboard.down('ArrowUp');
  await until((st, i) => st.s.room === i, 2, 'hopping into the bonus room', thinAir);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowLeft');
  await frames(2);
  assert.match((await page.evaluate(() => __test.stats())).room, /Bonus room/);

  // Its own bonus door (behind its start) leads back to the start of the branch room, without clearing it
  const before = await bonusCount();
  await page.keyboard.down('ArrowLeft');
  await until((st, i) => st.s.room === i, 2, 'leaving through the way back', room30);
  await page.keyboard.up('ArrowLeft');
  await frames(2);
  assert.equal(await bonusCount(), before);
  let p = (await state()).p;
  assert.ok(p.x < 3 * 32 && p.onGround, 'back at the start of the room it branched from');

  // Its door D clears it and goes on to the main room after the branch room (no replay of the branch room)
  await page.evaluate(i => __levels.goto(i), thinAir);
  await frames(2);
  await teleport(...await doorOf(thinAir));
  await until((st, i) => st.s.room === i, 1, 'the room after the branch room', await roomIndex('Quiet ledge'));
  await frames(2);
  assert.equal(await bonusCount(), before + 1);
  p = (await state()).p;
  assert.ok(p.x < 3 * 32 && p.onGround, 'at the start of the next room');

  // The bonus room off the last room of section 4 leads on to the next section's rest spot
  await page.evaluate(i => __levels.goto(i), bonus);
  await frames(2);
  await teleport(...await doorOf(bonus));
  await until((st, i) => st.s.room === i, 1, 'the storm section', await roomIndex('Watchtower'));

  // The flag in the chapter's last room ends it; the end screen counts the stars and shows the map
  await gotoRoom('Sunrise');
  await page.keyboard.down('ArrowRight');
  await until(st => st.s.won, 5, 'reaching the flag');
  await page.keyboard.up('ArrowRight');
  const end = await page.evaluate(() => __test.stats());
  assert.match(end.endScreen, /Stars {2}\d \/ 5/);
  assert.ok(end.endMap.every(s => s.state === 'done'), 'every section lit on the end screen');

  // A main-path door skips the optional room after it
  await gotoRoom('Spring, crack, spring');
  await teleport(...await doorOf(room30));
  await until((st, i) => st.s.room === i, 1, 'the next main room', await roomIndex('Quiet ledge'));
});

test('checkpoint: after touching it, a death restarts the room there; leaving the room forgets it', async () => {
  const grid = room(
    '.P...KK....^.............',
    '#########################',
  );
  await load(grid);
  const cp = () => page.evaluate(() => __test.checkpoint());
  assert.equal(await cp(), null);
  await page.keyboard.down('ArrowRight');
  await until(() => window.__test.checkpoint(), 2, 'touching the checkpoint');
  await until(() => window.__game.scene.scenes[0].dying, 2, 'running into the spikes');
  await page.keyboard.up('ArrowRight');
  await seconds(0.5);
  const p = (await state()).p;
  assert.ok(Math.abs(p.x - (6 * 32 - 14)) < 1 && p.onGround, `restarted at the checkpoint (x ${p.x})`);
  assert.deepEqual(await cp(), { x: 6 * 32 - 14, y: 14 * 32 - 14 });
  // Loading a room (a new room, or the measurer's goto) starts at P again
  await load(grid);
  assert.equal(await cp(), null);
  assert.ok(Math.abs((await state()).p.x - 48) < 1);
});

test('wide room: the camera follows the player and the HUD stays put', async () => {
  await gotoRoom('The long way');
  const width = await page.evaluate(() => ROOMS.find(r => r.name === 'The long way').grid[0].length * 32);
  assert.ok(width > 800);
  assert.equal(await page.evaluate(() => __game.scene.scenes[0].physics.world.bounds.width), width);
  assert.equal((await page.evaluate(() => __test.stats())).scrollX, 0, 'starts at the left edge');
  await teleport(40, 9);  // the rest platform, well into the second screen
  await frames(2);
  const st = await page.evaluate(() => __test.stats());
  const p = (await state()).p;
  assert.ok(Math.abs(st.scrollX + 400 - p.x) < 1, `camera centred on the player (scroll ${st.scrollX}, x ${p.x})`);
  assert.equal(await page.evaluate(() => __game.scene.scenes[0].statsText.scrollFactorX), 0);
  // Restarting the room puts the camera back at the start straight away
  await page.evaluate(i => __levels.goto(i), await roomIndex('The long way'));
  await frames(1);
  assert.equal((await page.evaluate(() => __test.stats())).scrollX, 0);
});
