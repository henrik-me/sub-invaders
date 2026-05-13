import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRenderer } from './renderer.mjs';

function createStubContext() {
  const calls = [];
  const context = {
    calls,
    setTransform(...args) {
      calls.push(['setTransform', ...args]);
    },
    fillRect(...args) {
      calls.push(['fillRect', ...args]);
    },
    drawImage(...args) {
      calls.push(['drawImage', ...args]);
    },
    strokeRect(...args) {
      calls.push(['strokeRect', ...args]);
    },
    fillText(...args) {
      calls.push(['fillText', ...args]);
    },
  };

  for (const property of ['fillStyle', 'strokeStyle', 'font', 'textAlign', 'textBaseline']) {
    let value;
    Object.defineProperty(context, property, {
      get() {
        return value;
      },
      set(nextValue) {
        value = nextValue;
        calls.push([property, nextValue]);
      },
    });
  }

  return context;
}

function createStubCanvas(context = createStubContext()) {
  return {
    style: {},
    context,
    getContext(type) {
      assert.equal(type, '2d');
      return context;
    },
  };
}

test('createRenderer configures DPR-aware backing store and transform', () => {
  const canvas = createStubCanvas();
  createRenderer({ canvas, dpr: 2 });

  assert.equal(canvas.width, 1600);
  assert.equal(canvas.height, 1200);
  assert.equal(canvas.style.width, '800px');
  assert.equal(canvas.style.height, '600px');
  assert.deepEqual(canvas.context.calls[0], ['setTransform', 2, 0, 0, 2, 0, 0]);
});

test('clear fills the logical canvas with the requested color', () => {
  const canvas = createStubCanvas();
  const renderer = createRenderer({ canvas });
  canvas.context.calls.length = 0;

  renderer.clear('#abc');

  assert.deepEqual(canvas.context.calls, [
    ['fillStyle', '#abc'],
    ['fillRect', 0, 0, 800, 600],
  ]);
});

test('drawSprite forwards the 9-argument drawImage signature', () => {
  const canvas = createStubCanvas();
  const renderer = createRenderer({ canvas });
  const image = { id: 'sprites' };
  canvas.context.calls.length = 0;

  renderer.drawSprite(image, 1, 2, 3, 4, 5, 6, 7, 8);

  assert.deepEqual(canvas.context.calls, [
    ['drawImage', image, 1, 2, 3, 4, 5, 6, 7, 8],
  ]);
});

test('drawRect can fill, stroke, or do both', () => {
  const canvas = createStubCanvas();
  const renderer = createRenderer({ canvas });

  canvas.context.calls.length = 0;
  renderer.drawRect(1, 2, 3, 4, '#123');
  assert.deepEqual(canvas.context.calls, [
    ['fillStyle', '#123'],
    ['fillRect', 1, 2, 3, 4],
  ]);

  canvas.context.calls.length = 0;
  renderer.drawRect(5, 6, 7, 8, undefined, '#456');
  assert.deepEqual(canvas.context.calls, [
    ['strokeStyle', '#456'],
    ['strokeRect', 5, 6, 7, 8],
  ]);

  canvas.context.calls.length = 0;
  renderer.drawRect(9, 10, 11, 12, '#789', '#abc');
  assert.deepEqual(canvas.context.calls, [
    ['fillStyle', '#789'],
    ['fillRect', 9, 10, 11, 12],
    ['strokeStyle', '#abc'],
    ['strokeRect', 9, 10, 11, 12],
  ]);
});

test('drawText applies text options before drawing', () => {
  const canvas = createStubCanvas();
  const renderer = createRenderer({ canvas });
  canvas.context.calls.length = 0;

  renderer.drawText('hello', 13, 14, {
    font: '16px sans-serif',
    fill: '#fed',
    align: 'center',
    baseline: 'middle',
  });

  assert.deepEqual(canvas.context.calls, [
    ['font', '16px sans-serif'],
    ['fillStyle', '#fed'],
    ['textAlign', 'center'],
    ['textBaseline', 'middle'],
    ['fillText', 'hello', 13, 14],
  ]);
});

test('width and height expose logical canvas dimensions', () => {
  const renderer = createRenderer({
    canvas: createStubCanvas(),
    logicalWidth: 320,
    logicalHeight: 240,
  });

  assert.equal(renderer.width(), 320);
  assert.equal(renderer.height(), 240);
});
