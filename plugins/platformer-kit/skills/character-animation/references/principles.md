# The twelve principles, for a 16–18 px hero

Frank Thomas and Ollie Johnston listed twelve principles of animation in *The Illusion of Life* (1981). Games bend some of them, because the player controls the timing and the body must answer at once. At this size, timing, squash and stretch, follow-through and silhouette do most of the work.

Matter most:

- **Timing.** How long each pose stays on screen decides how heavy and fast the hero feels. Hold the key poses (landing, the top of a jump) and keep in-betweens short. Vary frame lengths; even timing looks mechanical. Numbers: [timing.md](timing.md).
- **Squash and stretch.** Squash on landing, stretch on take-off and in a fast fall. Keep the area about the same (wider means shorter). At this size it is 1–2 px of change, or a short scale tween on the sprite. Only one piece of code may own it (SKILL.md, rule 5), and it never touches the hitbox.
- **Anticipation.** In film, a wind-up comes before every action. For the player's own hero it must not delay anything: the body leaves on the press frame, and the wind-up becomes a visual beat (a crouch frame while the body is already rising, or the landing crouch). Enemies are the opposite: give them long, readable wind-ups so the player can react.
- **Follow-through and overlapping action.** Parts keep moving after the body stops, and loose parts lag behind the parts that drive them. This is the cheapest life you can add, and the safest, because it happens after the action. A chain does it in code ([secondary-motion.md](secondary-motion.md)). Keep the body's own follow-through short; a body that keeps sliding after the player lets go feels sluggish.
- **Appeal and solid drawing → silhouette and steady volume.** Each state has its own outline at 1×. Keep pixel counts steady between frames (a 6 px torso stays 6 px) unless you squash on purpose. Build frames from shared parts so the face can't drift.
- **Exaggeration.** Push poses past what looks "right" in a still: a lean of 1 px reads as nothing, 2 px reads as running.

Matter, but differently:

- **Arcs.** Things move along curves. The body's arc is the physics, so don't move the sprite off it. The arcs you control are the chain, the head and lantern bob, and the order of frame offsets.
- **Slow in and slow out.** With 2–4 frames there are no in-betweens to ease. Hold the extremes longer instead. Tweens on scale and offsets use easing (ease-out, or a slight overshoot for a springy landing).
- **Secondary action.** Small actions that support the main one: a blink, looking up when idle for a while, the lantern swinging, dust. They make the hero feel like a character, not a cursor. Keep them out of the way of play.
- **Staging.** In film, the camera directs the eye. In a game, level layout, light and contrast do that (pixel-art skill). For the hero: keep it the brightest, clearest thing in its area.
- **Straight ahead and pose to pose.** A way of working. With frames drawn in code, work pose to pose: draw the key poses of a state first, check them on a contact sheet, then add in-betweens only where motion jumps. Secondary motion in code is the "straight ahead" part: it is worked out frame by frame as the game runs.
