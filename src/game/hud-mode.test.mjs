import assert from 'node:assert/strict';
import test from 'node:test';
import { createModeBadgeOverlay } from './hud-mode.mjs';

function createFakeRenderer() {
  const calls = [];

  return {
    calls,
    drawText(...args) {
      calls.push({ method: 'drawText', args });
    },
  };
}

test('mode badge renders ranked text in yellow', () => {
  const renderer = createFakeRenderer();
  const overlay = createModeBadgeOverlay({ getMode: () => 'ranked' });

  overlay.render(renderer);

  assert.deepEqual(renderer.calls, [{
    method: 'drawText',
    args: ['RANKED', 16, 64, {
      font: '16px monospace',
      fill: '#ffd23f',
      align: 'left',
      baseline: 'top',
    }],
  }]);
});

test('mode badge renders practice text in cyan', () => {
  const renderer = createFakeRenderer();
  const overlay = createModeBadgeOverlay({ getMode: () => 'practice' });

  overlay.render(renderer);

  assert.deepEqual(renderer.calls[0].args, ['PRACTICE', 16, 64, {
    font: '16px monospace',
    fill: '#22d3ee',
    align: 'left',
    baseline: 'top',
  }]);
});

test('mode badge treats unknown modes as ranked', () => {
  const renderer = createFakeRenderer();
  const overlay = createModeBadgeOverlay({ getMode: () => 'unknown' });

  overlay.render(renderer);

  assert.equal(renderer.calls[0].args[0], 'RANKED');
  assert.equal(renderer.calls[0].args[3].fill, '#ffd23f');
});

test('mode badge uses configured position and text alignment', () => {
  const renderer = createFakeRenderer();
  const overlay = createModeBadgeOverlay({
    getMode: () => 'practice',
    hudConfig: { padding: 24, badgeY: 72 },
  });

  overlay.render(renderer);

  assert.equal(renderer.calls[0].args[1], 24);
  assert.equal(renderer.calls[0].args[2], 72);
  assert.equal(renderer.calls[0].args[3].align, 'left');
  assert.equal(renderer.calls[0].args[3].baseline, 'top');
});
