import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayer, createTorpedo } from './player.mjs';

function input({ down = [], pressed = [] } = {}) {
  const downSet = new Set(down);
  const pressedSet = new Set(pressed);

  return {
    down: (code) => downSet.has(code),
    pressed: (code) => pressedSet.has(code),
  };
}

test('player horizontal movement clamps to canvas bounds', () => {
  const player = createPlayer({ canvasWidth: 100, w: 32, x: 10, y: 50, speed: 50 });

  player.update(1, input({ down: ['ArrowLeft'] }));
  assert.equal(player.x, 0);

  player.x = 90;
  player.update(1, input({ down: ['KeyD'] }));
  assert.equal(player.x, 68);
});

test('player single-shot rule blocks firing while a torpedo is alive', () => {
  const player = createPlayer({ x: 20, y: 50, fireCooldownMs: 0 });
  const fire = input({ pressed: ['Space'] });

  const first = player.tryFire(fire);
  assert.ok(first);
  assert.equal(player.tryFire(fire), null);

  first.kill();
  assert.ok(player.tryFire(fire));
});

test('player fire cooldown must elapse before another torpedo can spawn', () => {
  const player = createPlayer({ x: 20, y: 50, fireCooldownMs: 350 });
  const fire = input({ pressed: ['KeyW'] });

  const first = player.tryFire(fire);
  first.kill();

  assert.equal(player.tryFire(fire), null);
  player.update(0.349, input());
  assert.equal(player.tryFire(fire), null);
  player.update(0.001, input());
  assert.ok(player.tryFire(fire));
});

test('loseLife decrements and respawn recenters with invulnerability', () => {
  const player = createPlayer({ canvasWidth: 100, w: 20, x: 0, y: 70, lives: 3, invulnMs: 1500 });

  assert.equal(player.loseLife(), 2);
  player.x = 5;
  player.respawn();

  assert.equal(player.x, 40);
  assert.equal(player.y, 70);
  assert.equal(player.isInvulnerable(), true);
});

test('player invulnerability expires after invulnMs', () => {
  const player = createPlayer({ invulnMs: 100 });

  player.respawn();
  player.update(0.099, input());
  assert.equal(player.isInvulnerable(), true);
  player.update(0.001, input());
  assert.equal(player.isInvulnerable(), false);
});

test('player isDead becomes true after all lives are lost', () => {
  const player = createPlayer({ lives: 2 });

  player.loseLife();
  assert.equal(player.isDead(), false);
  player.loseLife();
  assert.equal(player.isDead(), true);
});

test('torpedo self-kills after leaving the top of the canvas', () => {
  const torpedo = createTorpedo({ x: 0, y: 0, h: 10, speed: 100 });

  torpedo.update(0.09);
  assert.equal(torpedo.alive, true);
  torpedo.update(0.02);
  assert.equal(torpedo.alive, false);
});

test('player render draws sprites and blinks during invulnerability', () => {
  const calls = [];
  const renderer = { drawSprite: (...args) => calls.push(args) };
  const sprites = { image: 'sheet', submarine: { x: 0, y: 0, w: 32, h: 16 } };
  const player = createPlayer({ blinkMs: 120, invulnMs: 500 });

  assert.equal(player.render(renderer, sprites), true);
  player.respawn();
  assert.equal(player.render(renderer, sprites), true);
  player.update(0.121, input());
  assert.equal(player.render(renderer, sprites), false);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].slice(0, 5), ['sheet', 0, 0, 32, 16]);
});
