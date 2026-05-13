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
