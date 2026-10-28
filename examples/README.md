# Replay a post

One folder per part of the [make-a-platformer series](https://aigamedev.ai/series/make-a-platformer/). Each has the post's link, the exact prompt, the folder to start from, the skills the recorded session had, and what we got.

| Part | Post | Start from | Main skill |
|---|---|---|---|
| 1 | [Coyote time](part-01-coyote-time/) | `part-01-start` | platformer-feel |
| 2 | [Jump buffering](part-02-jump-buffering/) | `part-02-start` | platformer-feel |
| 3 | [Variable jump height in a Phaser platformer](part-03-variable-jump-height/) | `part-03-start` | platformer-feel |
| 4 | [Level design with Claude Code](part-04-level-design/) | `part-04-start` | platformer-levels |
| 5 | [Growing a game](part-05-new-mechanic/) | `part-05-start` | platformer-levels |
| 6 | [Difficulty that grows with the player](part-06-difficulty-curve/) | `part-06-start` | platformer-levels |
| 7 | [A full chapter with Claude Code](part-07-chapter/) | `part-07-start` | platformer-levels |
| 8 | [Making the chapter feel alive](part-08-game-juice/) | `part-08-start` | game-juice |
| 9 | [When the simulated player reacts late](part-09-full-player-model/) | `part-09-start` | platformer-levels |
| 10 | [Sound effects in one prompt](part-10-sound/) | `part-10-start` | game-sound |
| 11 | [Pixel art with Claude Code and a local image model](part-11-pixel-art/) | `part-11-start` | pixel-art |
| 12 | [From 34 rooms in a row to a journey](part-12-chapter-structure/) | `part-12-start` | platformer-levels |
| 13 | [Animating the hero with Claude Code](part-13-character-animation/) | `part-13-start` | character-animation |
| 14 | [An adaptive soundtrack in code](part-14-game-music/) | `part-14-start` | game-music |

## Steps

1. Install the plugin (see the [main README](../README.md#install-the-skills)).
2. Copy the starting folder somewhere outside this repo, so the session can change it freely:

   ```sh
   cp -r template-stages/part-08-start ~/pk-part-08 && cd ~/pk-part-08
   npm install && npx playwright install chromium   # parts 6 to 14, which have a package.json
   ```

3. Start Claude Code in that folder and send the prompt from the part's README. Don't add follow-ups: the recorded sessions got none (part 7 says which of its prompts came from our own checks).

The starting folders are the files the recorded sessions started from, unchanged, so they load Phaser from jsDelivr like the originals. You need an internet connection to play them.

## Record a clean session

We recorded every session with a clean Claude Code, so personal skills, plugins, MCP servers and settings couldn't change the result. To do the same with this kit's plugin loaded for one session only:

```sh
claude -p "<the prompt>" --model opus \
  --plugin-dir /path/to/platformer-kit/plugins/platformer-kit \
  --setting-sources project,local --strict-mcp-config \
  --output-format stream-json --verbose \
  --dangerously-skip-permissions > session.jsonl
```

- `--setting-sources project,local` skips your user settings, and with them your installed plugins. `--plugin-dir` loads this plugin anyway, and `--strict-mcp-config` skips your MCP servers.
- `--dangerously-skip-permissions` lets the session work alone. Only use it in a throwaway copy of a starting folder.
- Check the first `system/init` line in `session.jsonl`: `skills` should list only `platformer-kit:*` and Claude Code's own skills, and `plugins` only `platformer-kit` and the built-in `cc-plugin-*` ones.
- The plugin brings all seven skills. The recorded sessions had only the skills each part lists, as project skills. For the closest match, skip `--plugin-dir` and copy just those skill folders from `plugins/platformer-kit/skills/` into the starting folder's `.claude/skills/`.
- Run sessions one at a time. Parallel sessions share `/tmp`, and their test browsers can collide.

Your result will differ from the post. Every run is different, and the skills here are newer than the recordings: each post's "What the session missed" list has since been turned into skill rules.
