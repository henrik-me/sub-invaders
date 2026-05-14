import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DAILY_OPTION_LABEL,
  createDailyMenuOption,
} from './menu-daily-option.mjs';

const makeInput = (codes) => ({
  pressed: (code) => codes.has(code),
});

test('menu-daily-option: DAILY_OPTION_LABEL is the user-visible prompt text', () => {
  assert.equal(DAILY_OPTION_LABEL, 'PRESS D FOR DAILY CHALLENGE');
});

test('menu-daily-option: enabled when dailyChallenge=on and onDaily provided', () => {
  const opt = createDailyMenuOption({ flags: { dailyChallenge: 'on' }, onDaily: () => {} });
  assert.equal(opt.enabled, true);
  assert.equal(opt.promptText(), DAILY_OPTION_LABEL);
});

test('menu-daily-option: disabled when flag is off', () => {
  const opt = createDailyMenuOption({ flags: { dailyChallenge: 'off' }, onDaily: () => {} });
  assert.equal(opt.enabled, false);
  assert.equal(opt.promptText(), null);
});

test('menu-daily-option: disabled when onDaily is not a function', () => {
  const opt = createDailyMenuOption({ flags: { dailyChallenge: 'on' } });
  assert.equal(opt.enabled, false);
  assert.equal(opt.promptText(), null);
});

test('menu-daily-option: handleInput on KeyD invokes onDaily and returns true when enabled', () => {
  let calls = 0;
  const opt = createDailyMenuOption({
    flags: { dailyChallenge: 'on' },
    onDaily: () => { calls += 1; },
  });
  const consumed = opt.handleInput(makeInput(new Set(['KeyD'])));
  assert.equal(consumed, true);
  assert.equal(calls, 1);
});

test('menu-daily-option: handleInput ignores KeyD when disabled', () => {
  let calls = 0;
  const opt = createDailyMenuOption({
    flags: { dailyChallenge: 'off' },
    onDaily: () => { calls += 1; },
  });
  const consumed = opt.handleInput(makeInput(new Set(['KeyD'])));
  assert.equal(consumed, false);
  assert.equal(calls, 0);
});

test('menu-daily-option: handleInput returns false on non-KeyD when enabled', () => {
  const opt = createDailyMenuOption({
    flags: { dailyChallenge: 'on' },
    onDaily: () => {},
  });
  const consumed = opt.handleInput(makeInput(new Set(['Space'])));
  assert.equal(consumed, false);
});

test('menu-daily-option: handleInput tolerates missing input shape', () => {
  const opt = createDailyMenuOption({
    flags: { dailyChallenge: 'on' },
    onDaily: () => {},
  });
  assert.equal(opt.handleInput(undefined), false);
  assert.equal(opt.handleInput({}), false);
  assert.equal(opt.handleInput({ pressed: null }), false);
});
