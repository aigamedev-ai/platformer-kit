# Starting numbers for common effects

All times in seconds, sizes in pixels at the game's native size. Tune by eye after.

## Motion (squash and stretch)

Scale the player's visual, never its body. Keep the area roughly the same (wider means shorter).

- **Jump take-off:** stretch to 0.8 wide × 1.2 tall, back to 1 × 1 over 0.15 with an ease-out.
- **Landing:** squash to 1.3 × 0.7, back over 0.12 with an ease-out (a slight overshoot, "back" easing, looks springy). Scale the amount with the fall speed: a short hop barely squashes.
- **Air jump:** a smaller stretch (0.9 × 1.1) and a quick spin or flip is fine if the game's style allows it.
- Anchor squash at the feet so the player doesn't appear to sink into the floor.

## Particles

- **Dust on landing and take-off:** 6–10 small squares or circles, 0.25–0.4 life, spread sideways along the ground, fading out.
- **Death burst:** 15–25 pieces in the player's colour, outward, 0.4–0.6 life, some gravity.
- **Pickups and refills:** a ring that grows and fades (0.25), plus a few sparks.
- **Breaking things:** debris in the object's colour that falls with gravity.
- Keep particles out of the way: no particles on top of hazards the player must read.

## Camera

- **Screen shake:** a random offset that decays to zero. Death 5–6 px over 0.25; a heavy landing or a block falling 2–3 px over 0.1; jumps and pickups none. Small and short is the rule.
- **Directional nudge:** for a launch or bounce, push the camera 2–4 px against the motion and let it ease back. It reads as force without blurring.
- Shake the camera, not the world: hitboxes stay put.

## Time

- **Hit pause:** freeze the game's visuals for 0.05–0.1 on death or a big hit. It makes the moment land. Never pause on frequent events like jumps.
- If the game measures difficulty with a fixed clock, the pause must be visual only, or the measurements change.

## Flash and colour

- **Flash:** tint the player or object white for 0.05–0.08 on a hit or a refill.
- **State colour:** keep any colour that carries game information (for example, "double jump spent") readable over every effect.

## Ambient

- A slow, small "breathing" scale (±3% over 1.5) on the idle player, a gentle bob on pickups, a shake on anything that is about to fall. Things that will act should look like it before they do.

## Easing

Use ease-out for things arriving or recovering, ease-in for things leaving, and a small overshoot ("back") for springy motion. Linear motion looks mechanical.
