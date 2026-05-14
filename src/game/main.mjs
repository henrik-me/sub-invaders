import { createInput } from '../engine/input.mjs';
import { createLoop } from '../engine/loop.mjs';
import { createRenderer } from '../engine/renderer.mjs';
import { createSceneStack } from '../engine/scene.mjs';
import { createRng } from '../engine/seed.mjs';
import { loadSpriteSheet } from '../engine/sprite.mjs';
import { createApiClient } from './api.mjs';
import { CANVAS, SPRITES } from './constants.mjs';
import { createFormation } from './invaders.mjs';
import { createPlayer } from './player.mjs';
import { createGameOverScene } from './scenes/gameover.mjs';
import { createLeaderboardScene } from './scenes/leaderboard.mjs';
import { createMenuScene } from './scenes/menu.mjs';
import { createPlayScene } from './scenes/play.mjs';
import { getHighScore, setHighScore } from './score.mjs';
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
    spritesUrl = './public/sprites.png',
    loadSprites = ({ url, imageFactory: factory }) => loadSpriteSheet(url, { imageFactory: factory }),
    storage,
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
    createGameOverSceneFn = createGameOverScene,
    createLeaderboardSceneFn = createLeaderboardScene,
    createPlayerFn = createPlayer,
    createFormationFn = createFormation,
    createRngFn = createRng,
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

  const readHighScore = () => getHighScore({ storage });
  const writeHighScore = (value) => setHighScore(value, { storage });

  function createMenu() {
    return createMenuSceneFn({
      onStart: startPlay,
      onLeaderboard: apiClient ? showLeaderboard : undefined,
      getHighScore: readHighScore,
    });
  }

  function createConfiguredFormation(options = {}) {
    return createFormationFn({
      ...options,
      ...(currentFormationSpeed === undefined ? {} : { baseSpeed: currentFormationSpeed }),
      ...(currentFireIntervalMs === undefined ? {} : { fireIntervalMs: currentFireIntervalMs }),
    });
  }

  function createPlay() {
    return createPlaySceneFn({
      createPlayer: createPlayerFn,
      createFormation: createConfiguredFormation,
      createRng: createRngFn,
      loadSprites: () => sprites,
      getHighScore: readHighScore,
      setHighScore: writeHighScore,
      onGameOver: showGameOver,
      apiClient,
      seed: currentSeed,
      startWave: currentStartWave,
      formationSpeed: currentFormationSpeed,
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
    });
  }

  function startPlay() {
    scenes.replace(createPlay());
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

  return { renderer, input, scenes, loop, sprites, testHooks };
}

if (typeof globalThis.document !== 'undefined') {
  bootstrap().catch((err) => console.error('Sub Invaders bootstrap failed', err));
}
