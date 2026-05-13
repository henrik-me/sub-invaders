import assert from 'node:assert/strict';
import test from 'node:test';

import { aabbOverlap, groupCollisions } from './collision.mjs';

test('aabbOverlap returns true for clearly overlapping boxes', () => {
  assert.equal(
    aabbOverlap(
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 5, y: 4, w: 10, h: 10 },
    ),
    true,
  );
});

test('aabbOverlap returns false for clearly disjoint boxes', () => {
  assert.equal(
    aabbOverlap(
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 20, y: 20, w: 5, h: 5 },
    ),
    false,
  );
});

test('aabbOverlap treats touching edges as overlap', () => {
  assert.equal(
    aabbOverlap(
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 10, y: 2, w: 3, h: 3 },
    ),
    true,
  );
});

test('aabbOverlap treats touching corners as overlap', () => {
  assert.equal(
    aabbOverlap(
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 10, y: 10, w: 4, h: 4 },
    ),
    true,
  );
});

test('groupCollisions returns colliding cross-product pairs', () => {
  const a1 = { id: 'a1', x: 0, y: 0, w: 5, h: 5 };
  const a2 = { id: 'a2', x: 30, y: 30, w: 5, h: 5 };
  const b1 = { id: 'b1', x: 4, y: 4, w: 5, h: 5 };
  const b2 = { id: 'b2', x: 32, y: 31, w: 5, h: 5 };
  const b3 = { id: 'b3', x: 100, y: 100, w: 5, h: 5 };

  assert.deepEqual(groupCollisions([a1, a2], [b1, b2, b3]), [
    { a: a1, b: b1 },
    { a: a2, b: b2 },
  ]);
});

test('groupCollisions skips entities with alive false', () => {
  const alive = { id: 'alive', x: 0, y: 0, w: 10, h: 10 };
  const deadA = { id: 'deadA', x: 0, y: 0, w: 10, h: 10, alive: false };
  const deadB = { id: 'deadB', x: 0, y: 0, w: 10, h: 10, alive: false };
  const target = { id: 'target', x: 2, y: 2, w: 2, h: 2 };

  assert.deepEqual(groupCollisions([deadA, alive], [deadB, target]), [
    { a: alive, b: target },
  ]);
});

test('groupCollisions returns empty result for empty inputs', () => {
  const entity = { x: 0, y: 0, w: 1, h: 1 };

  assert.deepEqual(groupCollisions([], [entity]), []);
  assert.deepEqual(groupCollisions([entity], []), []);
  assert.deepEqual(groupCollisions([], []), []);
});

test('groupCollisions accepts an injected AABB extractor', () => {
  const a = { id: 'a', bounds: { left: 0, top: 0, width: 8, height: 8 } };
  const b = { id: 'b', bounds: { left: 7, top: 7, width: 2, height: 2 } };
  const aabbOf = (entity) => ({
    x: entity.bounds.left,
    y: entity.bounds.top,
    w: entity.bounds.width,
    h: entity.bounds.height,
  });

  assert.deepEqual(groupCollisions([a], [b], { aabbOf }), [{ a, b }]);
});

test('groupCollisions does not mutate input items', () => {
  const a = Object.freeze({ x: 0, y: 0, w: 4, h: 4 });
  const b = Object.freeze({ x: 2, y: 2, w: 4, h: 4 });

  assert.deepEqual(groupCollisions([a], [b]), [{ a, b }]);
});
