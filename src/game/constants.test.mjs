import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  CANVAS,
  PALETTE,
  PLAYER,
  TORPEDO,
  ENEMY_SHOT,
  FORMATION,
  ENEMY_TYPES,
  SCORING,
  SPRITES,
} from './constants.mjs';

describe('constants — shape smoke (CS02 plan-vs-impl review fix)', () => {
  it('CANVAS is the documented 800×600 logical surface', () => {
    assert.equal(CANVAS.width, 800);
    assert.equal(CANVAS.height, 600);
  });

  it('PALETTE exposes every named colour role used by HUD / scenes', () => {
    for (const key of ['skyTop', 'skyMid', 'seaAccent', 'player', 'ui', 'shot', 'enemyShot']) {
      assert.equal(typeof PALETTE[key], 'string', `PALETTE.${key} should be a string`);
      assert.match(PALETTE[key], /^#[0-9a-fA-F]{6}$/, `PALETTE.${key} should be a #RRGGBB hex value`);
    }
  });

  it('PLAYER carries the documented tunables', () => {
    for (const key of ['speed', 'fireCooldownMs', 'invulnMs', 'lives', 'w', 'h', 'spawnYOffset']) {
      assert.equal(typeof PLAYER[key], 'number', `PLAYER.${key} should be a number`);
      assert.ok(PLAYER[key] > 0, `PLAYER.${key} should be positive`);
    }
    assert.equal(PLAYER.lives, 3, 'PLAYER.lives must default to the documented 3');
  });

  it('TORPEDO and ENEMY_SHOT have width/height/speed numerics', () => {
    for (const obj of [TORPEDO, ENEMY_SHOT]) {
      for (const key of ['speed', 'w', 'h']) {
        assert.equal(typeof obj[key], 'number');
        assert.ok(obj[key] > 0);
      }
    }
  });

  it('FORMATION encodes the 5×11 wave with documented caps', () => {
    assert.equal(FORMATION.rows, 5);
    assert.equal(FORMATION.cols, 11);
    assert.equal(FORMATION.depthCap, 120);
    assert.equal(FORMATION.fireMinIntervalMs, 200);
    assert.equal(FORMATION.descentStepCap, 5);
  });

  it('ENEMY_TYPES contains squid, anglerfish, jellyfish with point values', () => {
    for (const name of ['squid', 'anglerfish', 'jellyfish']) {
      const t = ENEMY_TYPES[name];
      assert.ok(t, `ENEMY_TYPES.${name} missing`);
      assert.equal(typeof t.points, 'number');
      assert.ok(Array.isArray(t.rowIndex));
      assert.equal(t.sprite, name);
    }
  });

  it('SCORING.waveBonusMultiplier matches the plan (100 × wave)', () => {
    assert.equal(SCORING.waveBonusMultiplier, 100);
  });

  it('SPRITES atlas frames cover every entity rendered by the game', () => {
    for (const key of ['submarine', 'torpedo', 'enemyShot', 'lifeIcon', 'jellyfish', 'anglerfish', 'squid']) {
      const f = SPRITES[key];
      assert.ok(f, `SPRITES.${key} missing`);
      for (const dim of ['x', 'y', 'w', 'h']) {
        assert.equal(typeof f[dim], 'number', `SPRITES.${key}.${dim} should be a number`);
      }
      assert.ok(f.w > 0 && f.h > 0, `SPRITES.${key} dimensions must be positive`);
    }
  });

  it('every constants export is frozen so accidental mutation throws in strict mode', () => {
    for (const obj of [CANVAS, PALETTE, PLAYER, TORPEDO, ENEMY_SHOT, FORMATION, SCORING, SPRITES]) {
      assert.equal(Object.isFrozen(obj), true);
    }
  });
});
