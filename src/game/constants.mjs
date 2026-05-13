export const CANVAS = Object.freeze({ width: 800, height: 600 });

export const PALETTE = Object.freeze({
  skyTop: '#061525',
  skyMid: '#0b4f63',
  seaAccent: '#12a7a0',
  player: '#ffd84d',
  ui: '#ffffff',
  shot: '#ffd84d',
  enemyShot: '#ff5b6e',
});

export const PLAYER = Object.freeze({
  speed: 240,
  fireCooldownMs: 350,
  invulnMs: 1500,
  lives: 3,
  w: 32,
  h: 16,
  spawnYOffset: 60,
});

export const TORPEDO = Object.freeze({ speed: 540, w: 4, h: 10 });

export const ENEMY_SHOT = Object.freeze({ speed: 220, w: 4, h: 10 });

export const FORMATION = Object.freeze({
  rows: 5,
  cols: 11,
  cellW: 40,
  cellH: 28,
  originX: 80,
  originY: 80,
  baseSpeed: 60,
  descendStep: 16,
  accelFactor: 1.2,
  depthBumpPerWave: 8,
  depthCap: 120,
  firePerWaveMs: 100,
  fireMinIntervalMs: 200,
  fireIntervalMs: 1500,
  descentStepPerWave: 1,
  descentStepCap: 5,
});

export const ENEMY_TYPES = Object.freeze({
  squid: { points: 40, rowIndex: [0], sprite: 'squid', w: 32, h: 24 },
  anglerfish: { points: 20, rowIndex: [1, 2], sprite: 'anglerfish', w: 24, h: 24 },
  jellyfish: { points: 10, rowIndex: [3, 4], sprite: 'jellyfish', w: 24, h: 24 },
});

export const SCORING = Object.freeze({
  waveBonusMultiplier: 100,
});

export const SPRITES = Object.freeze({
  submarine: { x: 0, y: 0, w: 32, h: 16 },
  torpedo: { x: 40, y: 0, w: 4, h: 10 },
  enemyShot: { x: 48, y: 0, w: 4, h: 10 },
  lifeIcon: { x: 64, y: 0, w: 16, h: 8 },
  jellyfish: { x: 0, y: 16, w: 24, h: 24 },
  anglerfish: { x: 48, y: 16, w: 24, h: 24 },
  squid: { x: 0, y: 40, w: 32, h: 24 },
});
