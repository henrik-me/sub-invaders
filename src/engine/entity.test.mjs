import assert from 'node:assert/strict';
import test from 'node:test';

import { Entity } from './entity.mjs';

test('default constructor initializes zero geometry and alive entity', () => {
  const entity = new Entity();

  assert.equal(entity.x, 0);
  assert.equal(entity.y, 0);
  assert.equal(entity.vx, 0);
  assert.equal(entity.vy, 0);
  assert.equal(entity.w, 0);
  assert.equal(entity.h, 0);
  assert.equal(entity.alive, true);
});

test('constructor accepts position, velocity, and dimensions', () => {
  const entity = new Entity({ x: 1, y: 2, vx: 3, vy: 4, w: 5, h: 6 });

  assert.equal(entity.x, 1);
  assert.equal(entity.y, 2);
  assert.equal(entity.vx, 3);
  assert.equal(entity.vy, 4);
  assert.equal(entity.w, 5);
  assert.equal(entity.h, 6);
  assert.equal(entity.alive, true);
});

test('aabb returns current top-left bounds', () => {
  const entity = new Entity({ x: 10, y: 20, w: 30, h: 40 });

  assert.deepEqual(entity.aabb(), { x: 10, y: 20, w: 30, h: 40 });

  entity.x = 15;
  entity.y = 25;
  entity.w = 35;
  entity.h = 45;

  assert.deepEqual(entity.aabb(), { x: 15, y: 25, w: 35, h: 45 });
});

test('default update integrates velocity over dt', () => {
  const entity = new Entity({ x: 10, y: 20, vx: 90, vy: -30 });

  entity.update(0.5);

  assert.equal(entity.x, 55);
  assert.equal(entity.y, 5);
});

test('render is a default no-op', () => {
  const entity = new Entity();
  const ctx = { untouched: true };

  assert.equal(entity.render(ctx), undefined);
  assert.deepEqual(ctx, { untouched: true });
});

test('kill marks the entity as not alive', () => {
  const entity = new Entity();

  entity.kill();

  assert.equal(entity.alive, false);
});

test('subclasses can replace update behavior', () => {
  class StaticEntity extends Entity {
    update(dt) {
      this.lastDt = dt;
    }
  }

  const entity = new StaticEntity({ x: 10, y: 20, vx: 90, vy: -30 });

  entity.update(0.5);

  assert.equal(entity.x, 10);
  assert.equal(entity.y, 20);
  assert.equal(entity.lastDt, 0.5);
});

test('subclasses can extend update behavior with super', () => {
  class TrackingEntity extends Entity {
    update(dt) {
      super.update(dt);
      this.updated = true;
    }
  }

  const entity = new TrackingEntity({ x: 1, y: 2, vx: 6, vy: 12 });

  entity.update(0.25);

  assert.equal(entity.x, 2.5);
  assert.equal(entity.y, 5);
  assert.equal(entity.updated, true);
});
