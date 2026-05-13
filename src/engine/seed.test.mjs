import test from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from './seed.mjs';

function take(rng, count) {
  return Array.from({ length: count }, () => rng.next());
}

test('same seed reproduces the same first values', () => {
  const first = take(createRng(12345), 10);
  const second = take(createRng(12345), 10);

  assert.deepEqual(first, second);
});

test('different seeds produce different sequences', () => {
  const first = take(createRng(12345), 10);
  const second = take(createRng(54321), 10);

  assert.notDeepEqual(first, second);
});

test('next always returns a float in [0, 1)', () => {
  const rng = createRng(7);

  for (let i = 0; i < 1000; i += 1) {
    const value = rng.next();

    assert.equal(Number.isFinite(value), true);
    assert.equal(value >= 0, true);
    assert.equal(value < 1, true);
  }
});

test('range returns values in [min, max)', () => {
  const rng = createRng(8);

  for (let i = 0; i < 1000; i += 1) {
    const value = rng.range(0, 10);

    assert.equal(value >= 0, true);
    assert.equal(value < 10, true);
  }
});

test('int returns values in [min, max] inclusive', () => {
  const rng = createRng(9);

  for (let i = 0; i < 1000; i += 1) {
    const value = rng.int(1, 6);

    assert.equal(Number.isInteger(value), true);
    assert.equal(value >= 1, true);
    assert.equal(value <= 6, true);
  }
});

test('seed resets the internal sequence', () => {
  const rng = createRng(42);
  const expected = take(rng, 5);

  take(rng, 7);
  rng.seed(42);

  assert.deepEqual(take(rng, 5), expected);
});
