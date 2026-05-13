import test from 'node:test';
import assert from 'node:assert/strict';

import { createSceneStack } from './scene.mjs';

test('push makes the scene current and calls enter when present', () => {
  const events = [];
  const scene = {
    enter() {
      events.push('enter');
    },
  };
  const stack = createSceneStack();

  assert.equal(stack.push(scene), scene);
  assert.equal(stack.current(), scene);
  assert.deepEqual(events, ['enter']);
  assert.equal(stack.size(), 1);
});

test('pop calls exit and returns to the previous scene', () => {
  const events = [];
  const previous = {};
  const current = {
    exit() {
      events.push('exit');
    },
  };
  const stack = createSceneStack();

  stack.push(previous);
  stack.push(current);

  assert.equal(stack.pop(), current);
  assert.equal(stack.current(), previous);
  assert.deepEqual(events, ['exit']);
  assert.equal(stack.size(), 1);
});

test('replace swaps the current scene', () => {
  const events = [];
  const oldScene = {
    exit() {
      events.push('old exit');
    },
  };
  const newScene = {
    enter() {
      events.push('new enter');
    },
  };
  const stack = createSceneStack();

  stack.push(oldScene);

  assert.equal(stack.replace(newScene), newScene);
  assert.equal(stack.current(), newScene);
  assert.deepEqual(events, ['old exit', 'new enter']);
  assert.equal(stack.size(), 1);
});

test('update, render, and handleInput forward to the current scene', () => {
  const calls = [];
  const renderer = { id: 'renderer' };
  const input = { fire: true };
  const scene = {
    update(dt) {
      calls.push(['update', dt]);
      return 'updated';
    },
    render(value) {
      calls.push(['render', value]);
      return 'rendered';
    },
    handleInput(value) {
      calls.push(['input', value]);
      return 'handled';
    },
  };
  const stack = createSceneStack();

  stack.push(scene);

  assert.equal(stack.update(1 / 60), 'updated');
  assert.equal(stack.render(renderer), 'rendered');
  assert.equal(stack.handleInput(input), 'handled');
  assert.deepEqual(calls, [
    ['update', 1 / 60],
    ['render', renderer],
    ['input', input],
  ]);
});

test('forwarding methods do not throw when the stack is empty', () => {
  const stack = createSceneStack();

  assert.doesNotThrow(() => stack.update(1));
  assert.doesNotThrow(() => stack.render({}));
  assert.doesNotThrow(() => stack.handleInput({}));
  assert.equal(stack.current(), undefined);
  assert.equal(stack.size(), 0);
});

test('size reflects depth across multi-level push and pop', () => {
  const scenes = [{ name: 'one' }, { name: 'two' }, { name: 'three' }];
  const stack = createSceneStack();

  assert.equal(stack.size(), 0);
  assert.equal(stack.current(), undefined);

  stack.push(scenes[0]);
  stack.push(scenes[1]);
  stack.push(scenes[2]);

  assert.equal(stack.size(), 3);
  assert.equal(stack.current(), scenes[2]);
  assert.equal(stack.pop(), scenes[2]);
  assert.equal(stack.current(), scenes[1]);
  assert.equal(stack.size(), 2);
  assert.equal(stack.pop(), scenes[1]);
  assert.equal(stack.current(), scenes[0]);
  assert.equal(stack.pop(), scenes[0]);
  assert.equal(stack.current(), undefined);
  assert.equal(stack.size(), 0);
});
