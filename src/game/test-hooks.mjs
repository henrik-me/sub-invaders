const HOOK_NAME = '__subInvaders';

function locationUrl(locationLike) {
  const href = typeof locationLike === 'string' ? locationLike : locationLike?.href;

  try {
    return new URL(href ?? 'about:blank', 'http://localhost/');
  } catch {
    return new URL('about:blank');
  }
}

function shouldInstall(locationLike) {
  return locationUrl(locationLike ?? globalThis.location).searchParams.get('test') === '1';
}

function sceneState(scene) {
  return typeof scene?.state === 'function' ? scene.state() : undefined;
}

function currentScene(deps) {
  return deps.scenes?.current?.();
}

function currentState(deps) {
  return sceneState(currentScene(deps));
}

function sceneName(state) {
  if (state && Number.isFinite(Number(state.wave))) {
    return 'play';
  }

  if (state && Number.isFinite(Number(state.score)) && Number.isFinite(Number(state.high))) {
    return 'game-over';
  }

  return 'menu';
}

function getEnemies(formation) {
  if (Array.isArray(formation?.enemies)) {
    return formation.enemies;
  }

  if (typeof formation?.enemies === 'function') {
    return formation.enemies();
  }

  if (Array.isArray(formation?.invaders)) {
    return formation.invaders;
  }

  if (typeof formation?.invaders === 'function') {
    return formation.invaders();
  }

  if (typeof formation?.aliveInvaders === 'function') {
    return formation.aliveInvaders();
  }

  if (Array.isArray(formation?.entities)) {
    return formation.entities;
  }

  return [];
}

function entityBox(entity) {
  if (typeof entity?.aabb === 'function') {
    return entity.aabb();
  }

  return {
    x: entity?.x ?? 0,
    y: entity?.y ?? 0,
    w: entity?.w ?? 0,
    h: entity?.h ?? 0,
  };
}

function enemySnapshot(enemy, index) {
  const box = entityBox(enemy);

  return {
    index,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    type: enemy?.type ?? enemy?.kind ?? enemy?.sprite ?? 'unknown',
    row: enemy?.row,
    col: enemy?.col,
    alive: enemy?.alive !== false,
  };
}

function playerSnapshot(player, lives = player?.lives ?? 0) {
  const box = entityBox(player);

  return {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    lives: Math.max(0, Math.floor(Number(lives) || 0)),
  };
}

function requirePlayState(deps, action) {
  const state = currentState(deps);

  if (!state?.player || !state?.formation) {
    throw new Error(`${HOOK_NAME}.${action} requires the play scene`);
  }

  return state;
}

function setAlive(entity, alive) {
  if (!entity) {
    return;
  }

  if (!alive && typeof entity.kill === 'function') {
    entity.kill();
    return;
  }

  entity.alive = Boolean(alive);
}

function keyForCode(code) {
  if (code === 'Space') {
    return ' ';
  }

  if (code.startsWith('Key') && code.length === 4) {
    return code.at(-1).toLowerCase();
  }

  return code;
}

function dispatchKeyboardEvent(deps, type, code) {
  const win = deps.window ?? globalThis.window;
  const doc = deps.document ?? win?.document ?? globalThis.document;
  const eventInit = { code, key: keyForCode(code), bubbles: true, cancelable: true };
  const targets = [doc, win].filter(Boolean);

  for (const target of [...new Set(targets)]) {
    const EventCtor = win?.KeyboardEvent ?? globalThis.KeyboardEvent;
    const event = typeof EventCtor === 'function'
      ? new EventCtor(type, eventInit)
      : { type, ...eventInit };
    target.dispatchEvent?.(event);
  }
}

export function installTestHooks(deps = {}) {
  if (!shouldInstall(deps.location)) {
    return undefined;
  }

  const win = deps.window ?? globalThis.window;

  if (!win) {
    throw new Error('installTestHooks requires a window when ?test=1 is present');
  }

  const api = Object.freeze({
    state() {
      const state = currentState(deps) ?? {};
      const playScene = sceneName(state) === 'play';
      const gameOver = Boolean(state.gameOver) || sceneName(state) === 'game-over';
      const high = Number(state.high ?? deps.getHighScore?.() ?? 0) || 0;
      const lives = Number(state.lives ?? state.player?.lives ?? 0) || 0;

      return {
        scene: sceneName(state),
        score: Math.max(0, Math.floor(Number(state.score) || 0)),
        high: Math.max(0, Math.floor(high)),
        lives: Math.max(0, Math.floor(lives)),
        wave: Math.max(1, Math.floor(Number(state.wave) || 1)),
        alive: playScene && lives > 0 && state.player?.alive !== false,
        ready: !playScene || state.ready === true,
        paused: Boolean(state.paused),
        gameOver,
      };
    },

    formation() {
      const state = currentState(deps);
      return getEnemies(state?.formation).map(enemySnapshot);
    },

    player() {
      const state = currentState(deps);
      return playerSnapshot(state?.player, state?.lives);
    },

    pressKey(code) {
      dispatchKeyboardEvent(deps, 'keydown', code);
    },

    releaseKey(code) {
      dispatchKeyboardEvent(deps, 'keyup', code);
    },

    setSeed(n) {
      deps.setSeed?.(n);
    },

    killAllInvaders() {
      const state = requirePlayState(deps, 'killAllInvaders');
      for (const enemy of getEnemies(state.formation)) {
        setAlive(enemy, false);
      }
    },

    setLives(n) {
      const state = requirePlayState(deps, 'setLives');
      state.player.lives = Math.max(0, Math.floor(Number(n) || 0));
    },

    setHighScore(n) {
      deps.setHighScore?.(n);
    },

    forceGameOver(score) {
      deps.showGameOver?.(score ?? currentState(deps)?.score ?? 0);
    },
  });

  win[HOOK_NAME] = api;
  return api;
}