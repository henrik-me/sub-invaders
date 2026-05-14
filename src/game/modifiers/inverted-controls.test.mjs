import test from 'node:test';
import assert from 'node:assert/strict';

import { NAME, apply, remapHorizontalCode } from './inverted-controls.mjs';

test('inverted-controls: NAME matches CS04-5 pool name', () => {
  assert.equal(NAME, 'inverted-controls');
});

test('inverted-controls: apply sets invertHorizontalControls flag', () => {
  const state = {};
  apply(state);
  assert.equal(state.invertHorizontalControls, true);
  assert.equal(state.modifiers.invertedControls.enabled, true);
});

test('inverted-controls: remapHorizontalCode swaps arrow keys', () => {
  assert.equal(remapHorizontalCode('ArrowLeft'), 'ArrowRight');
  assert.equal(remapHorizontalCode('ArrowRight'), 'ArrowLeft');
});

test('inverted-controls: remapHorizontalCode swaps A/D keys', () => {
  assert.equal(remapHorizontalCode('KeyA'), 'KeyD');
  assert.equal(remapHorizontalCode('KeyD'), 'KeyA');
});

test('inverted-controls: remapHorizontalCode passes through non-horizontal keys', () => {
  for (const code of ['Space', 'KeyW', 'ArrowUp', 'Escape', 'KeyM']) {
    assert.equal(remapHorizontalCode(code), code);
  }
});

test('inverted-controls: apply preserves existing modifier entries', () => {
  const state = { modifiers: { speedRun: { enabled: true } } };
  apply(state);
  assert.equal(state.modifiers.speedRun.enabled, true);
  assert.equal(state.modifiers.invertedControls.enabled, true);
});
