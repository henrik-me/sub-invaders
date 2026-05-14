import test from 'node:test';
import assert from 'node:assert/strict';

import { NAME, DEFAULT_HALO_RADIUS, apply, renderOverlay } from './fog-of-war.mjs';

test('fog-of-war: NAME constant matches CS04-5 pool name', () => {
  assert.equal(NAME, 'fog-of-war');
});

test('fog-of-war: apply enables fog with default halo radius', () => {
  const state = {};
  apply(state);
  assert.equal(state.modifiers.fogOfWar.enabled, true);
  assert.equal(state.modifiers.fogOfWar.haloRadius, DEFAULT_HALO_RADIUS);
});

test('fog-of-war: apply accepts custom haloRadius', () => {
  const state = {};
  apply(state, { haloRadius: 50 });
  assert.equal(state.modifiers.fogOfWar.haloRadius, 50);
});

test('fog-of-war: apply preserves existing modifiers entries', () => {
  const state = { modifiers: { other: true } };
  apply(state);
  assert.equal(state.modifiers.other, true);
  assert.equal(state.modifiers.fogOfWar.enabled, true);
});

test('fog-of-war: renderOverlay calls canvas evenodd punch-out', () => {
  const calls = [];
  const ctx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    rect: (...args) => calls.push(['rect', ...args]),
    arc: (...args) => calls.push(['arc', ...args]),
    fill: (rule) => calls.push(['fill', rule]),
    set fillStyle(v) { calls.push(['fillStyle', v]); },
  };
  const renderer = { ctx };
  const player = { x: 100, y: 200, w: 16, h: 16 };
  renderOverlay(renderer, { player, canvasWidth: 480, canvasHeight: 640, haloRadius: 60 });

  assert.deepEqual(calls[0], 'save');
  assert.deepEqual(calls[calls.length - 1], 'restore');
  // Circle is centered on the player center (px+w/2, py+h/2) with halo radius.
  const arcCall = calls.find((c) => Array.isArray(c) && c[0] === 'arc');
  assert.equal(arcCall[1], 108); // 100 + 16/2
  assert.equal(arcCall[2], 208); // 200 + 16/2
  assert.equal(arcCall[3], 60);  // haloRadius
  // evenodd fill punches the halo out of the dark rect.
  const fillCall = calls.find((c) => Array.isArray(c) && c[0] === 'fill');
  assert.equal(fillCall[1], 'evenodd');
});

test('fog-of-war: renderOverlay no-ops when renderer or player missing', () => {
  // Should not throw on missing renderer.ctx or missing player.
  renderOverlay(null, { player: { x: 0, y: 0 }, canvasWidth: 1, canvasHeight: 1 });
  renderOverlay({}, { player: null, canvasWidth: 1, canvasHeight: 1 });
});

// CS04 PvI R2 fix: renderer exposes ctx as a FUNCTION (renderer.mjs:89-91),
// not a property. Both shapes must work.
test('fog-of-war: renderOverlay supports renderer.ctx as a function (real renderer contract)', () => {
  const calls = [];
  const ctx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    rect: (...args) => calls.push(['rect', ...args]),
    arc: (...args) => calls.push(['arc', ...args]),
    fill: (rule) => calls.push(['fill', rule]),
    set fillStyle(v) { calls.push(['fillStyle', v]); },
  };
  const renderer = { ctx: () => ctx };
  const player = { x: 100, y: 200, w: 16, h: 16 };
  renderOverlay(renderer, { player, canvasWidth: 480, canvasHeight: 640, haloRadius: 60 });
  assert.equal(calls[0], 'save');
  assert.equal(calls.at(-1), 'restore');
  const arcCall = calls.find((c) => Array.isArray(c) && c[0] === 'arc');
  assert.equal(arcCall[1], 108);
  assert.equal(arcCall[2], 208);
  assert.equal(arcCall[3], 60);
});
