import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NAME,
  BOSS_RUSH_SCORE_MULTIPLIER,
  BOSS_RUSH_FIRE_DENSITY_MULTIPLIER,
  apply,
} from './boss-rush.mjs';

test('boss-rush: NAME matches CS04-5 pool name', () => {
  assert.equal(NAME, 'boss-rush');
});

test('boss-rush: score multiplier is 2 per CS04 design', () => {
  assert.equal(BOSS_RUSH_SCORE_MULTIPLIER, 2);
});

test('boss-rush: fire density multiplier is 2 per CS04 design', () => {
  assert.equal(BOSS_RUSH_FIRE_DENSITY_MULTIPLIER, 2);
});

test('boss-rush: apply restricts enemy type to squid + sets respawn flag', () => {
  const state = {};
  apply(state);
  assert.equal(state.modifiers.bossRush.enabled, true);
  assert.equal(state.modifiers.bossRush.onlyEnemyType, 'squid');
  assert.equal(state.modifiers.bossRush.respawnImmediately, true);
});

test('boss-rush: apply doubles score multiplier from default', () => {
  const state = {};
  apply(state);
  assert.equal(state.scoreMultiplier, 2);
});

test('boss-rush: apply doubles enemyFireDensityMultiplier from default', () => {
  const state = {};
  apply(state);
  assert.equal(state.enemyFireDensityMultiplier, 2);
});

test('boss-rush: apply compounds with existing multipliers', () => {
  const state = { scoreMultiplier: 1.5, enemyFireDensityMultiplier: 0.5 };
  apply(state);
  assert.equal(state.scoreMultiplier, 3);
  assert.equal(state.enemyFireDensityMultiplier, 1);
});

test('boss-rush: apply preserves existing modifier entries', () => {
  const state = { modifiers: { fogOfWar: { enabled: true } } };
  apply(state);
  assert.equal(state.modifiers.fogOfWar.enabled, true);
  assert.equal(state.modifiers.bossRush.enabled, true);
});
