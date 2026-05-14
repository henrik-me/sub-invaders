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
 * Daily-mode wiring summary (see CS04 PvI R2):
 * - The named modifier (`daily.modifierName`) is matched against the
 *   `MODIFIER_REGISTRY` in `play.mjs` and its `apply(state)` is invoked at
 *   scene construction. Resulting state fields drive runtime behavior:
 *   `startingLives`, `playerSpeedMultiplier`, `formationSpeedMultiplier`,
 *   `enemyFireDensityMultiplier`, `scoreMultiplier`, `invertHorizontalControls`,
 *   and `modifiers.fogOfWar.haloRadius`.
 * - The whale-shark mystery enemy is created when `daily` is set and ticks +
 *   renders + checks-hit each frame; its score award is multiplied by the
 *   active modifier's `scoreMultiplier`.
 * - The `DAILY · YYYY-MM-DD · modifier-name` HUD badge is rendered top-right
 *   each frame.
 * - The `period: 'daily', utcDate` tuple is threaded into the score submit
 *   payload so the server partitions to the daily leaderboard.
 *
 * Known sub-limitations (documented as acceptable for v1.0):
 * - boss-rush `onlyEnemyType: 'squid'` requires formation-factory cooperation
 *   to filter spawned types; only its `scoreMultiplier × 2` and
 *   `enemyFireDensityMultiplier × 2` take effect.
 * - speed-run `fireRateMultiplier` is a no-op because the player factory does
 *   not accept a fire-rate multiplier (only an absolute `fireCooldownMs`).
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
