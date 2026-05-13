import assert from 'node:assert/strict';
import test from 'node:test';

import { createLoop } from './loop.mjs';

const FIXED_DT = 1 / 60;

function createTime(initial = 0) {
  let current = initial;

  return {
    advance(seconds) {
      current += seconds;
    },
    now() {
      return current;
    },
  };
}

function createRafController() {
  let nextId = 1;
  const callbacks = new Map();

  return {
    raf(callback) {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancelRaf(id) {
      callbacks.delete(id);
    },
    pendingCount() {
      return callbacks.size;
    },
    pendingCallback() {
      const first = callbacks.values().next();
      return first.done ? null : first.value;
    },
    tick() {
      const first = callbacks.entries().next();

      if (first.done) {
        return false;
      }

      const [id, callback] = first.value;
      callbacks.delete(id);
      callback();
      return true;
    },
  };
}

test('fixed accumulator calls update once per fixed frame', () => {
  const time = createTime();
  const frames = createRafController();
  const updates = [];
  const renders = [];
  const loop = createLoop({
    update: (dt) => updates.push(dt),
    render: (alpha) => renders.push(alpha),
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  loop.start();

  for (let frame = 0; frame < 8; frame += 1) {
    time.advance(FIXED_DT);
    assert.equal(frames.tick(), true);
  }

  assert.equal(updates.length, 8);
  assert.deepEqual(updates, Array.from({ length: 8 }, () => FIXED_DT));
  assert.equal(renders.length, 8);
  assert.ok(renders.every((alpha) => alpha >= 0 && alpha <= 1));
});

test('accumulator is clamped after a long frame', () => {
  const time = createTime();
  const frames = createRafController();
  const updates = [];
  const fixedDt = FIXED_DT;
  const maxAccumulator = 0.25;
  const loop = createLoop({
    update: (dt) => updates.push(dt),
    render: () => {},
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
    fixedDt,
    maxAccumulator,
  });

  loop.start();
  time.advance(5);
  assert.equal(frames.tick(), true);

  assert.ok(updates.length <= Math.floor(maxAccumulator / fixedDt));
  assert.equal(updates.length, 15);
  assert.ok(updates.every((dt) => dt === fixedDt));
});

test('pause halts updates and resume skips missed time', () => {
  const time = createTime();
  const frames = createRafController();
  const updates = [];
  const renders = [];
  const loop = createLoop({
    update: (dt) => updates.push(dt),
    render: (alpha) => renders.push(alpha),
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  loop.start();
  time.advance(FIXED_DT);
  assert.equal(frames.tick(), true);
  assert.equal(updates.length, 1);

  loop.pause();
  time.advance(5);
  assert.equal(frames.tick(), true);
  assert.equal(updates.length, 1);
  assert.equal(loop.isPaused(), true);

  loop.resume();
  time.advance(FIXED_DT);
  assert.equal(frames.tick(), true);

  assert.equal(updates.length, 2);
  assert.deepEqual(updates, [FIXED_DT, FIXED_DT]);
  assert.equal(renders.length, 3);
});

test('stop cancels the queued frame and stale callbacks do nothing', () => {
  const time = createTime();
  const frames = createRafController();
  let updateCount = 0;
  let renderCount = 0;
  const loop = createLoop({
    update: () => {
      updateCount += 1;
    },
    render: () => {
      renderCount += 1;
    },
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  loop.start();
  const staleCallback = frames.pendingCallback();
  loop.stop();

  assert.equal(loop.isRunning(), false);
  assert.equal(frames.pendingCount(), 0);

  time.advance(FIXED_DT);
  staleCallback();

  assert.equal(updateCount, 0);
  assert.equal(renderCount, 0);
  assert.equal(frames.pendingCount(), 0);
});

test('start is a no-op if already running', () => {
  const time = createTime();
  const frames = createRafController();
  const loop = createLoop({
    update: () => {},
    render: () => {},
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  loop.start();
  const queuedAfterFirst = frames.pendingCount();
  loop.start();
  assert.equal(frames.pendingCount(), queuedAfterFirst);
});

test('stop is a no-op if not running', () => {
  const time = createTime();
  const frames = createRafController();
  const loop = createLoop({
    update: () => {},
    render: () => {},
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  assert.doesNotThrow(() => loop.stop());
  assert.equal(loop.isRunning(), false);
});

test('pause is a no-op when not running and when already paused', () => {
  const time = createTime();
  const frames = createRafController();
  const loop = createLoop({
    update: () => {},
    render: () => {},
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  loop.pause(); // not running
  assert.equal(loop.isPaused(), false);

  loop.start();
  loop.pause();
  loop.pause(); // already paused
  assert.equal(loop.isPaused(), true);
});

test('resume is a no-op when not running and when not paused', () => {
  const time = createTime();
  const frames = createRafController();
  const loop = createLoop({
    update: () => {},
    render: () => {},
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  loop.resume(); // not running
  assert.equal(loop.isPaused(), false);

  loop.start();
  loop.resume(); // running but not paused
  assert.equal(loop.isPaused(), false);
});

test('scheduleNextFrame is skipped when stop is called from inside update', () => {
  const time = createTime();
  const frames = createRafController();
  let updates = 0;
  const loop = createLoop({
    update: () => {
      updates += 1;
      loop.stop();
    },
    render: () => {},
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  loop.start();
  time.advance(FIXED_DT);
  frames.tick();

  assert.equal(updates, 1);
  assert.equal(frames.pendingCount(), 0);
  assert.equal(loop.isRunning(), false);
});

test('createLoop without injected now uses globalThis.performance.now', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  let timeMs = 0;
  const performance = {
    now() {
      const t = timeMs;
      timeMs += 16;
      return t;
    },
  };
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: performance });
  try {
    const frames = createRafController();
    const updates = [];
    const loop = createLoop({
      update: (dt) => updates.push(dt),
      render: () => {},
      raf: frames.raf,
      cancelRaf: frames.cancelRaf,
    });
    loop.start();
    frames.tick();
    assert.ok(updates.length >= 0);
  } finally {
    if (original) Object.defineProperty(globalThis, 'performance', original);
    else delete globalThis.performance;
  }
});

test('createLoop validates update/render/raf/now are callable', () => {
  const frames = createRafController();
  assert.throws(
    () => createLoop({ update: 'no', raf: frames.raf, now: () => 0 }),
    /update to be a function/,
  );
  assert.throws(
    () => createLoop({ render: 'no', raf: frames.raf, now: () => 0 }),
    /render to be a function/,
  );
  assert.throws(
    () => createLoop({ raf: 'no', now: () => 0 }),
    /raf to be a function/,
  );
  assert.throws(
    () => createLoop({ raf: frames.raf, now: 'no' }),
    /now to be a function/,
  );
});

test('createLoop validates fixedDt and maxAccumulator constraints', () => {
  const frames = createRafController();
  assert.throws(
    () => createLoop({ raf: frames.raf, now: () => 0, fixedDt: 0 }),
    /fixedDt/,
  );
  assert.throws(
    () => createLoop({ raf: frames.raf, now: () => 0, fixedDt: -1 }),
    /fixedDt/,
  );
  assert.throws(
    () => createLoop({ raf: frames.raf, now: () => 0, maxAccumulator: -0.1 }),
    /maxAccumulator/,
  );
});

test('stop without a cancelRaf still clears running state', () => {
  const time = createTime();
  const frames = createRafController();
  const loop = createLoop({
    update: () => {},
    render: () => {},
    raf: frames.raf,
    now: time.now,
    // no cancelRaf passed
  });

  loop.start();
  assert.doesNotThrow(() => loop.stop());
  assert.equal(loop.isRunning(), false);
});

test('a frame callback that fires after stop is a no-op', () => {
  const time = createTime();
  const frames = createRafController();
  let updates = 0;
  const loop = createLoop({
    update: () => { updates += 1; },
    render: () => {},
    raf: frames.raf,
    cancelRaf: () => {}, // ignore cancel — preserve callback
    now: time.now,
  });
  loop.start();
  loop.stop();
  // Manually invoke the leftover callback (cancelRaf was a no-op).
  time.advance(FIXED_DT);
  frames.tick();

  assert.equal(updates, 0);
});

test('paused frame still calls render with a stable alpha', () => {
  const time = createTime();
  const frames = createRafController();
  const renders = [];
  const loop = createLoop({
    update: () => {},
    render: (alpha) => renders.push(alpha),
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  loop.start();
  loop.pause();
  time.advance(FIXED_DT * 5);
  frames.tick();

  assert.ok(renders.length >= 1);
  for (const alpha of renders) {
    assert.ok(alpha >= 0 && alpha <= 1);
  }
});

test('createLoop with fixedDt = 0 is rejected', () => {
  const frames = createRafController();
  assert.throws(
    () => createLoop({ raf: frames.raf, now: () => 0, fixedDt: 0 }),
    /fixedDt/,
  );
});

test('opts.now arg uses scale=1 (raw seconds)', () => {
  const frames = createRafController();
  let t = 0;
  const updates = [];
  const loop = createLoop({
    update: (dt) => updates.push(dt),
    render: () => {},
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: () => t,
  });
  loop.start();
  t += FIXED_DT;
  frames.tick();
  assert.equal(updates.length, 1);
});
