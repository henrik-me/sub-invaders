import { createInput } from '../engine/input.mjs';
import { createLoop } from '../engine/loop.mjs';
import { createRenderer } from '../engine/renderer.mjs';
import { createSceneStack } from '../engine/scene.mjs';
import { createRng } from '../engine/seed.mjs';
import { loadSpriteSheet } from '../engine/sprite.mjs';
import { CANVAS, SPRITES } from './constants.mjs';
import { createFormation } from './invaders.mjs';
import { createPlayer } from './player.mjs';
import { createGameOverScene } from './scenes/gameover.mjs';
import { createMenuScene } from './scenes/menu.mjs';
import { createPlayScene } from './scenes/play.mjs';
import { getHighScore, setHighScore } from './score.mjs';

function toScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
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
    spritesUrl = './public/sprites.png',
    loadSprites = ({ url, imageFactory: factory }) => loadSpriteSheet(url, { imageFactory: factory }),
    storage,
    seed = 1,
    createRendererFn = createRenderer,
    createInputFn = createInput,
    createSceneStackFn = createSceneStack,
    createLoopFn = createLoop,
    createMenuSceneFn = createMenuScene,
    createPlaySceneFn = createPlayScene,
    createGameOverSceneFn = createGameOverScene,
    createPlayerFn = createPlayer,
    createFormationFn = createFormation,
    createRngFn = createRng,
    imageFactory,
  } = opts;

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
      getHighScore: readHighScore,
    });
  }

  function createPlay() {
    return createPlaySceneFn({
      createPlayer: createPlayerFn,
      createFormation: createFormationFn,
      createRng: createRngFn,
      loadSprites: () => sprites,
      getHighScore: readHighScore,
      setHighScore: writeHighScore,
      onGameOver: showGameOver,
      seed,
    });
  }

  function createGameOver(score, high) {
    const scene = createGameOverSceneFn({
      onRestart: startPlay,
      onMenu: showMenu,
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

  function startPlay() {
    scenes.replace(createPlay());
  }

  function showMenu() {
    scenes.replace(createMenu());
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

  return { renderer, input, scenes, loop, sprites };
}

if (typeof globalThis.document !== 'undefined') {
  bootstrap().catch((err) => console.error('Sub Invaders bootstrap failed', err));
}
