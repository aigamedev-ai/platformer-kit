# Part 3: Variable jump height in a Phaser platformer: tap to hop, hold to jump high

Post: https://aigamedev.ai/tutorials/variable-jump-height/

Recorded with Phaser 3.80.1 · Claude Code 2.1.311. Skills installed in that session: platformer-feel.

## Start from

`template-stages/part-03-start/`. The double-jump game from the start-here series, unchanged (same file as part 2).

```sh
cp -r template-stages/part-03-start ~/pk-part-03 && cd ~/pk-part-03
claude
```

## The prompt

```text
I want a quick tap to give a small hop and holding jump to give a full jump. Check how it works now and fix it if needed. Test it.
```

## What you should get

Claude measures the jump in the running game and changes nothing: `JUMP_CUT = 0.45` is already inside the skill's range (0.35 to 0.6).

| Jump | Peak height |
|---|---|
| Tap (held 0.05 s) | about 41 px (35 to 53 px depending on the release frame; Claude's run got 47 px) |
| Hold until falling | 107 px |
| Tap with `JUMP_CUT = 1` | 107 px |

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
