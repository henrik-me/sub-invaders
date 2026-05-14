import assert from 'node:assert/strict';
import test from 'node:test';
import { createMenuScene } from './scenes/menu.mjs';
import { createPlayScene } from './scenes/play.mjs';
import { createGameOverScene } from './scenes/gameover.mjs';

function createFakeRenderer() {
  const calls = [];

  return {
    calls,
    clear(...args) {
      calls.push({ method: 'clear', args });
    },
    drawText(...args) {
      calls.push({ method: 'drawText', args });
    },
    drawSprite(...args) {
      calls.push({ method: 'drawSprite', args });
    },
    drawRect(...args) {
      calls.push({ method: 'drawRect', args });
    },
    width() {
      return 800;
    },
    height() {
      return 600;
    },
  };
}

function inputWith(...pressedCodes) {
  const pressed = new Set(pressedCodes);

  return {
    pressed: (code) => pressed.has(code),
    down: (code) => pressed.has(code),
    released: () => false,
    touchDx: () => 0,
  };
}

function textValues(renderer) {
  return renderer.calls
    .filter((call) => call.method === 'drawText')
    .map((call) => call.args[0]);
}

function createPlayHarness({ player = {}, invaders = [], formation = {}, onGameOver = () => {} } = {}) {
  const fakePlayer = {
    x: 384,
    y: 540,
    w: 32,
    h: 16,
    lives: 3,
    alive: true,
    update() {},
    tryFire() {
      return null;
    },
    isDead() {
      return this.lives <= 0;
    },
    ...player,
  };
  const fakeFormation = {
    invaders,
    update() {},
    aliveCount() {
      return this.invaders.filter((invader) => invader.alive !== false).length;
    },
    lowestY() {
      return 120;
    },
    ...formation,
  };

  return createPlayScene({
    createPlayer: () => fakePlayer,
    createFormation: () => fakeFormation,
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({ submarine: {}, torpedo: {}, enemyShot: {}, lifeIcon: {} }),
    getHighScore: () => 0,
    setHighScore: () => {},
    onGameOver,
  });
}

test('menu starts the game when Space is pressed', () => {
  let starts = 0;
  const scene = createMenuScene({ onStart: () => { starts += 1; } });

  scene.handleInput(inputWith('Space'));

  assert.equal(starts, 1);
});

test('menu render draws the title', () => {
  const renderer = createFakeRenderer();
  const scene = createMenuScene({ getHighScore: () => 42, now: () => 0 });

  scene.render(renderer);

  assert.ok(textValues(renderer).includes('SUB INVADERS'));
});

test('menu fires onLeaderboard when KeyL is pressed and callback is provided', () => {
  let leaderboards = 0;
  const scene = createMenuScene({
    onStart: () => {},
    onLeaderboard: () => { leaderboards += 1; },
    getHighScore: () => 0,
    now: () => 0,
  });

  scene.handleInput(inputWith('KeyL'));
  assert.equal(leaderboards, 1);

  const renderer = createFakeRenderer();
  scene.render(renderer);
  const labels = textValues(renderer);
  assert.ok(
    labels.some((t) => /PRESS L FOR LEADERBOARD/.test(t)),
    'leaderboard hint is rendered when onLeaderboard is provided',
  );
});

test('menu ignores KeyL and hides the hint when onLeaderboard is absent', () => {
  const scene = createMenuScene({
    onStart: () => {},
    getHighScore: () => 0,
    now: () => 0,
  });

  assert.doesNotThrow(() => scene.handleInput(inputWith('KeyL')));

  const renderer = createFakeRenderer();
  scene.render(renderer);
  const labels = textValues(renderer);
  assert.ok(
    !labels.some((t) => /PRESS L FOR LEADERBOARD/.test(t)),
    'leaderboard hint is hidden when onLeaderboard is absent',
  );
  assert.ok(
    labels.some((t) => /PRESS SPACE TO START/.test(t)),
    'start hint is still shown',
  );
});

test('play enter initialises score, wave, and lives', () => {
  const scene = createPlayHarness({ player: { lives: 2 }, invaders: [{ alive: true, x: 0, y: 0, w: 8, h: 8 }] });

  scene.enter();

  assert.equal(scene.state().score, 0);
  assert.equal(scene.state().wave, 1);
  assert.equal(scene.state().lives, 2);
});

test('play enter applies configured start wave', () => {
  let resetWave = 0;
  const scene = createPlayScene({
    startWave: 3,
    createPlayer: () => ({
      x: 384,
      y: 540,
      w: 32,
      h: 16,
      lives: 3,
      alive: true,
      update() {},
      tryFire() {
        return null;
      },
      isDead() {
        return this.lives <= 0;
      },
    }),
    createFormation: () => ({
      invaders: [{ alive: true, x: 0, y: 0, w: 8, h: 8 }],
      resetForWave(nextWave) {
        resetWave = nextWave;
      },
      update() {},
      aliveCount() {
        return this.invaders.filter((invader) => invader.alive !== false).length;
      },
      lowestY() {
        return 120;
      },
    }),
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({ submarine: {}, torpedo: {}, enemyShot: {}, lifeIcon: {} }),
    getHighScore: () => 0,
    setHighScore: () => {},
    onGameOver: () => {},
  });

  scene.enter();

  assert.equal(scene.state().wave, 3);
  assert.equal(resetWave, 3);
});

test('play update scores when a torpedo collides with an invader', () => {
  const torpedo = { x: 10, y: 10, w: 4, h: 10, alive: true };
  const invaders = [
    { x: 10, y: 10, w: 24, h: 24, alive: true, points: 40, sprite: 'squid' },
    { x: 100, y: 10, w: 24, h: 24, alive: true, points: 10, sprite: 'jellyfish' },
  ];
  const scene = createPlayHarness({
    player: {
      tryFire() {
        return torpedo;
      },
    },
    invaders,
  });

  scene.enter();
  scene.update(0, inputWith('Space'));

  assert.equal(scene.state().score, 40);
  assert.equal(invaders[0].alive, false);
  assert.equal(scene.state().wave, 1);
});

test('play clearing all invaders adds the wave bonus and advances the wave', () => {
  const invaders = [{ x: 10, y: 10, w: 24, h: 24, alive: true, points: 10, sprite: 'jellyfish' }];
  let resetWave = 0;
  const scene = createPlayHarness({
    player: {
      tryFire() {
        return { x: 10, y: 10, w: 4, h: 10, alive: true };
      },
    },
    invaders,
    formation: {
      resetForWave(nextWave) {
        resetWave = nextWave;
        this.invaders = [{ x: 80, y: 80, w: 24, h: 24, alive: true, points: 10, sprite: 'jellyfish' }];
      },
    },
  });

  scene.enter();
  scene.update(0, inputWith('Space'));

  assert.equal(scene.state().score, 110);
  assert.equal(scene.state().wave, 2);
  assert.equal(resetWave, 2);
});

test('play reports game over when the player is dead', () => {
  let finalScore;
  const scene = createPlayHarness({
    player: {
      lives: 0,
      isDead() {
        return true;
      },
    },
    invaders: [{ x: 0, y: 0, w: 24, h: 24, alive: true, points: 10 }],
    onGameOver(score) {
      finalScore = score;
    },
  });

  scene.enter();
  scene.update(0);

  assert.equal(finalScore, 0);
  assert.equal(scene.state().gameOver, true);
});

test('game-over scene stores scores, renders them, and handles prompts', () => {
  const renderer = createFakeRenderer();
  let restarts = 0;
  let menus = 0;
  const scene = createGameOverScene({
    onRestart: () => { restarts += 1; },
    onMenu: () => { menus += 1; },
  });

  scene.enter({ score: 1234, high: 5000 });
  scene.render(renderer);
  scene.handleInput(inputWith('Space'));
  scene.handleInput(inputWith('KeyM'));

  const labels = textValues(renderer);
  assert.deepEqual(scene.state(), { score: 1234, high: 5000 });
  assert.ok(labels.includes('SCORE  1234'));
  assert.ok(labels.includes('HIGH  5000'));
  assert.equal(restarts, 1);
  assert.equal(menus, 1);
});

test('game-over scene fires onLeaderboard when KeyL is pressed and callback is provided', () => {
  let leaderboards = 0;
  const scene = createGameOverScene({
    onRestart: () => {},
    onMenu: () => {},
    onLeaderboard: () => { leaderboards += 1; },
  });
  scene.enter({ score: 50, high: 100 });

  scene.handleInput(inputWith('KeyL'));
  assert.equal(leaderboards, 1);

  const renderer = createFakeRenderer();
  scene.render(renderer);
  const labels = textValues(renderer);
  assert.ok(
    labels.some((t) => /PRESS L FOR LEADERBOARD/.test(t)),
    'leaderboard hint is rendered when onLeaderboard is provided',
  );
});

test('game-over scene ignores KeyL when onLeaderboard is not provided', () => {
  const scene = createGameOverScene({
    onRestart: () => {},
    onMenu: () => {},
  });
  scene.enter({ score: 0, high: 0 });
  assert.doesNotThrow(() => scene.handleInput(inputWith('KeyL')));

  const renderer = createFakeRenderer();
  scene.render(renderer);
  const labels = textValues(renderer);
  assert.ok(
    !labels.some((t) => /PRESS L FOR LEADERBOARD/.test(t)),
    'leaderboard hint is hidden when onLeaderboard is absent',
  );
});

test('play scene wired with REAL formation: torpedo kills the targeted invader', async () => {
  const { createPlayer } = await import('./player.mjs');
  const { createFormation } = await import('./invaders.mjs');

  const formation = createFormation();
  const target = formation.enemies[0];
  const torpedo = {
    x: target.x + (target.w / 2) - 2,
    y: target.y + target.h - 1,
    w: 4,
    h: 10,
    alive: true,
    update() {},
  };
  const fakePlayer = {
    x: 384, y: 540, w: 32, h: 16, lives: 3, alive: true,
    update() {},
    tryFire() { return torpedo; },
    isDead() { return this.lives <= 0; },
  };

  const scene = createPlayScene({
    createPlayer: () => fakePlayer,
    createFormation: () => formation,
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({ submarine: {}, torpedo: {}, enemyShot: {}, lifeIcon: {} }),
    getHighScore: () => 0,
    setHighScore: () => {},
    onGameOver: () => {},
  });

  scene.enter();
  scene.update(0, inputWith('Space'));

  assert.equal(target.alive, false, 'invader should be dead after torpedo overlap');
  assert.equal(scene.state().score, target.points, 'score should equal the killed invader points');
});

// CS04 D5/D14 — menu honors dailyOption (CS04-11)
test('CS04: menu routes KeyD via dailyOption.handleInput when enabled', () => {
  let dailyCalls = 0;
  const dailyOption = {
    enabled: true,
    promptText: () => 'PRESS D FOR DAILY CHALLENGE',
    handleInput: (input) => { if (input?.pressed?.('KeyD')) { dailyCalls += 1; return true; } return false; },
  };
  const scene = createMenuScene({ onStart: () => {}, dailyOption, getHighScore: () => 0, now: () => 0 });
  scene.handleInput(inputWith('KeyD'));
  assert.equal(dailyCalls, 1);
});

test('CS04: menu render shows daily prompt when dailyOption is enabled', () => {
  const dailyOption = {
    enabled: true,
    promptText: () => 'PRESS D FOR DAILY CHALLENGE',
    handleInput: () => false,
  };
  const renderer = createFakeRenderer();
  const scene = createMenuScene({ getHighScore: () => 0, now: () => 0, dailyOption });
  scene.render(renderer);
  assert.ok(textValues(renderer).some((t) => /PRESS D FOR DAILY CHALLENGE/.test(t)));
});

test('CS04: menu does not render daily prompt when dailyOption.promptText returns null', () => {
  const dailyOption = {
    enabled: false,
    promptText: () => null,
    handleInput: () => false,
  };
  const renderer = createFakeRenderer();
  const scene = createMenuScene({ getHighScore: () => 0, now: () => 0, dailyOption });
  scene.render(renderer);
  assert.ok(!textValues(renderer).some((t) => /DAILY CHALLENGE/.test(t)));
});
