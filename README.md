# SHADOWLINE — Museum Heist

[![make.fun bounty](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/ayilinalin/best-stealth-game-20261121-1759-entry/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/ayilinalin/best-stealth-game-20261121-1759-entry/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A top-down stealth game for the [make.fun best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759). You are a thief in a city museum at night: slip past patrolling guards and sweeping cameras, hide behind crates and statues, grab the golden idols, and reach the green exit unseen.

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static server) and play with keyboard + mouse:

- **WASD / arrows** — move (click the floor to walk there)
- **Shift** — run (fast, but loud: guards hear you and come to look)
- **C / Ctrl** — sneak (slow, quiet, harder to spot)
- **R** — retry a floor after being caught, **Enter** — next floor

Three floors, rising difficulty: the Galeri Utama (2 guards), the Gudang Patung (3 guards, statue maze), and the Ruang Harta (4 guards + 2 cameras). A detection meter fills while any guard or camera sees you and drains while you stay hidden; fill it and you are caught. Shadows and cover break line of sight — patience beats sprinting.

## How it works

- `game/src/config.js` — every tuned number in one place
- `game/src/level.js` — the three floors: tile maps, patrols, cameras
- `game/src/guard.js` — patrols, vision cones, line of sight, suspicion and chase
- `game/src/player.js` — movement, stance, noise, loot, collision
- `game/src/render.js` — the top-down view: floor, cover, wall-clipped cones
- `game/src/hud.js` — HUD strip, title / caught / win overlays
- `game/src/audio.js` — procedural WebAudio: footsteps, pickup, alarm, win
- `game/src/shots.js` — the staged screenshot scenes (`?shot=cover|hide|patrol|win`)
- `game/src/main.js` — state machine, fixed-step loop, detection, scoring

No libraries, no network requests, no external assets — everything is drawn and synthesised in code. Screenshots in `screenshots/` are real renders of this code in Chrome.

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
