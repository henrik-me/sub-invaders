import assert from 'node:assert/strict';
import test from 'node:test';
import { CANVAS } from './constants.mjs';
import { bootstrap } from './main.mjs';

function createFakeSceneStack() {
  const stack = [];
  const api = {
    push(scene) {
      stack.push(scene);
      scene?.enter?.();
      return scene;
    },
    pop() {
      const scene = stack.pop();
      scene?.exit?.();
      return scene;
    },
    replace(scene) {
      api.pop();
      return api.push(scene);
    },
    current() {
      return stack.at(-1);
    },
    update(dt) {
      return api.current()?.update?.(dt);
    },
    render(renderer) {
      return api.current()?.render?.(renderer);
    },
    handleInput(input) {
      return api.current()?.handleInput?.(input);
    },
    size() {
      return stack.length;
    },
  };

  return api;
}

function createStorage(initialValue = null) {
  let value = initialValue;

  return {
    getItem() {
      return value;
    },
    setItem(_key, nextValue) {
      value = String(nextValue);
    },
    value() {
      return value;
    },
  };
}

function createHarness(overrides = {}) {
  const records = {
    attachedTarget: undefined,
    endFrameCalls: 0,
    gameOverScenes: [],
    image: { naturalWidth: 80, naturalHeight: 64 },
    loopOptions: undefined,
    loopStarted: false,
    menuOptions: undefined,
    playOptions: undefined,
    rendererOptions: undefined,
  };
  const canvas = { id: 'game-canvas' };
  const win = { name: 'window' };
  const renderer = { name: 'renderer' };
  const input = {
    attach(target) {
      records.attachedTarget = target;
      return input;
    },
    endFrame() {
      records.endFrameCalls += 1;
      return input;
    },
  };
  const stack = createFakeSceneStack();
  const menuScene = { tag: 'menu' };
  const playScene = { tag: 'play' };

  const defaults = {
    canvas,
    window: win,
    createRendererFn(options) {
      records.rendererOptions = options;
      return renderer;
    },
    createInputFn() {
      return input;
    },
    createSceneStackFn() {
      return stack;
    },
    createLoopFn(options) {
      records.loopOptions = options;
      return {
        start() {
          records.loopStarted = true;
        },
        stop() {},
        pause() {},
        resume() {},
        isRunning: () => records.loopStarted,
        isPaused: () => false,
      };
    },
    createMenuSceneFn(options) {
      records.menuOptions = options;
      return menuScene;
    },
    createPlaySceneFn(options) {
      records.playOptions = options;
      return playScene;
    },
    createGameOverSceneFn(options) {
      const scene = {
        tag: 'gameover',
        options,
        enter(state) {
          scene.state = state;
        },
      };
      records.gameOverScenes.push(scene);
      return scene;
    },
    createPlayerFn: () => ({}),
    createFormationFn: () => ({}),
    createRngFn: () => ({}),
    loadSprites: async () => ({ image: records.image, width: 80, height: 64 }),
  };
  const options = { ...defaults, ...overrides };

  return {
    records,
    run: () => bootstrap(options),
  };
}

test('bootstrap resolves without a DOM when required fakes are injected', async () => {
  const harness = createHarness();

  await assert.doesNotReject(() => harness.run());
});

test('bootstrap creates the renderer with the logical canvas size', async () => {
  const harness = createHarness();

  await harness.run();

  assert.equal(harness.records.rendererOptions.logicalWidth, CANVAS.width);
  assert.equal(harness.records.rendererOptions.logicalHeight, CANVAS.height);
});

test('bootstrap pushes the menu scene first', async () => {
  const harness = createHarness();
  const { scenes } = await harness.run();

  assert.equal(scenes.current()?.tag, 'menu');
});

test('menu onStart replaces the current scene with a play scene', async () => {
  const playSentinel = { tag: 'play-sentinel' };
  const harness = createHarness({
    createPlaySceneFn(options) {
      harness.records.playOptions = options;
      return playSentinel;
    },
  });
  const { scenes } = await harness.run();

  harness.records.menuOptions.onStart();

  assert.equal(scenes.current(), playSentinel);
});

test('play onGameOver stores a new high score and shows game over', async () => {
  const storage = createStorage('5');
  const gameOverSentinel = {
    tag: 'gameover-sentinel',
    enter(state) {
      gameOverSentinel.state = state;
    },
  };
  const harness = createHarness({
    storage,
    createGameOverSceneFn(options) {
      harness.records.gameOverOptions = options;
      return gameOverSentinel;
    },
  });
  const { scenes } = await harness.run();

  harness.records.menuOptions.onStart();
  harness.records.playOptions.onGameOver(42);

  assert.equal(storage.value(), '42');
  assert.equal(scenes.current(), gameOverSentinel);
  assert.deepEqual(gameOverSentinel.state, { score: 42, high: 42 });
});

test('bootstrap starts the loop', async () => {
  const harness = createHarness();

  await harness.run();

  assert.equal(harness.records.loopStarted, true);
});
