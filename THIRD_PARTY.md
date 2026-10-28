# Third-party material

Everything in this repository is under the MIT licence in [LICENSE](LICENSE), except the files below.

## Phaser

`template/vendor/phaser.min.js` is Phaser 3.80.1 (https://phaser.io), unchanged. MIT licence, Copyright (c) 2024 Richard Davey, Phaser Studio Inc. The full text is in [template/vendor/PHASER-LICENSE.md](template/vendor/PHASER-LICENSE.md). The folders in `template-stages/` load the same version from jsDelivr instead.

## Playwright

The tests and tools use Playwright (Apache-2.0, Microsoft) as a development dependency. It is installed by npm and not included here.

## Backgrounds made with FLUX.2-klein

The sky and floating-island backgrounds in `template/art/bg/` (and baked into `template/art/bg.js`) were generated on our own machine with FLUX.2-klein-4B, which is released under the Apache-2.0 licence, then reduced to the game's palette with the pixel-art skill's scripts. The prompts and seeds are in [template/art/README.md](template/art/README.md). We release these images under this repository's MIT licence.

## Sources the skills credit

The skills summarise public talks and articles in their own words and name them, mostly in their `references/sources.md` files: Maddy Thorson and others on Celeste's level design, Koichi Hayashida on kishōtenketsu, Martin Jonasson and Petri Purho on juice, and Jan Willem Nijman on screen shake. The game-sound skill names Tomas Pettersson's sfxr as the idea behind its sound recipes. No text or code from those sources is included.
