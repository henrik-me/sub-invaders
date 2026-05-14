import assert from 'node:assert/strict';
import test from 'node:test';

import { createRng } from '../engine/seed.mjs';
import { createWhaleShark } from './whaleshark.mjs';

function intervalRng(intervalMs = 15000, pointIndex = 0) {
  const calls = [];

  return {
    calls,
    int(min, max) {
      calls.push([min, max]);
      if (min === 0 && max === 2) {
        return pointIndex;
      }
      return intervalMs;
    },
  };
}

test('normal mode spawns on the tick after the random interval has elapsed', () => {
  const rng = intervalRng(15000);
  const whaleShark = createWhaleShark({ rng, canvasWidth: 800, canvasHeight: 600 });

  assert.deepEqual(rng.calls[0], [15000, 30000]);
  assert.equal(whaleShark.state.active, false);

  whaleShark.update(14.999);
  assert.equal(whaleShark.state.active, false);
  assert.equal(whaleShark.state.spawnTimerMs, 1);

  whaleShark.update(0.001);
  assert.equal(whaleShark.state.active, true);
  assert.equal(whaleShark.state.shark.x, -whaleShark.__forTesting.constants.width);
});

test('daily mode uses the deterministic spawn interval instead of normal random cadence', () => {
  const whaleShark = createWhaleShark({
    rng: createRng(20260514),
    canvasWidth: 800,
    canvasHeight: 600,
    dailyMode: true,
    spawnIntervalMs: 10000,
  });

  assert.equal(whaleShark.state.spawnIntervalMs, 10000);
  whaleShark.update(9.999);
  assert.equal(whaleShark.state.active, false);

  whaleShark.update(0.001);
  assert.equal(whaleShark.state.active, true);
});

test('spawned whale shark moves left to right at constant velocity', () => {
  const rng = intervalRng();
  const whaleShark = createWhaleShark({ rng, canvasWidth: 800, canvasHeight: 600 });
  const shark = whaleShark.__forTesting.forceSpawn();
  const startX = shark.x;
  const startY = shark.y;

  whaleShark.update(1);

  assert.equal(shark.x, startX + whaleShark.__forTesting.constants.speed);
  assert.equal(shark.y, startY);
  assert.equal(shark.vx, whaleShark.__forTesting.constants.speed);
});

test('AABB torpedo overlap hits, consumes the torpedo, and awards an allowed point value', () => {
  const rng = intervalRng(15000, 2);
  const whaleShark = createWhaleShark({ rng, canvasWidth: 800, canvasHeight: 600 });
  const shark = whaleShark.__forTesting.forceSpawn();
  const torpedo = { x: shark.x + 4, y: shark.y + 4, w: 4, h: 10, alive: true };

  const result = whaleShark.checkHit([torpedo]);

  assert.deepEqual(result, { hit: true, points: 200 });
  assert.equal([50, 100, 200].includes(result.points), true);
  assert.equal(torpedo.consumed, true);
  assert.equal(torpedo.alive, false);
});

test('hit despawns the whale shark and arms the next spawn timer', () => {
  const rng = intervalRng(16000, 1);
  const whaleShark = createWhaleShark({ rng, canvasWidth: 800, canvasHeight: 600 });
  const shark = whaleShark.__forTesting.forceSpawn();

  const result = whaleShark.checkHit([{ x: shark.x, y: shark.y, w: shark.w, h: shark.h, alive: true }]);

  assert.equal(result.hit, true);
  assert.equal(whaleShark.state.active, false);
  assert.equal(whaleShark.state.shark, null);
  assert.equal(whaleShark.state.spawnTimerMs, 16000);
});

test('leaving the opposite edge despawns and resets the spawn timer', () => {
  const rng = intervalRng(17000);
  const whaleShark = createWhaleShark({ rng, canvasWidth: 100, canvasHeight: 600 });
  const shark = whaleShark.__forTesting.forceSpawn();
  const travelSeconds = (100 + shark.w + 1) / whaleShark.__forTesting.constants.speed;

  whaleShark.update(travelSeconds);

  assert.equal(whaleShark.state.active, false);
  assert.equal(whaleShark.state.shark, null);
  assert.equal(whaleShark.state.spawnTimerMs, 17000);
});

test('render draws an active whale shark as a rectangle placeholder', () => {
  const rng = intervalRng();
  const whaleShark = createWhaleShark({ rng });
  const shark = whaleShark.__forTesting.forceSpawn();
  const calls = [];
  const renderer = { drawRect: (...args) => calls.push(args) };

  assert.equal(whaleShark.render(renderer), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 4), [shark.x, shark.y, shark.w, shark.h]);
});
