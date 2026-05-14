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
  if (state && (state.phase === 'loading' || state.phase === 'ready' || state.phase === 'error')
      && Array.isArray(state.entries)) {
    return 'leaderboard';
  }

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

function projectileSnapshot(projectile, index) {
  const box = entityBox(projectile);

  return {
    index,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    alive: projectile?.alive !== false,
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
      const scene = sceneName(state);
      const playScene = scene === 'play';
      const leaderboardScene = scene === 'leaderboard';
      const gameOver = Boolean(state.gameOver) || scene === 'game-over';
      const liveHigh = Number(deps.getHighScore?.() ?? NaN);
      const fallbackHigh = Number(state.high ?? 0) || 0;
      const high = Number.isFinite(liveHigh) ? liveHigh : fallbackHigh;
      const lives = Number(state.lives ?? state.player?.lives ?? 0) || 0;
      const enemyShotsCount = Array.isArray(state.enemyShots) ? state.enemyShots.length : 0;
      const torpedoesCount = Array.isArray(state.torpedoes) ? state.torpedoes.length : 0;
      const entriesCount = leaderboardScene && Array.isArray(state.entries) ? state.entries.length : 0;
      const submission = (playScene || gameOver) && state.submission
        ? {
            attempted: Boolean(state.submission.attempted),
            status: typeof state.submission.status === 'string' ? state.submission.status : 'idle',
            error: state.submission.error ?? null,
          }
        : null;

      return {
        scene,
        score: Math.max(0, Math.floor(Number(state.score) || 0)),
        high: Math.max(0, Math.floor(high)),
        lives: Math.max(0, Math.floor(lives)),
        wave: Math.max(1, Math.floor(Number(state.wave) || 1)),
        alive: playScene && lives > 0 && state.player?.alive !== false,
        ready: !playScene || state.ready === true,
        paused: Boolean(state.paused),
        gameOver,
        enemyShots: enemyShotsCount,
        torpedoes: torpedoesCount,
        phase: leaderboardScene ? state.phase : undefined,
        entriesCount: leaderboardScene ? entriesCount : undefined,
        leaderboardError: leaderboardScene ? state.error ?? null : undefined,
        submission,
      };
    },

    entries() {
      const state = currentState(deps);
      if (!Array.isArray(state?.entries)) {
        return [];
      }
      return state.entries.map((entry) => ({
        rank: Number(entry?.rank ?? 0) || 0,
        score: Number(entry?.score ?? 0) || 0,
        finishedAt: typeof entry?.finishedAt === 'string' ? entry.finishedAt : null,
      }));
    },

    formation() {
      const state = currentState(deps);
      return getEnemies(state?.formation).map(enemySnapshot);
    },

    enemyShots() {
      const state = currentState(deps);
      return Array.isArray(state?.enemyShots) ? state.enemyShots.map(projectileSnapshot) : [];
    },

    torpedoes() {
      const state = currentState(deps);
      return Array.isArray(state?.torpedoes) ? state.torpedoes.map(projectileSnapshot) : [];
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

    forceEnemyFire() {
      const state = requirePlayState(deps, 'forceEnemyFire');
      const formation = state.formation;

      if (!formation || !Array.isArray(state.enemyShots)) {
        return null;
      }

      const fakeRng = {
        int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        next: () => Math.random(),
      };

      if (typeof formation.update === 'function') {
        formation.update(2);
      }

      const shot = typeof formation.tryFire === 'function'
        ? formation.tryFire(fakeRng)
        : null;

      if (shot) {
        state.enemyShots.push(shot);
      }

      return shot ? { x: shot.x, y: shot.y, w: shot.w, h: shot.h } : null;
    },

    loopState() {
      const loop = deps.loop;
      if (!loop || typeof loop.isRunning !== 'function') {
        return { running: false, paused: false };
      }
      return {
        running: Boolean(loop.isRunning()),
        paused: typeof loop.isPaused === 'function' ? Boolean(loop.isPaused()) : false,
      };
    },

    pauseLoop() {
      deps.loop?.pause?.();
    },

    resumeLoop() {
      deps.loop?.resume?.();
    },

    stopLoop() {
      deps.loop?.stop?.();
    },

    startLoop() {
      deps.loop?.start?.();
    },
  });

  win[HOOK_NAME] = api;
  return api;
}