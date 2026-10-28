# Frames and timings

Starting numbers for a hero 16–18 art px tall, drawn at 2×, in a 60 fps game. Tune by eye on the contact sheet and the slowed clip. Times are in ms; time everything with the frame's delta, never by counting frames.

| State | Drawn frames | Time per frame | Notes |
|---|---|---|---|
| Idle | 2–4 | 300–500 | A 1 px breath or bob. Two frames are enough at this size. |
| Idle variation | 1–3 | blink 100–150; look 1–3 s | Blink every 3–4 s. After 4–6 s of idle, a longer one (look up, adjust scarf). Any input ends it at once. |
| Run | 4 (6–8 if there's room) | 80–120, or by distance | Better: advance one frame every N px travelled (about the stride, e.g. 14 px at 2×), so the feet never skate and the cycle speeds up with the body. Drop 1 px on contact frames. |
| Turn / skid | 0–1 | while the input opposes the speed | Flip on the frame the direction changes. A skid pose may show while the body slows, but never hold the flip back. |
| Take-off | 1 crouch frame | ≤ 50 | Visual only: the body is already rising. Skip it for coyote jumps (no ground under the feet). |
| Rise | 1 | while rising fast | E.g. speed up faster than ~20% of the jump speed. |
| Apex | 1 | while the vertical speed is small | Makes the top of the jump read as a float. Optional at 16 px. |
| Fall | 1–2 | — | A second, more stretched frame at high fall speed. |
| Land | 1–2 | 80–120 total | Only after a real fall (faster than ~200 px/s); scale with fall speed. Any input or leaving the ground ends it. |
| Air jump | 1, or a spin | 150–260 | The juice may spin the sprite; kick the chain. |
| Bounce (spring) | 1 stretch frame | 100–150 | Kick the chain down, so it snaps after the launch. |
| Death | hit pause, then a burst | pause 50–100 | Usually juice. The burst ends before the respawn. |
| Respawn | 2–4, or a pop-in tween | 200–300 total | Reset the chain to its rest shape at the new spot. |

## 8–12 fps on a 60 fps game

Hand-drawn sprites usually change frame 8–12 times a second, while the game moves the body 60 times a second. That is fine and looks intentional, like animation on twos. The body still moves smoothly; only the drawing holds.

- Prefer rates that divide 60: 12 fps = 5 game frames per drawing, 10 fps = 6, 15 fps = 4. At 8 fps the holds alternate 7 and 8 frames, which can show as an uneven beat.
- Keep a time accumulator per state (or per drawing, for holds of different lengths) and switch drawings when it passes the frame's time. Reset it on entering a state, so a state always starts on its first drawing.
- Secondary motion (the chain) and squash tweens run every game frame. They are what keep a low-frame-rate sprite feeling smooth.

## Holds and smears

- **Holds.** Give the extremes (contact, the top of a jump, the deepest point of a landing) about twice the time of the frames between them.
- **Smears.** One stretched, blurred-looking frame between two far-apart poses sells a fast move in few frames (a dash, an attack swing, a quick turn). Show it for one drawn frame (≤ 50 ms). For a plain run and jump at this size you rarely need one.
- **Sub-pixel motion.** To move a detail less than one pixel, shift colour instead of shape: step a highlight or the edge colour of a part over a few frames. Use it on large, calm parts (a breathing chest, a cape's edge), not on the face, and check it slowed down.
