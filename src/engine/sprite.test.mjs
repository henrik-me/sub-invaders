import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAnimation, createFrame, loadSpriteSheet } from './sprite.mjs';

test('loadSpriteSheet resolves image metadata from an injected factory', async () => {
  const stubImage = { width: 64, height: 32 };

  const sheet = await loadSpriteSheet('sprites.png', {
    imageFactory(src) {
      assert.equal(src, 'sprites.png');
      return Promise.resolve(stubImage);
    },
  });

  assert.deepEqual(sheet, {
    image: stubImage,
    width: 64,
    height: 32,
  });
});

test('loadSpriteSheet rejects when the injected factory rejects', async () => {
  await assert.rejects(
    () => loadSpriteSheet('missing.png', {
      imageFactory() {
        return Promise.reject(new Error('load failed'));
      },
    }),
    /load failed/,
  );
});

test('loadSpriteSheet uses naturalWidth/naturalHeight when present', async () => {
  const stubImage = { naturalWidth: 128, naturalHeight: 64, width: 0, height: 0 };

  const sheet = await loadSpriteSheet('sprites.png', {
    imageFactory: () => stubImage,
  });

  assert.equal(sheet.width, 128);
  assert.equal(sheet.height, 64);
});

test('loadSpriteSheet returns 0 dimensions when image lacks size info', async () => {
  const sheet = await loadSpriteSheet('sprites.png', {
    imageFactory: () => ({}),
  });

  assert.equal(sheet.width, 0);
  assert.equal(sheet.height, 0);
});

test('loadSpriteSheet throws TypeError when factory yields a non-object', async () => {
  await assert.rejects(
    () => loadSpriteSheet('s.png', { imageFactory: () => null }),
    /loadSpriteSheet expected an image-like object/,
  );

  await assert.rejects(
    () => loadSpriteSheet('s.png', { imageFactory: () => 'not-an-image' }),
    /loadSpriteSheet expected an image-like object/,
  );
});

test('loadSpriteSheet rejects when no Image constructor is available', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  delete globalThis.Image;
  try {
    await assert.rejects(
      () => loadSpriteSheet('s.png'),
      /Image constructor is not available/,
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'Image', original);
  }
});

test('loadSpriteSheet uses a polyfilled Image constructor when present', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  let assignedSrc;
  class FakeImage {
    constructor() {
      this.naturalWidth = 16;
      this.naturalHeight = 8;
      setTimeout(() => {
        if (assignedSrc === 'fail.png') {
          this.onerror?.();
        } else {
          this.onload?.();
        }
      }, 0);
    }
    set src(value) {
      assignedSrc = value;
    }
    get src() {
      return assignedSrc;
    }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
  try {
    const sheet = await loadSpriteSheet('ok.png');
    assert.equal(sheet.width, 16);
    assert.equal(sheet.height, 8);

    await assert.rejects(
      () => loadSpriteSheet('fail.png'),
      /Failed to load sprite sheet: fail.png/,
    );
  } finally {
    if (original) {
      Object.defineProperty(globalThis, 'Image', original);
    } else {
      delete globalThis.Image;
    }
  }
});

test('createFrame returns a frozen frame descriptor', () => {
  const frame = createFrame({ x: 1, y: 2, w: 3, h: 4 });

  assert.deepEqual(frame, { x: 1, y: 2, w: 3, h: 4 });
  assert.equal(Object.isFrozen(frame), true);
});

test('createAnimation returns the first frame at t=0', () => {
  const frames = [
    createFrame({ x: 0, y: 0, w: 8, h: 8 }),
    createFrame({ x: 8, y: 0, w: 8, h: 8 }),
  ];
  const animation = createAnimation({ frames, fps: 4 });

  assert.equal(animation.currentFrame(), frames[0]);
});

test('createAnimation advances by fps and wraps when loop is true', () => {
  const frames = [
    createFrame({ x: 0, y: 0, w: 8, h: 8 }),
    createFrame({ x: 8, y: 0, w: 8, h: 8 }),
    createFrame({ x: 16, y: 0, w: 8, h: 8 }),
  ];
  const animation = createAnimation({ frames, fps: 2, loop: true });

  animation.tick(0.5);
  assert.equal(animation.currentFrame(), frames[1]);
  animation.tick(0.5);
  assert.equal(animation.currentFrame(), frames[2]);
  animation.tick(0.5);
  assert.equal(animation.currentFrame(), frames[0]);
  animation.tick(2);
  assert.equal(animation.currentFrame(), frames[1]);
});

test('createAnimation clamps at the final frame when loop is false', () => {
  const frames = [
    createFrame({ x: 0, y: 0, w: 8, h: 8 }),
    createFrame({ x: 8, y: 0, w: 8, h: 8 }),
    createFrame({ x: 16, y: 0, w: 8, h: 8 }),
  ];
  const animation = createAnimation({ frames, fps: 2, loop: false });

  animation.tick(10);

  assert.equal(animation.currentFrame(), frames[2]);
});

test('createAnimation rejects empty or non-array frames', () => {
  assert.throws(() => createAnimation({ frames: [], fps: 4 }), TypeError);
  assert.throws(() => createAnimation({ frames: null, fps: 4 }), TypeError);
  assert.throws(() => createAnimation({}), TypeError);
});

test('createAnimation rejects non-positive or non-finite fps', () => {
  const frames = [createFrame({ x: 0, y: 0, w: 1, h: 1 })];
  assert.throws(() => createAnimation({ frames, fps: 0 }), RangeError);
  assert.throws(() => createAnimation({ frames, fps: -1 }), RangeError);
  assert.throws(() => createAnimation({ frames, fps: Number.NaN }), RangeError);
  assert.throws(() => createAnimation({ frames, fps: Number.POSITIVE_INFINITY }), RangeError);
});

test('createAnimation tick ignores non-finite or non-positive dt', () => {
  const frames = [
    createFrame({ x: 0, y: 0, w: 1, h: 1 }),
    createFrame({ x: 1, y: 0, w: 1, h: 1 }),
  ];
  const animation = createAnimation({ frames, fps: 4 });

  animation.tick(Number.NaN);
  animation.tick(-2);
  animation.tick(Number.POSITIVE_INFINITY);
  assert.equal(animation.currentFrame(), frames[0]);
});

test('createAnimation tick returns the current frame', () => {
  const frames = [
    createFrame({ x: 0, y: 0, w: 1, h: 1 }),
    createFrame({ x: 1, y: 0, w: 1, h: 1 }),
  ];
  const animation = createAnimation({ frames, fps: 2 });
  const frame = animation.tick(0.5);
  assert.equal(frame, frames[1]);
});

