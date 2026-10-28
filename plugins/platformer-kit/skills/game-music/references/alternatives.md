# Alternatives for richer audio

This skill writes chip music in code: small, adaptive, free, no files. If the user wants recorded-sounding music (real instruments, vocals), these are options. Each one produces audio files, so the game then needs file loading, loop points and stems for layering, and the checks in checking.md still apply. Ask before downloading models or paying for a service. Checked 2026-10-29; prices and terms change.

## ACE-Step 1.5 (open model, runs locally)

- What: an open music generation model from ACE Studio and StepFun. Paper submitted to arXiv on 2026-01-31; an XL (4B) version followed on 2026-04-02.
- License: the ACE-Step 1.5 code and model weights are MIT (GitHub README and LICENSE, Hugging Face model cards, checked 2026-10-29). The earlier ACE-Step v1 (3.5B, April 2025) is Apache-2.0. Some third-party pages list 1.5 as Apache-2.0; the repository says MIT. Either way commercial use of the model is allowed; the project asks users to check outputs for originality and to disclose AI use.
- Runs on: under 4 GB of VRAM for the 2B model (CPU offload and INT8), about 12 GB for XL with offload. Apple Silicon is supported (MPS and MLX launch scripts, a macOS package). Python 3.11 to 3.12, installed with `uv`.
- Speed and length: under 10 seconds per song on an RTX 3090; from short loops up to 10 minutes.
- Useful features: text prompts with style and tempo, "repainting" (regenerate a section), LoRA training on a few of your own tracks to keep a consistent style, a REST API and ComfyUI support.
- For games: generate a mood per state with the same prompt words and tempo, then cut seamless loops by hand or with ffmpeg and check the seam. It won't give you separate layers on its own, and outputs are not deterministic.

## Suno (hosted service)

- Free plan: about 10 songs a day, personal use only. Songs made on the free plan can't be used commercially, and upgrading later doesn't change that.
- Pro: about $10 a month (about $8 a month billed yearly) and Premier about $30 a month (about $24 yearly). Songs made while subscribed can be used commercially, also after cancelling. Pro adds the newer models and stems.
- The user gets rights to use the output, not a traditional copyright; purely AI-generated music generally can't be registered for copyright.
- For games: same loop-cutting work as above; check the current terms before release.

Sources: see sources.md.
