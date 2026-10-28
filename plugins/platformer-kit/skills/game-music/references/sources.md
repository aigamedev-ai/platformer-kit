# Sources

Read 2026-10-29. Summarized in our own words; melodies in this skill are original.

## Chiptune

- Kirby, T. "NES Chiptunes in Unlock Everything" (ddrkirby.com): channel roles (pulse lead and harmony, triangle bass and triangle "drum" slides, noise kit), 25% duty for a bright lead, echo by repeating the lead on the second pulse later, softer and detuned, vibrato on long notes. https://ddrkirby.com/articles/nes-chiptunes-unlock-everything/nes-chiptunes-unlock-everything.html
- NESdev Wiki, "APU basics": pulse duty options 12.5/25/50/75%, 16 volume levels on pulse and noise, triangle without volume control, an octave lower than a pulse at the same period. https://nesdev.org/wiki/APU_basics
- "Advanced Sound Techniques" (kindatechnical.com, retro NES development): duty cycle changes timbre and perceived harshness, envelopes to avoid clipping, noise for percussion. https://kindatechnical.com/retro-nes-game-development/advanced-sound-techniques.html

## Composition

- Splice, "Music modes: what they are and how to use them": interval formula and mood of each mode (Dorian mystery, Lydian wonder, Locrian tension). https://splice.com/blog/music-modes/
- Native Instruments, "Common chord progressions": progressions and their moods (I–V–vi–IV, vi–IV–I–V, i–VII–VI–VII and others). https://www.native-instruments.com/blogs/blog/common-chord-progressions
- Open Music Theory 2e, "AABA form and strophic form" (LibreTexts): 32-bar form, contrasting bridge that ends on the dominant and leads back to A. https://human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_2e_(Gotham_et_al.)/07%3A_Popular_Music/7.05%3A_AABA_Form_and_Strophic_Form
- Liu et al. (2018), "Effects of Musical Tempo on Musicians' and Non-musicians' Emotional Experience When Listening to Music", Frontiers in Psychology: tempo bands (slow 60–76, medium 76–120, fast above 120 BPM) and their effect on arousal and valence. https://www.frontiersin.org/articles/10.3389/fpsyg.2018.02118/full
- Game Developer, "An examination of leitmotifs and their use to shape narrative in Undertale" (part 1): how themes return slowed, re-rhythmed, re-harmonized, re-orchestrated and combined. https://www.gamedeveloper.com/audio/an-examination-of-leitmotifs-and-their-use-to-shape-narrative-in-undertale-part-1-of-2

## Adaptive music and acclaimed games

- Audiokinetic blog, "How to use interactive music to score gameplay" (Sackboy: A Big Adventure, Joe Thwaites): horizontal re-sequencing, vertical layering, stingers, when to use each. https://blog.audiokinetic.com/how-to-use-interactive-music-to-score-gameplay/
- abratabia.com, "Dynamic game music" (web game audio): synchronized stems with their own gains, 2/4/8-bar segments, transition segments, debouncing state changes by 1–3 s, stingers in key and through the music bus, no stacking. https://abratabia.com/web-game-audio/dynamic-game-music.php
- Game Audio Lookout (Medium), "Enhancing Gameplay with Music in Celeste": the prologue's danger cue, the Old Site's layers added as mechanics appear, silence before the confrontation, the chase peak and the fade-out after it. https://medium.com/game-audio-lookout/enhancing-gameplay-with-music-in-celeste-5da210bbc602
- Wikipedia, "Super Mario Bros. theme": the tempo rises when fewer than 100 time units remain; Kondo's rule that music must match running and jumping and harmonize with the sound effects. https://en.wikipedia.org/wiki/Super_Mario_Bros._theme
- Construct forum, "Prevent music restarting": the common bug of music restarting with the level on death, fixed by starting it once outside the level. https://construct.net/en/forum/construct-2/how-do-i-18/prevent-music-restarting-73494

## Web Audio and mixing

- web.dev, "A tale of two clocks" (Chris Wilson): schedule notes on the audio clock with a lookahead (about 100 ms) from a timer (about 25 ms), never fire notes from timers directly. https://web.dev/articles/audio-scheduling
- Game Developer, "Game Audio Theory: Ducking": what ducking is, an example of -9 dB over 500 ms down and 1000 ms back, overuse is distracting. https://www.gamedeveloper.com/audio/game-audio-theory-ducking
- Audiokinetic, "Loudness Processing Best Practice, Chapter 3": console example targets (dialogue -12 dB RMS, music and effects -16, peaks below -3 dB). https://blog.audiokinetic.com/loudness-processing-best-practice-chapter-3-scalable-loudness-processing-for-games/

## Alternatives

- ACE-Step 1.5 README and LICENSE (GitHub, read through the jsDelivr mirror): MIT license, "co-led by ACE Studio and StepFun", under 4 GB VRAM, under 10 s per song on an RTX 3090, loops to 10-minute pieces, MPS and MLX on macOS, XL release 2026-04-02. https://cdn.jsdelivr.net/gh/ace-step/ace-step-1.5@main/README.md
- Hugging Face model API: `ACE-Step/Ace-Step1.5` license MIT (created 2026-01-23); `ACE-Step/acestep-v15-xl-turbo` MIT (2026-04-02); `ACE-Step/ACE-Step-v1-3.5B` Apache-2.0 (2025-04-28). https://huggingface.co/ACE-Step/Ace-Step1.5
- arXiv 2602.00744, "ACE-Step 1.5: Pushing the Boundaries of Open-Source Music Generation" (submitted 2026-01-31). https://arxiv.org/abs/2602.00744
- ComfyUI Wiki, "ACE-Step 1.5" (lists it as Apache-2.0 with free commercial use; the repository itself says MIT). https://comfyui-wiki.com/en/models/ace-step/ace-step-v1-5
- Sonilo, "Suno v5.5 pricing and commercial use" (published 2026-04-22, updated 2026-07-08): Free personal use only; Pro about $10/month ($8 yearly) and Premier about $30 ($24 yearly) with commercial use for songs made while subscribed. https://sonilo.com/blog/suno-v5-5-pricing-commercial-use
