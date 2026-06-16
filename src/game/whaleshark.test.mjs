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

test('normal-mode interval uses rng.range when rng.int is absent', () => {
  const whaleShark = createWhaleShark({ rng: { range: () => 20000.7 } });
  assert.equal(whaleShark.state.spawnIntervalMs, 20000);
});

test('normal-mode interval uses rng.next (then Math.random fallback) when int and range are absent', () => {
  const whaleShark = createWhaleShark({ rng: { next: () => 0.5 } });
  const { normalMinMs, normalMaxMs } = whaleShark.__forTesting.constants;
  assert.equal(
    whaleShark.state.spawnIntervalMs,
    Math.floor(0.5 * (normalMaxMs - normalMinMs + 1)) + normalMinMs,
  );
});

test('rng.next returning a non-finite value is clamped to 0', () => {
  const whaleShark = createWhaleShark({ rng: { next: () => Number.NaN } });
  assert.equal(whaleShark.state.spawnIntervalMs, whaleShark.__forTesting.constants.normalMinMs);
});

test('rng.next above 1 is clamped just below 1', () => {
  const whaleShark = createWhaleShark({ rng: { next: () => 5 } });
  const { normalMinMs, normalMaxMs } = whaleShark.__forTesting.constants;
  assert.equal(
    whaleShark.state.spawnIntervalMs,
    Math.floor(0.999999999 * (normalMaxMs - normalMinMs + 1)) + normalMinMs,
  );
});

test('non-positive canvas dimensions fall back to defaults', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng(), canvasWidth: 0, canvasHeight: -5 });
  const shark = whaleShark.__forTesting.forceSpawn();
  assert.equal(shark.x, -whaleShark.__forTesting.constants.width);
});

test('checkHit uses torpedo.aabb() and torpedo.kill() when provided', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng(15000, 0) });
  const shark = whaleShark.__forTesting.forceSpawn();
  let killed = false;
  const torpedo = {
    alive: true,
    aabb: () => ({ x: shark.x + 2, y: shark.y + 2, w: 4, h: 4 }),
    kill() {
      killed = true;
      this.alive = false;
    },
  };

  const result = whaleShark.checkHit([torpedo]);

  assert.equal(result.hit, true);
  assert.equal(killed, true);
  assert.equal(torpedo.consumed, true);
});

test('checkHit tolerates a torpedo missing geometry fields (defaults to 0)', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng() });
  whaleShark.__forTesting.forceSpawn();
  assert.equal(typeof whaleShark.checkHit([{ alive: true }]).hit, 'boolean');
});

test('render returns false when the active shark has no drawRect renderer', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng() });
  whaleShark.__forTesting.forceSpawn();
  assert.equal(whaleShark.render({}), false);
});

test('forceSpawn while already active returns the existing shark', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng() });
  const first = whaleShark.__forTesting.forceSpawn();
  const second = whaleShark.__forTesting.forceSpawn();
  assert.equal(first, second);
});

test('alternating spawns flip the entry edge to a left-moving shark entering from the right', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng() });
  whaleShark.__forTesting.forceSpawn();
  whaleShark.__forTesting.despawn({ resetTimer: false });
  const shark = whaleShark.__forTesting.forceSpawn(1000);

  assert.equal(shark.direction, -1);
  assert.equal(shark.x, 800);
  assert.equal(shark.vx, -whaleShark.__forTesting.constants.speed);
  assert.equal(whaleShark.state.lastSpawnAtMs, 1000);
});

test('a left-moving shark despawns after exiting the left edge', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng(17000), canvasWidth: 100, canvasHeight: 600 });
  whaleShark.__forTesting.forceSpawn();
  whaleShark.__forTesting.despawn({ resetTimer: false });
  const shark = whaleShark.__forTesting.forceSpawn();
  const travelSeconds = (100 + shark.w + 1) / whaleShark.__forTesting.constants.speed;

  whaleShark.update(travelSeconds);

  assert.equal(whaleShark.state.active, false);
});

test('despawn with a finite now schedules the next spawn at now + interval', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng(15000) });
  whaleShark.__forTesting.forceSpawn();
  whaleShark.__forTesting.despawn({ now: 5000 });
  assert.equal(whaleShark.state.nextSpawnAtMs, 5000 + 15000);
});

test('maybeSpawn returns the existing shark when already active', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng() });
  const shark = whaleShark.__forTesting.forceSpawn();
  assert.equal(whaleShark.maybeSpawn(123), shark);
});

test('maybeSpawn(now) schedules then spawns on an external clock', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng(15000) });

  assert.equal(whaleShark.maybeSpawn(1000), null);
  assert.equal(whaleShark.state.active, false);

  whaleShark.maybeSpawn(1000 + 15000);
  assert.equal(whaleShark.state.active, true);
});

test('checkHit skips dead torpedoes and tolerates a missing list', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng() });
  const shark = whaleShark.__forTesting.forceSpawn();
  const dead = { x: shark.x, y: shark.y, w: shark.w, h: shark.h, alive: false };

  assert.deepEqual(whaleShark.checkHit([dead]), { hit: false });
  assert.deepEqual(whaleShark.checkHit(), { hit: false });
});

test('reset() despawns an active shark and re-arms the timer', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng(18000) });
  whaleShark.__forTesting.forceSpawn();
  assert.equal(whaleShark.state.active, true);

  whaleShark.reset();

  assert.equal(whaleShark.state.active, false);
  assert.equal(whaleShark.state.shark, null);
  assert.equal(whaleShark.state.nextSpawnAtMs, null);
  assert.equal(whaleShark.state.spawnIntervalMs, 18000);
});

test('reset() is safe when no shark is active', () => {
  const whaleShark = createWhaleShark({ rng: intervalRng(19000) });
  whaleShark.reset();
  assert.equal(whaleShark.state.active, false);
});
