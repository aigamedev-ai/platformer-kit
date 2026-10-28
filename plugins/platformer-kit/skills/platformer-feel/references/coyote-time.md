# Coyote time

**What it is:** after the player walks or runs off a ledge, a ground jump is still allowed for a short time. Named after the cartoon coyote who runs off a cliff and only falls once he notices.

**Why:** players press jump at the edge with their eyes, not with the physics. Without coyote time, a press a few milliseconds late does nothing and feels like the game ate the input.

**Default:** `COYOTE_TIME = 0.10` seconds. Good range 0.06 to 0.15. Longer feels floaty and lets players jump from mid-air.

**How:**
1. Keep `coyoteTimer`. Each frame: if the player is on the ground, set it to `COYOTE_TIME`; otherwise subtract the frame's delta time (not below 0).
2. A ground jump is allowed when `onGround || coyoteTimer > 0`.
3. When a jump starts, set `coyoteTimer = 0`.
4. Only start the timer from walking off. If the player left the ground by jumping, the timer is already 0 (step 3), so they can't "coyote jump" in mid-air.

**Test (scripted):** run the player right off a ledge with no jump pressed. Press jump at 0.05 s after the last frame on the ground: the player must go up. Press jump at 0.20 s: no ground jump (only the air jump, if the game has one). Run the same test with `COYOTE_TIME = 0`: the 0.05 s press must fail. That proves the test checks the right thing.

**Common bugs:**
- Free extra jump: the timer is not cleared when the jump starts, so jump, then jump again within 0.1 s gives two ground jumps.
- Double jump eaten: with a double jump, a coyote jump wrongly uses up the air jump. A coyote jump is a ground jump.
- Frame-based timer: `coyoteFrames = 6` feels different at 144 fps. Use seconds.
