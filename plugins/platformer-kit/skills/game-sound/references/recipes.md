# Starting recipes

Pitches in Hz, times in seconds, volume 0–1 before the master volume. Tune by ear later; these are reasonable first versions.

- **Jump:** square wave, pitch slides up 300 → 600 over 0.12, attack 0.005, decay 0.12, volume 0.25. Light and bouncy.
- **Air jump:** like the jump but a step higher (450 → 900) and a little shorter, so the two are easy to tell apart.
- **Land:** a short burst of noise through a low-pass filter (about 800 Hz), decay 0.06, volume 0.2. Louder and longer after a long fall.
- **Spring / bounce:** triangle wave, 200 → 900 over 0.25 with a fast wobble (vibrato around 30 Hz), volume 0.3.
- **Pick up / refill:** two quick square notes a fifth apart (e.g. 880 then 1320), 0.06 each, volume 0.2. A rising pair reads as "good".
- **Something starts to break:** quiet crackling noise, short repeated ticks while it shakes.
- **Something falls / breaks:** low noise thump (low-pass 400 Hz), decay 0.2, volume 0.3.
- **Death:** square wave sliding down 400 → 80 over 0.35 plus a noise burst, volume 0.35. The clearest sound in the game.
- **Respawn:** soft sine rising 300 → 600 over 0.15, volume 0.15.
- **Door / next room:** sine 500 → 700, 0.1, volume 0.15. Quiet: it happens often.
- **Checkpoint:** three rising notes, 0.05 each.
- **Finish:** a short rising arpeggio (four notes), then a held note, about 0.8 in total.

Envelope: attack is the time to full volume, decay the time back to silence. Use exponential ramps for decay (they sound natural); never ramp to exactly 0, ramp to 0.0001.
