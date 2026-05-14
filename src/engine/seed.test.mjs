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

// CS04 D1 — date-seeded RNG usage pattern: seed = parseInt(YYYYMMDD).
// Daily challenge requires that all players see the same modifier and params
// for the same UTC date. Lock the contract with explicit reproducibility +
// boundary tests so future changes to seed.mjs cannot silently desync players.

test('CS04: date-seeded RNG reproduces identical first draws across calls', () => {
  const seed = parseInt('20260514', 10);
  const a = createRng(seed);
  const b = createRng(seed);

  assert.deepEqual(take(a, 20), take(b, 20));
});

test('CS04: distinct UTC dates produce distinct first draws', () => {
  const a = createRng(parseInt('20260514', 10));
  const b = createRng(parseInt('20260515', 10));

  assert.notDeepEqual(take(a, 5), take(b, 5));
});

test('CS04: date-seeded int draws stay within bounds for a fixed pool', () => {
  const seed = parseInt('20260514', 10);
  const rng = createRng(seed);
  const pool = ['fog-of-war', 'speed-run', 'one-shot', 'boss-rush', 'inverted-controls'];

  for (let i = 0; i < 1000; i += 1) {
    const idx = rng.int(0, pool.length - 1);
    assert.equal(Number.isInteger(idx), true);
    assert.equal(idx >= 0, true);
    assert.equal(idx <= 4, true);
  }
});

test('CS04: re-seeding with the same UTC date restores the modifier choice', () => {
  const seed = parseInt('20260514', 10);
  const rng = createRng(seed);
  const firstChoice = rng.int(0, 4);

  // Burn entropy as if a full day's worth of draws ran, then re-seed.
  take(rng, 500);
  rng.seed(seed);

  assert.equal(rng.int(0, 4), firstChoice);
});

test('CS04: 1900-01-01 (lowest plausible YYYYMMDD seed) still produces deterministic draws', () => {
  const seed = parseInt('19000101', 10);
  const a = createRng(seed);
  const b = createRng(seed);

  assert.deepEqual(take(a, 16), take(b, 16));
});
