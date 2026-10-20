# ECHO CHAIN — Army of One

A marching autobattler. One fighter marches forward; every technique you earn becomes an **echo**, a glowing afterimage that trails behind and replays your moves. Each echo reacts only to the echo directly ahead of it, so **the order of your trail is your build**.

## Run it

```bash
npm install
npm run dev        # play at http://localhost:5173
npm run build      # production build → dist/ (deploy dist/ to Vercel as a static site)
npm run check      # typecheck + combo tests + 200-run headless sim
npm run sim        # full 1000-run headless balance report
```

## Controls

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Sync Break | Space | tap portrait / button | A or RT |
| Battle speed 1×/2× | Tab | speed button | LB / RB |
| Pause | Esc / P | pause button | Start / B |
| Pick a card | 1 · 2 · 3 | tap | D-pad + A |
| Formation (map) | F | button | Y |
| Auto-arrange | A | button | X |
| Reorder trail | drag, or ← → on a focused echo | drag, or tap two echoes to swap | — |

## What's in the box

- **Sim** (`src/sim`, `src/data`): deterministic 60 Hz chain engine, all 24 techniques, 10 Seals, 5 enemy families + elites, The Duplicate and The Original, 3-act run with forks, Forge/Rest, Ascension 1–10, Endless Road. Untouched by presentation.
- **Renderer** (`src/render`): procedural ink-and-afterlight art. Rigged ink fighter (3 forms), additive echoes with afterimages, the Inverse echo rendered by color inversion, geometric slate enemies with eye telegraphs, link arcs that travel slot to slot, phantom strikes at the target, chain counter, hitstop, trauma shake, Sync Break freeze with inversion flash, three parallax dusk acts. Zero image assets.
- **Audio** (`src/audio`): fully synthesized. Chains are melodies (each link one step up a minor pentatonic in the act's key), per-family timbres, adaptive music that adds layers as the trail grows.
- **UI** (`src/ui`): title with a live attract-mode battle, form select, draft cards with link hints, drag-to-reorder formation with live link preview, road map, forge/rest, HUD trail bar that fires with the chain, boss bars, results with damage breakdown and unlocks, Codex, settings, pause. Desktop, phone portrait/landscape, and gamepad.
- **Meta** (`src/meta`): profile in localStorage (fails safe), technique unlock goals, form unlocks, Codex of every 4+ chain, Ascension ladder, save & continue mid-run.

## Dev hooks

`F1` toggles the debug overlay (seed, tick, trail I/O, last 20 events). In the console, `__dev` exposes:
`win()`, `lose()`, `charge()`, `unlockAll()`, `reset()`, `world()`, `run()`, and `sandbox(trail, enemies, act, rank)`. For example:

```js
__dev.sandbox(["launcher","juggler","juggler","slam","shockline"], ["husk","husk","bulwark"], 2, 3)
```

## Notes

- `vite.config.ts` aliases the bare `@slu/web-shell` import to the shell's `DeterministicRng` module, the only shell piece the game uses at runtime. This keeps the bundle around 150 KB and avoids pulling the shell's renderer adapters. Remove the alias when the game consumes more of the shell.
- The renderer has an adaptive quality governor: if frames get expensive, afterimages drop out automatically.
