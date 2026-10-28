# Starting points

The game as it was at the start of each part of the [make-a-platformer series](https://aigamedev.ai/series/make-a-platformer/), so you can send a post's prompt to the same files. The prompts are in [../examples](../examples).

| Folder | What it is |
|---|---|
| `part-01-start` | The double-jump game from the start-here series, with coyote time switched off |
| `part-02-start`, `part-03-start` | The double-jump game, unchanged |
| `part-04-start` | One room with coyote time, the jump buffer fix and variable jump height |
| `part-05-start` | Part 4's six-room level |
| `part-06-start` | Part 5's 12 rooms, plus Playwright in `package.json` |
| `part-07-start` | The 12 rooms after part 6's re-run, with the measuring hook and `levels/routes.json` |
| `part-08-start` | The 36-room chapter from part 7, with tests and a route per room |
| `part-09-start` | The chapter with juice (part 8) |
| `part-10-start` | The refined chapter (part 9) |
| `part-11-start` | The chapter with sound (part 10) |

These are the recorded sessions' starting files, unchanged, without `node_modules`, reports or our own notes. They load Phaser 3.80.1 from jsDelivr as the originals did. The finished game after part 11 is [../template](../template), which has Phaser in the folder.

For parts 6 to 11, run `npm install && npx playwright install chromium` in your copy before you start.
