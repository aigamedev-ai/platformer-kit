---
name: platformer-feel
description: Make a 2D platformer feel good to control. Use when building or changing player movement or jumping in a platformer (Phaser, Godot, Unity or plain canvas), or when the user says the controls feel stiff, floaty, unfair or "eat" their jump.
---

# Platformer feel

Players judge a platformer by its jump. Most "the controls feel bad" complaints come from a few missing details, not from the speed or gravity numbers. Add these details on purpose, test each one with scripted input, and tell the user the numbers you chose.

## Always do

1. Keep every movement number as a named constant at the top of the player code, in seconds and pixels per second (not frames), so the user can tune them.
2. Add the three core helpers below unless the user says not to. Each has a reference file with defaults, steps, a test and common bugs. Read the file before you build that helper.
   - **Coyote time**: the player can still jump for a short moment after running off a ledge. See [references/coyote-time.md](references/coyote-time.md).
   - **Jump buffering**: a jump pressed just before landing still happens on landing. See [references/jump-buffer.md](references/jump-buffer.md).
   - **Variable jump height**: tap for a small hop, hold for a full jump. See [references/variable-jump.md](references/variable-jump.md).
3. Test with scripted input, not by reading the code. See [references/testing.md](references/testing.md). Each helper needs one test that fails without it and passes with it.
4. When you finish, list each helper with its number and what the test showed, in plain words.

## Rules that keep the helpers from fighting

- One jump counter decides how many jumps are left. Coyote time and buffering only change *when* a ground jump is allowed. They never add an extra jump.
- Clear the coyote timer and the buffer as soon as a jump starts, so one press gives one jump.
- Measure time with the frame's delta time, never by counting frames. The game must feel the same at 30, 60 and 144 fps.
- If the game has a double jump, the air jump uses the jump counter, not coyote time. Pressing jump 0.05 s after leaving a ledge is a ground jump (coyote), not the air jump.

## Not now

Wall jumps, dashes, moving and one-way platforms, ledge grabs, camera smoothing and slopes are separate topics. Don't add them unless asked.
