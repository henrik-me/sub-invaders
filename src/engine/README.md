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

Other CS02 lanes are writing several modules in parallel. The named exports below are the expected
surface from the CS02 plan Deliverable 1; the orchestrator will reconcile the exact exports
post-wave.

| Module | Named exports | Purpose |
|---|---|---|
| `loop.mjs` | `createLoop` | Fixed-timestep update plus variable-rate render loop. |
| `entity.mjs` | `Entity` | Base entity with position, velocity, dimensions, AABB, and alive state. |
| `collision.mjs` | `aabbOverlap`, `findCollisionPairs` | AABB tests and group collision queries. |
| `input.mjs` | `createInput` | Keyboard and touch input state with per-frame reset. |
| `renderer.mjs` | `createRenderer` | DPR-aware Canvas 2D drawing wrapper. |
| `sprite.mjs` | `loadSpriteSheet`, `createAnimation`, `getFrameIndex` | Sprite loading and frame selection. |
| `audio.mjs` | `createAudioPool` | HTML audio element pool for future SFX hooks. |
| `scene.mjs` | `createSceneStack` | Duck-typed scene stack with lifecycle and input forwarding. |
| `seed.mjs` | `createRng` | Mulberry32 seedable random number generator. |

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
