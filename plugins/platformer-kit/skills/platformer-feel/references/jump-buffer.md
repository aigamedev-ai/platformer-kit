# Jump buffering

**What it is:** if the player presses jump a moment before landing, the jump happens as soon as they land.

**Why:** when falling toward a platform, players press jump early. Without buffering the press is lost and they have to press again, which feels unresponsive.

**Default:** `JUMP_BUFFER = 0.12` seconds. Good range 0.08 to 0.15.

**How:**
1. Keep `bufferTimer`. When jump is pressed (the moment it goes down), set it to `JUMP_BUFFER`. Each frame, subtract the delta time (not below 0).
2. Each frame, if `bufferTimer > 0` and a ground jump is allowed (on the ground or coyote time), start the jump and set `bufferTimer = 0` and `coyoteTimer = 0`.
3. Use the press moment, not "is held". Holding jump through a landing must not auto-jump forever, unless the user wants that.

**Test (scripted):** drop the player from a height. Press and release jump 0.08 s before they touch down: they must jump right after landing, without a second press. Press 0.30 s before landing: no jump on landing. Repeat with `JUMP_BUFFER = 0`: the 0.08 s press must fail.

**Common bugs:**
- Buffer eats the air jump: with a double jump, an early press in the air triggers the air jump instead of waiting for the ground. Decide one rule and say it: if an air jump is available, the press uses it; buffering only applies when no air jump is left.
- Buffered jump ignores variable height: if the key was already released when the buffered jump starts, apply the short-hop rule right away (see variable-jump.md).
