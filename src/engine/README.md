# Sub Invaders Engine

This directory contains the vanilla ES2022 + Canvas 2D engine slice for Sub Invaders. It has no
npm dependencies and targets browsers through direct ES module imports.

## Extraction contract

The future package target placeholder is `henrik-me/canvas-game-engine`. The engine surface in
`src/engine/` is the candidate API for that future package, so keep every module game-agnostic.

## One-way dependency rule

Engine modules in `src/engine/` MAY import other `src/engine/` peers. Engine modules MUST NOT
import from `src/game/`. A fail-closed linter at `scripts/check-engine-isolation.mjs` enforces this
rule in CI; lane 9 of the CS02 fan-out authors that linter.

## API surface

The named exports below are the actual surface shipped by CS02 (commit `263aec0`,
PR #19). Update this table in lock-step with any change to engine module exports —
`src/game/main.mjs` (game bootstrap) and any future engine consumer treats this as
the contract.

| Module | Named exports | Purpose |
|---|---|---|
| `loop.mjs` | `createLoop` | Fixed-timestep update plus variable-rate render loop with accumulator clamp. |
| `entity.mjs` | `Entity` | Base entity with position, velocity, dimensions, AABB, and alive state. |
| `collision.mjs` | `aabbOverlap`, `groupCollisions` | Closed-interval AABB overlap test and group-vs-group collision iteration. |
| `input.mjs` | `createInput` | Keyboard + touch input with per-frame edge state; recognised codes: ArrowLeft/Right, KeyA/D, Space, KeyW, ArrowUp, Escape, KeyM. |
| `renderer.mjs` | `createRenderer` | DPR-aware Canvas 2D drawing wrapper (`clear`, `drawSprite`, `drawRect`, `drawText`). |
| `sprite.mjs` | `loadSpriteSheet`, `createFrame`, `createAnimation` | Sprite loading, single-frame helper, and animation clock. |
| `audio.mjs` | `createAudioPool` | HTML `<audio>` element pool for future SFX hooks. |
| `scene.mjs` | `createSceneStack` | Duck-typed scene stack with lifecycle and input forwarding. |
| `seed.mjs` | `createRng` | Mulberry32 seedable random number generator. |

## Date-seeded RNG (CS04)

The daily-challenge mode uses `createRng` with a UTC-date-derived seed so that
all players see the same modifier and parameters for the same calendar day.
This is intentional reuse of the CS02 engine surface — no API change is required
for daily mode.

```js
import { createRng } from '../engine/seed.mjs';

// Today's UTC date as YYYY-MM-DD (e.g. '2026-05-14').
const utcDate = new Date().toISOString().slice(0, 10);

// Compose the seed by stripping dashes and parsing as decimal int.
const seed = parseInt(utcDate.replaceAll('-', ''), 10); // → 20260514

const rng = createRng(seed);

// All daily draws share this rng — modifier choice, param values, whale-shark
// spawn cadence, etc. Same `utcDate` always produces the same draws on every
// machine, so the daily challenge is reproducible without server coordination.
```

The contract that all daily draws are reproducible across machines and reloads
is locked by `seed.test.mjs` under the `CS04: ...` test names. Do NOT change
`createRng`'s output without bumping the daily-challenge contract first.

## Dependency example

```js
// src/game/main.mjs
import { createRenderer } from '../engine/renderer.mjs';
import { createInput } from '../engine/input.mjs';
import { createSceneStack } from '../engine/scene.mjs';
import { createLoop } from '../engine/loop.mjs';

const renderer = createRenderer(document.querySelector('canvas'));
const input = createInput(window);
const scenes = createSceneStack();

scenes.push({
  handleInput: (state) => state,
  update: (dt) => scenes.handleInput(input.snapshot?.() ?? input),
  render: () => renderer.clear(),
});

createLoop({
  update: (dt) => scenes.update(dt),
  render: () => scenes.render(renderer),
}).start();

// src/engine/debug-collision.mjs
import { aabbOverlap } from './collision.mjs';
export { aabbOverlap };
```
