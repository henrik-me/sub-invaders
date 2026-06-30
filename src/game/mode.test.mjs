import test from 'node:test';
import assert from 'node:assert/strict';

import { getMode, isPractice, isRanked, LAST_MODE_KEY, MODES, setMode } from './mode.mjs';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },

    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test('getMode defaults to ranked when nothing is set', () => {
  assert.equal(getMode({ search: '', storage: createStorage() }), MODES.RANKED);
});

test('getMode parses ?mode=practice from search', () => {
  assert.equal(getMode({ search: '?mode=practice', storage: createStorage() }), MODES.PRACTICE);
});

test('getMode parses ?mode=ranked from url', () => {
  assert.equal(getMode({ url: { search: '?mode=ranked' }, storage: createStorage() }), MODES.RANKED);
});

test('getMode ignores unknown query mode and falls back to storage', () => {
  const storage = createStorage({ [LAST_MODE_KEY]: MODES.PRACTICE });

  assert.equal(getMode({ search: '?mode=foo', storage }), MODES.PRACTICE);
});

test('getMode ignores unknown query and storage modes before defaulting', () => {
  const storage = createStorage({ [LAST_MODE_KEY]: 'arcade' });

  assert.equal(getMode({ search: '?mode=foo', storage }), MODES.RANKED);
});

test('getMode uses localStorage when no URL override is present', () => {
  const storage = createStorage({ [LAST_MODE_KEY]: MODES.PRACTICE });

  assert.equal(getMode({ search: '', storage }), MODES.PRACTICE);
});

test('setMode round-trips through storage with getMode', () => {
  const storage = createStorage();

  setMode(MODES.PRACTICE, { storage });

  assert.equal(storage.getItem(LAST_MODE_KEY), MODES.PRACTICE);
  assert.equal(getMode({ storage }), MODES.PRACTICE);
});

test('setMode rejects unknown modes without persisting', () => {
  const storage = createStorage({ [LAST_MODE_KEY]: MODES.RANKED });

  setMode('arcade', { storage });

  assert.equal(storage.getItem(LAST_MODE_KEY), MODES.RANKED);
});

test('isRanked and isPractice agree with getMode', () => {
  const rankedOpts = { search: '?mode=ranked', storage: createStorage() };
  const practiceOpts = { search: '?mode=practice', storage: createStorage() };

  assert.equal(getMode(rankedOpts), MODES.RANKED);
  assert.equal(isRanked(rankedOpts), true);
  assert.equal(isPractice(rankedOpts), false);

  assert.equal(getMode(practiceOpts), MODES.PRACTICE);
  assert.equal(isRanked(practiceOpts), false);
  assert.equal(isPractice(practiceOpts), true);
});

test('storage and URL absence in Node does not throw', () => {
  assert.doesNotThrow(() => getMode());
  assert.doesNotThrow(() => isRanked());
  assert.doesNotThrow(() => isPractice());
  assert.doesNotThrow(() => setMode(MODES.RANKED));
  assert.equal(getMode(), MODES.RANKED);
});

test('getMode ignores storage failures', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
  };

  assert.equal(getMode({ search: '', storage }), MODES.RANKED);
});

test('setMode ignores storage write failures', () => {
  const storage = {
    setItem() {
      throw new Error('blocked');
    },
  };

  assert.doesNotThrow(() => setMode(MODES.PRACTICE, { storage }));
});
