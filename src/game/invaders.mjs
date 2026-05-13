import { Entity } from '../engine/entity.mjs';

const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 11;
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 600;
const DEFAULT_SPAWN_X = 80;
const DEFAULT_SPAWN_Y = 64;
const DEFAULT_COL_SPACING = 48;
const DEFAULT_ROW_SPACING = 36;
const DEFAULT_BASE_SPEED = 60;
const DEFAULT_DESCEND_STEP = 16;
const DEFAULT_ACCEL_FACTOR = 1.2;
const DEFAULT_FIRE_INTERVAL_MS = 1500;
const DEFAULT_FIRE_MIN_INTERVAL_MS = 200;
const DEFAULT_FIRE_PER_WAVE_MS = 100;
const DEFAULT_DEPTH_BUMP_PER_WAVE = 8;
const DEFAULT_DEPTH_CAP = 120;
const DEFAULT_DESCENT_STEP_PER_WAVE = 1;
const DEFAULT_DESCENT_STEP_CAP = 5;
const DEFAULT_SHOT_SPEED = 220;

const POINTS_BY_TYPE = Object.freeze({
  squid: 40,
  anglerfish: 20,
  jellyfish: 10,
});

const FRAMES = Object.freeze({
  enemy_shot: Object.freeze({ x: 48, y: 0, w: 4, h: 10 }),
  jellyfish: Object.freeze({ x: 0, y: 16, w: 24, h: 24 }),
  anglerfish: Object.freeze({ x: 48, y: 16, w: 24, h: 24 }),
  squid: Object.freeze({ x: 0, y: 40, w: 32, h: 24 }),
});

const finiteOrZero = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

function imageFromSprites(sprites) {
  return sprites?.image ?? sprites?.sheet?.image ?? sprites?.spriteSheet?.image ?? sprites;
}

function frameFromSprites(sprites, key, fallback) {
  return sprites?.frames?.[key] ?? sprites?.[key] ?? fallback;
}

function drawSpriteFrame(renderer, sprites, key, fallback, x, y, w, h) {
  if (typeof renderer?.drawSprite !== 'function') {
    return false;
  }

  const image = imageFromSprites(sprites);
  const frame = frameFromSprites(sprites, key, fallback);

  if (!image || !frame) {
    return false;
  }

  renderer.drawSprite(image, frame.x, frame.y, frame.w, frame.h, x, y, w, h);
  return true;
}

function typeForRow(row) {
  if (row === 0) {
    return 'squid';
  }

  if (row <= 2) {
    return 'anglerfish';
  }

  return 'jellyfish';
}

function dimensionsForType(type, opts) {
  const byType = opts.dimensionsByType?.[type] ?? opts.sizeByType?.[type];

  return {
    w: opts.enemyW ?? opts.w ?? byType?.w ?? FRAMES[type].w,
    h: opts.enemyH ?? opts.h ?? byType?.h ?? FRAMES[type].h,
  };
}

function createEnemy({ type, x, y, points, sprite, w, h, row, col }) {
  const enemy = new Entity({ x, y, w, h });
  enemy.type = type;
  enemy.points = points;
  enemy.sprite = sprite;
  enemy.row = row;
  enemy.col = col;
  return enemy;
}

class EnemyShot extends Entity {
  constructor(opts = {}) {
    const speed = opts.speed ?? DEFAULT_SHOT_SPEED;
    const w = opts.w ?? FRAMES.enemy_shot.w;
    const h = opts.h ?? FRAMES.enemy_shot.h;

    super({
      x: opts.x ?? 0,
      y: opts.y ?? 0,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? speed,
      w,
      h,
    });

    this.speed = speed;
    this.sprite = opts.sprite ?? 'enemy_shot';
    this.canvasHeight = opts.canvasHeight ?? DEFAULT_CANVAS_HEIGHT;
  }

  update(dt) {
    super.update(finiteOrZero(dt));

    if (this.y > this.canvasHeight) {
      this.kill();
    }
  }

  render(renderer, sprites) {
    return drawSpriteFrame(renderer, sprites, this.sprite, FRAMES.enemy_shot, this.x, this.y, this.w, this.h);
  }
}

function createEnemyShot(opts = {}) {
  return new EnemyShot(opts);
}

function randomIndex(rng, length) {
  if (length <= 1) {
    return 0;
  }

  if (typeof rng?.int === 'function') {
    const rawIndex = Math.trunc(rng.int(0, length - 1));
    return ((rawIndex % length) + length) % length;
  }

  const next = typeof rng?.next === 'function' ? rng.next() : Math.random();
  const normalized = Math.min(0.999999999, Math.max(0, Number.isFinite(next) ? next : 0));
  return Math.floor(normalized * length);
}

export function createFormation(opts = {}) {
  const rows = opts.rows ?? DEFAULT_ROWS;
  const cols = opts.cols ?? DEFAULT_COLS;
  const canvasWidth = opts.canvasWidth ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = opts.canvasHeight ?? DEFAULT_CANVAS_HEIGHT;
  const spawnX = opts.x ?? opts.spawnX ?? DEFAULT_SPAWN_X;
  const firstWaveSpawnY = opts.y ?? opts.spawnY ?? DEFAULT_SPAWN_Y;
  const colSpacing = opts.colSpacing ?? DEFAULT_COL_SPACING;
  const rowSpacing = opts.rowSpacing ?? DEFAULT_ROW_SPACING;
  const baseSpeed = opts.baseSpeed ?? DEFAULT_BASE_SPEED;
  const accelFactor = opts.accelFactor ?? DEFAULT_ACCEL_FACTOR;
  const baseDescendStep = opts.descendStep ?? DEFAULT_DESCEND_STEP;
  const pointsByType = { ...POINTS_BY_TYPE, ...(opts.pointsByType ?? {}) };
  const depthBumpPerWave = opts.depthBumpPerWave ?? DEFAULT_DEPTH_BUMP_PER_WAVE;
  const depthCap = opts.depthCap ?? DEFAULT_DEPTH_CAP;
  const firePerWaveMs = opts.firePerWaveMs ?? DEFAULT_FIRE_PER_WAVE_MS;
  const fireMinIntervalMs = opts.fireMinIntervalMs ?? DEFAULT_FIRE_MIN_INTERVAL_MS;
  const baseFireIntervalMs = opts.fireIntervalMs ?? DEFAULT_FIRE_INTERVAL_MS;
  const descentStepPerWave = opts.descentStepPerWave ?? DEFAULT_DESCENT_STEP_PER_WAVE;
  const descentStepCap = opts.descentStepCap ?? DEFAULT_DESCENT_STEP_CAP;
  const totalEnemies = rows * cols;
  const initialDirection = opts.direction === -1 ? -1 : 1;

  let direction = initialDirection;
  let currentSpawnY = firstWaveSpawnY;
  let currentFireIntervalMs = baseFireIntervalMs;
  let currentDescendStep = baseDescendStep;
  let fireAccumulatorMs = 0;
  let enemies = [];

  function buildEnemies(yBase) {
    const built = [];

    for (let row = 0; row < rows; row += 1) {
      const type = typeForRow(row);
      const { w, h } = dimensionsForType(type, opts);

      for (let col = 0; col < cols; col += 1) {
        built.push(createEnemy({
          type,
          x: spawnX + (col * colSpacing),
          y: yBase + (row * rowSpacing),
          points: pointsByType[type],
          sprite: type,
          w,
          h,
          row,
          col,
        }));
      }
    }

    return built;
  }

  function aliveEnemies() {
    return enemies.filter((enemy) => enemy.alive !== false);
  }

  function aliveCount() {
    return aliveEnemies().length;
  }

  function currentSpeed() {
    if (totalEnemies <= 0) {
      return 0;
    }

    const aliveRatio = aliveCount() / totalEnemies;
    return baseSpeed * (1 + ((1 - aliveRatio) * accelFactor));
  }

  function boundsOfAlive() {
    const alive = aliveEnemies();

    if (alive.length === 0) {
      return { left: 0, right: 0, top: 0, bottom: 0 };
    }

    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    for (const enemy of alive) {
      left = Math.min(left, enemy.x);
      right = Math.max(right, enemy.x + enemy.w);
      top = Math.min(top, enemy.y);
      bottom = Math.max(bottom, enemy.y + enemy.h);
    }

    return { left, right, top, bottom };
  }

  function moveAlive(dx, dy) {
    for (const enemy of enemies) {
      if (enemy.alive !== false) {
        enemy.x += dx;
        enemy.y += dy;
      }
    }
  }

  function aliveColumns() {
    const columns = [];

    for (let col = 0; col < cols; col += 1) {
      if (enemies.some((enemy) => enemy.col === col && enemy.alive !== false)) {
        columns.push(col);
      }
    }

    return columns;
  }

  function lowestAliveInColumn(col) {
    let lowest = null;

    for (const enemy of enemies) {
      if (enemy.col !== col || enemy.alive === false) {
        continue;
      }

      if (lowest === null || enemy.y + enemy.h > lowest.y + lowest.h) {
        lowest = enemy;
      }
    }

    return lowest;
  }

  function consumeFireCadence(accumulatorState) {
    if (accumulatorState && typeof accumulatorState === 'object') {
      if (Number.isFinite(accumulatorState.nowMs)) {
        const dueAt = Number.isFinite(accumulatorState.lastFireAtMs)
          ? accumulatorState.lastFireAtMs + currentFireIntervalMs
          : currentFireIntervalMs;

        if (accumulatorState.nowMs < dueAt) {
          return false;
        }

        accumulatorState.lastFireAtMs = accumulatorState.nowMs;
        return true;
      }

      if (Number.isFinite(accumulatorState.dtMs)) {
        accumulatorState.elapsedMs = (Number.isFinite(accumulatorState.elapsedMs) ? accumulatorState.elapsedMs : 0)
          + accumulatorState.dtMs;
      } else if (Number.isFinite(accumulatorState.dt)) {
        accumulatorState.elapsedMs = (Number.isFinite(accumulatorState.elapsedMs) ? accumulatorState.elapsedMs : 0)
          + (accumulatorState.dt * 1000);
      }

      if (!Number.isFinite(accumulatorState.elapsedMs) || accumulatorState.elapsedMs < currentFireIntervalMs) {
        return false;
      }

      accumulatorState.elapsedMs -= currentFireIntervalMs;
      return true;
    }

    if (fireAccumulatorMs < currentFireIntervalMs) {
      return false;
    }

    fireAccumulatorMs -= currentFireIntervalMs;
    return true;
  }

  function update(dt) {
    const seconds = finiteOrZero(dt);
    fireAccumulatorMs += seconds * 1000;

    if (aliveCount() === 0 || seconds === 0) {
      return;
    }

    const bounds = boundsOfAlive();
    const dx = direction * currentSpeed() * seconds;
    const crossesRight = direction > 0 && bounds.right + dx > canvasWidth;
    const crossesLeft = direction < 0 && bounds.left + dx < 0;

    if (crossesRight || crossesLeft) {
      moveAlive(0, currentDescendStep);
      direction *= -1;
      return;
    }

    moveAlive(dx, 0);
  }

  function tryFire(rng, accumulatorState) {
    const columns = aliveColumns();

    if (columns.length === 0 || !consumeFireCadence(accumulatorState)) {
      return null;
    }

    const col = columns[randomIndex(rng, columns.length)];
    const enemy = lowestAliveInColumn(col);

    if (enemy === null) {
      return null;
    }

    const shotW = opts.shotW ?? FRAMES.enemy_shot.w;
    const shotH = opts.shotH ?? FRAMES.enemy_shot.h;

    return createEnemyShot({
      x: enemy.x + (enemy.w / 2) - (shotW / 2),
      y: enemy.y + enemy.h,
      speed: opts.shotSpeed ?? DEFAULT_SHOT_SPEED,
      w: shotW,
      h: shotH,
      sprite: opts.shotSprite ?? 'enemy_shot',
      canvasHeight,
    });
  }

  function resetForWave(wave = 1) {
    const waveIndex = Math.max(0, Math.trunc((Number.isFinite(wave) ? wave : 1) - 1));
    const depth = Math.min(depthCap, waveIndex * depthBumpPerWave);
    const descentGrowth = Math.min(descentStepCap, waveIndex * descentStepPerWave);

    currentSpawnY = firstWaveSpawnY + depth;
    currentFireIntervalMs = Math.max(fireMinIntervalMs, baseFireIntervalMs - (waveIndex * firePerWaveMs));
    currentDescendStep = baseDescendStep + descentGrowth;
    fireAccumulatorMs = 0;
    direction = initialDirection;
    enemies = buildEnemies(currentSpawnY);
    return api;
  }

  function forEachAlive(cb) {
    for (const enemy of enemies) {
      if (enemy.alive !== false) {
        cb(enemy);
      }
    }
  }

  function render(renderer, sprites) {
    let drawn = 0;

    forEachAlive((enemy) => {
      if (drawSpriteFrame(renderer, sprites, enemy.sprite, FRAMES[enemy.sprite], enemy.x, enemy.y, enemy.w, enemy.h)) {
        drawn += 1;
      }
    });

    return drawn;
  }

  const api = {
    get enemies() {
      return enemies;
    },
    update,
    tryFire,
    resetForWave,
    forEachAlive,
    render,
    aliveCount,
    currentSpeed,
    speed: currentSpeed,
    isCleared: () => aliveCount() === 0,
    lowestY: () => boundsOfAlive().bottom,
    bounds: boundsOfAlive,
    direction: () => direction,
    fireIntervalMs: () => currentFireIntervalMs,
    descendStep: () => currentDescendStep,
    spawnY: () => currentSpawnY,
  };

  enemies = buildEnemies(currentSpawnY);
  return api;
}
