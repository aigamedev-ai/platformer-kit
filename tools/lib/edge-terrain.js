/* edge-terrain.js: edge-band terrain for tile-based browser games (no dependencies).
 *
 * The room's solid tiles become one pixel mask. The mask's outline is roughened (caps that rise and overhang,
 * jittered sides, tapered undersides on one-tile platforms, hanging roots and drips), and every solid pixel is
 * shaded by its distance to air in each direction. Interiors are a dark mass near the background value; all detail
 * lives in a thin band along the exposed edges. It works on world pixels, so edges flow across tiles with no seams.
 * Visual only: draw it behind the game's own collision, which stays the tile grid.
 *
 * Browser:  <script src="edge-terrain.js"></script>
 *           const canvas = EdgeTerrain.render({ grid, solid: '#', art: 16, scale: 2, style: EdgeTerrain.presets.N });
 *           this.textures.addCanvas('terrain-' + roomIndex, canvas);      // Phaser: cache once per room
 *           this.add.image(0, 0, 'terrain-' + roomIndex).setOrigin(0).setDepth(-1);
 * Node:     const ET = require('./edge-terrain.js'); const { width, height, data } = ET.renderPixels({ ... });
 *
 * Options
 *   grid     array of strings (one per tile row) or array of arrays of booleans
 *   solid    characters that count as terrain (default '#'); crumbling blocks etc. are objects, not terrain
 *   art      art pixels per tile (default 16). The output is grid size * art * scale.
 *   scale    integer upscale, nearest neighbour (default 2: 16 px art on 32 px tiles)
 *   style    a preset or your own object with the same keys (see presets below)
 *   seed     integer, changes the random detail (default 0 = the prototype's look). Same input -> same pixels.
 *   island   false (default), true, or a tile row such as 13.5: cut the ground off there and give it a tapered rocky
 *            underside, so the room floats. true = 1.5 tiles below the lowest walkable surface. Only for rooms with
 *            nothing at the bottom of the screen (no spike rows down there).
 *   player   the player's height in game px (default 0.9 tile). Undersides and roots never hang lower than the top of
 *            a player standing on the floor below them, so the player is never drawn inside rock. 0 turns this off.
 *   floors   other tile characters the player can stand on, for that check (default 'CS': crumbling blocks, springs)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EdgeTerrain = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- presets (ramps from the prototype)
  const presets = {
    // N: night ruins above the clouds. Moss caps with warm gold tips, cool blue stone, near-black blue interior.
    N: {
      name: 'night-ruins',
      cap: ['#8cbc4c', '#4a8c42', '#25643f', '#17423a', '#0e2a2a'],   // light -> dark: top line, lit, body, deep, shadow
      tips: '#e0b850',                                                 // grass tips on the very top line (or null)
      capMin: 3, capMax: 7,                                           // cap thickness in art px
      overhang: [4, 7],                                                // lip past outer corners, art px
      underCap: '#2c364f',                                             // a 2 px band under the cap (or null)
      rim: { lit: '#435070', mid: '#2c364f', mid2: '#1d2539', dark: '#121829', under: '#1d2539' },
      hang: '#17423a', hangLit: '#25643f', hangTip: '#9a8a36',         // roots under overhangs and ceilings
      fill: ['#0f1426', '#161d33', '#202a44'],                         // interior, pebble, pebble lit
      speck: null,
      background: '#0a0f2a',                                           // what the interior is tuned against
    },
    // B: crystal cavern. Cyan crystal caps, grey-blue stone rims, interior one step above the cave background.
    B: {
      name: 'crystal-cavern',
      cap: ['#74ece0', '#2fb0b8', '#177087', '#0f3448', '#0f3448'],
      tips: '#e0fff2',
      capMin: 3, capMax: 7,
      overhang: [4, 7],
      underCap: '#333a4c',
      rim: { lit: '#333a4c', mid: '#232939', mid2: '#151927', dark: '#0a0b16', under: '#232939' },
      hang: '#232939', hangLit: '#333a4c', hangTip: '#177087',
      fill: ['#0d1322', '#141c30', '#1c2840'],
      speck: '#0f3448',
      background: '#09101d',
    },
  };

  // ---------------------------------------------------------------- noise (bit-exact with the Python prototype)
  function makeHash(seed) {
    const v0 = (2166136261 ^ (seed | 0)) >>> 0;
    return function hsh() {                       // stable integer hash -> [0, 1)
      let v = v0;
      for (let i = 0; i < arguments.length; i++) {
        v = Math.imul((v ^ (Math.trunc(arguments[i]) >>> 0)) >>> 0, 16777619) >>> 0;
      }
      v = (v ^ (v >>> 13)) >>> 0;
      v = Math.imul(v, 0x5bd1e995) >>> 0;
      v = (v ^ (v >>> 15)) >>> 0;
      return v / 4294967296;
    };
  }

  function hexRgb(h) {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }

  function toMask(grid, solid) {
    const rows = grid.length, cols = grid[0].length;
    const chars = typeof solid === 'string' ? solid : '#';
    const m = [];
    for (let r = 0; r < rows; r++) {
      m.push([]);
      for (let c = 0; c < cols; c++) {
        const v = grid[r][c];
        m[r].push(typeof v === 'string' ? chars.includes(v) : !!v);
      }
    }
    return m;
  }

  // ---------------------------------------------------------------- the renderer (art resolution, RGBA)
  function renderPixels(opts) {
    const st = opts.style || presets.N;
    const T = opts.art || 16;
    const hsh = makeHash(opts.seed || 0);
    const vnoise = (x, period, ...seed) => {      // 1-D value noise in [0, 1), smooth every `period` px
      const a = x / period, i = Math.floor(a);
      let f = a - i;
      f = f * f * (3 - 2 * f);
      return hsh(i, ...seed) * (1 - f) + hsh(i + 1, ...seed) * f;
    };
    const solid = toMask(opts.grid, opts.solid);
    const GH = solid.length, GW = solid[0].length;
    const H = GH * T, W = GW * T;
    const idx = (y, x) => y * W + x;

    // headroom: how far (art px) anything may hang below the solid into the air at tile (r, c)
    const scale = opts.scale || 2;
    const playerArt = opts.player === 0 ? 0 : Math.ceil((opts.player != null ? opts.player : 0.9 * T * scale) / scale);
    const floorChars = opts.floors != null ? opts.floors : 'CS';
    const standable = (r, c) => solid[r][c] || (typeof opts.grid[r][c] === 'string' && floorChars.includes(opts.grid[r][c]));
    const hangLimit = (y, x) => {                 // y = first air pixel below the solid
      if (!playerArt) return Infinity;
      const c = (x / T) | 0, r0 = (y / T) | 0;
      if (r0 >= GH || solid[r0][c]) return Infinity;
      let r = r0;
      while (r < GH && !standable(r, c)) r++;
      if (r >= GH) return Infinity;                // nothing to stand on below: a pit, no limit
      return r * T - y - playerArt - 1;
    };

    const base = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) base[idx(y, x)] = solid[(y / T) | 0][(x / T) | 0] ? 1 : 0;
    const M = base.slice();
    const capPx = new Uint8Array(W * H);         // pixels forced to cap material (overhang, bumps, corner climb)
    const hang = new Uint8Array(W * H);          // 1 = hanging rock/root, 2 = drip (cap material)

    // island cut row (art px)
    let cut = 1e9;
    if (opts.island) {
      let row = opts.island === true ? null : Number(opts.island);
      if (row === null) {
        let low = -1;
        for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) if (solid[r][c] && (r === 0 || !solid[r - 1][c])) low = Math.max(low, r);
        row = low + 1.5;
      }
      cut = Math.round(row * T);
      if (cut >= H) cut = 1e9;
    }

    // -- island bottom: the ground ends above the screen bottom and tapers into a rocky underside
    if (cut < H) {
      for (let y = cut; y < H; y++) for (let x = 0; x < W; x++) M[idx(y, x)] = 0;
      let x = 0;
      while (x < W) {
        if (base[idx(cut - 1, x)]) {
          const x0 = x;
          while (x < W && base[idx(cut - 1, x)]) x++;
          const x1 = x - 1, n = x1 - x0 + 1;
          for (let xx = x0; xx <= x1; xx++) {
            const t = (xx - x0) / Math.max(1, n - 1);
            const env = Math.pow(Math.sin(Math.PI * t), 0.7);
            const L = Math.trunc(env * (6 + 8 * hsh(Math.floor(xx / 3), 77)) + 2 * hsh(Math.floor(xx / 2), 78));
            for (let k = 0; k < L; k++) if (cut + k < H) M[idx(cut + k, xx)] = 1;
          }
        } else x++;
      }
    }

    // -- sides: jitter vertical faces by -1/0/+1 px in 5 px runs (below the cap zone)
    {
      const add = [], rem = [];
      for (let y = 0; y < Math.min(H, cut); y++) {
        for (let x = 1; x < W - 1; x++) {
          for (const sgn of [-1, 1]) {
            if (base[idx(y, x)] && !base[idx(y, x + sgn)]) {
              let top = y;
              while (top > 0 && base[idx(top - 1, x)]) top--;
              if (y - top < 7) continue;
              const r = hsh(x, Math.floor(y / 5), sgn, 7);
              if (r < 0.3) rem.push(idx(y, x));
              else if (r > 0.75) add.push(idx(y, x + sgn));
            }
          }
        }
      }
      for (const i of rem) M[i] = 0;
      for (const i of add) M[i] = 1;
    }

    // -- tops: bumps along the walking line, overhangs at outer corners, cap climbing walls at inner corners
    {
      const [oMin, oMax] = st.overhang || [4, 7];
      const spans = [];
      for (let y = 0; y < H; y += T) {
        let x = 0;
        const on = (xx) => base[idx(y, xx)] && (y === 0 || !base[idx(y - 1, xx)]);
        while (x < W) {
          if (on(x)) { const x0 = x; while (x < W && on(x)) x++; spans.push([y, x0, x - 1]); } else x++;
        }
      }
      for (const [y, x0, x1] of spans) {
        let x = x0;
        while (x <= x1) {                          // bumps: 0-2 px above the line, in runs of 2-4 px
          const run = 2 + Math.trunc(hsh(x, y, 1) * 3);
          const b = [0, 0, 0, 1, 1, 2, 2, 3][Math.trunc(hsh(x, y, 2) * 8)];
          let i = 0;
          for (let xx = x; xx < Math.min(x1 + 1, x + run); xx++, i++) {
            const bb = (0 < i && i < run - 1) || b < 2 ? b : b - 1;       // rounded clusters, not bars
            for (let k = 1; k <= bb; k++) if (y - k >= 0) { M[idx(y - k, xx)] = 1; capPx[idx(y - k, xx)] = 1; }
          }
          x += run;
        }
        for (const [end, sgn] of [[x0, -1], [x1, 1]]) {
          const nx = end + sgn;
          if (!(nx >= 0 && nx < W)) continue;
          if (!base[idx(y, nx)] && (y + 1 >= H || !base[idx(y + 1, nx)])) {
            const o = oMin + Math.trunc(hsh(end, y, 3) * (oMax - oMin + 1));   // outer corner: overhang
            for (let k = 0; k < o; k++) {
              for (let j = 1; j <= o - k - (k % 2); j++) {
                const xx = end + sgn * j;
                if (xx >= 0 && xx < W && y + k < H) { M[idx(y + k, xx)] = 1; capPx[idx(y + k, xx)] = 1; }
              }
            }
            for (const [j, L] of [[o - 1, 2 + Math.trunc(hsh(end, y, 4) * 4)], [1, Math.trunc(hsh(end, y, 5) * 3)]]) {
              const xx = end + sgn * j;                // a drip or two off the overhang lip
              for (let k = 0; k < L; k++) {
                const yy = y + o - j + k + 1;
                if (xx >= 0 && xx < W && yy < H && !M[idx(yy, xx)]) hang[idx(yy, xx)] = 2;
              }
            }
          } else if (y >= 1 && base[idx(y - 1, nx)]) {
            const h = 4 + Math.trunc(hsh(end, y, 6) * 5);                   // inner corner: cap climbs the wall
            for (let k = 1; k <= h; k++) {
              for (let j = 0; j < (k < h - 1 ? 2 : 1); j++) {
                const xx = nx + sgn * j;
                if (xx >= 0 && xx < W && y - k >= 0) capPx[idx(y - k, xx)] = 1;
              }
            }
          }
        }
      }
    }

    // -- undersides: one-tile-thick platforms get a tapered rocky underside (little floating islands)
    for (let y = T - 1; y < H - 1; y += T) {
      let x = 0;
      while (x < W) {
        if (base[idx(y, x)] && !base[idx(y + 1, x)] && (y - T < 0 || !base[idx(y - T, x)])) {
          const x0 = x;
          while (x < W && base[idx(y, x)] && !base[idx(y + 1, x)]) x++;
          const x1 = x - 1, n = x1 - x0 + 1;
          for (let xx = x0; xx <= x1; xx++) {
            const xs = xx - (xx % 2);
            const t = (xs - x0 + 1) / Math.max(1, n);
            const env = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t))), 0.6);
            const L = Math.min(Math.trunc(env * (3 + 7 * vnoise(xs, 7, y, 21))), hangLimit(y + 1, xx));
            for (let k = 1; k <= L; k++) if (y + k < H) M[idx(y + k, xx)] = 1;
          }
        } else x++;
      }
    }

    // -- bottoms: roots and rock bits hang from every underside; outer bottom corners get rounded
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        if (M[idx(y, x)] && !M[idx(y + 1, x)] && hang[idx(y + 1, x)] === 0) {
          const r = hsh(Math.floor(x / 2), y, 8);
          if (r < 0.22) {
            const lim = hangLimit(y + 1, x);
            let L = 2 + Math.trunc(hsh(Math.floor(x / 2), y, 9) * 6);
            if (L > lim) L = lim < 2 ? 0 : lim;           // too little headroom: shorter roots, or none
            const w = (x % 2 === 0 && r < 0.1) ? 2 : 1;
            for (let k = 0; k < L; k++) {
              for (let j = 0; j < (k < L - 2 ? w : 1); j++) {
                if (x + j < W && y + 1 + k < H && !M[idx(y + 1 + k, x + j)]) hang[idx(y + 1 + k, x + j)] = 1;
              }
            }
          }
        }
      }
    }
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (M[idx(y, x)] && !M[idx(y + 1, x)] && (!M[idx(y, x - 1)] || !M[idx(y, x + 1)])) M[idx(y, x)] = 0;
      }
    }

    // -- distance (px) from each solid pixel to air straight up/down/left/right. Off-screen: top = air, rest = solid
    const BIG = 99;
    const du = new Int32Array(W * H), dd = new Int32Array(W * H), dl = new Int32Array(W * H), dr = new Int32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) du[idx(y, x)] = M[idx(y, x)] ? (y ? du[idx(y - 1, x)] + 1 : 0) : -1;
    for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) dd[idx(y, x)] = M[idx(y, x)] ? (y < H - 1 ? dd[idx(y + 1, x)] + 1 : BIG) : -1;
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) dl[idx(y, x)] = M[idx(y, x)] ? (x ? dl[idx(y, x - 1)] + 1 : BIG) : -1;
    for (let x = W - 1; x >= 0; x--) for (let y = 0; y < H; y++) dr[idx(y, x)] = M[idx(y, x)] ? (x < W - 1 ? dr[idx(y, x + 1)] + 1 : BIG) : -1;

    // -- shading
    const C = {};
    const col = (h) => C[h] || (C[h] = hexRgb(h));
    const cap = st.cap, rim = st.rim, fill = st.fill;
    const data = new Uint8ClampedArray(W * H * 4);
    const put = (i, h) => { const c = col(h); data[i * 4] = c[0]; data[i * 4 + 1] = c[1]; data[i * 4 + 2] = c[2]; data[i * 4 + 3] = 255; };
    const PEB_A = { '0,0': 2, '1,0': 1, '2,0': 1, '0,1': 1, '1,1': 1 }, PEB_B = { '0,0': 2, '1,0': 1, '0,1': 1 };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = idx(y, x);
        if (!M[i]) {
          const hv = hang[i];
          if (hv === 1) {
            let k = 0;
            while (y - k - 1 >= 0 && !M[idx(y - k - 1, x)]) k++;
            const tip = y + 1 >= H || hang[idx(y + 1, x)] === 0;
            put(i, tip ? st.hangTip : ((x + k) % 3 ? st.hang : st.hangLit));
          } else if (hv === 2) {
            const tip = y + 1 >= H || hang[idx(y + 1, x)] === 0;
            put(i, !tip ? cap[3] : cap[2]);
          }
          continue;
        }
        const u = du[i], d = dd[i], l = dl[i], r = dr[i];
        const ys = y - u;
        const xs = x - (x % 2);                                          // 2 px steps
        let ct = st.capMin + Math.trunc(vnoise(xs, 9, ys, 11) * (st.capMax - st.capMin + 1));
        const cl = vnoise(xs, 5, ys, 16);
        if (cl > 0.78) ct += 2 + Math.trunc((cl - 0.78) * 14);           // heavy clumps that sag lower
        let drip = Math.trunc(hsh(x, ys, 12) * 12);
        drip = drip > 7 ? drip - 7 : 0;                                   // 0 for most columns, 1-4 for a few
        const top = u < 40;
        if (capPx[i] || (top && u < ct)) {
          // cap material: bright top line, darker downward, lit on the left, dark on the right
          let c;
          if (u === 0) c = hsh(Math.floor(x / 2), y, 13) > 0.18 ? cap[0] : cap[1];
          else if (u === 1) c = cap[1];
          else if (u < ct - 2) c = cap[2];
          else c = cap[3];
          if (r === 0 && u > 0) c = cap[4];
          else if (l === 0 && u > 1) c = cap[1];
          if (st.tips && u === 0 && ((capPx[i] && !base[i] && hsh(x, y, 14) > 0.35) || hsh(x, y, 14) > 0.8)) c = st.tips;
          put(i, c);
        } else if (top && u < ct + drip) {
          put(i, u < ct + drip - 1 ? cap[3] : cap[4]);
        } else if (top && u < ct + 2 && st.underCap) {
          put(i, st.underCap);
        } else if (l <= 1) {
          put(i, l === 0 ? rim.lit : rim.mid);
        } else if (r <= 1) {
          put(i, r === 0 ? rim.mid2 : rim.dark);
        } else if (d <= 1) {
          put(i, d === 0 ? rim.under : rim.mid2);
        } else {
          // interior: near-background mass, rare pebbles deep inside
          let c = fill[0];
          if (u > 10 && l > 5 && r > 5 && d > 3) {
            const cx = Math.floor(x / 11), cy = Math.floor(y / 9);
            if (hsh(cx, cy, 15) > 0.72) {
              const px = cx * 11 + 2 + Math.trunc(hsh(cx, cy, 17) * 6), py = cy * 9 + 2 + Math.trunc(hsh(cx, cy, 18) * 5);
              const shape = hsh(cx, cy, 19) > 0.5 ? PEB_B : PEB_A;
              const s = shape[(x - px) + ',' + (y - py)];
              if (s) c = fill[s];
            }
            if (hsh(x, y, 15) < 0.0025 && st.speck) c = st.speck;
          }
          put(i, c);
        }
      }
    }
    return { width: W, height: H, data };
  }

  // ---------------------------------------------------------------- browser: a canvas at game size
  function render(opts) {
    const scale = opts.scale || 2;
    const px = renderPixels(opts);
    const small = document.createElement('canvas');
    small.width = px.width; small.height = px.height;
    small.getContext('2d').putImageData(new ImageData(px.data, px.width, px.height), 0, 0);
    if (scale === 1) return small;
    const big = document.createElement('canvas');
    big.width = px.width * scale; big.height = px.height * scale;
    const g = big.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, big.width, big.height);
    return big;
  }

  return { presets, render, renderPixels, makeHash };
}));
