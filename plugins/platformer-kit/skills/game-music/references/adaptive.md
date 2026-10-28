# Music that follows the game

## Two ways to change the music

- **Vertical layering**: one loop split into layers (base, lead, drums, an extra pulse) that fade in and out. The music never jumps, so it is the best tool for intensity that rises and falls inside one place: danger near, a timer, more enemies. Every layer must sound right alone and with the others. Fade over 1 to 2 seconds.
- **Horizontal re-sequencing**: moving to another section or another track. Use it for a new place or a new mood. Switch on a bar boundary so the beat continues; crossfade 0.5 to 2 seconds for calm changes, 0.1 to 0.3 seconds (on the next beat) for urgent ones like a chase. A short fill or a stinger can cover the join.

In music.js both are one call: `setState(name)`. A state on the same track fades layers; a state on another track switches on the next bar (`at: 'beat'` for urgent states). A change asked for while another is still waiting for its bar replaces it, so a state that flips twice inside a bar doesn't stack two switches.

## How acclaimed games do it (described, not copied)

- **Celeste**: the music grows with the level. In one chapter it starts as a sparse synth and piano line, adds a drum layer and a moving bass when the player reaches a new mechanic, drops to near silence before a confrontation, and becomes its most intense version (faster bass, live drums, piano chords) during a chase. After the chase the same energetic music fades out as if moving into the distance. A calm opening, layers building with the gameplay, a peak, then release is a pattern worth copying.
- **Super Mario Bros.**: when the timer drops below 100, a warning plays and the music continues faster. Same tune, more urgency, no new material to learn. Here: a state with `speed: 1.2` (changes on the next bar). Koji Kondo also rewrote the main theme to match the speed and rhythm of running and jumping, and rejected music that clashed with the sound effects.
- **Sackboy: A Big Adventure** (Sumo Digital, talk summarized by Audiokinetic): re-sequencing to keep momentum through a level and change mood; layering to build into story moments and boss fights; stingers to reward progress.
- **Undertale**: every area and character has a theme, and themes come back changed in other tracks (see composition.md). Players feel the connection without being told.

## Stingers

A stinger is a short phrase (0.5 to 2 seconds) for a big moment: a checkpoint, a key, a boss defeated, the end of a level. Keep it in the key and tempo of the loop (or make it pitchless, like a drum hit), start it on the next beat, and dip the loop under it instead of stopping it. Don't stack them: music.js drops a stinger asked for while another is still playing. Don't add a stinger where the game already plays a sound effect for the same moment unless the moment is rare and big.

## Ducking

Dip the music under big sounds (death, explosion, a boss roar) so they cut through: down to 0.3 to 0.5 in about 30 ms, hold 0.2 to 0.3 s, back over 0.5 to 1 s. Not under frequent sounds (jumps, steps): constant pumping is tiring. In music.js: `music.duck({ amount: 0.35, hold: 0.3 })`, called from the game's sound function for the chosen sounds.

## Never restart on death

Dying and respawning must not restart the loop: hearing the first bars again after every death is the fastest way to make players mute the music. Start the music once, outside whatever the game reloads on death, and call `setState` with the state of the room; the same state again changes nothing, so a respawn in the same room keeps the loop going. A death can dip the music (duck), not reset it.

## Debouncing and pausing

- A state that can flicker (an enemy just at the edge of "chase" range) should hold for about 1 to 3 seconds in the game before the game asks for it.
- Pause: lower the music (`setVolume`) or leave it; don't stop it.
- A tab in the background slows timers: music.js skips notes that are already late instead of playing them in a burst.

## Mapping game states (a small platformer)

| Game | State |
| --- | --- |
| first room, ordinary rooms | `explore` |
| rest rooms, bonus rooms | `camp` |
| an area's test room, a timer below 30 s | `tension` (drums layer), `hurry` (faster) |
| something chasing the player | `chase` |
| death | `duck` only |
| finish | stinger, then `camp` |

## Wiring it into a game with a sound class

```js
// in the place that creates the audio context on the first input:
this.out = sfxOutput(this.ac, this.muted ? 0 : SOUND.master);        // the game's sound master + limiter
this.music = new GameMusic(SONG, { ac: this.ac, out: this.out, volume: SOUND.music, muted: this.musicMuted });
if (this.musicWanted) this.music.setState(this.musicWanted);         // the state the game reached before input

musicState(name) {                     // the game calls this on every room or mode change
  if (name === this.musicWanted) return;
  this.musicWanted = name;
  this.music?.setState(name);
}
toggleMusic() {                        // its own key (N) and button, remembered
  this.musicMuted = !this.musicMuted;
  try { localStorage.setItem('musicMuted', this.musicMuted ? '1' : '0'); } catch {}
  this.music?.setMuted(this.musicMuted);
}
// in play(name): if (SOUND.duck[name] !== undefined) this.music?.duck({ amount: SOUND.duck[name], hold: 0.3 });
```
