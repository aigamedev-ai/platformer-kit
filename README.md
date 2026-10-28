# platformer-kit

Claude Code skills, tools and a starter game for making a platformer with AI. It comes from the [make-a-platformer series](https://aigamedev.ai/series/make-a-platformer/) on aigamedev.ai, where each post sends Claude Code one prompt and shows what came back. With this repo you can send the same prompt to the same starting files and get roughly what the post shows, or point the skills at your own game.

| Folder | What's in it |
|---|---|
| [plugins/platformer-kit](plugins/platformer-kit) | The Claude Code plugin: seven skills (`platformer-feel`, `platformer-levels`, `game-juice`, `game-sound`, `game-music`, `pixel-art`, `character-animation`) |
| [template](template) | The finished game, Wick: Night Ruins. 53 rooms in five sections with rest spots, side rooms and a storm chase, plus animation, music, juice, sound, pixel art and tests |
| [template-stages](template-stages) | The game as it was at the start of each part of the series |
| [examples](examples) | One folder per post: the prompt, where to start and what we got |
| [tools](tools) | The measuring script and the terrain renderer as command-line tools |

## Install the skills

In a Claude Code session:

```
/plugin marketplace add aigamedev-ai/platformer-kit
/plugin install platformer-kit@aigamedev
```

On Claude Code 2.1.275 or later you can do both in one step:

```
/plugin install platformer-kit --marketplace aigamedev-ai/platformer-kit
```

From your shell, the same thing is `claude plugin marketplace add aigamedev-ai/platformer-kit` and then `claude plugin install platformer-kit@aigamedev`.

Claude loads a skill when your request fits it, so "the jump feels floaty" brings in `platformer-feel` and "make the game look like pixel art" brings in `pixel-art`. You can also call one by name, for example `/platformer-kit:platformer-levels`. To update later, run `/plugin marketplace update aigamedev`.

Without the plugin system, copy the skill folders from `plugins/platformer-kit/skills/` into your game's `.claude/skills/`. That is how the posts were recorded.

## Try the finished game

```sh
git clone https://github.com/aigamedev-ai/platformer-kit
cd platformer-kit/template
```

Open `index.html` in a browser, or run `npm start` and go to http://localhost:8080. Arrow keys or A/D to move, Up, W or Space to jump, and again in mid-air to double jump. M mutes all sound, N turns the music off and J switches the effects.

To check it the way the sessions did:

```sh
npm install
npx playwright install chromium
npm run check          # 53 of 53 routes pass
npm run playthrough    # plays the whole chapter through to the end
npm test
```

The backgrounds are already in the game, so you don't need an image model. [template/README.md](template/README.md) says where everything is.

## Replay a post

1. Pick a part in [examples](examples) and copy its starting folder out of the repo, for example `cp -r template-stages/part-08-start ~/pk-part-08`.
2. For parts 6 to 14, run `npm install && npx playwright install chromium` in the copy.
3. Start Claude Code there and send the prompt from the example's README.

Each example lists what the recorded session produced, with the post's key numbers. Your run will differ in the details. The examples README also shows how to record a clean session, with no personal settings, plugins or MCP servers.

## Use the tools on your own game

The `platformer-levels` skill measures how hard each room is by playing a scripted route many times in headless Chromium, with simulated new, average and skilled players. Inside Claude Code the skill runs it for you: it adds a small hook to your game and writes a route per room ([the guide](plugins/platformer-kit/skills/platformer-levels/references/measuring.md)). To run it yourself from your game's folder:

```sh
npm install --save-dev playwright && npx playwright install chromium
npx github:aigamedev-ai/platformer-kit measure-difficulty index.html levels/routes.json --check
npx github:aigamedev-ai/platformer-kit measure-difficulty index.html levels/routes.json
```

The second command writes a table and an HTML report to `difficulty-report/`. The terrain renderer from the `pixel-art` skill draws edge-band terrain for every room on one sheet:

```sh
npx github:aigamedev-ai/platformer-kit terrain-sheet --levels levels/section-*.js --preset N --out terrain.png
```

After cloning, `node tools/bin/measure-difficulty.mjs` and `node tools/bin/terrain-sheet.mjs` do the same. Run either one without arguments to see its options. The tools are exact copies of the skills' scripts: `npm run sync` refreshes them, and CI fails if they drift.

## Requirements

- Claude Code, for the skills.
- Node 18 or newer, and Playwright with Chromium (`npx playwright install chromium`) for the tests, the measuring script and the terrain renderer.
- Python 3 for the pixel-art scripts. Pillow is used if it's installed but isn't needed.
- ffmpeg for the character-animation clips and the game-music MP3 previews.
- Optional: a local [ComfyUI](https://github.com/comfyanonymous/ComfyUI) with FLUX.2-klein, if you want the pixel-art skill to make new backgrounds. Without it, the skill draws backgrounds in code.

## Licence

MIT, see [LICENSE](LICENSE). Phaser and the image-model backgrounds are covered in [THIRD_PARTY.md](THIRD_PARTY.md).

## More

- The series: https://aigamedev.ai/series/make-a-platformer/
- New to making games with AI: https://aigamedev.ai/series/start-here/
- aigamedev.ai: https://aigamedev.ai
