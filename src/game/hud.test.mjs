import assert from 'node:assert/strict';
import test from 'node:test';
import { createHud } from './hud.mjs';

function createFakeRenderer() {
  const calls = [];

  return {
    calls,
    drawText(...args) {
      calls.push({ method: 'drawText', args });
    },
    drawSprite(...args) {
      calls.push({ method: 'drawSprite', args });
    },
    width() {
      return 800;
    },
    height() {
      return 600;
    },
  };
}

const textCalls = (renderer) => renderer.calls.filter((call) => call.method === 'drawText');
const spriteCalls = (renderer) => renderer.calls.filter((call) => call.method === 'drawSprite');

test('HUD setters update labels and life icon count', () => {
  const renderer = createFakeRenderer();
  const hud = createHud({ fill: '#fff', padding: 10 });

  hud
    .setScore(123)
    .setHigh(999)
    .setLives(3)
    .setWave(4)
    .render(renderer, { lifeIcon: {} });

  const labels = textCalls(renderer).map((call) => call.args[0]);
  assert.ok(labels.includes('SCORE  123'));
  assert.ok(labels.includes('HIGH  999'));
  assert.ok(labels.includes('WAVE  4'));
  assert.ok(labels.includes('LIVES'));
  assert.equal(spriteCalls(renderer).length, 3);
});

test('HUD render draws no life icons when lives are zero', () => {
  const renderer = createFakeRenderer();

  createHud()
    .setScore(5)
    .setHigh(8)
    .setLives(0)
    .setWave(1)
    .render(renderer, { lifeIcon: {} });

  const labels = textCalls(renderer).map((call) => call.args[0]);
  assert.ok(labels.includes('SCORE  5'));
  assert.ok(labels.includes('HIGH  8'));
  assert.ok(labels.includes('WAVE  1'));
  assert.equal(spriteCalls(renderer).length, 0);
});
