# Testing feel with scripted input

You can't feel the game, so measure it. Drive the real game with scripted key presses and read the player's position.

**Browser games (Phaser, canvas):** open the page in a headless browser with Playwright. Expose a tiny read-only hook for tests, e.g. `window.__test = { player: () => ({ x, y, vy, onGround }) }`. Press keys with `page.keyboard.down/up`, wait real time with `page.waitForTimeout`, and sample `__test.player()` every ~16 ms. Report numbers (peak height in px, whether a jump started) not "looks fine".

**Godot:** run the project headless with the godot command and a test script that feeds `Input.action_press/release` on chosen frames and prints positions.

**Rules:**
- Each helper gets one test that fails with the helper turned off (constant set to 0 or 1) and passes with it on. Run both and report both.
- Use time (seconds), not frame counts, in tests too.
- Check for console errors after every change.
- Keep the test hook out of the player's way: no on-screen debug unless asked.
