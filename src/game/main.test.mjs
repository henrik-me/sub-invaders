import assert from 'node:assert/strict';
import test from 'node:test';
import { CANVAS } from './constants.mjs';
import { bootstrap } from './main.mjs';
import { installTestHooks } from './test-hooks.mjs';

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
    formationOptions: undefined,
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
  const location = { href: 'http://localhost/' };
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
    location,
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
    createFormationFn(options) {
      records.formationOptions = options;
      return {};
    },
    createRngFn: () => ({}),
    loadSprites: async () => ({ image: records.image, width: 80, height: 64 }),
  };
  const options = { ...defaults, ...overrides };

  return {
    records,
    run: () => bootstrap(options),
  };
}

function withGlobals(values, fn) {
  const previous = new Map();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true });
  }

  try {
    return fn();
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete globalThis[key];
      }
    }
  }
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

test('menu wiring exposes onLeaderboard when apiClient is available', async () => {
  const apiClient = { startSession: () => {}, submitScore: () => {}, getLeaderboard: () => {} };
  const harness = createHarness({ apiClient });

  await harness.run();

  assert.equal(typeof harness.records.menuOptions.onLeaderboard, 'function');
});

test('menu wiring omits onLeaderboard when no apiClient is available', async () => {
  const harness = createHarness({ apiClient: null });

  await harness.run();

  assert.equal(harness.records.menuOptions.onLeaderboard, undefined);
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

test('bootstrap threads query params into play scene setup', async () => {
  const harness = createHarness({
    location: { href: 'http://localhost/?seed=42&startWave=3&formationSpeed=0' },
  });

  await harness.run();
  harness.records.menuOptions.onStart();
  harness.records.playOptions.createFormation({ marker: true });

  assert.equal(harness.records.playOptions.seed, 42);
  assert.equal(harness.records.playOptions.startWave, 3);
  assert.equal(harness.records.playOptions.formationSpeed, 0);
  assert.deepEqual(harness.records.formationOptions, { marker: true, baseSpeed: 0 });
});

test('installTestHooks is a no-op without ?test=1', () => {
  withGlobals({ window: {}, location: { href: 'http://localhost/' } }, () => {
    const hooks = installTestHooks({ scenes: createFakeSceneStack() });

    assert.equal(hooks, undefined);
    assert.equal(Object.hasOwn(globalThis.window, '__subInvaders'), false);
  });
});

test('installTestHooks exposes the required methods with ?test=1', () => {
  const playState = {
    score: 0,
    high: 7,
    lives: 3,
    wave: 1,
    ready: true,
    gameOver: false,
    player: { x: 10, y: 20, w: 32, h: 16, lives: 3, alive: true },
    formation: { enemies: [{ x: 80, y: 90, w: 24, h: 24, type: 'jellyfish', alive: true }] },
  };
  const scenes = { current: () => ({ state: () => playState }) };

  withGlobals({ window: {}, location: { href: 'http://localhost/?test=1' } }, () => {
    const hooks = installTestHooks({ scenes, getHighScore: () => 7 });

    assert.equal(hooks, globalThis.window.__subInvaders);
    for (const method of ['state', 'formation', 'player', 'pressKey', 'releaseKey', 'setSeed']) {
      assert.equal(typeof hooks[method], 'function');
    }
    assert.deepEqual(hooks.state(), {
      scene: 'play',
      score: 0,
      high: 7,
      lives: 3,
      wave: 1,
      alive: true,
      ready: true,
      paused: false,
      gameOver: false,
      enemyShots: 0,
      torpedoes: 0,
      phase: undefined,
      entriesCount: undefined,
      leaderboardError: undefined,
      submission: null,
    });
  });
});

test('installTestHooks state() surfaces submission for play scene when present', () => {
  const playState = {
    score: 42,
    high: 7,
    lives: 1,
    wave: 1,
    ready: true,
    gameOver: false,
    player: { x: 10, y: 20, w: 32, h: 16, lives: 1, alive: true },
    formation: { enemies: [] },
    submission: { attempted: true, status: 'ok', error: null },
  };
  const scenes = { current: () => ({ state: () => playState }) };
  withGlobals({ window: {}, location: { href: 'http://localhost/?test=1' } }, () => {
    const hooks = installTestHooks({ scenes });
    const s = hooks.state();
    assert.equal(s.scene, 'play');
    assert.deepEqual(s.submission, { attempted: true, status: 'ok', error: null });
  });
});

test('installTestHooks detects leaderboard scene by phase + entries shape', () => {
  const leaderboardState = {
    phase: 'ready',
    entries: [
      { rank: 1, score: 9001, finishedAt: '2026-05-13T00:00:00.000Z' },
      { rank: 2, score: 5000, finishedAt: '2026-05-12T23:59:00.000Z' },
    ],
    error: null,
  };
  const scenes = { current: () => ({ state: () => leaderboardState }) };
  withGlobals({ window: {}, location: { href: 'http://localhost/?test=1' } }, () => {
    const hooks = installTestHooks({ scenes });
    const s = hooks.state();
    assert.equal(s.scene, 'leaderboard');
    assert.equal(s.phase, 'ready');
    assert.equal(s.entriesCount, 2);
    assert.equal(s.leaderboardError, null);
    assert.deepEqual(hooks.entries(), [
      { rank: 1, score: 9001, finishedAt: '2026-05-13T00:00:00.000Z' },
      { rank: 2, score: 5000, finishedAt: '2026-05-12T23:59:00.000Z' },
    ]);
  });
});

test('installTestHooks reports loading phase and entries() returns empty array', () => {
  const leaderboardState = { phase: 'loading', entries: [], error: null };
  const scenes = { current: () => ({ state: () => leaderboardState }) };
  withGlobals({ window: {}, location: { href: 'http://localhost/?test=1' } }, () => {
    const hooks = installTestHooks({ scenes });
    const s = hooks.state();
    assert.equal(s.scene, 'leaderboard');
    assert.equal(s.phase, 'loading');
    assert.equal(s.entriesCount, 0);
    assert.deepEqual(hooks.entries(), []);
  });
});

test('installTestHooks reports error phase and exposes leaderboardError', () => {
  const leaderboardState = { phase: 'error', entries: [], error: 'fetch failed' };
  const scenes = { current: () => ({ state: () => leaderboardState }) };
  withGlobals({ window: {}, location: { href: 'http://localhost/?test=1' } }, () => {
    const hooks = installTestHooks({ scenes });
    const s = hooks.state();
    assert.equal(s.scene, 'leaderboard');
    assert.equal(s.phase, 'error');
    assert.equal(s.leaderboardError, 'fetch failed');
  });
});
