import assert from 'node:assert/strict';
import test from 'node:test';

import { createInput } from './input.mjs';

class StubTarget {
  constructor(props = {}) {
    Object.assign(this, props);
    this.listeners = new Map();
    this.addedListeners = [];
    this.removedListeners = [];
  }

  addEventListener(type, handler, options) {
    const entries = this.listeners.get(type) ?? [];
    entries.push({ handler, options });
    this.listeners.set(type, entries);
    this.addedListeners.push({ type, handler, options });
  }

  removeEventListener(type, handler, options) {
    const entries = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      entries.filter((entry) => entry.handler !== handler),
    );
    this.removedListeners.push({ type, handler, options });
  }

  dispatchEvent(type, event = {}) {
    const dispatchedEvent = { type, ...event };
    const entries = this.listeners.get(type) ?? [];

    for (const { handler } of [...entries]) {
      handler(dispatchedEvent);
    }

    return dispatchedEvent;
  }

  listenerCount(type) {
    return this.listeners.get(type)?.length ?? 0;
  }
}

const touch = (clientX, identifier = 1) => ({ clientX, identifier });

test('pressing an arrow key sets down and pressed', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('keydown', { code: 'ArrowLeft' });

  assert.equal(input.down('ArrowLeft'), true);
  assert.equal(input.pressed('ArrowLeft'), true);
  assert.equal(input.released('ArrowLeft'), false);
});

test('endFrame clears pressed while preserving held keys', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);
  target.dispatchEvent('keydown', { code: 'ArrowRight' });

  input.endFrame();

  assert.equal(input.pressed('ArrowRight'), false);
  assert.equal(input.down('ArrowRight'), true);
});

test('releasing a key sets released and clears after endFrame', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);
  target.dispatchEvent('keydown', { code: 'ArrowLeft' });
  input.endFrame();

  target.dispatchEvent('keyup', { code: 'ArrowLeft' });

  assert.equal(input.down('ArrowLeft'), false);
  assert.equal(input.released('ArrowLeft'), true);

  input.endFrame();

  assert.equal(input.down('ArrowLeft'), false);
  assert.equal(input.released('ArrowLeft'), false);
});

test('repeated keydown does not re-press an already held key', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);
  target.dispatchEvent('keydown', { code: 'KeyA' });
  input.endFrame();

  target.dispatchEvent('keydown', { code: 'KeyA', repeat: true });

  assert.equal(input.down('KeyA'), true);
  assert.equal(input.pressed('KeyA'), false);
});

test('unrecognized keys are ignored and do not prevent default', () => {
  const input = createInput();
  const target = new StubTarget({ tagName: 'CANVAS' });
  input.attach(target);
  const event = target.dispatchEvent('keydown', {
    code: 'Enter',
    preventDefault() {
      this.defaultPrevented = true;
    },
  });

  assert.equal(input.down('Enter'), false);
  assert.equal(event.defaultPrevented, undefined);
});

test('recognized keys prevent default on canvas targets', () => {
  const input = createInput();
  const target = new StubTarget({ nodeName: 'canvas' });
  input.attach(target);
  const event = target.dispatchEvent('keydown', {
    code: 'Space',
    preventDefault() {
      this.defaultPrevented = true;
    },
  });

  assert.equal(event.defaultPrevented, true);
});

test('generic test targets do not prevent default for recognized keys', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);
  const event = target.dispatchEvent('keydown', {
    code: 'Space',
    preventDefault() {
      this.defaultPrevented = true;
    },
  });

  assert.equal(input.down('Space'), true);
  assert.equal(event.defaultPrevented, undefined);
});

test('touch horizontal drag delta accumulates until endFrame', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('touchstart', { changedTouches: [touch(10)] });
  target.dispatchEvent('touchmove', { changedTouches: [touch(24)] });
  target.dispatchEvent('touchmove', { changedTouches: [touch(19)] });
  target.dispatchEvent('touchend', { changedTouches: [touch(31)] });

  assert.equal(input.touchDx(), 21);

  input.endFrame();

  assert.equal(input.touchDx(), 0);
});

test('touch tracking ignores non-active touches', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('touchstart', { changedTouches: [touch(10, 1)] });
  target.dispatchEvent('touchmove', { changedTouches: [touch(50, 2)] });

  assert.equal(input.touchDx(), 0);
});

test('detach removes listeners and stops future input updates', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  input.detach();

  assert.deepEqual(
    target.removedListeners.map((listener) => listener.type),
    ['keydown', 'keyup', 'touchstart', 'touchmove', 'touchend'],
  );
  assert.equal(target.listenerCount('keydown'), 0);

  target.dispatchEvent('keydown', { code: 'ArrowLeft' });

  assert.equal(input.down('ArrowLeft'), false);
});
