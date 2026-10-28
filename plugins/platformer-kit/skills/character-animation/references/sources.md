# Where these rules come from

Our own summary, not quotes. Games are described, not copied: draw your own hero.

## Principles

- Frank Thomas and Ollie Johnston, *Disney Animation: The Illusion of Life* (1981), the twelve principles; overview at https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- Jonathan Cooper, *Game Anim: Video Game Animation Explained*; excerpt "The 12 principles of animation in video games", Game Developer (2019). Each principle in games: keep the player's anticipation short or it costs control, let control return before follow-through ends, use holds so players can read an action. https://gamedeveloper.com/production/the-12-principles-of-animation-in-video-games
- Jonathan Cooper, on gameanim.com (2005): split a move into anticipation, the moment it does its job, and recovery; keep the player's anticipation minimal and put feel before looks. https://www.gameanim.com/?p=115
- Christopher Totten, "12 principles for game animation", Game Developer (2021). No wind-up on player actions (start with a squash frame instead), keep squash to a few frames so the art and collision agree, keep follow-through brief, use smears to save frames. https://www.gamedeveloper.com/blogs/12-principles-for-game-animation
- Justin T. Carter, "Responsive Animation" (CreateWorld 2018): film-style animation adds latency and makes the player feel less in control; real-time control needs its own techniques. https://auc.edu.au/2018/11/responsive-animation-an-examination-of-character-animation-for-responsive-game-feel/

## Pixel-art animation

- Raymond Schlitter (Slynyrd), "Pixelblog 8: Intro to Animation" (2018). Idle as a breathing bob, run cycles cut from 8 to 6 or 4 frames with longer frames to keep the same loop time (8 × 80 ms = 4 × 160 ms), keyframes that read alone, few in-betweens. https://slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation
- Sprite-AI, "Why 90-year-old animation theory still matters for pixel art". At 16 px, timing, anticipation and squash do most of the work; starting frame counts and durations per action; 1–2 px squash; about 1 px of follow-through on hair or a cape; steady pixel counts between frames. https://www.sprite-ai.art/guides/animation-principles
- Thomas Palef, "How to make a run cycle in pixel art": 4 key poses doubled to 8, a 1–2 px drop on each footfall, arms against legs. https://medium.com/@thomaspalef/how-to-make-a-run-cycle-in-pixel-art-e72fb9c0b812
- Tiny Warrior Games, "Pixel art sub-pixel animation" (2019): move a part less than a pixel by spreading its colour over neighbouring pixels across frames; best on larger, calmer parts; check it slowed down. https://tinywarriorgames.com/2019/01/04/game-development-pixel-art-sub-pixel-animation/
- Jake Parker, "The art of the smear" (2022): one stretched frame makes a fast move read in few frames. https://www.mrjakeparker.com/blog/2022/1/12/the-art-of-the-smear
- GameDev.net thread on sprite frame rates (2019): sprites animated slower than the game are normal; 12 fps divides 60 evenly (5 frames per drawing), 10 or 15 fps if the game also runs at 30. https://gamedev.net/forums/topic/703269-question-regarding-variable-fps-for-sprite-sheet-animations-and-the-game-itself

## Secondary motion

- Noel Berry (programmer of Celeste), answer on r/gamedev (2018): Madeline's sprite has no hair; the hair is 5–6 points, the first on her head, each following the one before at an offset and a maximum distance, drawn as shrinking circles; each animation frame sets where it attaches; wind changes the offsets. https://www.reddit.com/r/gamedev/comments/9a0cfr/how_is_the_hair_in_celeste_made/
- Game Maker's Toolkit, "Why does Celeste feel so good to play?": the one air dash is shown by her hair turning blue; squash and stretch on the jump. https://amara.org/v/C3BEJ/
- Thomas Jakobsen, "Advanced Character Physics", Game Developer (2003): Verlet integration (position and previous position, no stored velocity), distance constraints solved by repeated passes, stable because errors don't build up; damping by keeping a little less than all of the implied velocity. https://gamedeveloper.com/programming/advanced-character-physics

## Acclaimed platformers

- James Benson (lead animator, Ori and the Blind Forest), GDC 2015 animation bootcamp; notes at https://zyzyz.github.io/en/2018/01/GDC2015-Animating-Ori — hand-made frames, walk and run drawn at a high frame rate and played faster or slower with the stick, many small variants (looking, slopes) chosen by code instead of blending. Talk: https://gdcvault.com/play/1021791/Animation-Bootcamp-The-Animation-Process
- Team Cherry on Hollow Knight (GamesRadar): very tight controls with almost no momentum, so the player always has command; the animation serves that. https://www.gamesradar.com/new-caped-crusader-rises-hollow-knight
