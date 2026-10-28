# Checking

Look at the animation slowed down and frame by frame, and prove the game plays the same. `<skill>/scripts/anim-sheet.mjs` films the hero with the game's own drawing in headless Chromium (muted, on a fixed 1/60 s clock, so a run repeats exactly).

## The hook

Add this to the game (Phaser shown; test only, it never changes play). `hero()` is required; `stage()`, `solo()` and `render()` make the contact sheet better.

```js
// Hook for the character-animation skill's anim-sheet.mjs
const ANIM_STAGE = [...Array(12).fill('.'.repeat(25)), '...P.....................', '#'.repeat(25), '#'.repeat(25)];
window.__anim = {
  stage: () => { this.loadRoom(-1, ANIM_STAGE); this.player.body.setVelocity(0, 0); },  // a flat floor to run and jump on
  hero: () => {                       // canvas px: x = centre, y = feet; state/frame = what the drawing code chose
    const cam = this.cameras.main, h = this.heroSprite;
    return { x: h.x - cam.scrollX + cam.x, y: h.y + FEET * h.scaleY - cam.scrollY + cam.y,
             state: this.animState, frame: h.frame.name, flip: h.flipX };
  },
  solo: (on) => {                     // only the hero and its chain, on #ff00ff (keyed out by the script)
    const cam = this.cameras.main;
    if (on) {
      const keep = new Set([this.heroSprite, this.scarfGfx]);
      this.animHidden = this.children.list.filter(o => o.visible && !keep.has(o));
      this.animHidden.forEach(o => o.setVisible(false));
      this.animBg = [cam.backgroundColor, cam.transparent];
      cam.setBackgroundColor(0xff00ff);
    } else {
      this.animHidden.forEach(o => o.setVisible(true));
      [cam.backgroundColor, cam.transparent] = this.animBg;
    }
  },
  render: () => { const g = this.game; g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender(); },
};
```

Use the game's real room loader for `stage()` (one wide, flat room is enough) and real names for the sprite and the chain's Graphics. If the game has the platformer-levels hook (`window.__levels.state()`), the script also records the body every frame.

## Film it

From the game's folder (Playwright and Chromium installed, as for the measurer):

```
SEQ="none:0.8, right:0.7, right+jump:0.4, right:0.5, none:0.5, left:0.25, none:0.4, jump:0.25, none:0.2, jump:0.2, none:1"
node <skill>/scripts/anim-sheet.mjs index.html --seq "$SEQ" --out anim/before
# ... make the change ...
node <skill>/scripts/anim-sheet.mjs index.html --seq "$SEQ" --out anim/after --compare anim/before/frames.json
```

That sequence covers idle, idle variation, run, a held jump while running (rise, apex, fall, land), stopping, turning, a short jump with an air jump and a landing. Add steps for what the game has: a spring (`--room N` with a spring room), a death and respawn, long idle (`none:6`). A full run with the clip takes under a minute; `--no-clip` for a quick contact sheet.

Outputs: `contact.png` (one row per step; a cell every 3 game frames; faint copies of the two cells before, at their real offset, show the arc and spacing; the line is the feet; the drawn frame's name under each cell), `clip.mp4` and `clip.gif` (the area the hero moved through, 4× slower, 2× size), `frames.json` (state, drawing, position and body for every game frame).

## Look for

On the contact sheet:

- every state in the list shows up, with its own outline; you can name the state of a cell without its label;
- the face is identical in every cell (shared parts), and nothing covers it;
- spacing: wide gaps between onion copies where it's fast, tight ones at the apex and the landing (holds);
- the chain trails when running, hangs below when rising, lifts when falling, swings forward and settles after a stop, flips cleanly on a turn, and never pokes through the floor at idle;
- the landing crouch shows after real falls only, and the take-off beat for at most one cell;
- palette cues switch on the right frame (spent / ready), the chain included;
- no stray pixels: the chain sits on the sprite's pixel grid with an outline that matches.

In the clip, at real speed (`--slow 1`) and slowed: nothing pops, jitters or lags behind the body, and the run doesn't skate.

## Gameplay is unchanged

1. `--compare` prints `body identical in all N frames`. Anything else means the animation touched play.
2. Run the game's measurement before and after (with platformer-levels: `measure-difficulty.mjs index.html levels/routes.mjs --check`, then a few rooms with `--rooms`); the room lines must be identical.
3. Run the game's tests (`npm test`).

## Report

- The state list with each state's trigger, drawings and timings (the table from [timing.md](timing.md), filled in).
- The chain's numbers and what it is anchored to.
- What the juice still owns, and any squash you lowered to make room for a drawn pose.
- The before/after contact sheets and clips, the compare line, the measurements and the tests.
- Anything left unfixed and why.
