import assert from 'node:assert/strict';
import test from 'node:test';
import { createModeMenuOption } from './menu-mode-option.mjs';

const inputPressing = (pressedCode) => ({
  pressed: (code) => code === pressedCode,
});

test('mode menu option toggles ranked to practice on ArrowLeft', () => {
  const modes = [];
  const option = createModeMenuOption({
    getMode: () => 'ranked',
    setMode: (mode) => { modes.push(mode); },
  });

  const handled = option.handleInput(inputPressing('ArrowLeft'));

  assert.equal(handled, true);
  assert.deepEqual(modes, ['practice']);
});

test('mode menu option toggles practice to ranked on ArrowRight', () => {
  const modes = [];
  const option = createModeMenuOption({
    getMode: () => 'practice',
    setMode: (mode) => { modes.push(mode); },
  });

  const handled = option.handleInput(inputPressing('ArrowRight'));

  assert.equal(handled, true);
  assert.deepEqual(modes, ['ranked']);
});

test('mode menu option ignores other keys', () => {
  const modes = [];
  const option = createModeMenuOption({
    getMode: () => 'ranked',
    setMode: (mode) => { modes.push(mode); },
  });

  const handled = option.handleInput(inputPressing('Space'));

  assert.equal(handled, false);
  assert.deepEqual(modes, []);
});

test('mode menu option prompt reflects ranked mode', () => {
  const option = createModeMenuOption({
    getMode: () => 'ranked',
    setMode: () => {},
  });

  assert.equal(option.promptText(), 'MODE: RANKED  (\u2190 \u2192 to change)');
});

test('mode menu option prompt reflects practice mode', () => {
  const option = createModeMenuOption({
    getMode: () => 'practice',
    setMode: () => {},
  });

  assert.equal(option.promptText(), 'MODE: PRACTICE  (\u2190 \u2192 to change)');
});
