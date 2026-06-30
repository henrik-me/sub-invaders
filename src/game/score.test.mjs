import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getHighScore,
  getHighScoreFor,
  HIGH_SCORE_KEY,
  PRACTICE_HIGH_SCORE_KEY,
  setHighScore,
  setHighScoreFor,
} from './score.mjs';

function createStorage(initialEntries = null) {
  const values = new Map();

  if (initialEntries instanceof Map) {
    for (const [key, value] of initialEntries) {
      values.set(key, value);
    }
  } else if (
    initialEntries &&
    typeof initialEntries === 'object' &&
    !Array.isArray(initialEntries)
  ) {
    for (const [key, value] of Object.entries(initialEntries)) {
      values.set(key, value);
    }
  } else if (initialEntries !== null && initialEntries !== undefined) {
    values.set(HIGH_SCORE_KEY, initialEntries);
  }

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, nextValue) {
      values.set(key, String(nextValue));
    },
    removeItem(key) {
      values.delete(key);
    },
    value(key = HIGH_SCORE_KEY) {
      return values.has(key) ? values.get(key) : null;
    },
  };
}

test('getHighScore returns 0 when the key is missing', () => {
  assert.equal(getHighScore({ storage: createStorage(null) }), 0);
});

test('getHighScore returns 0 for malformed stored values', () => {
  for (const value of ['NaN', 'abc', '', '-5', '{"score":42}', '3.14', 'Infinity']) {
    assert.equal(getHighScore({ storage: createStorage(value) }), 0, value);
    assert.equal(
      getHighScoreFor('practice', {
        storage: createStorage({ [PRACTICE_HIGH_SCORE_KEY]: value }),
      }),
      0,
      value,
    );
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

test('getHighScoreFor reads and writes the practice key', () => {
  const storage = createStorage();

  setHighScoreFor('practice', 77, { storage });

  assert.equal(storage.value(PRACTICE_HIGH_SCORE_KEY), '77');
  assert.equal(getHighScoreFor('practice', { storage }), 77);
});

test('getHighScoreFor ranked mode uses the legacy key', () => {
  const storage = createStorage({ [HIGH_SCORE_KEY]: '51' });

  assert.equal(getHighScoreFor('ranked', { storage }), 51);

  setHighScoreFor('ranked', 52, { storage });

  assert.equal(storage.value(HIGH_SCORE_KEY), '52');
});

test('ranked and practice high scores do not cross-pollinate', () => {
  const storage = createStorage();

  setHighScoreFor('practice', 88, { storage });

  assert.equal(getHighScoreFor('practice', { storage }), 88);
  assert.equal(getHighScoreFor('ranked', { storage }), 0);
  assert.equal(storage.value(HIGH_SCORE_KEY), null);

  setHighScoreFor('ranked', 99, { storage });

  assert.equal(getHighScoreFor('ranked', { storage }), 99);
  assert.equal(getHighScoreFor('practice', { storage }), 88);
  assert.equal(storage.value(PRACTICE_HIGH_SCORE_KEY), '88');
});

test('unknown high-score modes fall back to ranked', () => {
  const storage = createStorage({ [HIGH_SCORE_KEY]: '64', [PRACTICE_HIGH_SCORE_KEY]: '128' });

  assert.equal(getHighScoreFor('arcade', { storage }), 64);

  setHighScoreFor('arcade', 65, { storage });

  assert.equal(getHighScoreFor('ranked', { storage }), 65);
  assert.equal(getHighScoreFor('practice', { storage }), 128);
});

test('legacy high-score helpers continue targeting ranked only', () => {
  const storage = createStorage();

  setHighScore(31, { storage });

  assert.equal(getHighScore({ storage }), 31);
  assert.equal(getHighScoreFor('ranked', { storage }), 31);
  assert.equal(getHighScoreFor('practice', { storage }), 0);
  assert.equal(storage.value(PRACTICE_HIGH_SCORE_KEY), null);
});
