import assert from 'node:assert/strict';
import test from 'node:test';

import { createDailyScene } from './daily.mjs';

function fakePlaySceneFactory(received = []) {
  return (opts) => {
    received.push(opts);
    return {
      enter() {},
      exit() {},
      handleInput() {},
      update() {},
      render() {},
      state() {
        return { ready: true };
      },
    };
  };
}

function createScene(utcDate) {
  return createDailyScene({
    utcDate,
    createPlayScene: fakePlaySceneFactory(),
  });
}

function utcDateFromOffset(offset) {
  return new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
}

test('same utcDate produces identical daily modifier and params', () => {
  const first = createScene('2026-05-14').daily();
  const second = createScene('2026-05-14').daily();

  assert.deepEqual(first, second);
});

test('seven consecutive dates are not all identical', () => {
  const draws = Array.from({ length: 7 }, (_, index) => (
    JSON.stringify(createScene(`2026-05-0${index + 1}`).daily())
  ));

  assert.ok(new Set(draws).size > 1);
});

test('modifier pool indices map to the expected names', () => {
  const cases = [
    ['2026-05-03', 'fog-of-war'],
    ['2026-05-01', 'speed-run'],
    ['2026-05-10', 'one-shot'],
    ['2026-05-02', 'boss-rush'],
    ['2026-05-05', 'inverted-controls'],
  ];

  for (const [utcDate, expectedName] of cases) {
    assert.equal(createScene(utcDate).daily().modifierName, expectedName);
  }
});

test('params always come from the fixed CS04 allowed sets', () => {
  const enemyFire = new Set([0.8, 1.0, 1.2, 1.5]);
  const formationSpeed = new Set([0.8, 1.0, 1.2, 1.5]);
  const whaleIntervals = new Set([10000, 15000, 20000, 30000]);

  for (let index = 0; index < 30; index += 1) {
    const { params } = createScene(utcDateFromOffset(index)).daily();
    assert.ok(enemyFire.has(params.enemyFireMultiplier));
    assert.ok(formationSpeed.has(params.formationSpeedMultiplier));
    assert.ok(whaleIntervals.has(params.whaleSharkInterval));
  }
});

test('invalid utcDate throws', () => {
  const invalidDates = [
    undefined,
    null,
    '',
    '20260514',
    '2026-5-14',
    '2026-13-01',
    '2026-02-30',
  ];

  for (const utcDate of invalidDates) {
    assert.throws(() => createScene(utcDate), /utcDate/);
  }
});

test('daily scene forwards daily contract and date seed into play scene', () => {
  const received = [];
  const scene = createDailyScene({
    utcDate: '2026-05-14',
    seed: 1,
    createPlayScene: fakePlaySceneFactory(received),
  });

  assert.equal(received[0].seed, 20260514);
  assert.deepEqual(received[0].daily, scene.daily());
  assert.equal(scene.state().modifierName, scene.daily().modifierName);
  assert.deepEqual(scene.state().daily, scene.daily());
});
