---
name: game-sound
description: Add sound effects to a browser game, generated in code with the Web Audio API (no audio files). Use when the user asks for sound, sound effects, audio feedback, or says the game feels silent.
---

# Game sound

Sound is half of how an action feels: a jump with a soft "boing" feels lighter than the same jump in silence. For small games you don't need audio files. Short effects can be generated in code with the Web Audio API, the way the classic sfxr tool does: a waveform, a pitch that slides, a quick volume envelope, maybe some noise.

## Always do

1. **List every event first.** Use the same list as the visual effects: jump, land, air jump, bounce, pick up, break, die, respawn, door, finish, plus anything the game adds. Every event gets a sound. If the game already has a central place where visual effects are triggered, call sounds from there.
2. **Build each sound from a recipe.** One small function per sound: waveform (square, triangle, sine, noise), start and end pitch, attack and decay in seconds, and volume. Keep them short (most under 0.3 s). Starting points are in [references/recipes.md](references/recipes.md).
3. **Vary repeated sounds.** Shift pitch randomly by about ±5% on frequent sounds (jump, land, steps) so they don't sound like a machine gun.
4. **Mix, don't stack.** One master volume, quiet defaults (frequent sounds quieter than rare ones), and a limit on how many copies of one sound play at once. Nothing may clip: leave headroom (master around 0.7) and treat a compressor as a safety net, not a hard ceiling. If the engine already has an audio system (Phaser does), reuse its audio context or turn its sound off, so the page has one context, not two.
5. **Respect the player.** Audio can only start after a click or key press (browsers block it before), so create or resume the audio context on the first input. Add a mute toggle (M key and a small on-screen button) and remember it. Never change how the game plays: sound is output only.
6. **Check what you can't hear.** You can't listen, so test it: count that every event triggers its sound (spy on the sound functions in a scripted playthrough), render each sound with an `OfflineAudioContext` and check its length and peak level (no clipping, nothing silent), and confirm gameplay measurements are unchanged with audio actually running. When rendering offline, start sounds after about 0.5 s: a compressor turns the first moments of a fresh render down and makes sounds look quieter than they are. Also render the worst case (many sounds at once) and check its peak. Any browser your tests launch must be muted (`--mute-audio`), and never kill browser processes by name: other things may be running. Report each sound's recipe in plain words.

## Not now

Music and audio files. Music is its own step.
