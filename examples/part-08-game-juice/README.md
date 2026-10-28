# Part 8: Making the chapter feel alive: game juice with Claude Code in one prompt

Post: https://aigamedev.ai/tutorials/game-juice/

Recorded with Phaser 3.80.1 · Claude Code 2.1.312. Skills installed in that session: game-juice, platformer-feel, platformer-levels.

## Start from

`template-stages/part-08-start/`. The finished chapter from part 7: 34 rooms and 2 bonus rooms, tests and a route for every room.

```sh
cp -r template-stages/part-08-start ~/pk-part-08 && cd ~/pk-part-08
npm install && npx playwright install chromium
claude
```

## The prompt

```text
The chapter plays well but feels flat. Make it feel alive: every jump, landing, bounce, crumbling block, orb, death and door should react on screen. Don't change how anything plays.
```

## What you should get

Every event gets a visual reaction drawn on a separate visual, with one settings object (`JUICE`), a J key to switch everything, `?juice=0`, and reduced motion respected. The routes, the tests and the difficulty table must come out identical before and after.

| Event | What happens on screen |
|---|---|
| Jump | Stretch to 0.8 x 1.2 over 150 ms, dust to both sides |
| Double jump | Stretch, one full spin and a ring |
| Landing | Squash up to 1.3 x 0.7, a 2 px shake on heavy landings |
| Spring | Stretch, green sparks, 3 px camera dip |
| Crumbling block | Crumbs while it shakes, debris and a 2 px shake when it falls |
| Refill orb | Sparks and a 60 ms white flash |
| Death | 70 ms freeze, 22 pieces, 5 px shake |

The recorded session took 10 minutes and $1.69. The current skill also asks for the four things that session missed (door reactions, readable death bursts, shake that leaves the HUD alone, reduced motion for spins and squash), so a replay should do better there.

Results vary from run to run, and the skills in this kit are newer than the ones in the recording. For a clean recording, see [../README.md](../README.md#record-a-clean-session).
