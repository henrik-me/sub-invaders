import assert from 'node:assert/strict';
import test from 'node:test';
import { getHighScore, HIGH_SCORE_KEY, setHighScore } from './score.mjs';

function createStorage(initialValue = null) {
  let value = initialValue;

  return {
    getItem(key) {
      assert.equal(key, HIGH_SCORE_KEY);
      return value;
    },
    setItem(key, nextValue) {
      assert.equal(key, HIGH_SCORE_KEY);
      value = String(nextValue);
    },
    removeItem(key) {
      assert.equal(key, HIGH_SCORE_KEY);
      value = null;
    },
    value() {
      return value;
    },
  };
}

test('getHighScore returns 0 when the key is missing', () => {
  assert.equal(getHighScore({ storage: createStorage(null) }), 0);
});

test('getHighScore returns 0 for malformed stored values', () => {
  for (const value of ['NaN', 'abc', '', '-5', '{"score":42}', '3.14', 'Infinity']) {
    assert.equal(getHighScore({ storage: createStorage(value) }), 0, value);
  }
});

test('getHighScore returns the stored integer', () => {
  assert.equal(getHighScore({ storage: createStorage('42') }), 42);
});

test('setHighScore writes an integer that getHighScore can read', () => {
  const storage = createStorage(null);

  setHighScore(123, { storage });

  assert.equal(getHighScore({ storage }), 123);
});

test('setHighScore clamps negative values to 0', () => {
  const storage = createStorage('9');

  setHighScore(-5, { storage });

  assert.equal(storage.value(), '0');
});

test('setHighScore no-ops for NaN', () => {
  const storage = createStorage('9');

  setHighScore(NaN, { storage });

  assert.equal(storage.value(), '9');
});

test('score helpers do not throw when storage is unavailable', () => {
  assert.doesNotThrow(() => getHighScore({ storage: undefined }));
  assert.doesNotThrow(() => setHighScore(12, { storage: undefined }));
});

test('getHighScore returns 0 when storage getItem throws', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
  };

  assert.doesNotThrow(() => getHighScore({ storage }));
  assert.equal(getHighScore({ storage }), 0);
});

test('setHighScore does not throw when storage setItem throws', () => {
  const storage = {
    setItem() {
      throw new Error('quota');
    },
  };

  assert.doesNotThrow(() => setHighScore(12, { storage }));
});
