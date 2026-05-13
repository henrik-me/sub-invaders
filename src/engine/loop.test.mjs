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

test('running and paused state helpers reflect lifecycle transitions', () => {
  const time = createTime();
  const frames = createRafController();
  const loop = createLoop({
    update: () => {},
    render: () => {},
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    now: time.now,
  });

  assert.equal(loop.isRunning(), false);
  assert.equal(loop.isPaused(), false);

  loop.start();
  assert.equal(loop.isRunning(), true);
  assert.equal(loop.isPaused(), false);

  loop.pause();
  assert.equal(loop.isRunning(), true);
  assert.equal(loop.isPaused(), true);

  loop.resume();
  assert.equal(loop.isRunning(), true);
  assert.equal(loop.isPaused(), false);

  loop.stop();
  assert.equal(loop.isRunning(), false);
  assert.equal(loop.isPaused(), false);
});
