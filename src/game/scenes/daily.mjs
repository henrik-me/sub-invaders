import { createRng } from '../../engine/seed.mjs';
import { createPlayScene as defaultCreatePlayScene } from './play.mjs';

const MODIFIER_NAMES = Object.freeze([
  'fog-of-war',
  'speed-run',
  'one-shot',
  'boss-rush',
  'inverted-controls',
]);
const ENEMY_FIRE_MULTIPLIERS = Object.freeze([0.8, 1.0, 1.2, 1.5]);
const FORMATION_SPEED_MULTIPLIERS = Object.freeze([0.8, 1.0, 1.2, 1.5]);
const WHALE_SHARK_INTERVALS = Object.freeze([10000, 15000, 20000, 30000]);
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertUtcDate(utcDate) {
  if (typeof utcDate !== 'string' || !UTC_DATE_PATTERN.test(utcDate)) {
    throw new TypeError('utcDate must be a YYYY-MM-DD string');
  }

  const [year, month, day] = utcDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== utcDate) {
    throw new TypeError('utcDate must be a valid UTC YYYY-MM-DD date');
  }
}

function seedForUtcDate(utcDate) {
  return Number(utcDate.replaceAll('-', ''));
}

function drawFrom(rng, values) {
  return values[rng.int(0, values.length - 1)];
}

function createDailyDefinition(utcDate) {
  assertUtcDate(utcDate);

  const seed = seedForUtcDate(utcDate);
  const rng = createRng(seed);
  const modifierName = drawFrom(rng, MODIFIER_NAMES);
  const params = Object.freeze({
    enemyFireMultiplier: drawFrom(rng, ENEMY_FIRE_MULTIPLIERS),
    formationSpeedMultiplier: drawFrom(rng, FORMATION_SPEED_MULTIPLIERS),
    whaleSharkInterval: drawFrom(rng, WHALE_SHARK_INTERVALS),
  });

  return {
    seed,
    daily: Object.freeze({ utcDate, modifierName, params }),
  };
}

/**
 * Creates a deterministic daily scene wrapper around play.mjs.
 *
 * play.mjs does not yet expose the modifier hook owned by CS04 integration row 10,
 * so this factory forwards `{ daily: { utcDate, modifierName, params } }` and the
 * UTC date seed into createPlayScene for that integration to wire into gameplay.
 */
export function createDailyScene(opts = {}) {
  const {
    utcDate,
    createPlayScene = defaultCreatePlayScene,
    ...deps
  } = opts;
  const { seed, daily } = createDailyDefinition(utcDate);
  const playScene = createPlayScene({
    ...deps,
    seed,
    daily,
  });

  return {
    ...playScene,

    daily() {
      return daily;
    },

    state() {
      const baseState = typeof playScene?.state === 'function' ? playScene.state() : {};
      return {
        ...baseState,
        modifierName: daily.modifierName,
        daily,
      };
    },
  };
}
