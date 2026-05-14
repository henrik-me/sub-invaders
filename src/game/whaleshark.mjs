import { aabbOverlap } from '../engine/collision.mjs';
import { Entity } from '../engine/entity.mjs';

const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 600;
const DEFAULT_SPEED = 80;
const DEFAULT_WIDTH = 72;
const DEFAULT_HEIGHT = 24;
const DEFAULT_NORMAL_MIN_MS = 15000;
const DEFAULT_NORMAL_MAX_MS = 30000;
const DEFAULT_DAILY_INTERVAL_MS = 15000;
const SCORE_VALUES = Object.freeze([50, 100, 200]);
const FILL = '#6fe7ff';
const STROKE = '#dffbff';

// The mystery enemy traverses a fixed top band (y 32-48) above the default
// formation rows (spawn at y 64/80) at 80 pixels per second.
const Y_BAND = Object.freeze({ min: 32, max: 48 });

const finitePositive = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const finiteNonNegative = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const secondsOrZero = (dt) => finiteNonNegative(dt, 0);

function randomInt(rng, min, max) {
  if (typeof rng?.int === 'function') {
    return Math.trunc(rng.int(min, max));
  }

  if (typeof rng?.range === 'function') {
    return Math.floor(rng.range(min, max + 1));
  }

  const next = typeof rng?.next === 'function' ? rng.next() : Math.random();
  const normalized = Math.min(0.999999999, Math.max(0, Number.isFinite(next) ? next : 0));
  return Math.floor(normalized * (max - min + 1)) + min;
}

function randomIndex(rng, length) {
  const raw = randomInt(rng, 0, length - 1);
  return ((raw % length) + length) % length;
}

function aabbOf(entity) {
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

function isLiveTorpedo(torpedo) {
  return torpedo && torpedo.alive !== false && torpedo.consumed !== true;
}

function consumeTorpedo(torpedo) {
  torpedo.consumed = true;

  if (typeof torpedo.kill === 'function') {
    torpedo.kill();
    return;
  }

  torpedo.alive = false;
}

class WhaleShark extends Entity {
  constructor({ x, y, vx, w, h, direction, speed }) {
    super({ x, y, vx, vy: 0, w, h });
    this.direction = direction;
    this.speed = speed;
    this.sprite = 'whaleshark';
  }

  render(renderer) {
    if (typeof renderer?.drawRect !== 'function') {
      return false;
    }

    // Placeholder cyan silhouette until a whale-shark sprite is wired.
    renderer.drawRect(this.x, this.y, this.w, this.h, FILL, STROKE);
    return true;
  }
}

export function createWhaleShark({
  rng,
  canvasWidth = DEFAULT_CANVAS_WIDTH,
  canvasHeight = DEFAULT_CANVAS_HEIGHT,
  spawnIntervalMs,
  dailyMode = false,
} = {}) {
  const width = finitePositive(canvasWidth, DEFAULT_CANVAS_WIDTH);
  const height = finitePositive(canvasHeight, DEFAULT_CANVAS_HEIGHT);
  const maxY = Math.max(0, height - DEFAULT_HEIGHT);
  const spawnY = Math.round((Math.min(Y_BAND.min, maxY) + Math.min(Y_BAND.max, maxY)) / 2);
  const state = {
    active: false,
    shark: null,
    spawnTimerMs: 0,
    spawnIntervalMs: 0,
    nextSpawnAtMs: null,
    lastSpawnAtMs: null,
    dailyMode: Boolean(dailyMode),
  };
  let nextEdge = 'left';

  function nextIntervalMs() {
    if (state.dailyMode) {
      return finiteNonNegative(spawnIntervalMs, DEFAULT_DAILY_INTERVAL_MS);
    }

    return finiteNonNegative(randomInt(rng, DEFAULT_NORMAL_MIN_MS, DEFAULT_NORMAL_MAX_MS), DEFAULT_NORMAL_MIN_MS);
  }

  function scheduleNextSpawn(now) {
    const delay = nextIntervalMs();
    state.spawnIntervalMs = delay;
    state.spawnTimerMs = delay;
    state.nextSpawnAtMs = Number.isFinite(now) ? now + delay : null;
    return delay;
  }

  function spawn(now) {
    if (state.active) {
      return state.shark;
    }

    const direction = nextEdge === 'left' ? 1 : -1;
    const x = direction > 0 ? -DEFAULT_WIDTH : width;
    const shark = new WhaleShark({
      x,
      y: spawnY,
      vx: direction * DEFAULT_SPEED,
      w: DEFAULT_WIDTH,
      h: DEFAULT_HEIGHT,
      direction,
      speed: DEFAULT_SPEED,
    });

    state.active = true;
    state.shark = shark;
    state.spawnTimerMs = 0;
    state.nextSpawnAtMs = null;
    state.lastSpawnAtMs = Number.isFinite(now) ? now : null;
    nextEdge = direction > 0 ? 'right' : 'left';
    return shark;
  }

  function despawn({ resetTimer = true, now } = {}) {
    if (state.shark) {
      state.shark.kill();
    }

    state.active = false;
    state.shark = null;
    state.lastSpawnAtMs = null;

    if (resetTimer) {
      scheduleNextSpawn(now);
    } else {
      state.spawnTimerMs = 0;
      state.nextSpawnAtMs = null;
    }

    return state;
  }

  function isOffscreen(shark) {
    return shark.direction > 0 ? shark.x > width : shark.x + shark.w < 0;
  }

  function maybeSpawn(now) {
    if (state.active) {
      return state.shark;
    }

    if (Number.isFinite(now)) {
      if (state.nextSpawnAtMs === null) {
        state.nextSpawnAtMs = now + Math.max(0, state.spawnTimerMs);
      }

      const remaining = state.nextSpawnAtMs - now;
      if (remaining > 0) {
        state.spawnTimerMs = remaining;
        return null;
      }

      return spawn(now);
    }

    return state.spawnTimerMs <= 0 ? spawn() : null;
  }

  function update(dt) {
    const seconds = secondsOrZero(dt);

    if (state.active) {
      state.shark.update(seconds);

      if (isOffscreen(state.shark)) {
        despawn();
      }

      return state;
    }

    state.nextSpawnAtMs = null;
    state.spawnTimerMs = Math.max(0, state.spawnTimerMs - (seconds * 1000));
    maybeSpawn();
    return state;
  }

  function render(renderer) {
    if (!state.active) {
      return false;
    }

    return state.shark.render(renderer);
  }

  function checkHit(torpedoes) {
    if (!state.active) {
      return { hit: false };
    }

    for (const torpedo of torpedoes ?? []) {
      if (!isLiveTorpedo(torpedo)) {
        continue;
      }

      if (aabbOverlap(state.shark.aabb(), aabbOf(torpedo))) {
        consumeTorpedo(torpedo);
        const points = SCORE_VALUES[randomIndex(rng, SCORE_VALUES.length)];
        despawn();
        return { hit: true, points };
      }
    }

    return { hit: false };
  }

  function reset() {
    if (state.shark) {
      state.shark.kill();
    }

    state.active = false;
    state.shark = null;
    state.lastSpawnAtMs = null;
    state.nextSpawnAtMs = null;
    nextEdge = 'left';
    scheduleNextSpawn();
    return state;
  }

  scheduleNextSpawn();

  return {
    update,
    render,
    checkHit,
    maybeSpawn,
    state,
    reset,
    __forTesting: Object.freeze({
      constants: Object.freeze({
        speed: DEFAULT_SPEED,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        yBand: Y_BAND,
        normalMinMs: DEFAULT_NORMAL_MIN_MS,
        normalMaxMs: DEFAULT_NORMAL_MAX_MS,
        scoreValues: SCORE_VALUES,
      }),
      forceSpawn: spawn,
      despawn,
    }),
  };
}
