import { createInput } from 'canvas-game-engine/input.mjs';
import { createLoop } from 'canvas-game-engine/loop.mjs';
import { createRenderer } from 'canvas-game-engine/renderer.mjs';
import { createSceneStack } from 'canvas-game-engine/scene.mjs';
import { createRng } from 'canvas-game-engine/seed.mjs';
import { loadSpriteSheet } from 'canvas-game-engine/sprite.mjs';
import { createApiClient } from './api.mjs';
import { CANVAS, SPRITES } from './constants.mjs';
import { fetchFlags as defaultFetchFlags, isDailyChallengeEnabled } from './flags.mjs';
import { createFormation } from './invaders.mjs';
import { createPlayer } from './player.mjs';
import { createDailyScene } from './scenes/daily.mjs';
import { createGameOverScene } from './scenes/gameover.mjs';
import { createLeaderboardScene } from './scenes/leaderboard.mjs';
import { createMenuScene } from './scenes/menu.mjs';
import { createDailyMenuOption } from './scenes/menu-daily-option.mjs';
import { createModeMenuOption } from './scenes/menu-mode-option.mjs';
import { createPlayScene } from './scenes/play.mjs';
import { getMode as defaultGetMode, setMode as defaultSetMode } from './mode.mjs';
import { drain as drainPendingScores } from './pending-scores.mjs';
import { getHighScore, getHighScoreFor, setHighScore, setHighScoreFor } from './score.mjs';
import { installTestHooks } from './test-hooks.mjs';

function toScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
}

function toPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback;
}

function toSeed(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function toNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function locationUrl(locationLike) {
  const href = typeof locationLike === 'string' ? locationLike : locationLike?.href;

  try {
    return new URL(href ?? 'about:blank', 'http://localhost/');
  } catch {
    return new URL('about:blank');
  }
}

function readQueryOptions(locationLike) {
  const params = locationUrl(locationLike).searchParams;

  return {
    seed: params.has('seed') ? toSeed(params.get('seed')) : undefined,
    startWave: params.has('startWave') ? toPositiveInt(params.get('startWave'), 1) : undefined,
    formationSpeed: params.has('formationSpeed') ? toNonNegativeNumber(params.get('formationSpeed')) : undefined,
    fireIntervalMs: params.has('fireIntervalMs')
      ? toNonNegativeNumber(params.get('fireIntervalMs'))
      : undefined,
  };
}

function buildSprites(spriteSheet) {
  const image = spriteSheet?.image ?? spriteSheet;
  const frames = {};
  const sprites = { image, frames };

  for (const [name, frame] of Object.entries(SPRITES)) {
    frames[name] = frame;
    sprites[name] = { image, frame };
  }

  return sprites;
}

export async function bootstrap(opts = {}) {
  const {
    canvas = globalThis.document?.getElementById('game-canvas'),
    window: win = globalThis.window,
    location = globalThis.location,
    navigator: nav = globalThis.navigator,
    spritesUrl = './public/sprites.png',
    loadSprites = ({ url, imageFactory: factory }) => loadSpriteSheet(url, { imageFactory: factory }),
    storage,
    getMode = defaultGetMode,
    setMode = defaultSetMode,
    registerServiceWorker,
    seed,
    startWave,
    formationSpeed,
    fireIntervalMs,
    apiClient = (() => {
      try {
        return createApiClient();
      } catch {
        return null;
      }
    })(),
    createRendererFn = createRenderer,
    createInputFn = createInput,
    createSceneStackFn = createSceneStack,
    createLoopFn = createLoop,
    createMenuSceneFn = createMenuScene,
    createPlaySceneFn = createPlayScene,
    createDailySceneFn = createDailyScene,
    createDailyMenuOptionFn = createDailyMenuOption,
    createGameOverSceneFn = createGameOverScene,
    createLeaderboardSceneFn = createLeaderboardScene,
    createPlayerFn = createPlayer,
    createFormationFn = createFormation,
    createRngFn = createRng,
    fetchFlagsFn = defaultFetchFlags,
    now = () => new Date(),
    imageFactory,
  } = opts;
  const queryOptions = readQueryOptions(location);
  let currentSeed = toSeed(seed ?? queryOptions.seed, 1);
  const currentStartWave = toPositiveInt(startWave ?? queryOptions.startWave, 1);
  const currentFormationSpeed = toNonNegativeNumber(formationSpeed ?? queryOptions.formationSpeed);
  const currentFireIntervalMs = toNonNegativeNumber(fireIntervalMs ?? queryOptions.fireIntervalMs);

  if (!canvas) {
    throw new Error('bootstrap: canvas is required');
  }

  const renderer = createRendererFn({
    canvas,
    logicalWidth: CANVAS.width,
    logicalHeight: CANVAS.height,
  });
  const input = createInputFn();
  input.attach(win);

  const spriteSheet = await loadSprites({ url: spritesUrl, imageFactory });
  const sprites = buildSprites(spriteSheet);
  const scenes = createSceneStackFn();

  const flags = await Promise.resolve(fetchFlagsFn({})).catch(() => ({}));
  const dailyEnabled = isDailyChallengeEnabled(flags);

  const readHighScore = () => getHighScoreFor(getMode(), { storage });
  const writeHighScore = (value) => setHighScoreFor(getMode(), value, { storage });

  function currentUtcDate() {
    const date = now();
    const iso = date instanceof Date ? date.toISOString() : new Date(date).toISOString();
    return iso.slice(0, 10);
  }

  // CS04 PvI R1 fix (PVI-CS04-004): track which leaderboard period to show
  // when the user navigates to leaderboard from the menu vs from a daily run.
  // Cleared when a normal game starts; set when a daily game starts.
  let lastLeaderboardContext = { period: 'all', date: null };

  function createMenu() {
    const dailyOption = createDailyMenuOptionFn({ flags, onDaily: dailyEnabled ? startDaily : undefined });
    const modeOption = createModeMenuOption({ getMode, setMode });
    return createMenuSceneFn({
      onStart: startPlay,
      onLeaderboard: apiClient ? showLeaderboard : undefined,
      getHighScore: readHighScore,
      dailyOption,
      modeOption,
    });
  }

  function maybeRegisterServiceWorker() {
    try {
      const search = String(location?.search ?? '');
      if (/[?&]nosw=1\b/.test(search)) return;
      const host = String(location?.hostname ?? '');
      if (host === 'localhost' || host === '127.0.0.1' || host === '') return;
      const reg = registerServiceWorker ?? nav?.serviceWorker?.register?.bind(nav.serviceWorker);
      if (typeof reg !== 'function') return;
      Promise.resolve(reg('/sw.mjs')).catch(() => {});
    } catch {
      // Service Worker registration is a progressive enhancement; boot must not depend on it.
    }
  }

  async function drainPendingOnLoad() {
    try {
      if (nav && nav.onLine === false) return;
      if (!apiClient || typeof apiClient.submitScore !== 'function') return;
      await drainPendingScores((entry) => apiClient.submitScore(entry), { storage });
    } catch {
      // Pending-score drain is best-effort; the queue remains for the next online load.
    }
  }

  function createConfiguredFormation(options = {}) {
    return createFormationFn({
      ...options,
      ...(currentFormationSpeed === undefined ? {} : { baseSpeed: currentFormationSpeed }),
      ...(currentFireIntervalMs === undefined ? {} : { fireIntervalMs: currentFireIntervalMs }),
    });
  }

  function playSceneDeps() {
    return {
      createPlayer: createPlayerFn,
      createFormation: createConfiguredFormation,
      createRng: createRngFn,
      loadSprites: () => sprites,
      getHighScore: readHighScore,
      setHighScore: writeHighScore,
      onGameOver: showGameOver,
      apiClient,
      startWave: currentStartWave,
      formationSpeed: currentFormationSpeed,
    };
  }

  function createPlay() {
    return createPlaySceneFn({
      ...playSceneDeps(),
      seed: currentSeed,
    });
  }

  function createDaily(utcDate = currentUtcDate()) {
    return createDailySceneFn({
      ...playSceneDeps(),
      utcDate,
      createPlayScene: createPlaySceneFn,
    });
  }

  function createGameOver(score, high) {
    const scene = createGameOverSceneFn({
      onRestart: startPlay,
      onMenu: showMenu,
      onLeaderboard: apiClient ? showLeaderboard : undefined,
      score,
      high,
    });

    if (typeof scene?.enter === 'function') {
      const originalEnter = scene.enter;
      const initialState = { score, high };
      scene.enter = (state = initialState) => originalEnter.call(scene, state);
    }

    return scene;
  }

  function createLeaderboard() {
    return createLeaderboardSceneFn({
      apiClient,
      onRestart: startPlay,
      onMenu: showMenu,
      period: lastLeaderboardContext.period,
      ...(lastLeaderboardContext.date ? { date: lastLeaderboardContext.date } : {}),
    });
  }

  function startPlay() {
    lastLeaderboardContext = { period: 'all', date: null };
    scenes.replace(createPlay());
  }

  function startDaily() {
    setMode('ranked');
    const utcDate = currentUtcDate();
    lastLeaderboardContext = { period: 'daily', date: utcDate };
    scenes.replace(createDaily(utcDate));
  }

  function showMenu() {
    scenes.replace(createMenu());
  }

  function showLeaderboard() {
    scenes.replace(createLeaderboard());
  }

  function showGameOver(finalScore) {
    const score = toScore(finalScore);
    const storedHigh = toScore(readHighScore());
    const high = Math.max(storedHigh, score);

    if (score > storedHigh) {
      writeHighScore(score);
    }

    scenes.replace(createGameOver(score, high));
  }

  function setSeed(nextSeed) {
    currentSeed = toSeed(nextSeed, currentSeed);
    startPlay();
  }

  scenes.push(createMenu());

  const loop = createLoopFn({
    update: (dt) => {
      scenes.handleInput(input);
      scenes.update(dt);
    },
    render: () => {
      scenes.render(renderer);
      input.endFrame();
    },
  });
  loop.start();

  const testHooks = installTestHooks({
    window: win,
    location,
    scenes,
    input,
    loop,
    getHighScore: readHighScore,
    setHighScore: writeHighScore,
    setSeed,
    showGameOver,
  });

  drainPendingOnLoad();
  maybeRegisterServiceWorker();

  return { renderer, input, scenes, loop, sprites, testHooks };
}

if (typeof globalThis.document !== 'undefined') {
  bootstrap().catch((err) => console.error('Sub Invaders bootstrap failed', err));
}
