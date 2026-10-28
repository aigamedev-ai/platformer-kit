# States and transitions

Animation reads the game; it never drives it. Each frame, after the physics step (and after any juice has placed its visual), work out the state from the body and the game's events, then pick the drawing.

## Find the states in the code

Read the player code and list, for each state, the exact condition or event. Typical sources:

| State | Comes from |
|---|---|
| idle | on the ground (blocked/touching below) and almost no horizontal speed |
| run | on the ground and moving; the drawing advances with distance travelled |
| turn / skid | on the ground, the input (acceleration) points against the speed |
| rise | in the air, moving up fast |
| apex | in the air, vertical speed small |
| fall | in the air, moving down |
| take-off beat | the jump event (or: was on the ground last frame, now moving up) |
| land beat | was in the air last frame, now on the ground, after falling faster than a threshold |
| air jump | the game's air-jump event (the jump counter goes down in the air) |
| bounce | the spring event |
| death | the death event (the body is often disabled or frozen) |
| respawn | the room reload after a death |
| idle variations | idle for longer than a few seconds |

Prefer the game's own event calls (it usually already tells the juice and the sound about jump, air jump, bounce, death, exit, room loaded) over guessing from velocities. Where you do read velocities, use the same thresholds the game uses, and keep the previous frame's values (was on the ground, last vertical speed) because landing is a change, not a state.

## Order of priority

When several apply, the first one wins:

1. death, respawn (the game is not in control of the hero)
2. a beat that is still running (land, take-off, bounce, air jump), unless it is cut (below)
3. air states: rise, apex, fall
4. ground states: turn, run, idle
5. idle variations, only after idle has lasted long enough

## Beats and how they end

A beat is a short drawn moment on top of a state: the crouch after landing, the crouch on take-off, the stretch of a bounce. It never holds the body. It ends early when:

- the player presses anything that changes the body (jump, a direction) — the new state shows on that same frame;
- the condition behind it stops being true (a land beat ends if the hero leaves the ground; a take-off beat ends if it lands);
- its time is up.

Never queue a state behind a beat. If the landing crouch is still showing when the player jumps, the next frame shows the take-off, not the end of the landing.

## Facing

Face the direction of the input while it's held, else the direction of the speed above a small threshold, else keep the last facing. Flip on the frame it changes. A turn or skid drawing may play while the body slows, but the flip itself is never delayed.

## Transitions to plan

- idle → run: first run drawing at once (a contact pose), not the middle of the cycle.
- run → idle: optionally one settle frame (≤ 100 ms) if the body is still sliding. The chain's swing forward does most of this for free.
- ground → air: take-off beat (only for a real jump, not walking off a ledge), then rise.
- rise → apex → fall: from vertical speed, so a cut jump (released early) passes through apex sooner on its own.
- air → ground: land beat scaled by fall speed; none for tiny hops.
- air jump: a stretch, a spin (juice) or its own drawing; the chain gets no reset, just a kick.
- death → respawn: hide the hero and its chain; on respawn reset the chain at the new spot and let the pop-in play.
- state cues: when the double jump is spent, every drawing and the chain switch palette on the same frame, and switch back on the frame it's restored.

## A small state machine

```js
// called every frame after physics, from the drawing code only
pickState() {
  const b = body, grounded = b.blocked.down, vy = b.velocity.y;
  if (dying) return 'death';
  if (grounded && !this.wasGrounded && this.lastVy > LAND_SPEED) this.beat = { name: 'land', until: t + LAND_MS };
  if (justJumped && this.wasGrounded) this.beat = { name: 'takeoff', until: t + TAKEOFF_MS };
  this.wasGrounded = grounded; this.lastVy = vy;
  if (this.beat && t < this.beat.until && (this.beat.name === 'land') === grounded) return this.beat.name;
  this.beat = null;
  if (!grounded) return vy < -RISE ? 'rise' : vy > FALL ? 'fall' : 'apex';
  if (Math.abs(b.velocity.x) > RUN_MIN) return b.acceleration.x * b.velocity.x < 0 ? 'turn' : 'run';
  return idleTime > 5000 ? 'idle_long' : 'idle';
}
```

Keep the chosen state in a field the `window.__anim` hook can report, so the contact sheet and `frames.json` show it.
