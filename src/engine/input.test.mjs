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

test('Escape and KeyM are recognized for pause and menu return', () => {
  const input = createInput();
  const target = new StubTarget({ tagName: 'CANVAS' });
  input.attach(target);

  target.dispatchEvent('keydown', { code: 'Escape' });
  target.dispatchEvent('keydown', { code: 'KeyM' });

  assert.equal(input.pressed('Escape'), true);
  assert.equal(input.pressed('KeyM'), true);
  assert.equal(input.down('Escape'), true);
  assert.equal(input.down('KeyM'), true);
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

test('detach is a no-op when nothing is attached', () => {
  const input = createInput();
  const result = input.detach();
  assert.equal(result, input);
});

test('attach to the same target twice is idempotent', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  const beforeAdded = target.addedListeners.length;
  input.attach(target);

  assert.equal(target.addedListeners.length, beforeAdded);
  assert.equal(target.listenerCount('keydown'), 1);
});

test('attach to a new target detaches the previous one first', () => {
  const input = createInput();
  const first = new StubTarget();
  const second = new StubTarget();

  input.attach(first);
  input.attach(second);

  assert.equal(first.listenerCount('keydown'), 0);
  assert.equal(second.listenerCount('keydown'), 1);
});

test('attach to a null/undefined target is a no-op', () => {
  const input = createInput();
  const result = input.attach(null);
  assert.equal(result, input);

  const undefResult = input.attach(undefined);
  assert.equal(undefResult, input);
});

test('attach falls back to opts.target when called with no args', () => {
  const fallback = new StubTarget();
  const input = createInput({ target: fallback });

  input.attach();

  assert.equal(fallback.listenerCount('keydown'), 1);
});

test('attach returns input chain even when target unset', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  delete globalThis.window;
  try {
    const input = createInput();
    const result = input.attach(); // no fallback, no globalThis.window
    assert.equal(result, input);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
  }
});

test('attach uses globalThis.window when no fallback or arg provided', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const fakeWindow = new StubTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  try {
    const input = createInput();
    input.attach();
    assert.equal(fakeWindow.listenerCount('keydown'), 1);

    fakeWindow.dispatchEvent('keydown', {
      code: 'Space',
      preventDefault() { this.defaultPrevented = true; },
    });
    assert.equal(input.down('Space'), true);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
  }
});

test('keyup of a key that was never pressed is ignored', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('keyup', { code: 'ArrowLeft' });
  assert.equal(input.released('ArrowLeft'), false);
});

test('unrecognized key in keyup is ignored', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);
  target.dispatchEvent('keyup', { code: 'Tab' });
  assert.equal(input.released('Tab'), false);
});

test('every recognized code is acknowledged', () => {
  const codes = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'KeyW', 'ArrowUp', 'Escape', 'KeyM'];
  for (const code of codes) {
    const input = createInput();
    const target = new StubTarget();
    input.attach(target);

    target.dispatchEvent('keydown', { code });
    assert.equal(input.pressed(code), true, code);
    assert.equal(input.down(code), true, code);

    target.dispatchEvent('keyup', { code });
    assert.equal(input.released(code), true, code);
  }
});

test('touchstart on event.touches works when changedTouches missing', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('touchstart', { touches: [touch(20)] });
  target.dispatchEvent('touchmove', { touches: [touch(35)] });

  assert.equal(input.touchDx(), 15);
});

test('touch with identifier 0 is tracked and yields delta', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('touchstart', { changedTouches: [{ clientX: 5, identifier: 0 }] });
  target.dispatchEvent('touchmove', { changedTouches: [{ clientX: 25, identifier: 0 }] });

  assert.equal(input.touchDx(), 20);
});

test('touchstart with no touches is a no-op', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('touchstart', { changedTouches: [], touches: [] });
  target.dispatchEvent('touchmove', { changedTouches: [touch(50)] });

  assert.equal(input.touchDx(), 0);
});

test('touchmove without an active touch is ignored', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('touchmove', { changedTouches: [touch(100)] });
  assert.equal(input.touchDx(), 0);
});

test('touchend without a matching identifier keeps active touch alive', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('touchstart', { changedTouches: [touch(0, 1)] });
  target.dispatchEvent('touchend', { changedTouches: [touch(50, 99)] });

  // Touch identifier 99 doesn't match active id (1) — no delta added.
  assert.equal(input.touchDx(), 0);
  // The active touch is still alive: a follow-up move on id=1 should still register.
  target.dispatchEvent('touchmove', { changedTouches: [touch(20, 1)] });
  assert.equal(input.touchDx(), 20);
});

test('isWindowTarget recognises window for preventDefault on recognised keys', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const fakeWindow = new StubTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  try {
    const input = createInput();
    input.attach(fakeWindow);
    const event = fakeWindow.dispatchEvent('keydown', {
      code: 'ArrowLeft',
      preventDefault() { this.defaultPrevented = true; },
    });
    assert.equal(event.defaultPrevented, true);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
  }
});

test('touches.item() accessor is used when array index is missing', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  // Touch list with item() but no index access.
  const touchList = {
    length: 1,
    item(i) { return i === 0 ? { clientX: 7, identifier: 1 } : undefined; },
  };
  target.dispatchEvent('touchstart', { changedTouches: touchList });
  target.dispatchEvent('touchmove', { changedTouches: { length: 1, item(i) { return i === 0 ? { clientX: 17, identifier: 1 } : undefined; } } });

  assert.equal(input.touchDx(), 10);
});

test('touch without clientX falls back to lastTouchX (no extra dx)', () => {
  const input = createInput();
  const target = new StubTarget();
  input.attach(target);

  target.dispatchEvent('touchstart', { changedTouches: [{ clientX: 10, identifier: 1 }] });
  target.dispatchEvent('touchmove', { changedTouches: [{ identifier: 1 }] });
  assert.equal(input.touchDx(), 0);
});
