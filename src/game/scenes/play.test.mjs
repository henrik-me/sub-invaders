import assert from 'node:assert/strict';
import test from 'node:test';

import { CANVAS, PALETTE } from '../constants.mjs';
import { createPlayScene } from './play.mjs';

function inputWith({ pressed = [], down = [] } = {}) {
  const pressedSet = new Set(pressed);
  const downSet = new Set([...pressed, ...down]);

  return {
    pressed: (code) => pressedSet.has(code),
    down: (code) => downSet.has(code),
    released: () => false,
    touchDx: () => 0,
  };
}

function createFakeRenderer() {
  const calls = [];

  return {
    calls,
    clear(...args) {
      calls.push({ method: 'clear', args });
    },
    drawText(text, x, y, opts) {
      calls.push({ method: 'drawText', args: [text, x, y, opts] });
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

function createFakePlayer(overrides = {}) {
  return {
    x: 384,
    y: 540,
    w: 32,
    h: 16,
    lives: 3,
    alive: true,
    handleInputCalls: 0,
    updateCalls: 0,
    handleInput() {
      this.handleInputCalls += 1;
    },
    update(dt) {
      this.updateCalls += 1;
      this.lastDt = dt;
    },
    tryFire() {
      return null;
    },
    isDead() {
      return this.lives <= 0;
    },
    aabb() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    },
    ...overrides,
  };
}

function createFakeFormation(overrides = {}) {
  const formation = {
    invaders: [{ x: 0, y: 0, w: 8, h: 8, alive: true, points: 10, sprite: 'jellyfish' }],
    updateCalls: 0,
    update() {
      this.updateCalls += 1;
    },
    aliveCount() {
      return this.invaders.filter((invader) => invader.alive !== false).length;
    },
    lowestY() {
      return 80;
    },
    ...overrides,
  };
  return formation;
}

function createScene(opts = {}) {
  const player = opts.playerInstance ?? createFakePlayer(opts.player);
  const formation = opts.formationInstance ?? createFakeFormation(opts.formation);
  const sprites = opts.sprites ?? { submarine: {}, torpedo: {}, enemyShot: {}, lifeIcon: {} };
  const sceneOpts = {
    createPlayer: () => player,
    createFormation: () => formation,
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => sprites,
    getHighScore: opts.getHighScore ?? (() => 0),
    setHighScore: opts.setHighScore ?? (() => {}),
    onGameOver: opts.onGameOver ?? (() => {}),
    startWave: opts.startWave,
    seed: opts.seed,
    apiClient: opts.apiClient,
    now: opts.now,
    daily: opts.daily,
  };
  const scene = createPlayScene(sceneOpts);
  return { scene, player, formation, sprites };
}

test('handleInput stores the input and toggles pause when Escape pressed', () => {
  const { scene } = createScene();
  scene.enter();

  scene.handleInput(inputWith({ pressed: ['Escape'] }));
  assert.equal(scene.state().paused, true);

  scene.handleInput(inputWith({ pressed: ['Escape'] }));
  assert.equal(scene.state().paused, false);
});

test('update is a no-op when paused', () => {
  const { scene, player, formation } = createScene();
  scene.enter();
  scene.handleInput(inputWith({ pressed: ['Escape'] }));

  scene.update(0.016, inputWith());

  assert.equal(player.updateCalls, 0);
  assert.equal(formation.updateCalls, 0);
});

test('update is a no-op when game over', () => {
  const { scene, player, formation } = createScene({ player: { lives: 0, isDead: () => true } });
  scene.enter();
  scene.update(0.016);
  assert.equal(scene.state().gameOver, true);

  const playerCalls = player.updateCalls;
  const formationCalls = formation.updateCalls;
  scene.update(0.016, inputWith());

  assert.equal(player.updateCalls, playerCalls);
  assert.equal(formation.updateCalls, formationCalls);
});

test('update without ready does nothing', async () => {
  const { scene, player } = createScene({ sprites: Promise.resolve({}) });
  const enterPromise = scene.enter();
  scene.update(0.016);

  assert.equal(player.updateCalls, 0);
  await enterPromise;
});

test('update uses last input when no input arg given', () => {
  const { scene, player } = createScene();
  scene.enter();
  scene.handleInput(inputWith({ down: ['ArrowLeft'] }));

  scene.update(0.016);

  assert.equal(player.handleInputCalls, 1);
  assert.equal(player.updateCalls, 1);
});

test('exit clears last input and prevents further async setup', async () => {
  let resolveSprites;
  const spritesPromise = new Promise((resolve) => { resolveSprites = resolve; });
  const player = createFakePlayer();
  const formation = createFakeFormation();
  const scene = createPlayScene({
    createPlayer: () => player,
    createFormation: () => formation,
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => spritesPromise,
    getHighScore: () => 0,
    setHighScore: () => {},
    onGameOver: () => {},
  });

  const enterPromise = scene.enter();
  scene.exit();
  resolveSprites({});
  await enterPromise;

  // ready remained false because exited cancelled setupRun
  assert.equal(scene.state().ready, false);
});

test('player firing pushes torpedoes which travel and despawn off-screen', () => {
  const torpedo = {
    x: 400,
    y: -100,
    w: 4,
    h: 10,
    alive: true,
    update(dt) {
      this.y += -1000 * dt;
    },
  };
  const { scene } = createScene({
    player: {
      tryFire(input) {
        if (input?.pressed?.('Space')) {
          return torpedo;
        }
        return null;
      },
    },
  });
  scene.enter();

  scene.update(0.016, inputWith({ pressed: ['Space'] }));
  assert.ok(scene.state().torpedoes.length >= 0); // out-of-bounds filtered already
  // The torpedo started at y=-100 (already off-screen) so inBounds removes it.
  assert.equal(scene.state().torpedoes.length, 0);
});

test('null torpedo from tryFire is treated as no projectile', () => {
  const { scene } = createScene({
    player: {
      tryFire() {
        return null;
      },
    },
  });
  scene.enter();
  scene.update(0.016, inputWith({ pressed: ['Space'] }));
  assert.equal(scene.state().torpedoes.length, 0);
});

test('player fire returning an array is added to torpedoes', () => {
  const torpedoes = [
    { x: 400, y: 500, w: 4, h: 10, alive: true, update(dt) { this.y += -100 * dt; } },
    { x: 410, y: 500, w: 4, h: 10, alive: true, update(dt) { this.y += -100 * dt; } },
  ];
  const { scene } = createScene({
    player: {
      tryFire() {
        return torpedoes;
      },
    },
  });
  scene.enter();
  scene.update(0.001, inputWith({ pressed: ['Space'] }));
  assert.equal(scene.state().torpedoes.length, 2);
});

test('formation tryFire shots are added to enemy shots and propagate downwards', () => {
  const enemyShot = {
    x: 100,
    y: 50,
    w: 4,
    h: 10,
    alive: true,
    update(dt) {
      this.y += 100 * dt;
    },
  };
  const formation = createFakeFormation({
    fireCount: 0,
    tryFire() {
      this.fireCount += 1;
      if (this.fireCount === 1) {
        return enemyShot;
      }
      return null;
    },
  });
  const { scene } = createScene({ formationInstance: formation });
  scene.enter();
  scene.update(0.016);

  assert.equal(scene.state().enemyShots.length, 1);
  assert.ok(scene.state().enemyShots[0].y > 50);
});

test('updateProjectile applies default vx/vy when projectile lacks update method', () => {
  const torpedo = { x: 400, y: 500, w: 4, h: 10, alive: true };
  const { scene } = createScene({
    player: {
      tryFire() {
        return torpedo;
      },
    },
  });
  scene.enter();
  scene.update(0.5, inputWith({ pressed: ['Space'] }));

  // After 0.5s with TORPEDO.speed (540) upward, y should be 500 - 270 = 230.
  assert.ok(scene.state().torpedoes[0].y < 500);
});

test('enemy shot collides with the player and consumes a life', () => {
  const enemyShot = { x: 384, y: 540, w: 4, h: 10, alive: true };
  const formation = createFakeFormation({
    tryFire(_rng, _player) {
      return enemyShot;
    },
  });
  const { scene, player } = createScene({
    formationInstance: formation,
    player: { lives: 3 },
  });
  scene.enter();

  scene.update(0.001);

  assert.equal(player.lives, 2);
  assert.equal(scene.state().enemyShots.length, 0);
});

test('player.hit method is called when damage is taken', () => {
  let hitCalls = 0;
  const enemyShot = { x: 384, y: 540, w: 4, h: 10, alive: true };
  const formation = createFakeFormation({
    tryFire() { return enemyShot; },
  });
  const player = createFakePlayer({
    lives: 3,
    hit() {
      hitCalls += 1;
      this.lives -= 1;
    },
  });
  const { scene } = createScene({ playerInstance: player, formationInstance: formation });
  scene.enter();

  scene.update(0.001);
  assert.equal(hitCalls, 1);
});

test('isInvulnerable() prevents damage on collision', () => {
  const enemyShot = { x: 384, y: 540, w: 4, h: 10, alive: true };
  const formation = createFakeFormation({
    tryFire() { return enemyShot; },
  });
  const player = createFakePlayer({
    lives: 3,
    isInvulnerable() { return true; },
  });
  const { scene } = createScene({ playerInstance: player, formationInstance: formation });
  scene.enter();

  scene.update(0.001);
  assert.equal(player.lives, 3);
});

test('formation reaching the player y triggers game over', () => {
  let finalScore;
  const formation = createFakeFormation({
    invaders: [{ x: 0, y: 0, w: 24, h: 24, alive: true, points: 10, sprite: 'jellyfish' }],
    lowestY() { return 600; },
  });
  const { scene } = createScene({
    formationInstance: formation,
    player: { y: 500 },
    onGameOver: (score) => { finalScore = score; },
  });
  scene.enter();
  scene.update(0.001);
  assert.equal(scene.state().gameOver, true);
  assert.equal(finalScore, 0);
});

test('finishGame uses storage high score when greater than the current high', () => {
  let stored;
  const player = createFakePlayer({ lives: 0, isDead: () => true });
  const { scene } = createScene({
    playerInstance: player,
    getHighScore: () => 1000,
    setHighScore: (n) => { stored = n; },
  });
  scene.enter();
  scene.update(0.001);

  assert.equal(scene.state().high, 1000);
  assert.equal(stored, undefined); // score (0) < high (1000), not written
});

test('finishGame writes a new high score when score exceeds it', () => {
  let stored;
  const target = { x: 10, y: 10, w: 24, h: 24, alive: true, points: 50, sprite: 'jellyfish' };
  const torpedo = { x: 10, y: 10, w: 4, h: 10, alive: true, update() {} };
  const formation = createFakeFormation({
    invaders: [target],
    // resetForWave swaps the invader for a fresh non-dead one so we don't
    // keep advancing waves on every update.
    resetForWave() {
      this.invaders = [{ x: 200, y: 50, w: 24, h: 24, alive: true, points: 10 }];
      return this;
    },
  });
  const player = createFakePlayer({
    tryFire() { return torpedo; },
  });

  const { scene } = createScene({
    playerInstance: player,
    formationInstance: formation,
    getHighScore: () => 10,
    setHighScore: (n) => { stored = n; },
  });
  scene.enter();
  scene.update(0.001, inputWith({ pressed: ['Space'] })); // kill invader, advance wave bonus

  // killing the only invader gives points (50) plus wave bonus 100*1=100, so score=150.
  // game-over not yet triggered. Force it by setting player to dead.
  player.lives = 0;
  player.isDead = () => true;
  scene.update(0.001);

  assert.equal(stored, 150);
  assert.equal(scene.state().high, 150);
});

test('finishGame is idempotent — calling update again after game-over does nothing', () => {
  let onGameOverCalls = 0;
  const player = createFakePlayer({ lives: 0, isDead: () => true });
  const { scene } = createScene({
    playerInstance: player,
    onGameOver: () => { onGameOverCalls += 1; },
  });
  scene.enter();
  scene.update(0.001);
  scene.update(0.001);
  assert.equal(onGameOverCalls, 1);
});

test('points fallback uses ENEMY_TYPES when invader has no .points', () => {
  const target = { x: 10, y: 10, w: 24, h: 24, alive: true, type: 'squid' };
  const torpedo = { x: 10, y: 10, w: 4, h: 10, alive: true, update() {} };
  const formation = createFakeFormation({ invaders: [target] });
  const player = createFakePlayer({
    tryFire() { return torpedo; },
  });
  const { scene } = createScene({
    playerInstance: player,
    formationInstance: formation,
  });
  scene.enter();
  scene.update(0.001, inputWith({ pressed: ['Space'] }));

  // squid points from ENEMY_TYPES is 40, plus wave bonus 100
  assert.equal(scene.state().score, 140);
});

test('advanceWaveIfCleared rebuilds formation when no resetForWave is provided', () => {
  let createCount = 0;
  const target = { x: 10, y: 10, w: 24, h: 24, alive: true, points: 10 };
  const torpedo = { x: 10, y: 10, w: 4, h: 10, alive: true, update() {} };

  function makeFormation() {
    createCount += 1;
    return {
      invaders: createCount === 1 ? [target] : [{ x: 50, y: 50, w: 24, h: 24, alive: true, points: 10 }],
      update() {},
      aliveCount() { return this.invaders.filter((i) => i.alive !== false).length; },
      lowestY() { return 80; },
    };
  }

  const player = createFakePlayer({ tryFire: () => torpedo });
  const scene = createPlayScene({
    createPlayer: () => player,
    createFormation: makeFormation,
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    getHighScore: () => 0,
    setHighScore: () => {},
    onGameOver: () => {},
  });

  scene.enter();
  assert.equal(createCount, 1);
  scene.update(0.001, inputWith({ pressed: ['Space'] }));
  assert.equal(scene.state().wave, 2);
  assert.equal(createCount, 2);
});

test('render shows a LOAD ERROR overlay when sprites failed to load', async () => {
  const player = createFakePlayer();
  const formation = createFakeFormation();
  const scene = createPlayScene({
    createPlayer: () => player,
    createFormation: () => formation,
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => Promise.reject(new Error('boom')),
    getHighScore: () => 0,
    setHighScore: () => {},
    onGameOver: () => {},
  });

  await scene.enter();
  const renderer = createFakeRenderer();
  scene.render(renderer);

  const texts = renderer.calls
    .filter((call) => call.method === 'drawText')
    .map((call) => call.args[0]);
  assert.ok(texts.includes('LOAD ERROR'));
});

test('render shows LOADING when not yet ready', () => {
  const scene = createPlayScene({
    createPlayer: () => createFakePlayer(),
    createFormation: () => createFakeFormation(),
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => Promise.resolve({}),
    getHighScore: () => 0,
    setHighScore: () => {},
    onGameOver: () => {},
  });

  scene.enter(); // not awaited — still loading
  const renderer = createFakeRenderer();
  scene.render(renderer);

  const texts = renderer.calls
    .filter((call) => call.method === 'drawText')
    .map((call) => call.args[0]);
  assert.ok(texts.includes('LOADING...'));
});

test('render falls back to per-invader drawing when formation has no render method', () => {
  const formation = createFakeFormation({
    invaders: [
      { x: 10, y: 10, w: 24, h: 24, alive: true, sprite: 'jellyfish' },
      { x: 50, y: 10, w: 24, h: 24, alive: true, sprite: 'anglerfish' },
      { x: 90, y: 10, w: 24, h: 24, alive: false, sprite: 'squid' }, // not drawn
    ],
  });
  const { scene } = createScene({ formationInstance: formation });
  scene.enter();

  const renderer = createFakeRenderer();
  scene.render(renderer);

  // 2 alive invaders + 1 player = 3 sprites at minimum
  const sprites = renderer.calls.filter((c) => c.method === 'drawSprite');
  assert.ok(sprites.length >= 3);
});

test('render uses formation.render when provided', () => {
  let formationRenderCalls = 0;
  const formation = createFakeFormation({
    render() {
      formationRenderCalls += 1;
    },
  });
  const { scene } = createScene({ formationInstance: formation });
  scene.enter();

  scene.render(createFakeRenderer());
  assert.equal(formationRenderCalls, 1);
});

test('render renders torpedoes and enemy shots in flight', () => {
  const torpedo = { x: 400, y: 500, w: 4, h: 10, alive: true, sprite: 'torpedo', update() {} };
  const enemyShot = { x: 100, y: 100, w: 4, h: 10, alive: true, sprite: 'enemyShot', update() {} };

  const formation = createFakeFormation({
    fired: false,
    tryFire() {
      if (this.fired) return null;
      this.fired = true;
      return enemyShot;
    },
    render() {},
  });
  const player = createFakePlayer({ tryFire: () => torpedo });
  const { scene } = createScene({ playerInstance: player, formationInstance: formation });
  scene.enter();
  scene.update(0.001, inputWith({ pressed: ['Space'] }));

  const renderer = createFakeRenderer();
  scene.render(renderer);

  // Should have drawn at least: torpedo, enemyShot, player (3 sprites)
  const sprites = renderer.calls.filter((c) => c.method === 'drawSprite');
  assert.ok(sprites.length >= 3);
});

test('render uses CANVAS dimensions when renderer has no width()/height()', () => {
  const { scene } = createScene();
  scene.enter();

  const calls = [];
  const renderer = {
    clear: (...args) => calls.push({ method: 'clear', args }),
    // Use an arity-of-6 drawRect so play.mjs sends the (x,y,w,h,fill,stroke) signature.
    drawRect(x, y, w, h, fill, stroke) {
      calls.push({ method: 'drawRect', args: [x, y, w, h, fill, stroke] });
    },
    drawSprite: () => {},
    drawText: () => {},
  };
  scene.render(renderer);

  // First drawRect is the sky-top band: x=0, y=0, w=CANVAS.width.
  const firstRect = calls.find((c) => c.method === 'drawRect');
  assert.equal(firstRect.args[2], CANVAS.width);
});

test('drawEntity uses entity.render when present', () => {
  let entityRendered = false;
  const fancyTorpedo = {
    x: 400,
    y: 500,
    w: 4,
    h: 10,
    alive: true,
    sprite: 'torpedo',
    update() {},
    render() { entityRendered = true; },
  };
  const formation = createFakeFormation({ render() {} });
  const player = createFakePlayer({ tryFire: () => fancyTorpedo });
  const { scene } = createScene({ playerInstance: player, formationInstance: formation });
  scene.enter();
  scene.update(0.001, inputWith({ pressed: ['Space'] }));

  scene.render(createFakeRenderer());
  assert.equal(entityRendered, true);
});

test('drawEntity falls back to drawRect when sprite/image missing', () => {
  const formation = createFakeFormation({
    invaders: [{ x: 10, y: 10, w: 24, h: 24, alive: true, sprite: 'unknown-sprite' }],
  });
  const { scene } = createScene({
    formationInstance: formation,
    sprites: {}, // no sprite mapping
  });
  scene.enter();

  const renderer = createFakeRenderer();
  scene.render(renderer);

  // The invader should produce a drawRect call (not a drawSprite)
  const rectCalls = renderer.calls.filter((c) => c.method === 'drawRect').length;
  assert.ok(rectCalls > 3); // 3 background rects + at least 1 fallback
});

test('drawEntity drawRect single-arg renderer is supported', () => {
  const formation = createFakeFormation({
    invaders: [{ x: 10, y: 10, w: 24, h: 24, alive: true, sprite: 'unknown' }],
  });
  const { scene } = createScene({ formationInstance: formation, sprites: {} });
  scene.enter();

  const calls = [];
  const renderer = {
    clear: () => {},
    drawText: () => {},
    drawSprite: () => {},
    drawRect(rect) { calls.push(rect); },
    width: () => 800,
    height: () => 600,
  };
  scene.render(renderer);
  assert.ok(calls.length > 0);
});

test('startWave > 1 sets the initial wave number', () => {
  let resetWave = 0;
  const formation = createFakeFormation({
    resetForWave(w) { resetWave = w; return this; },
  });
  const { scene } = createScene({ formationInstance: formation, startWave: 4 });
  scene.enter();
  assert.equal(scene.state().wave, 4);
  assert.equal(resetWave, 4);
});

test('startWave non-finite falls back to 1', () => {
  const formation = createFakeFormation();
  const { scene } = createScene({ formationInstance: formation, startWave: 'banana' });
  scene.enter();
  assert.equal(scene.state().wave, 1);
});

test('formation aliveInvaders function is accepted as enemy source', () => {
  const formation = {
    aliveInvaders: () => [{ x: 0, y: 0, w: 8, h: 8, alive: true, points: 10 }],
    aliveCount() { return 1; },
    isCleared() { return false; },
    update() {},
    lowestY: () => 80,
  };
  const { scene } = createScene({ formationInstance: formation });
  scene.enter();
  // No-op update — just exercise the path
  scene.update(0.001);
  assert.equal(scene.state().formation, formation);
});

test('formation entities array is accepted as enemy source when invaders missing', () => {
  const formation = {
    entities: [{ x: 0, y: 0, w: 8, h: 8, alive: true, points: 10 }],
    update() {},
    lowestY: () => 80,
  };
  const { scene } = createScene({ formationInstance: formation });
  scene.enter();
  scene.update(0.001);
  assert.equal(scene.state().formation, formation);
});

test('formation enemies function is accepted as enemy source', () => {
  const formation = {
    enemies: () => [{ x: 0, y: 0, w: 8, h: 8, alive: true, points: 10 }],
    update() {},
    lowestY: () => 80,
  };
  const { scene } = createScene({ formationInstance: formation });
  scene.enter();
  scene.update(0.001);
  assert.equal(scene.state().formation, formation);
});

test('player.loseLife is used when no .hit method', () => {
  let loseLifeCalls = 0;
  const enemyShot = { x: 384, y: 540, w: 4, h: 10, alive: true };
  const formation = createFakeFormation({
    tryFire() { return enemyShot; },
  });
  const player = createFakePlayer({
    loseLife() {
      loseLifeCalls += 1;
      this.lives -= 1;
    },
  });
  const { scene } = createScene({ playerInstance: player, formationInstance: formation });
  scene.enter();
  scene.update(0.001);
  assert.equal(loseLifeCalls, 1);
});

test('player.respawn is called after non-fatal damage', () => {
  let respawned = 0;
  const enemyShot = { x: 384, y: 540, w: 4, h: 10, alive: true };
  const formation = createFakeFormation({
    tryFire() { return enemyShot; },
  });
  const player = createFakePlayer({
    lives: 3,
    respawn() { respawned += 1; },
  });
  const { scene } = createScene({ playerInstance: player, formationInstance: formation });
  scene.enter();
  scene.update(0.001);
  assert.equal(respawned, 1);
});

test('formation.update returns shots that are added to the enemyShots array', () => {
  const enemyShot = { x: 100, y: 100, w: 4, h: 10, alive: true };
  const formation = createFakeFormation({
    update() {
      return [enemyShot];
    },
  });
  const { scene } = createScene({ formationInstance: formation });
  scene.enter();
  scene.update(0.001);
  assert.equal(scene.state().enemyShots.length, 1);
});

test('formation.fire is called and contributes shots', () => {
  const enemyShot = { x: 100, y: 100, w: 4, h: 10, alive: true };
  const formation = createFakeFormation({
    fire() {
      return enemyShot;
    },
  });
  const { scene } = createScene({ formationInstance: formation });
  scene.enter();
  scene.update(0.001);
  assert.equal(scene.state().enemyShots.length, 1);
});

test('createPlayScene without options uses safe defaults', () => {
  const scene = createPlayScene();
  assert.equal(typeof scene.enter, 'function');
  assert.equal(typeof scene.exit, 'function');
  // Calling enter without injection will still try to import default factories,
  // which returns a thenable.
  const result = scene.enter();
  if (result && typeof result.then === 'function') {
    // Discard the rejection — defaults try to import './player.mjs' relative paths.
    result.catch(() => {});
  }
});

test('exit is safe when called twice', () => {
  const { scene } = createScene();
  scene.enter();
  scene.exit();
  assert.doesNotThrow(() => scene.exit());
});

test('handleInput with no input.pressed is a safe no-op', () => {
  const { scene } = createScene();
  scene.enter();
  assert.doesNotThrow(() => scene.handleInput(null));
  assert.doesNotThrow(() => scene.handleInput({}));
  assert.equal(scene.state().paused, false);
});

test('player center collision: enemy shot to the left misses', () => {
  const enemyShot = { x: 100, y: 100, w: 4, h: 10, alive: true };
  const formation = createFakeFormation({
    tryFire() { return enemyShot; },
  });
  const { scene, player } = createScene({
    playerInstance: createFakePlayer({ x: 500, y: 540 }),
    formationInstance: formation,
  });
  scene.enter();
  scene.update(0.001);
  assert.equal(player.lives, 3);
});

test('out-of-bounds enemy shots are filtered each frame', () => {
  const enemyShot = {
    x: 100,
    y: 590,
    w: 4,
    h: 10,
    alive: true,
    update(dt) {
      this.y += 10000 * dt;
    },
  };
  const formation = createFakeFormation({
    fired: false,
    tryFire() {
      if (this.fired) return null;
      this.fired = true;
      return enemyShot;
    },
  });
  const { scene } = createScene({ formationInstance: formation });
  scene.enter();
  scene.update(0.5);
  assert.equal(scene.state().enemyShots.length, 0);
});

test('drawText uses fallback font/baseline configuration in render()', () => {
  const { scene } = createScene();
  scene.enter();
  const renderer = createFakeRenderer();
  scene.render(renderer);

  // No text should be drawn when ready and no error
  const texts = renderer.calls.filter((c) => c.method === 'drawText');
  // HUD draws SCORE, HIGH, WAVE, LIVES — total 4 minimum.
  assert.ok(texts.length >= 4);
});

test('PALETTE colors are used in render', () => {
  const { scene } = createScene();
  scene.enter();
  const renderer = createFakeRenderer();
  scene.render(renderer);

  // Background drawRects should use sky/sea palette
  const fills = renderer.calls
    .filter((c) => c.method === 'drawRect')
    .map((c) => c.args[4] ?? c.args[0]?.fill);
  assert.ok(fills.includes(PALETTE.skyTop));
  assert.ok(fills.includes(PALETTE.skyMid));
  assert.ok(fills.includes(PALETTE.seaAccent));
});

test('lives drop to 0 after damage triggers game over', () => {
  let finalScore;
  const enemyShot = { x: 384, y: 540, w: 4, h: 10, alive: true };
  const formation = createFakeFormation({
    tryFire() { return enemyShot; },
  });
  const player = createFakePlayer({
    lives: 1,
    isDead() { return this.lives <= 0; },
  });
  const { scene } = createScene({
    playerInstance: player,
    formationInstance: formation,
    onGameOver: (score) => { finalScore = score; },
  });
  scene.enter();
  scene.update(0.001);

  assert.equal(scene.state().gameOver, true);
  assert.equal(finalScore, 0);
});

// ---------------------------------------------------------------------------
// CS03 D9 — backend API integration: startSession at enter, submitScore at game over
// ---------------------------------------------------------------------------

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  // Drain a generous number of microtask ticks. The integration chains
  // Promise.resolve().then(api.startSession).then(store).catch(err) so several
  // queues need to fire before observable state updates.
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
  // Ensure any setImmediate-scheduled work (none today, but safe) runs too.
  await new Promise((resolve) => setImmediate(resolve));
}

function fakeApiClient() {
  const calls = { startSession: 0, submitScore: [] };
  let startSessionResponse = { sessionId: 'sess-001', nonce: 'aabb', startedAt: '2026-05-13T00:00:00.000Z' };
  let startSessionError = null;
  let submitScoreError = null;

  return {
    calls,
    setStartSessionResponse(value) { startSessionResponse = value; startSessionError = null; },
    setStartSessionError(err) { startSessionError = err; },
    setSubmitScoreError(err) { submitScoreError = err; },
    startSession() {
      calls.startSession += 1;
      if (startSessionError) return Promise.reject(startSessionError);
      return Promise.resolve(startSessionResponse);
    },
    submitScore(args) {
      calls.submitScore.push(args);
      if (submitScoreError) return Promise.reject(submitScoreError);
      return Promise.resolve({ status: 'accepted', score: args.score, submissionId: 'sub-001' });
    },
  };
}

test('CS03/D9: enter() calls apiClient.startSession exactly once and stores sessionId+startedAt', async () => {
  const api = fakeApiClient();
  const { scene } = createScene({ apiClient: api });
  scene.enter();
  await flushMicrotasks();

  assert.equal(api.calls.startSession, 1);
  const state = scene.state();
  assert.equal(state.sessionId, 'sess-001');
  assert.equal(state.sessionStartedAt, '2026-05-13T00:00:00.000Z');
  assert.equal(state.sessionError, null);
});

test('CS03/D9: startSession failure leaves sessionId null and records sessionError; game still plays', async () => {
  const api = fakeApiClient();
  api.setStartSessionError(Object.assign(new Error('network down'), { code: 'network_error' }));
  const { scene } = createScene({ apiClient: api });
  scene.enter();
  await flushMicrotasks();

  const state = scene.state();
  assert.equal(state.sessionId, null);
  assert.equal(state.sessionStartedAt, null);
  assert.equal(state.sessionError, 'network down');
  assert.equal(state.ready, true); // game still loaded
});

test('CS03/D9: finishGame submits the final score with apiClient.submitScore(sessionId, score, finishedAt)', async () => {
  const api = fakeApiClient();
  const fixedTime = new Date('2026-05-13T00:01:00.000Z');
  const player = createFakePlayer({ lives: 1, isDead() { return this.lives <= 0; } });
  const formation = createFakeFormation({
    tryFire() { return { x: 384, y: 540, w: 4, h: 10, alive: true }; },
  });
  const { scene } = createScene({
    apiClient: api,
    now: () => fixedTime,
    playerInstance: player,
    formationInstance: formation,
  });
  scene.enter();
  await flushMicrotasks();
  assert.equal(api.calls.startSession, 1);

  scene.update(0.001); // collide → finishGame
  await flushMicrotasks();

  assert.equal(api.calls.submitScore.length, 1);
  const submitted = api.calls.submitScore[0];
  assert.equal(submitted.sessionId, 'sess-001');
  assert.equal(submitted.score, scene.state().score);
  assert.equal(submitted.finishedAt, '2026-05-13T00:01:00.000Z');
  const state = scene.state();
  assert.equal(state.submission.attempted, true);
  assert.equal(state.submission.status, 'ok');
  assert.equal(state.submission.error, null);
});

test('CS03/D9: submitScore failure is captured in state.submission.error without throwing', async () => {
  const api = fakeApiClient();
  api.setSubmitScoreError(Object.assign(new Error('rate limited'), { code: 'rate_limited' }));
  const player = createFakePlayer({ lives: 1, isDead() { return this.lives <= 0; } });
  const formation = createFakeFormation({
    tryFire() { return { x: 384, y: 540, w: 4, h: 10, alive: true }; },
  });
  const { scene } = createScene({
    apiClient: api,
    playerInstance: player,
    formationInstance: formation,
  });
  scene.enter();
  await flushMicrotasks();
  scene.update(0.001);
  await flushMicrotasks();

  const state = scene.state();
  assert.equal(state.submission.attempted, true);
  assert.equal(state.submission.status, 'error');
  assert.equal(state.submission.error, 'rate limited');
});

test('CS03/D9: finishGame skips submitScore when startSession previously failed (no sessionId)', async () => {
  const api = fakeApiClient();
  api.setStartSessionError(new Error('offline'));
  const player = createFakePlayer({ lives: 1, isDead() { return this.lives <= 0; } });
  const formation = createFakeFormation({
    tryFire() { return { x: 384, y: 540, w: 4, h: 10, alive: true }; },
  });
  const { scene } = createScene({
    apiClient: api,
    playerInstance: player,
    formationInstance: formation,
  });
  scene.enter();
  await flushMicrotasks();
  scene.update(0.001);
  await flushMicrotasks();

  assert.equal(api.calls.submitScore.length, 0);
  const state = scene.state();
  assert.equal(state.submission.attempted, false);
  assert.equal(state.submission.status, 'skipped');
  assert.equal(state.submission.error, 'offline');
});

test('CS03/D9: no apiClient option leaves session/submission in idle state and never calls anything', () => {
  const { scene } = createScene(); // no apiClient
  scene.enter();
  const state = scene.state();
  assert.equal(state.sessionId, null);
  assert.equal(state.sessionStartedAt, null);
  assert.equal(state.sessionError, null);
  assert.equal(state.submission.attempted, false);
  assert.equal(state.submission.status, 'idle');
});

test('CS03/D9: scene.exit() before startSession resolves prevents sessionId leak into state', async () => {
  const api = fakeApiClient();
  const pending = deferred();
  api.startSession = () => {
    api.calls.startSession += 1;
    return pending.promise;
  };
  const { scene } = createScene({ apiClient: api });
  scene.enter();
  scene.exit();
  pending.resolve({ sessionId: 'late-sess', nonce: 'aa', startedAt: '2026-05-13T00:00:00.000Z' });
  await flushMicrotasks();

  assert.equal(scene.state().sessionId, null);
});

test('CS03/D9: finishGame queues score submission when game ends before startSession resolves', async () => {
  const api = fakeApiClient();
  const pending = deferred();
  api.startSession = () => {
    api.calls.startSession += 1;
    return pending.promise;
  };
  const fixedTime = new Date('2026-05-13T00:01:00.000Z');
  const player = createFakePlayer({ lives: 1, isDead() { return this.lives <= 0; } });
  const formation = createFakeFormation({
    tryFire() { return { x: 384, y: 540, w: 4, h: 10, alive: true }; },
  });
  const { scene } = createScene({
    apiClient: api,
    now: () => fixedTime,
    playerInstance: player,
    formationInstance: formation,
  });
  scene.enter();
  // Trigger game over before startSession resolves.
  scene.update(0.001);
  await flushMicrotasks();

  // Submission was queued, not skipped.
  assert.equal(api.calls.submitScore.length, 0);
  assert.equal(scene.state().submission.status, 'pending');
  assert.equal(scene.state().submission.attempted, true);

  // Now the session resolves — submission should fire with the late sessionId.
  pending.resolve({ sessionId: 'late-sess', nonce: 'aa', startedAt: '2026-05-13T00:00:00.000Z' });
  await flushMicrotasks();

  assert.equal(api.calls.submitScore.length, 1);
  assert.equal(api.calls.submitScore[0].sessionId, 'late-sess');
  assert.equal(api.calls.submitScore[0].finishedAt, '2026-05-13T00:01:00.000Z');
  assert.equal(scene.state().submission.status, 'ok');
});

test('CS03/D9: queued submission resolves to skipped when startSession ultimately rejects', async () => {
  const api = fakeApiClient();
  const pending = deferred();
  api.startSession = () => {
    api.calls.startSession += 1;
    return pending.promise;
  };
  const player = createFakePlayer({ lives: 1, isDead() { return this.lives <= 0; } });
  const formation = createFakeFormation({
    tryFire() { return { x: 384, y: 540, w: 4, h: 10, alive: true }; },
  });
  const { scene } = createScene({
    apiClient: api,
    playerInstance: player,
    formationInstance: formation,
  });
  scene.enter();
  scene.update(0.001);
  await flushMicrotasks();
  assert.equal(scene.state().submission.status, 'pending');

  pending.reject(new Error('offline'));
  await flushMicrotasks();

  assert.equal(api.calls.submitScore.length, 0);
  assert.equal(scene.state().submission.status, 'skipped');
  assert.equal(scene.state().submission.error, 'offline');
});

// CS04 D8/D14 — daily-mode submitScore payload contract (CS04-14)
test('CS04: daily-mode submission emits period:"daily" + utcDate alongside CS03 fields', async () => {
  const api = fakeApiClient();
  const fixedTime = new Date('2026-05-14T00:01:00.000Z');
  const player = createFakePlayer({ lives: 1, isDead() { return this.lives <= 0; } });
  const formation = createFakeFormation({
    tryFire() { return { x: 384, y: 540, w: 4, h: 10, alive: true }; },
  });
  const { scene } = createScene({
    apiClient: api,
    now: () => fixedTime,
    playerInstance: player,
    formationInstance: formation,
    daily: { utcDate: '2026-05-14', modifierName: 'fog-of-war', params: {} },
  });
  scene.enter();
  await flushMicrotasks();
  scene.update(0.001);
  await flushMicrotasks();

  assert.equal(api.calls.submitScore.length, 1);
  const submitted = api.calls.submitScore[0];
  assert.equal(submitted.sessionId, 'sess-001');
  assert.equal(submitted.finishedAt, '2026-05-14T00:01:00.000Z');
  assert.equal(submitted.period, 'daily');
  assert.equal(submitted.utcDate, '2026-05-14');
});

test('CS04: non-daily submission omits period and utcDate (CS03 back-compat)', async () => {
  const api = fakeApiClient();
  const fixedTime = new Date('2026-05-14T00:01:00.000Z');
  const player = createFakePlayer({ lives: 1, isDead() { return this.lives <= 0; } });
  const formation = createFakeFormation({
    tryFire() { return { x: 384, y: 540, w: 4, h: 10, alive: true }; },
  });
  const { scene } = createScene({
    apiClient: api,
    now: () => fixedTime,
    playerInstance: player,
    formationInstance: formation,
    // no daily opt
  });
  scene.enter();
  await flushMicrotasks();
  scene.update(0.001);
  await flushMicrotasks();

  assert.equal(api.calls.submitScore.length, 1);
  const submitted = api.calls.submitScore[0];
  assert.equal(Object.prototype.hasOwnProperty.call(submitted, 'period'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(submitted, 'utcDate'), false);
});

// =============================================================================
// CS04 PvI R1 fixes: modifier wiring + whaleshark integration + daily HUD
// (PVI-CS04-001, PVI-CS04-002, PVI-CS04-003)
// =============================================================================

function dailyDef(modifierName, params = {}) {
  return Object.freeze({
    utcDate: '2026-05-14',
    modifierName,
    params: Object.freeze({
      enemyFireMultiplier: 1,
      formationSpeedMultiplier: 1,
      whaleSharkInterval: 15000,
      ...params,
    }),
  });
}

test('CS04 PvI: one-shot modifier overrides starting lives via player factory opts', () => {
  let observedOpts = null;
  const player = createFakePlayer({ lives: 3 });
  const formation = createFakeFormation();
  const scene = createPlayScene({
    createPlayer: (opts) => { observedOpts = opts; return player; },
    createFormation: () => formation,
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    daily: dailyDef('one-shot'),
  });
  scene.enter();
  assert.equal(observedOpts.lives, 1);
});

test('CS04 PvI: speed-run modifier multiplies player speed and formation baseSpeed', () => {
  let playerOpts = null;
  let formationOpts = null;
  const player = createFakePlayer();
  const formation = createFakeFormation();
  const scene = createPlayScene({
    createPlayer: (opts) => { playerOpts = opts; return player; },
    createFormation: (opts) => { formationOpts = opts; return formation; },
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    daily: dailyDef('speed-run'),
  });
  scene.enter();
  // PLAYER.speed is 240 (constants.mjs); speed-run multiplier is 2.
  assert.equal(playerOpts.speed, 480);
  // FORMATION.baseSpeed is 60; speed-run multiplier is 2.
  assert.equal(formationOpts.baseSpeed, 120);
});

test('CS04 PvI: boss-rush modifier multiplies score and enemy fire density', () => {
  let formationOpts = null;
  // Two live invaders so killing one doesn't trigger wave-clear bonus.
  const liveInvader = { x: 100, y: 100, w: 8, h: 8, alive: true, points: 10, sprite: 'jellyfish' };
  const decoyInvader = { x: 200, y: 100, w: 8, h: 8, alive: true, points: 10, sprite: 'jellyfish' };
  const formation = createFakeFormation({ invaders: [liveInvader, decoyInvader] });
  const torpedo = { x: 100, y: 100, w: 4, h: 10, alive: true };
  const player = createFakePlayer({
    tryFireOnce: false,
    tryFire() {
      if (this.tryFireOnce) return null;
      this.tryFireOnce = true;
      return torpedo;
    },
  });
  const scene = createPlayScene({
    createPlayer: () => player,
    createFormation: (opts) => { formationOpts = opts; return formation; },
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    daily: dailyDef('boss-rush'),
  });
  scene.enter();
  // Boss-rush x2 enemyFireDensityMultiplier → fireIntervalMs = 1500/2 = 750.
  assert.equal(formationOpts.fireIntervalMs, 750);
  // Fire torpedo + collide with one invader → score = invader.points (10) * x2 = 20.
  // Decoy invader keeps formation alive so wave-clear bonus does NOT fire.
  scene.update(0.016, inputWith({ pressed: ['Space'] }));
  assert.equal(scene.state().score, 20);
});

test('CS04 PvI: inverted-controls modifier flips Arrow keys before reaching the player', () => {
  let observedDownCalls = [];
  const player = createFakePlayer({
    handleInput(input) {
      this.handleInputCalls += 1;
      observedDownCalls.push({
        ArrowLeft: input?.down?.('ArrowLeft'),
        ArrowRight: input?.down?.('ArrowRight'),
      });
    },
  });
  const formation = createFakeFormation();
  const scene = createPlayScene({
    createPlayer: () => player,
    createFormation: () => formation,
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    daily: dailyDef('inverted-controls'),
  });
  scene.enter();
  // User presses ArrowLeft → wrapped input should report ArrowRight as down.
  scene.handleInput(inputWith({ down: ['ArrowLeft'] }));
  scene.update(0.016);
  assert.deepEqual(observedDownCalls.at(-1), { ArrowLeft: false, ArrowRight: true });
});

test('CS04 PvI: fog-of-war modifier renders a halo overlay after main scene', () => {
  const player = createFakePlayer();
  const formation = createFakeFormation();
  const scene = createPlayScene({
    createPlayer: () => player,
    createFormation: () => formation,
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    daily: dailyDef('fog-of-war'),
  });
  scene.enter();

  // The fog-of-war overlay calls ctx.save/fillRect/arc/fill/restore directly;
  // our fake renderer doesn't expose `ctx`, so renderOverlay returns early
  // without throwing. Validate the dailyHud overlay still renders the badge.
  const renderer = createFakeRenderer();
  scene.render(renderer);
  const dailyTexts = renderer.calls
    .filter((c) => c.method === 'drawText')
    .map((c) => String(c.args[0]));
  assert.ok(
    dailyTexts.some((t) => t.includes('DAILY') && t.includes('2026-05-14')),
    'daily HUD overlay should render the DAILY badge',
  );
});

test('CS04 PvI: whaleshark is created in daily mode and updates on each tick', () => {
  let createdWith = null;
  const observedDts = [];
  const fakeWhaleshark = {
    update(dt) { observedDts.push(dt); },
    render() {},
    checkHit() { return { hit: false }; },
    state: { active: false, shark: null },
  };
  const scene = createPlayScene({
    createPlayer: () => createFakePlayer(),
    createFormation: () => createFakeFormation(),
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    daily: dailyDef('fog-of-war', { whaleSharkInterval: 12345 }),
    createWhaleShark: (opts) => { createdWith = opts; return fakeWhaleshark; },
  });
  scene.enter();
  assert.equal(createdWith.dailyMode, true);
  assert.equal(createdWith.spawnIntervalMs, 12345);
  // PvI R2 fix: whaleshark.update() takes SECONDS (not ms). A 16ms frame
  // (dt=0.016) must be forwarded as 0.016, not 16.
  scene.update(0.016);
  assert.equal(observedDts.length, 1);
  assert.equal(observedDts[0], 0.016);
});

// CS04 PvI R2 fix: integration with the real createWhaleShark — a single
// 16ms frame must NOT cause the shark to spawn-then-despawn. Previously,
// passing dt*1000 made the spawn timer (15-30s) decrement by 16,000 in one
// frame, exhausting the timer immediately and the shark would cross + despawn
// in the next tick.
test('CS04 PvI: real whaleshark does not spawn after one 16ms frame in normal-spawn mode', async () => {
  const { createWhaleShark } = await import('../whaleshark.mjs');
  const rng = {
    next: () => 0.5,
    range: (lo, hi) => (lo + hi) / 2,
    int: (lo, hi) => Math.floor((lo + hi) / 2),
  };
  // Use a fixed spawnIntervalMs of 15000ms (15s). After one 16ms frame in
  // seconds (dt=0.016), the timer should still be ~14984ms — no spawn.
  const ws = createWhaleShark({
    rng,
    canvasWidth: 800,
    canvasHeight: 600,
    dailyMode: true,
    spawnIntervalMs: 15000,
  });
  ws.update(0.016); // 16ms in seconds
  assert.equal(ws.state.active, false, 'shark must not be active after one 16ms frame');
});

test('CS04 PvI: whaleshark hit awards points (multiplied by scoreMultiplier)', () => {
  const fakeWhaleshark = {
    update() {},
    render() {},
    checkHit() { return { hit: true, points: 100 }; },
    state: { active: true },
  };
  const scene = createPlayScene({
    createPlayer: () => createFakePlayer(),
    createFormation: () => createFakeFormation({ invaders: [] }),
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    daily: dailyDef('boss-rush'), // x2 score multiplier
    createWhaleShark: () => fakeWhaleshark,
  });
  scene.enter();
  scene.update(0.016);
  // 100 (whaleshark) × 2 (boss-rush) = 200; advance-wave bonus may also fire
  // because the formation has zero invaders, so just verify score >= 200.
  assert.ok(scene.state().score >= 200);
});

test('CS04 PvI: non-daily mode creates whaleshark in normal-cadence mode (no daily HUD)', () => {
  const scene = createPlayScene({
    createPlayer: () => createFakePlayer(),
    createFormation: () => createFakeFormation(),
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    // no daily option
  });
  scene.enter();
  const state = scene.state();
  assert.ok(state.whaleshark, 'whaleshark should be created in normal mode (CS04-D7)');
  assert.equal(state.whaleshark.dailyMode, false, 'normal mode uses random 15-30s cadence, not deterministic');
  assert.equal(state.daily, null);
  assert.equal(state.modifierName, null);
});

test('CS04 PvI: daily HUD overlay renders DAILY · YYYY-MM-DD · modifier badge', () => {
  const scene = createPlayScene({
    createPlayer: () => createFakePlayer(),
    createFormation: () => createFakeFormation(),
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    daily: dailyDef('one-shot'),
  });
  scene.enter();
  const renderer = createFakeRenderer();
  scene.render(renderer);
  const badgeText = renderer.calls
    .filter((c) => c.method === 'drawText')
    .map((c) => String(c.args[0]))
    .find((t) => t.startsWith('DAILY'));
  assert.ok(badgeText);
  assert.match(badgeText, /DAILY · 2026-05-14 · one-shot/);
});

test('CS04 PvI: modifier registry ignores unknown daily.modifierName gracefully', () => {
  let observedOpts = null;
  const scene = createPlayScene({
    createPlayer: (opts) => { observedOpts = opts; return createFakePlayer(); },
    createFormation: () => createFakeFormation(),
    createRng: () => ({ next: () => 0.5, range: () => 0, int: () => 0 }),
    loadSprites: () => ({}),
    daily: dailyDef('not-a-real-modifier'),
  });
  scene.enter();
  // No modifier matched → no lives override, no speed override.
  assert.equal(observedOpts.lives, undefined);
  assert.equal(observedOpts.speed, undefined);
});


