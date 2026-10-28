// secondary-motion.js: scarves, hair, capes, tails and dangling props that follow a character, drawn as pixels.
// Part of the character-animation skill. No dependencies. Works as a plain <script> (window.SecondaryMotion),
// as a CommonJS module and from an ES module (import './secondary-motion.js' then use globalThis.SecondaryMotion).
//
//   const scarf = SecondaryMotion.chain({ points: 6, segment: 4 });   // 6 points, 4 px apart (2 art px at 2x)
//   // every frame, after the physics step:
//   const pts = scarf.update(dt, neckX, neckY, { x: body.velocity.x, y: body.velocity.y }, { facing });
//   const px = SecondaryMotion.raster(pts, { pixel: 2, originX: spriteLeft, originY: spriteTop, widths: [2, 2, 1] });
//   SecondaryMotion.paint(px, colours, (x, y, w, h, c) => g.fillStyle(c).fillRect(x, y, w, h));   // Phaser Graphics
//
//   const sway = SecondaryMotion.spring({ hz: 3, damping: 0.35 });     // one number that lags and overshoots
//   lantern.angle = sway.update(dt, -body.velocity.x * 0.05);
//
// Decoration only: nothing here may feed back into a body, a velocity, a timer or input.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecondaryMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STEP = 1 / 120;   // fixed sub-step: the same motion at 30, 60 or 144 fps
  const clamp01 = (t) => Math.min(1, Math.max(0, t));

  // A chain of points hanging from an anchor (Verlet integration, follow-the-leader lengths).
  // Each point keeps its last position; the gap between the two is its velocity, so the chain keeps moving after
  // the anchor stops (follow-through) and the tip lags behind the root (overlapping action).
  //   points     number of points including the anchor (4-8 for a scarf or a ponytail)
  //   segment    distance between points in game px (an even number of art px reads best)
  //   gravity    px/s^2 pulling the points down (the game's gravity or a bit less: cloth is light)
  //   drag       share of each point's speed lost per 1/60 s against still air (0.05 heavy rope .. 0.3 ribbon).
  //              This is what makes it trail behind a running character.
  //   stiffness  0..1, how hard each point is pulled toward its rest place per 1/60 s. 0 = a loose rope that only
  //              hangs; 0.2-0.4 keeps the drawn shape readable; 1 = rigid.
  //   rest       [x, y] direction of the rest shape for a character facing right ([-1, 0.5] = back and a bit down)
  //   flow       0..1, how far motion bends the rest shape to point against the velocity (streams back while
  //              running, hangs below while rising, lifts while falling); reaches full at flowSpeed px/s
  //   flowSpeed  px/s at which flow is full (about the run speed)
  //   floor      optional: points never go below this y (pass the feet y in update() options instead to follow it)
  //   teleport   if the anchor jumps further than this in one update (respawn, room change), the chain resets
  function chain(opts = {}) {
    const o = Object.assign({ points: 6, segment: 4, gravity: 900, drag: 0.15, stiffness: 0.25, rest: [-1, 0.6],
      flow: 0.7, flowSpeed: 260, floor: null, teleport: 80 }, opts);
    const n = Math.max(2, o.points | 0);
    const pts = Array.from({ length: n }, () => ({ x: 0, y: 0, px: 0, py: 0 }));
    let acc = 0, ax = null, ay = null, facing = 1, started = false;

    const restDir = (vx, vy) => {
      let rx = o.rest[0] * facing, ry = o.rest[1];
      const rl = Math.hypot(rx, ry) || 1; rx /= rl; ry /= rl;
      const sp = Math.hypot(vx, vy);
      if (sp > 1 && o.flow > 0) {
        const k = o.flow * clamp01(sp / o.flowSpeed);
        rx = rx * (1 - k) - (vx / sp) * k;
        ry = ry * (1 - k) - (vy / sp) * k;
        const l = Math.hypot(rx, ry) || 1; rx /= l; ry /= l;
      }
      return [rx, ry];
    };

    function reset(x, y, face = facing) {
      facing = face < 0 ? -1 : 1;
      const [rx, ry] = restDir(0, 0);
      pts.forEach((p, i) => { p.x = p.px = x + rx * o.segment * i; p.y = p.py = y + ry * o.segment * i; });
      ax = x; ay = y; acc = 0; started = true;
      return pts;
    }

    // dt in seconds; (x, y) the anchor in game px; velocity {x, y} of the character in px/s.
    // options: facing (1 or -1), floor (y the points may not pass), gravity (override, e.g. 0 underwater)
    function update(dt, x, y, velocity = { x: 0, y: 0 }, options = {}) {
      if (options.facing) facing = options.facing < 0 ? -1 : 1;
      if (!started || Math.hypot(x - ax, y - ay) > o.teleport) return reset(x, y);
      const floor = options.floor ?? o.floor, g = options.gravity ?? o.gravity;
      const keep = Math.pow(1 - clamp01(o.drag), STEP * 60);          // drag per sub-step
      const pull = 1 - Math.pow(1 - clamp01(o.stiffness), STEP * 60);
      const [rx, ry] = restDir(velocity.x || 0, velocity.y || 0);
      acc = Math.min(acc + Math.max(0, dt), 0.1);                      // after a long stall, don't fast-forward
      const steps = Math.floor(acc / STEP);
      const x0 = ax, y0 = ay;
      for (let s = 1; s <= steps; s++) {
        // move the anchor along the frame's path, so a fast anchor doesn't yank the chain in one jump
        const t = s / steps;
        pts[0].x = pts[0].px = x0 + (x - x0) * t;
        pts[0].y = pts[0].py = y0 + (y - y0) * t;
        for (let i = 1; i < n; i++) {
          const p = pts[i];
          const vx = (p.x - p.px) * keep, vy = (p.y - p.py) * keep;
          p.px = p.x; p.py = p.y;
          p.x += vx; p.y += vy + g * STEP * STEP;
          // pull toward the rest place: the point before plus one segment along the rest direction
          const q = pts[i - 1];
          p.x += (q.x + rx * o.segment - p.x) * pull;
          p.y += (q.y + ry * o.segment - p.y) * pull;
        }
        // lengths: one pass from the anchor outward, moving only the outer point (exact, can't blow up)
        for (let i = 1; i < n; i++) {
          const p = pts[i], q = pts[i - 1];
          const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1e-6;
          p.x = q.x + dx / d * o.segment;
          p.y = q.y + dy / d * o.segment;
          if (floor != null && p.y > floor) { p.y = floor; p.py = Math.min(p.py, floor); }
        }
      }
      acc -= steps * STEP;
      if (!steps) { pts[0].x = pts[0].px = x; pts[0].y = pts[0].py = y; }
      ax = x; ay = y;
      return pts;
    }

    // add a velocity (px/s) to the chain, more toward the tip: a landing flop, a hit, a gust
    function kick(vx, vy) {
      pts.forEach((p, i) => { const k = i / (n - 1); p.px -= vx * STEP * k; p.py -= vy * STEP * k; });
    }

    return { update, reset, kick, points: pts, options: o };
  }

  // A damped spring for one number (an angle, an offset): it chases the target, lags and overshoots.
  //   hz       how fast it swings (1-2 heavy lantern, 4-6 antenna or ear)
  //   damping  0..1 damping ratio: 0.2 wobbly, 0.5 one small overshoot, 1 no overshoot
  function spring(opts = {}) {
    const o = Object.assign({ hz: 3, damping: 0.4, value: 0 }, opts);
    let x = o.value, v = 0, acc = 0;
    const w = 2 * Math.PI * o.hz;
    return {
      update(dt, target) {
        acc = Math.min(acc + Math.max(0, dt), 0.1);
        for (; acc >= STEP; acc -= STEP) {
          v += (-(w * w) * (x - target) - 2 * o.damping * w * v) * STEP;   // semi-implicit Euler
          x += v * STEP;
        }
        return x;
      },
      kick(dv) { v += dv; },
      reset(value = 0) { x = value; v = 0; acc = 0; },
      get value() { return x; },
    };
  }

  // Points -> art pixels, on the sprite's own pixel grid (so the chain never sits half a pixel off the body).
  //   pixel     game px per art px (2 for art drawn at 2x)
  //   originX/Y game position of any pixel corner of the sprite's grid (e.g. its top-left corner)
  //   widths    thickness in art px from the root to the tip; the last value repeats ([2, 2, 1] = thick root)
  // Returns { pixel, cells: [{ x, y, cx, cy, shade }], outline: [{ x, y }] } where x, y are game px of the
  // pixel's top-left corner and shade is 'light' (open above), 'dark' (open below) or 'base'.
  function raster(points, opts = {}) {
    const o = Object.assign({ pixel: 2, originX: 0, originY: 0, widths: [2, 1], outline: true }, opts);
    const P = o.pixel, set = new Map(), key = (cx, cy) => cx + ',' + cy;
    const toCell = (p) => [Math.round((p.x - o.originX) / P - 0.5), Math.round((p.y - o.originY) / P - 0.5)];
    const put = (cx, cy, w) => {
      const lo = -Math.floor((w - 1) / 2);
      for (let dy = lo; dy < lo + w; dy++) for (let dx = lo; dx < lo + w; dx++) set.set(key(cx + dx, cy + dy), [cx + dx, cy + dy]);
    };
    for (let i = 0; i < points.length - 1; i++) {
      const w = o.widths[Math.min(i, o.widths.length - 1)];
      let [x0, y0] = toCell(points[i]);
      const [x1, y1] = toCell(points[i + 1]);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {                                                   // Bresenham line, so there are no gaps
        put(x0, y0, w);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    const has = (cx, cy) => set.has(key(cx, cy));
    const cells = [...set.values()].map(([cx, cy]) => {
      const up = has(cx, cy - 1), down = has(cx, cy + 1);
      return { cx, cy, x: o.originX + cx * P, y: o.originY + cy * P, shade: !up && down ? 'light' : up && !down ? 'dark' : 'base' };
    });
    const outline = [];
    if (o.outline) {
      const seen = new Set();
      for (const c of cells) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = c.cx + dx, ny = c.cy + dy, k = key(nx, ny);
          if (!set.has(k) && !seen.has(k)) { seen.add(k); outline.push({ x: o.originX + nx * P, y: o.originY + ny * P }); }
        }
      }
    }
    return { pixel: P, cells, outline };
  }

  // Draw a raster with any rectangle function: colours = { base, light, dark, outline } (null outline = none).
  function paint(r, colours, fillRect) {
    if (colours.outline != null) for (const c of r.outline) fillRect(c.x, c.y, r.pixel, r.pixel, colours.outline);
    for (const c of r.cells) fillRect(c.x, c.y, r.pixel, r.pixel, colours[c.shade] ?? colours.base);
  }

  return { chain, spring, raster, paint, STEP };
});
