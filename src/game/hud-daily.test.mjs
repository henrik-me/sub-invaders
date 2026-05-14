import assert from 'node:assert/strict';
import test from 'node:test';

import { createDailyHudOverlay } from './hud-daily.mjs';

function createFakeRenderer() {
  const calls = [];

  return {
    calls,
    drawText(...args) {
      calls.push({ method: 'drawText', args });
    },
    width() {
      return 800;
    },
  };
}

function textCalls(renderer) {
  return renderer.calls.filter((call) => call.method === 'drawText');
}

test('renders the daily badge with DAILY prefix', () => {
  const renderer = createFakeRenderer();
  const overlay = createDailyHudOverlay({
    daily: { utcDate: '2026-05-14', modifierName: 'speed-run' },
  });

  overlay.render(renderer);

  assert.equal(textCalls(renderer).length, 1);
  assert.ok(textCalls(renderer)[0].args[0].startsWith('DAILY · '));
});

test('truncates modifier names longer than 24 characters', () => {
  const renderer = createFakeRenderer();
  const longName = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const overlay = createDailyHudOverlay({
    daily: { utcDate: '2026-05-14', modifierName: longName },
  });

  overlay.render(renderer);

  const modifierSegment = textCalls(renderer)[0].args[0].split(' · ').at(-1);
  assert.equal(modifierSegment, longName.slice(0, 24));
  assert.ok(modifierSegment.length <= 24);
});

test('renders nothing when daily data is null', () => {
  const renderer = createFakeRenderer();
  const overlay = createDailyHudOverlay({ daily: null });

  overlay.render(renderer);

  assert.equal(textCalls(renderer).length, 0);
});

test('positions the badge below the wave counter', () => {
  const renderer = createFakeRenderer();
  const overlay = createDailyHudOverlay({
    daily: { utcDate: '2026-05-14', modifierName: 'boss-rush' },
    hudConfig: { waveCounterY: 12, lineHeight: 18, padding: 10 },
  });

  overlay.render(renderer);

  const [, x, y, opts] = textCalls(renderer)[0].args;
  assert.equal(x, 790);
  assert.equal(y, 30);
  assert.equal(opts.align, 'right');
});
