import assert from 'node:assert/strict';
import test from 'node:test';

import { createFormation } from './invaders.mjs';

test('formation starts with 5x11 alive enemies and expected type rows', () => {
  const formation = createFormation();

  assert.equal(formation.aliveCount(), 55);
  assert.equal(formation.isCleared(), false);
  assert.equal(formation.enemies[0].type, 'squid');
  assert.equal(formation.enemies[0].points, 40);
  assert.equal(formation.enemies[11].type, 'anglerfish');
  assert.equal(formation.enemies[33].type, 'jellyfish');
  assert.equal(formation.lowestY(), 232);
});

test('formation reverses and descends when an edge would cross a wall', () => {
  const formation = createFormation({ rows: 1, cols: 1, spawnX: 68, spawnY: 10, canvasWidth: 100, baseSpeed: 60, descendStep: 16 });
  const enemy = formation.enemies[0];

  formation.update(1 / 60);

  assert.equal(formation.direction(), -1);
  assert.equal(enemy.x, 68);
  assert.equal(enemy.y, 26);
});

test('formation speed scales as alive count drops', () => {
  const formation = createFormation({ rows: 2, cols: 2, baseSpeed: 100, accelFactor: 1.2 });

  assert.equal(formation.speed(), 100);
  formation.enemies[0].kill();
  formation.enemies[1].kill();

  assert.equal(formation.aliveCount(), 2);
  assert.equal(formation.speed(), 160);
});

test('formation isCleared is true when all enemies are dead', () => {
  const formation = createFormation({ rows: 2, cols: 2 });

  formation.forEachAlive((enemy) => enemy.kill());

  assert.equal(formation.aliveCount(), 0);
  assert.equal(formation.isCleared(), true);
});

test('tryFire uses cadence, rng column choice, and lowest alive enemy', () => {
  const formation = createFormation({ rows: 3, cols: 2, spawnX: 0, spawnY: 0, colSpacing: 50, rowSpacing: 10, fireIntervalMs: 100, shotSpeed: 99 });
  const calls = [];
  const rng = {
    int(min, max) {
      calls.push([min, max]);
      return 1;
    },
  };
  const clock = { elapsedMs: 99 };

  assert.equal(formation.tryFire(rng, clock), null);

  clock.elapsedMs = 100;
  const shot = formation.tryFire(rng, clock);

  assert.ok(shot);
  assert.deepEqual(calls[0], [0, 1]);
  assert.equal(clock.elapsedMs, 0);
  assert.equal(shot.x, 60);
  assert.equal(shot.y, 44);
  assert.equal(shot.vy, 99);

  formation.enemies.find((enemy) => enemy.row === 2 && enemy.col === 1).kill();
  clock.elapsedMs = 100;
  const nextShot = formation.tryFire(rng, clock);

  assert.equal(nextShot.y, 34);
});

test('tryFire can use update-accumulated time without external state', () => {
  const formation = createFormation({ rows: 1, cols: 1, fireIntervalMs: 50 });
  const rng = { int: () => 0 };

  formation.update(0.049);
  assert.equal(formation.tryFire(rng), null);
  formation.update(0.001);
  assert.ok(formation.tryFire(rng));
});

test('resetForWave respawns depth and clamps fire interval and descent growth', () => {
  const formation = createFormation({
    rows: 1,
    cols: 1,
    spawnY: 20,
    depthBumpPerWave: 8,
    depthCap: 16,
    fireIntervalMs: 500,
    firePerWaveMs: 100,
    fireMinIntervalMs: 250,
    descendStep: 16,
    descentStepPerWave: 1,
    descentStepCap: 2,
  });

  formation.enemies[0].kill();
  formation.resetForWave(3);

  assert.equal(formation.aliveCount(), 1);
  assert.equal(formation.enemies[0].y, 36);
  assert.equal(formation.fireIntervalMs(), 300);
  assert.equal(formation.descendStep(), 18);

  formation.resetForWave(10);

  assert.equal(formation.enemies[0].y, 36);
  assert.equal(formation.fireIntervalMs(), 250);
  assert.equal(formation.descendStep(), 18);
});

test('render draws every alive enemy with its sprite frame', () => {
  const formation = createFormation({ rows: 2, cols: 2 });
  const calls = [];
  const renderer = { drawSprite: (...args) => calls.push(args) };
  const sprites = {
    image: 'sheet',
    frames: {
      squid: { x: 0, y: 40, w: 32, h: 24 },
      anglerfish: { x: 48, y: 16, w: 24, h: 24 },
      jellyfish: { x: 0, y: 16, w: 24, h: 24 },
    },
  };

  formation.enemies[0].kill();

  assert.equal(formation.render(renderer, sprites), 3);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].slice(0, 5), ['sheet', 0, 40, 32, 24]);
});
