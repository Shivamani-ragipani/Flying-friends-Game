# Flying Friends

A Flappy-style portrait arcade game with your friend squad. Pick a friend on the
character selection screen — their intro voice plays and the flight starts
automatically. Tap to flap, squeeze through the gaps between the mia pillars.

## Run it
Double-click `index.html`. No build step, no dependencies, works offline.
For phone testing: `python3 -m http.server 8000` in this folder, then open
`http://<your-computer-ip>:8000` on the phone.

Serving over http (instead of file://) also gives pixel-exact collision for the
character and mia cutouts; from file:// the game falls back to a tight shape
approximation.

## Controls
- Character selection: tap / click a friend card (or keyboard Tab + Enter).
- In game: tap anywhere, click, or press Space. That is the only control.
- Space/Enter also presses Restart / Resume. P or Esc pauses.

## Flow
1. **Choose Your Friend** — animated cards with glow + tap effects.
2. Tap a card → that friend's intro voice plays → the game starts on its own.
3. `kute-ki-muat.mp3` loops seamlessly as the gameplay music.
4. Crash → gameplay music stops, the friend's own failure audio plays, and a
   random funny roast message shows on the Game Over popup.
5. **Restart** restarts instantly (no reload). **Home** returns to character
   selection and forgets the previous pick.

Best score is saved in localStorage (`flyingFriends.best`); old Flying Head
saves are migrated automatically.

## Code layout (js/)
config.js       all tunable numbers (gravity, flap, gaps, difficulty, asset paths)
save.js         SaveManager: best score + sound preference (localStorage)
assets.js       Asset Loader (optional images, never breaks the game)
characters.js   Character Manager: friends, images, per-character intro/fail clips
audio.js        single looping gameplay track + voice channel + synth SFX, mute
roasts.js       random Game Over roast lines (shuffle bag, no repeats in a row)
input.js        Input Manager: tap / click / Space only
physics.js      gravity, flap impulse, damping, speed limits, tilt (+25 / -75 deg)
difficulty.js   Difficulty Manager: smooth speed / gap / spawn-rate ramp
obstacles.js    pooled mia-pillar pairs + fair gap placement
collision.js    Collision System: per-row pillar silhouettes vs character outline
animation.js    Animation System: shake, zoom, flash
particles.js    pooled tap puffs, impact burst, ambient motes
sprites.js      pre-rendered mia pillar / character / cloud art
renderer.js     parallax background and scene drawing
ui.js           character cards, HUD, countdown, pause and game-over screens
game.js         Game Logic: state machine and main loop
main.js         boot

## Assets
- `assets/characters/*.png` — the friends (transparent cutouts), shown on the
  selection cards and used as the player sprite.
- `assets/images/mia.png` — every obstacle pillar is built from this image.
- `assets/audio/kute-ki-muat.mp3` — the looping gameplay music.
- `assets/audio/<friend-intro>.mp3` — one unique intro clip per friend.
- `assets/audio/<friend>-fail.mp3` — one unique failure clip per friend,
  derived from (and pitched away from) that friend's own intro voice so every
  character's Game Over audio is different.

Missing images fall back to generated art and missing clips to synthesized
sound — the game never crashes on a missing file. Optional scene art
(`background.png`, `clouds.png`, `buildings.png`, `ground.png` in
`assets/images/`) can replace the generated parallax layers: drop the files in
and add matching entries to `ASSETS.images` in `js/config.js`.

## How it stays smooth and fair
- requestAnimationFrame + delta time. Physics and collision run in fixed 1/120 s
  slices, so gameplay is identical at 30, 60 or 144 FPS.
- World height is always 800 units; only width adapts (370..450), so gravity,
  gaps and flap height feel the same on every device.
- Pillars and particles are pooled, static art is pre-rendered: nothing is
  allocated while playing.
- Difficulty: 0-10 easy, 10-30 normal, 30-60 hard, 60+ very hard, interpolated
  smoothly. Gap centres never move farther than a player can climb in the time
  available.
- Hitboxes follow the real outlines (slightly inside the art), no oversized boxes.
