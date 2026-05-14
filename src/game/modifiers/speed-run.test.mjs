import test from 'node:test';
import assert from 'node:assert/strict';

import { NAME, SPEED_MULTIPLIER, apply } from './speed-run.mjs';

test('speed-run: NAME matches CS04-5 pool name', () => {
  assert.equal(NAME, 'speed-run');
});

test('speed-run: SPEED_MULTIPLIER is 2 per CS04 design', () => {
  assert.equal(SPEED_MULTIPLIER, 2);
});

test('speed-run: apply doubles player, formation, fire-rate multipliers from defaults', () => {
  const state = {};
  apply(state);
  assert.equal(state.playerSpeedMultiplier, 2);
  assert.equal(state.formationSpeedMultiplier, 2);
  assert.equal(state.fireRateMultiplier, 2);
  assert.equal(state.modifiers.speedRun.enabled, true);
});

test('speed-run: apply compounds with existing multipliers', () => {
  const state = {
    playerSpeedMultiplier: 1.5,
    formationSpeedMultiplier: 1.2,
    fireRateMultiplier: 0.8,
  };
  apply(state);
  assert.equal(state.playerSpeedMultiplier, 3);
  assert.equal(state.formationSpeedMultiplier, 2.4);
  assert.equal(state.fireRateMultiplier, 1.6);
});

test('speed-run: apply preserves existing modifier entries', () => {
  const state = { modifiers: { fogOfWar: { enabled: true } } };
  apply(state);
  assert.equal(state.modifiers.fogOfWar.enabled, true);
  assert.equal(state.modifiers.speedRun.enabled, true);
});
