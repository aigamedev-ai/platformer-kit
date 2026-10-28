# Variable jump height

**What it is:** a quick tap gives a short hop, holding the button gives the full jump.

**Why:** it gives players control over every jump without extra buttons. Fixed-height jumps feel stiff.

**Default:** when the jump button is released while the player is still going up, multiply the upward speed by `JUMP_CUT = 0.5`. Good range 0.35 to 0.6. A tap should reach roughly 35-50% of the full jump height.

**How:**
1. When jump is released and the player is moving up (`velocityY` up), set `velocityY *= JUMP_CUT`. Do this once per jump, at the release moment, not every frame.
2. Don't cut after the peak. If the player is already falling, do nothing.
3. Apply the same rule to the air jump.

**Test (scripted):** measure the peak height of a full jump (hold until falling) and of a tap (hold 0.05 s). The tap must be clearly lower, around 35-50% of the full height. With `JUMP_CUT = 1` both heights must match.

**Common bugs:**
- Cutting every frame while the button is up: the jump gets cut again and again and the hop is tiny. Cut once.
- Cutting at the start of a buffered jump that was released long ago gives a tiny hop. That's correct behaviour for a tap; make sure it doesn't make the jump useless (keep `JUMP_CUT` at 0.35 or more).
