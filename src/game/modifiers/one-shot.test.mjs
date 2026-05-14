import test from 'node:test';
import assert from 'node:assert/strict';

import { NAME, ONE_SHOT_LIVES, apply } from './one-shot.mjs';

test('one-shot: NAME matches CS04-5 pool name', () => {
  assert.equal(NAME, 'one-shot');
});

test('one-shot: ONE_SHOT_LIVES is 1', () => {
  assert.equal(ONE_SHOT_LIVES, 1);
});

test('one-shot: apply sets startingLives to 1 from default', () => {
  const state = {};
  apply(state);
  assert.equal(state.startingLives, 1);
  assert.equal(state.modifiers.oneShot.enabled, true);
});

test('one-shot: apply overrides existing higher startingLives', () => {
  const state = { startingLives: 3 };
  apply(state);
  assert.equal(state.startingLives, 1);
});

test('one-shot: apply preserves existing modifier entries', () => {
  const state = { modifiers: { speedRun: { enabled: true } } };
  apply(state);
  assert.equal(state.modifiers.speedRun.enabled, true);
  assert.equal(state.modifiers.oneShot.enabled, true);
});
