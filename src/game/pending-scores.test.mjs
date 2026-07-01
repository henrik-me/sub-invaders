import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAP,
  drain,
  enqueue,
  peek,
  PENDING_SCORES_KEY,
  read,
} from './pending-scores.mjs';

function createStorage(initialValue) {
  const values = new Map();

  if (initialValue !== undefined) {
    values.set(PENDING_SCORES_KEY, initialValue);
  }

  return {
    getItem(key) {
      assert.equal(key, PENDING_SCORES_KEY);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      assert.equal(key, PENDING_SCORES_KEY);
      values.set(key, String(value));
    },
    value() {
      return values.has(PENDING_SCORES_KEY) ? values.get(PENDING_SCORES_KEY) : null;
    },
  };
}

function entry(id, score = 10) {
  return {
    sessionId: id,
    score,
    finishedAt: `2026-06-30T00:00:${String(score).padStart(2, '0')}Z`,
  };
}

function storedQueue(storage) {
  return JSON.parse(storage.value());
}

test('enqueue appends a normalized entry and persists it', () => {
  const storage = createStorage();

  const length = enqueue(entry('s1', 7), { storage, now: () => 1234 });

  assert.equal(length, 1);
  assert.deepEqual(storedQueue(storage), [{
    sessionId: 's1',
    score: 7,
    finishedAt: '2026-06-30T00:00:07Z',
    queuedAt: 1234,
  }]);
});

test('enqueue evicts oldest entries when the cap is exceeded', () => {
  const storage = createStorage();

  for (let index = 0; index < CAP + 1; index += 1) {
    enqueue(entry(`s${index}`, index), { storage, now: () => index });
  }

  const queue = storedQueue(storage);
  assert.equal(queue.length, CAP);
  assert.equal(queue[0].sessionId, 's1');
  assert.equal(queue.at(-1).sessionId, 's20');
});

test('peek returns a copy that cannot mutate persisted storage', () => {
  const storage = createStorage();
  enqueue(entry('s1'), { storage, now: () => 1 });

  const queue = peek({ storage });
  queue.push({ sessionId: 'mutated', score: 1, finishedAt: 'x', queuedAt: 2 });
  queue[0].score = 999;

  assert.deepEqual(storedQueue(storage), [{
    sessionId: 's1',
    score: 10,
    finishedAt: '2026-06-30T00:00:10Z',
    queuedAt: 1,
  }]);
});

test('drain submits all entries in FIFO order and empties the queue', async () => {
  const storage = createStorage();
  enqueue(entry('s1', 1), { storage, now: () => 101 });
  enqueue(entry('s2', 2), { storage, now: () => 102 });
  const calls = [];

  const summary = await drain(async (pending) => {
    calls.push(pending.sessionId);
  }, { storage });

  assert.deepEqual(calls, ['s1', 's2']);
  assert.deepEqual(summary, { submitted: 2, dropped: 0, remaining: 0, notes: [] });
  assert.deepEqual(storedQueue(storage), []);
});

test('drain stops on transient failure and keeps failed entry plus the rest', async () => {
  const storage = createStorage();
  enqueue(entry('s1', 1), { storage, now: () => 101 });
  enqueue(entry('s2', 2), { storage, now: () => 102 });
  enqueue(entry('s3', 3), { storage, now: () => 103 });
  const calls = [];

  const summary = await drain(async (pending) => {
    calls.push(pending.sessionId);
    if (pending.sessionId === 's2') {
      throw Object.assign(new Error('offline'), { code: 'network' });
    }
  }, { storage });

  assert.deepEqual(calls, ['s1', 's2']);
  assert.deepEqual(summary, { submitted: 1, dropped: 0, remaining: 2, notes: [] });
  assert.deepEqual(storedQueue(storage).map((pending) => pending.sessionId), ['s2', 's3']);
});

test('drain drops permanently dead entries, continues, and returns notes', async () => {
  const storage = createStorage();
  enqueue(entry('s1', 1), { storage, now: () => 101 });
  enqueue(entry('s2', 2), { storage, now: () => 102 });
  enqueue(entry('s3', 3), { storage, now: () => 103 });
  const calls = [];

  const summary = await drain(async (pending) => {
    calls.push(pending.sessionId);
    if (pending.sessionId === 's1') {
      throw { status: 409, code: 'session-consumed' };
    }
    if (pending.sessionId === 's2') {
      throw { status: 400, code: 'expired' };
    }
  }, { storage });

  assert.deepEqual(calls, ['s1', 's2', 's3']);
  assert.equal(summary.submitted, 1);
  assert.equal(summary.dropped, 2);
  assert.equal(summary.remaining, 0);
  assert.equal(summary.notes.length, 2);
  assert.match(summary.notes[0], /already submitted/);
  assert.match(summary.notes[1], /expired/);
  assert.deepEqual(storedQueue(storage), []);
});

test('corrupt JSON, non-arrays, and malformed entries recover to empty without throwing', () => {
  const malformedValues = [
    '{not json',
    JSON.stringify({ sessionId: 's1' }),
    JSON.stringify([{
      sessionId: 's1',
      score: 1,
      finishedAt: '2026-06-30T00:00:01Z',
    }]),
  ];

  for (const value of malformedValues) {
    const storage = createStorage(value);

    assert.doesNotThrow(() => read({ storage }));
    assert.deepEqual(read({ storage }), []);
    assert.deepEqual(storedQueue(storage), []);
  }
});

test('helpers do not throw when storage is unavailable', async () => {
  assert.doesNotThrow(() => read({ storage: undefined }));
  assert.doesNotThrow(() => enqueue(entry('s1'), { storage: undefined, now: () => 1 }));

  const summary = await drain(async () => {}, { storage: undefined });
  assert.deepEqual(summary, { submitted: 0, dropped: 0, remaining: 0, notes: [] });
});

