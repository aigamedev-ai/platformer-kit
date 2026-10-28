# Part 2: Jump buffering: when an early jump should still count

Post: https://aigamedev.ai/tutorials/jump-buffering/

Recorded with Phaser 3.80.1 · Claude Code 2.1.311. Skills installed in that session: platformer-feel.

## Start from

`template-stages/part-02-start/`. The double-jump game from the start-here series, unchanged. It already buffers early presses, but only after the double jump is used.

```sh
cp -r template-stages/part-02-start ~/pk-part-02 && cd ~/pk-part-02
claude
```

## The prompt

```text
When I press jump just before landing, nothing happens. Make the jump still count if I press it a moment early. Test it.
```

## What you should get

Claude finds that an early press goes to the air jump while one is left. It makes a press wait for the ground when landing is less than the buffer away, converts the timers to seconds (`JUMP_BUFFER = 0.11`, `COYOTE_TIME = 0.09`) and tests at 30, 60 and 144 fps, once with the buffer off.

| Press | Air jump | Before | After |
|---|---|---|---|
| 0.08 s early | unused | Air jump fires, no jump on landing | Jumps on landing |
| 0.30 s early | unused | Air jump fires | Air jump fires |
| 0.08 s early | used | Jumps on landing | Jumps on landing |
| 0.30 s early | used | Nothing | Nothing |

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
