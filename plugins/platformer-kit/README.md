# platformer-kit

Five Claude Code skills from the [make-a-platformer series](https://aigamedev.ai/series/make-a-platformer/) on aigamedev.ai. Claude loads each one when your request fits it, or you can call it by name, for example `/platformer-kit:platformer-levels`.

| Skill | What it does |
|---|---|
| `platformer-feel` | Coyote time, jump buffering and variable jump height, each tested with scripted key presses. |
| `platformer-levels` | Rules for rooms that teach one thing at a time, and `scripts/measure-difficulty.mjs`, which measures how hard each room is with simulated players. |
| `game-juice` | Dust, squash, flashes and screen shake, drawn on top so the game plays exactly the same. |
| `game-sound` | Sound effects generated in code for every event, with a mute switch. |
| `pixel-art` | Pixel art drawn in code, edge-band terrain and image-model backgrounds, without changing how the game plays. |

The measuring and terrain scripts need Node 18 or newer and Playwright with Chromium in your game's folder (`npm install --save-dev playwright && npx playwright install chromium`). The pixel-art scripts need Python 3. New backgrounds need a local ComfyUI with FLUX.2-klein; without it the skill draws backgrounds in code.

Install it in a Claude Code session (v2.1.275 or later):

```
/plugin install platformer-kit --marketplace aigamedev-ai/platformer-kit
```

The starter game, the tools and the prompts from each post are in the repository: https://github.com/aigamedev-ai/platformer-kit
