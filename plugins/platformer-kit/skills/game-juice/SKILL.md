---
name: game-juice
description: Make a 2D game feel alive with visual feedback (squash and stretch, particles, screen shake, hit pause, flashes) without changing how it plays. Use when the user says the game feels flat, lifeless, stiff or "not juicy", or asks for polish or game feel effects.
---

# Game juice

A game feels alive when it answers every action. Juice is the small visual responses that do that: the player squashes on landing, dust puffs up, the screen bumps when something big happens. It adds no rules. These rules come from two well-known talks on the topic (see [references/sources.md](references/sources.md)).

## Always do

1. **List every event first.** Go through the game and write down everything the player does or that happens to them: jump, land, air jump, bounce, pick up, break, die, respawn, enter a door, finish. Every event on the list gets a response, on the object involved as well as the player (a door opens or glows when touched, a spring squashes). Silent events are what make a game feel flat.
2. **Layer small effects per event.** Use two or three of: motion (squash and stretch, eased with a tween), particles, a short flash, camera (shake or nudge), time (a brief hit pause). Big events get more layers, frequent events fewer. Start from the numbers in [references/effects.md](references/effects.md).
3. **Never change how the game plays.** Juice is drawn on top. Don't touch hitboxes, physics, timers or input. Scale and offset a separate visual (a sprite or a container) instead of the physics body. If the game has scripted routes or difficulty measurements, run them before and after: the results must be identical.
4. **Keep it readable.** Effects must never hide hazards, pickups or the player. Particles must contrast with what they land on (no red bits on red spikes), and death effects end before the player respawns. Shake the game world only, never the HUD, and don't let the shake reveal the canvas edge. Respect the reader's "reduce motion" setting (`prefers-reduced-motion`): then turn off shake, flashes, spins and large squash.
5. **Make every effect switchable.** Put all juice numbers in one settings object with an on/off switch per effect, so the user can compare and tune. Turning everything off must give back the original game.
6. **Check it and report.** Take screenshots of the key moments and look at them. List each event with the effects you gave it and their numbers, and confirm gameplay is unchanged.

## Not now

Sound, music and new art. They are their own steps. Don't replace the game's shapes with sprites unless asked.
