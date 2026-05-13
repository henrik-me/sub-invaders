import { groupCollisions } from '../../engine/collision.mjs';
import { createRng as defaultCreateRng } from '../../engine/seed.mjs';
import {
  CANVAS,
  ENEMY_SHOT,
  ENEMY_TYPES,
  FORMATION,
  PALETTE,
  PLAYER,
  SCORING,
  SPRITES,
  TORPEDO,
} from '../constants.mjs';
import { createHud } from '../hud.mjs';

const noop = () => {};
const isThenable = (value) => value && typeof value.then === 'function';
const asScore = (value) => Math.max(0, Math.floor(Number(value) || 0));
const asStartWave = (value) => {
  const wave = Number(value);
  return Number.isFinite(wave) && wave >= 1 ? Math.floor(wave) : 1;
};
const isAlive = (entity) => entity?.alive !== false;

let defaultPlayerFactoryPromise;
let defaultFormationFactoryPromise;

function defaultPlayerFactory() {
  defaultPlayerFactoryPromise ??= import('../player.mjs').then((module) => {
    if (typeof module.createPlayer !== 'function') {
      throw new TypeError('player.mjs must export createPlayer');
    }

    return module.createPlayer;
  });

  return defaultPlayerFactoryPromise;
}

function defaultFormationFactory() {
  defaultFormationFactoryPromise ??= import('../invaders.mjs').then((module) => {
    if (typeof module.createFormation !== 'function') {
      throw new TypeError('invaders.mjs must export createFormation');
    }

    return module.createFormation;
  });

  return defaultFormationFactoryPromise;
}

function callMaybe(fn, receiver, args = []) {
  return typeof fn === 'function' ? fn.apply(receiver, args) : undefined;
}

function aabbOf(entity) {
  if (typeof entity?.aabb === 'function') {
    return entity.aabb();
  }

  const frame = SPRITES[entity?.sprite] ?? SPRITES.submarine;

  return {
    x: entity?.x ?? 0,
    y: entity?.y ?? 0,
    w: entity?.w ?? frame.w,
    h: entity?.h ?? frame.h,
  };
}

function entityX(entity) {
  return aabbOf(entity).x;
}

function entityY(entity) {
  return aabbOf(entity).y;
}

function entityW(entity, frame) {
  return aabbOf(entity).w ?? frame.w;
}

function entityH(entity, frame) {
  return aabbOf(entity).h ?? frame.h;
}

function kill(entity) {
  if (typeof entity?.kill === 'function') {
    entity.kill();
    return;
  }

  if (entity) {
    entity.alive = false;
  }
}

function projectileList(value) {
  if (value == null || value === false) {
    return [];
  }

  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function addProjectiles(target, value) {
  for (const projectile of projectileList(value)) {
    target.push(projectile);
  }
}

function updateProjectile(projectile, dt, defaultVy) {
  if (typeof projectile?.update === 'function') {
    projectile.update(dt);
    return;
  }

  if (projectile) {
    projectile.x = (projectile.x ?? 0) + (projectile.vx ?? 0) * dt;
    projectile.y = (projectile.y ?? 0) + (projectile.vy ?? defaultVy) * dt;
  }
}

function inBounds(projectile) {
  const box = aabbOf(projectile);
  return isAlive(projectile)
    && box.y + box.h >= 0
    && box.y <= CANVAS.height
    && box.x + box.w >= 0
    && box.x <= CANVAS.width;
}

function drawRect(renderer, rect) {
  if (typeof renderer?.drawRect !== 'function') {
    return;
  }

  if (renderer.drawRect.length <= 1) {
    renderer.drawRect(rect);
    return;
  }

  renderer.drawRect(rect.x, rect.y, rect.w, rect.h, rect.fill, rect.stroke);
}

function frameFor(sprites, key) {
  const candidate = sprites?.[key];
  return candidate && Number.isFinite(candidate.x) ? candidate : SPRITES[key];
}

function imageFor(sprites, key) {
  return sprites?.[key]?.image ?? sprites?.image ?? sprites?.[key];
}

function drawEntity(renderer, sprites, entity, fallbackKey, fallbackFill) {
  if (!isAlive(entity)) {
    return;
  }

  if (typeof entity?.render === 'function') {
    entity.render(renderer, sprites);
    return;
  }

  const key = entity?.sprite ?? fallbackKey;
  const frame = frameFor(sprites, key) ?? SPRITES[fallbackKey];
  const x = entityX(entity);
  const y = entityY(entity);
  const w = entityW(entity, frame);
  const h = entityH(entity, frame);
  const image = imageFor(sprites, key);

  if (image && typeof renderer?.drawSprite === 'function') {
    renderer.drawSprite(image, frame.x, frame.y, frame.w, frame.h, x, y, w, h);
    return;
  }

  drawRect(renderer, { x, y, w, h, fill: fallbackFill });
}

function playerLives(player) {
  const value = callMaybe(player?.getLives, player) ?? player?.lives;
  return Math.max(0, Math.floor(Number(value) || 0));
}

function playerIsDead(player) {
  if (typeof player?.isDead === 'function') {
    return Boolean(player.isDead());
  }

  return playerLives(player) <= 0;
}

function playerIsInvulnerable(player) {
  if (typeof player?.isInvulnerable === 'function') {
    return Boolean(player.isInvulnerable());
  }

  return Boolean(player?.invulnerable);
}

function damagePlayer(player) {
  if (!player || playerIsInvulnerable(player)) {
    return;
  }

  if (typeof player.hit === 'function') {
    player.hit();
  } else if (typeof player.loseLife === 'function') {
    player.loseLife();
  } else {
    player.lives = Math.max(0, playerLives(player) - 1);
  }

  if (!playerIsDead(player)) {
    callMaybe(player.respawn, player, [CANVAS, PLAYER]);
  }
}

function formationInvaders(formation) {
  if (typeof formation?.invaders === 'function') {
    return formation.invaders();
  }

  if (typeof formation?.aliveInvaders === 'function') {
    return formation.aliveInvaders();
  }

  if (Array.isArray(formation?.invaders)) {
    return formation.invaders;
  }

  if (Array.isArray(formation?.entities)) {
    return formation.entities;
  }

  if (Array.isArray(formation?.enemies)) {
    return formation.enemies;
  }

  if (typeof formation?.enemies === 'function') {
    return formation.enemies();
  }

  return [];
}

function formationAliveCount(formation) {
  if (typeof formation?.aliveCount === 'function') {
    return formation.aliveCount();
  }

  return formationInvaders(formation).filter(isAlive).length;
}

function formationCleared(formation) {
  if (typeof formation?.isCleared === 'function') {
    return Boolean(formation.isCleared());
  }

  const invaders = formationInvaders(formation);
  return invaders.length > 0 && formationAliveCount(formation) === 0;
}

function formationLowestY(formation) {
  if (typeof formation?.lowestY === 'function') {
    return formation.lowestY();
  }

  return formationInvaders(formation).filter(isAlive).reduce((lowest, invader) => {
    const box = aabbOf(invader);
    return Math.max(lowest, box.y + box.h);
  }, 0);
}

function invaderPoints(invader) {
  const typeKey = invader?.type ?? invader?.kind ?? invader?.sprite;
  const typeConfig = typeof typeKey === 'string' ? ENEMY_TYPES[typeKey] : typeKey;
  return asScore(invader?.points ?? typeConfig?.points);
}

function fireRequested(input) {
  if (!input) {
    return true;
  }

  return Boolean(
    input.pressed?.('Space')
    || input.pressed?.('KeyW')
    || input.pressed?.('ArrowUp')
    || input.down?.('Space')
    || input.down?.('KeyW')
    || input.down?.('ArrowUp'),
  );
}

function resolveOrReject(valueFactory) {
  try {
    return valueFactory();
  } catch (error) {
    return Promise.reject(error);
  }
}

export function createPlayScene(opts = {}) {
  const getHighScore = opts.getHighScore ?? (() => 0);
  const setHighScore = opts.setHighScore ?? noop;
  const onGameOver = opts.onGameOver ?? noop;
  const loadSprites = opts.loadSprites ?? (() => ({}));
  const startWave = asStartWave(opts.startWave);
  const hud = createHud(opts.hud ?? {});
  const apiClient = opts.apiClient ?? null;
  const now = typeof opts.now === 'function' ? opts.now : () => new Date();

  let player;
  let formation;
  let rng;
  let sprites = {};
  let torpedoes = [];
  let enemyShots = [];
  let score = 0;
  let high = 0;
  let wave = 1;
  let ready = false;
  let paused = false;
  let gameOver = false;
  let exited = false;
  let loadError;
  let lastInput;
  let setupPromise;
  let createFormationFactory;
  let sessionId = null;
  let sessionStartedAt = null;
  let sessionError = null;
  let submission = { attempted: false, status: 'idle', error: null };
  let pendingSessionPromise = null;
  let pendingSubmissionPromise = null;

  function playerOptions() {
    return {
      canvas: CANVAS,
      config: PLAYER,
      player: PLAYER,
      torpedo: TORPEDO,
      palette: PALETTE,
      sprites: SPRITES,
    };
  }

  function formationOptions() {
    return {
      canvas: CANVAS,
      config: FORMATION,
      formation: FORMATION,
      enemyShot: ENEMY_SHOT,
      enemyTypes: opts.enemyTypes ?? ENEMY_TYPES,
      sprites: SPRITES,
      wave,
      rng,
    };
  }

  function updateHud() {
    hud
      .setScore(score)
      .setHigh(high)
      .setLives(playerLives(player))
      .setWave(wave);
  }

  function resetState() {
    player = undefined;
    formation = undefined;
    rng = undefined;
    sprites = {};
    torpedoes = [];
    enemyShots = [];
    score = 0;
    high = asScore(getHighScore());
    wave = startWave;
    ready = false;
    paused = false;
    gameOver = false;
    loadError = undefined;
    lastInput = undefined;
    setupPromise = undefined;
    sessionId = null;
    sessionStartedAt = null;
    sessionError = null;
    submission = { attempted: false, status: 'idle', error: null };
    pendingSessionPromise = null;
    pendingSubmissionPromise = null;
    updateHud();
  }

  function startSession() {
    if (!apiClient || typeof apiClient.startSession !== 'function') {
      return null;
    }
    pendingSessionPromise = Promise.resolve()
      .then(() => apiClient.startSession())
      .then((result) => {
        if (exited) {
          return;
        }
        sessionId = typeof result?.sessionId === 'string' ? result.sessionId : null;
        sessionStartedAt = typeof result?.startedAt === 'string' ? result.startedAt : null;
        sessionError = null;
      })
      .catch((err) => {
        sessionId = null;
        sessionStartedAt = null;
        sessionError = err?.message ?? String(err);
      });
    return pendingSessionPromise;
  }

  function performSubmit(sid, finalScore, finishedAt) {
    submission = { attempted: true, status: 'pending', error: null };
    pendingSubmissionPromise = Promise.resolve()
      .then(() => apiClient.submitScore({ sessionId: sid, score: finalScore, finishedAt }))
      .then(() => {
        submission = { attempted: true, status: 'ok', error: null };
      })
      .catch((err) => {
        submission = { attempted: true, status: 'error', error: err?.message ?? String(err) };
      });
    return pendingSubmissionPromise;
  }

  function submitScore() {
    if (!apiClient || typeof apiClient.submitScore !== 'function') {
      return null;
    }
    const finishedAt = now().toISOString();
    const finalScore = score;

    if (sessionId) {
      return performSubmit(sessionId, finalScore, finishedAt);
    }

    // Race: game over fired before startSession resolved. Queue the
    // submission behind the pending session so we don't drop the score.
    if (pendingSessionPromise) {
      submission = { attempted: true, status: 'pending', error: null };
      pendingSubmissionPromise = pendingSessionPromise.then(() => {
        if (exited) return null;
        if (sessionId) {
          return performSubmit(sessionId, finalScore, finishedAt);
        }
        submission = { attempted: false, status: 'skipped', error: sessionError };
        return null;
      });
      return pendingSubmissionPromise;
    }

    submission = { attempted: false, status: 'skipped', error: sessionError };
    return null;
  }

  function finishGame() {
    if (gameOver) {
      return;
    }

    gameOver = true;
    const storedHigh = asScore(getHighScore());
    high = Math.max(high, storedHigh);

    if (score > high) {
      high = score;
      setHighScore(score);
    }

    updateHud();
    submitScore();
    onGameOver(score);
  }

  function setupRun(playerFactory, formationFactory, rngFactory, loadedSprites) {
    if (exited) {
      return;
    }

    rng = rngFactory(opts.seed ?? 1);
    createFormationFactory = formationFactory;
    player = playerFactory(playerOptions());
    formation = formationFactory(formationOptions());
    if (wave > 1) {
      const resetResult = callMaybe(formation?.resetForWave, formation, [wave]);
      if (resetResult) {
        formation = resetResult;
      }
    }
    sprites = loadedSprites ?? {};
    ready = true;
    updateHud();
  }

  function resolveResources() {
    const playerFactory = opts.createPlayer ?? defaultPlayerFactory();
    const formationFactory = opts.createFormation ?? defaultFormationFactory();
    const rngFactory = opts.createRng ?? defaultCreateRng;
    const spritesValue = resolveOrReject(loadSprites);
    const values = [playerFactory, formationFactory, rngFactory, spritesValue];

    if (values.some(isThenable)) {
      setupPromise = Promise.all(values)
        .then(([resolvedPlayerFactory, resolvedFormationFactory, resolvedRngFactory, loadedSprites]) => {
          setupRun(resolvedPlayerFactory, resolvedFormationFactory, resolvedRngFactory, loadedSprites);
        })
        .catch((error) => {
          loadError = error;
          ready = false;
        });
      return setupPromise;
    }

    setupRun(playerFactory, formationFactory, rngFactory, spritesValue);
    return undefined;
  }

  function updatePlayer(dt, input) {
    callMaybe(player?.handleInput, player, [input]);
    callMaybe(player?.update, player, [dt, input, CANVAS, PLAYER]);

    if (fireRequested(input)) {
      addProjectiles(torpedoes, callMaybe(player?.tryFire, player, [input, {
        canvas: CANVAS,
        player: PLAYER,
        torpedo: TORPEDO,
      }]));
    }
  }

  function updateFormation(dt) {
    addProjectiles(enemyShots, callMaybe(formation?.update, formation, [dt, {
      canvas: CANVAS,
      formation: FORMATION,
      enemyShot: ENEMY_SHOT,
      rng,
      player,
      wave,
    }]));
    // Issue #35: previously passed `player` as accumulatorState, which made
    // consumeFireCadence enter the object branch and short-circuit to false
    // (player has no nowMs/dtMs/dt/elapsedMs fields), so enemies never fired
    // in production. Drop player + the unused options object so the formation
    // uses its internal fireAccumulatorMs (incremented by formation.update).
    addProjectiles(enemyShots, callMaybe(formation?.tryFire, formation, [rng]));
    addProjectiles(enemyShots, callMaybe(formation?.fire, formation, [rng, player, wave]));
  }

  function updateProjectiles(dt) {
    for (const torpedo of torpedoes) {
      updateProjectile(torpedo, dt, -TORPEDO.speed);
    }

    for (const enemyShot of enemyShots) {
      updateProjectile(enemyShot, dt, ENEMY_SHOT.speed);
    }

    torpedoes = torpedoes.filter(inBounds);
    enemyShots = enemyShots.filter(inBounds);
  }

  function handleTorpedoCollisions() {
    const invaders = formationInvaders(formation);
    const collisions = groupCollisions(torpedoes, invaders, { aabbOf });

    for (const { a: torpedo, b: invader } of collisions) {
      if (!isAlive(torpedo) || !isAlive(invader)) {
        continue;
      }

      kill(torpedo);
      kill(invader);
      score += invaderPoints(invader);
    }

    torpedoes = torpedoes.filter(isAlive);
  }

  function handlePlayerCollisions() {
    const playerGroup = player ? [player] : [];
    const collisions = groupCollisions(enemyShots, playerGroup, { aabbOf });

    for (const { a: enemyShot } of collisions) {
      if (!isAlive(enemyShot)) {
        continue;
      }

      kill(enemyShot);
      damagePlayer(player);
    }

    enemyShots = enemyShots.filter(isAlive);
  }

  function advanceWaveIfCleared() {
    if (!formationCleared(formation)) {
      return;
    }

    score += SCORING.waveBonusMultiplier * wave;
    wave += 1;
    torpedoes = [];
    enemyShots = [];

    const resetResult = callMaybe(formation?.resetForWave, formation, [wave]);
    if (resetResult) {
      formation = resetResult;
    } else if (formationAliveCount(formation) === 0 && createFormationFactory) {
      formation = createFormationFactory(formationOptions());
    }
  }

  const scene = {
    enter() {
      exited = false;
      resetState();
      startSession();
      return resolveResources();
    },

    exit() {
      exited = true;
      lastInput = undefined;
    },

    handleInput(input) {
      lastInput = input;

      if (input?.pressed?.('Escape')) {
        paused = !paused;
      }
    },

    update(dt, input = lastInput) {
      if (!ready || paused || gameOver) {
        return;
      }

      updatePlayer(dt, input);
      updateFormation(dt);
      updateProjectiles(dt);
      handleTorpedoCollisions();
      handlePlayerCollisions();
      advanceWaveIfCleared();

      if (playerIsDead(player)) {
        finishGame();
      } else if (formationLowestY(formation) >= entityY(player)) {
        finishGame();
      }

      updateHud();
    },

    render(renderer) {
      const width = typeof renderer?.width === 'function' ? renderer.width() : CANVAS.width;
      const height = typeof renderer?.height === 'function' ? renderer.height() : CANVAS.height;

      renderer.clear?.(PALETTE.skyTop);
      drawRect(renderer, { x: 0, y: 0, w: width, h: Math.floor(height * 0.45), fill: PALETTE.skyTop });
      drawRect(renderer, { x: 0, y: Math.floor(height * 0.45), w: width, h: Math.floor(height * 0.35), fill: PALETTE.skyMid });
      drawRect(renderer, { x: 0, y: Math.floor(height * 0.8), w: width, h: Math.ceil(height * 0.2), fill: PALETTE.seaAccent });

      if (loadError) {
        renderer.drawText('LOAD ERROR', width / 2, height / 2, {
          font: '18px monospace',
          fill: PALETTE.enemyShot,
          align: 'center',
          baseline: 'middle',
        });
        return;
      }

      if (!ready) {
        renderer.drawText('LOADING...', width / 2, height / 2, {
          font: '18px monospace',
          fill: PALETTE.ui,
          align: 'center',
          baseline: 'middle',
        });
        return;
      }

      if (typeof formation?.render === 'function') {
        formation.render(renderer, sprites);
      } else {
        for (const invader of formationInvaders(formation)) {
          drawEntity(renderer, sprites, invader, invader?.sprite ?? 'jellyfish', PALETTE.ui);
        }
      }

      for (const torpedo of torpedoes) {
        drawEntity(renderer, sprites, torpedo, 'torpedo', PALETTE.shot);
      }

      for (const enemyShot of enemyShots) {
        drawEntity(renderer, sprites, enemyShot, 'enemyShot', PALETTE.enemyShot);
      }

      drawEntity(renderer, sprites, player, 'submarine', PALETTE.player);
      updateHud();
      hud.render(renderer, sprites);
    },

    state() {
      return {
        score,
        high,
        lives: playerLives(player),
        wave,
        ready,
        paused,
        gameOver,
        player,
        formation,
        torpedoes,
        enemyShots,
        sessionId,
        sessionStartedAt,
        sessionError,
        submission: { ...submission },
      };
    },
  };

  return scene;
}
