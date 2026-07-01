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

function createKeyedStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, nextValue) {
      values.set(key, String(nextValue));
    },
    value(key) {
      return values.get(key);
    },
  };
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

// CS04 D5/D14 — boot flag fetch + daily option wiring (CS04-11)
test('CS04: bootstrap awaits fetchFlagsFn before pushing the menu', async () => {
  let fetchOrder = 0;
  let menuOrder = 0;
  let counter = 0;
  const harness = createHarness({
    fetchFlagsFn: async () => { counter += 1; fetchOrder = counter; return { dailyChallenge: 'off' }; },
    createMenuSceneFn(options) {
      counter += 1; menuOrder = counter;
      return { tag: 'menu', options };
    },
  });
  await harness.run();
  assert.ok(fetchOrder > 0 && fetchOrder < menuOrder, 'fetchFlags should resolve before createMenuScene');
});

test('CS04: bootstrap falls back to defaults when fetchFlagsFn rejects (does not throw)', async () => {
  const harness = createHarness({
    fetchFlagsFn: async () => { throw new Error('network down'); },
  });
  await assert.doesNotReject(() => harness.run());
});

test('CS04: dailyOption is enabled and exposes onDaily when dailyChallenge=on', async () => {
  let capturedOptions;
  const harness = createHarness({
    fetchFlagsFn: async () => ({ dailyChallenge: 'on' }),
    createMenuSceneFn(options) {
      capturedOptions = options;
      return { tag: 'menu', options };
    },
  });
  await harness.run();
  assert.ok(capturedOptions.dailyOption, 'menu received a dailyOption');
  assert.equal(capturedOptions.dailyOption.enabled, true);
  assert.equal(typeof capturedOptions.dailyOption.handleInput, 'function');
});

test('CS04: dailyOption is disabled (no-op) when dailyChallenge=off', async () => {
  let capturedOptions;
  const harness = createHarness({
    fetchFlagsFn: async () => ({ dailyChallenge: 'off' }),
    createMenuSceneFn(options) {
      capturedOptions = options;
      return { tag: 'menu', options };
    },
  });
  await harness.run();
  assert.ok(capturedOptions.dailyOption, 'menu received a dailyOption');
  assert.equal(capturedOptions.dailyOption.enabled, false);
  assert.equal(capturedOptions.dailyOption.promptText(), null);
});

test('CS04: dailyOption.handleInput on KeyD invokes createDailySceneFn with utcDate from now()', async () => {
  let dailyCreated = 0;
  let capturedDailyOpts;
  const fixedTime = new Date('2026-05-14T12:34:56.000Z');
  let menuOptions;
  const harness = createHarness({
    fetchFlagsFn: async () => ({ dailyChallenge: 'on' }),
    now: () => fixedTime,
    createMenuSceneFn(options) { menuOptions = options; return { tag: 'menu', options }; },
    createDailySceneFn(options) { dailyCreated += 1; capturedDailyOpts = options; return { tag: 'daily' }; },
  });
  await harness.run();
  // simulate KeyD via the dailyOption's onDaily path
  menuOptions.dailyOption.handleInput({ pressed: (code) => code === 'KeyD' });
  assert.equal(dailyCreated, 1);
  assert.equal(capturedDailyOpts.utcDate, '2026-05-14');
});

// CS04 PvI R1 fix: PVI-CS04-004 — leaderboard context tracker (period + date)
// startPlay() must clear context to {period:'all', date:null};
// startDaily() must set {period:'daily', date:utcDate};
// createLeaderboard() must thread period (and date if present) into the scene.

test('CS04 PvI: showLeaderboard from menu defaults to all-time period', async () => {
  let lbOpts;
  let menuOptions;
  const apiClient = { startSession: () => {}, submitScore: () => {}, getLeaderboard: () => {} };
  const harness = createHarness({
    apiClient,
    createMenuSceneFn(options) { menuOptions = options; return { tag: 'menu', options }; },
    createLeaderboardSceneFn(opts) { lbOpts = opts; return { tag: 'leaderboard' }; },
  });
  await harness.run();
  menuOptions.onLeaderboard();
  assert.equal(lbOpts.period, 'all');
  assert.equal(Object.prototype.hasOwnProperty.call(lbOpts, 'date'), false);
});

test('CS04 PvI: after startDaily, showLeaderboard scopes to that day', async () => {
  let lbOpts;
  let menuOptions;
  const fixedTime = new Date('2026-05-14T12:34:56.000Z');
  const apiClient = { startSession: () => {}, submitScore: () => {}, getLeaderboard: () => {} };
  const harness = createHarness({
    apiClient,
    fetchFlagsFn: async () => ({ dailyChallenge: 'on' }),
    now: () => fixedTime,
    createMenuSceneFn(options) { menuOptions = options; return { tag: 'menu', options }; },
    createDailySceneFn() { return { tag: 'daily' }; },
    createLeaderboardSceneFn(opts) { lbOpts = opts; return { tag: 'leaderboard' }; },
  });
  await harness.run();
  // Trigger daily start via the dailyOption path.
  menuOptions.dailyOption.handleInput({ pressed: (code) => code === 'KeyD' });
  // Then open the leaderboard.
  menuOptions.onLeaderboard();
  assert.equal(lbOpts.period, 'daily');
  assert.equal(lbOpts.date, '2026-05-14');
});

test('CS04 PvI: startPlay after startDaily resets the leaderboard context', async () => {
  let lbOpts;
  let menuOptions;
  const fixedTime = new Date('2026-05-14T12:34:56.000Z');
  const apiClient = { startSession: () => {}, submitScore: () => {}, getLeaderboard: () => {} };
  const harness = createHarness({
    apiClient,
    fetchFlagsFn: async () => ({ dailyChallenge: 'on' }),
    now: () => fixedTime,
    createMenuSceneFn(options) { menuOptions = options; return { tag: 'menu', options }; },
    createDailySceneFn() { return { tag: 'daily' }; },
    createLeaderboardSceneFn(opts) { lbOpts = opts; return { tag: 'leaderboard' }; },
  });
  await harness.run();
  menuOptions.dailyOption.handleInput({ pressed: (code) => code === 'KeyD' });
  // Now start a normal play session — should clear the daily context.
  menuOptions.onStart();
  menuOptions.onLeaderboard();
  assert.equal(lbOpts.period, 'all');
  assert.equal(Object.prototype.hasOwnProperty.call(lbOpts, 'date'), false);
});

test('CS08: practice mode game over writes only the practice high-score key', async () => {
  const storage = createKeyedStorage({
    subInvadersHighScore: '5',
    subInvadersPracticeHighScore: '7',
  });
  const harness = createHarness({
    storage,
    getMode: () => 'practice',
  });
  await harness.run();

  harness.records.menuOptions.onStart();
  harness.records.playOptions.onGameOver(42);

  assert.equal(storage.value('subInvadersPracticeHighScore'), '42');
  assert.equal(storage.value('subInvadersHighScore'), '5');
});

test('CS08: menu receives a mode option that toggles getMode/setMode', async () => {
  let mode = 'ranked';
  const harness = createHarness({
    getMode: () => mode,
    setMode: (nextMode) => { mode = nextMode; },
  });
  await harness.run();

  const { modeOption } = harness.records.menuOptions;
  assert.equal(typeof modeOption.handleInput, 'function');
  assert.equal(modeOption.promptText(), 'MODE: RANKED  (← → to change)');

  assert.equal(modeOption.handleInput({ pressed: (code) => code === 'ArrowRight' }), true);
  assert.equal(mode, 'practice');
  assert.equal(modeOption.promptText(), 'MODE: PRACTICE  (← → to change)');
});

test('CS08: starting daily challenge switches mode back to ranked', async () => {
  let mode = 'practice';
  const fixedTime = new Date('2026-05-14T12:34:56.000Z');
  const harness = createHarness({
    fetchFlagsFn: async () => ({ dailyChallenge: 'on' }),
    getMode: () => mode,
    setMode: (nextMode) => { mode = nextMode; },
    now: () => fixedTime,
    createDailySceneFn() { return { tag: 'daily' }; },
  });
  await harness.run();

  harness.records.menuOptions.dailyOption.handleInput({ pressed: (code) => code === 'KeyD' });

  assert.equal(mode, 'ranked');
});

test('CS08: Service Worker registration is skipped for nosw and localhost, otherwise registered', async () => {
  const noswCalls = [];
  await createHarness({
    location: { href: 'https://example.test/?nosw=1', search: '?nosw=1', hostname: 'example.test' },
    navigator: { serviceWorker: { register: () => {} } },
    registerServiceWorker: (url) => { noswCalls.push(url); },
  }).run();
  assert.deepEqual(noswCalls, []);

  const localhostCalls = [];
  await createHarness({
    location: { href: 'http://localhost/', search: '', hostname: 'localhost' },
    navigator: { serviceWorker: { register: () => {} } },
    registerServiceWorker: (url) => { localhostCalls.push(url); },
  }).run();
  assert.deepEqual(localhostCalls, []);

  const registered = [];
  await createHarness({
    location: { href: 'https://sub.example/', search: '', hostname: 'sub.example' },
    navigator: { serviceWorker: { register: () => {} } },
    registerServiceWorker: (url) => { registered.push(url); },
  }).run();
  assert.deepEqual(registered, ['/sw.mjs']);
});

test('CS08: pending scores drain on online load and stay queued offline', async () => {
  const entry = {
    sessionId: 'session-1',
    score: 123,
    finishedAt: '2026-05-14T12:34:56.000Z',
    queuedAt: 1,
  };
  const storage = createKeyedStorage({
    subInvadersPendingScores: JSON.stringify([entry]),
  });
  const submitted = [];
  await createHarness({
    storage,
    navigator: { onLine: true },
    apiClient: { submitScore: async (nextEntry) => { submitted.push(nextEntry); } },
  }).run();
  await flushMicrotasks();

  assert.deepEqual(submitted, [entry]);
  assert.equal(storage.value('subInvadersPendingScores'), '[]');

  const offlineStorage = createKeyedStorage({
    subInvadersPendingScores: JSON.stringify([entry]),
  });
  const offlineSubmitted = [];
  await createHarness({
    storage: offlineStorage,
    navigator: { onLine: false },
    apiClient: { submitScore: async (nextEntry) => { offlineSubmitted.push(nextEntry); } },
  }).run();
  await flushMicrotasks();

  assert.deepEqual(offlineSubmitted, []);
  assert.equal(offlineStorage.value('subInvadersPendingScores'), JSON.stringify([entry]));
});
