// CS04 D2 — boss-rush modifier.
// Sets state.scoreMultiplier x2 and state.enemyFireDensityMultiplier x2 (both
// honored by play.mjs integration). Also stores onlyEnemyType: 'squid' and
// respawnImmediately: true on state.modifiers.bossRush — these are reserved
// for v1.1+ formation-factory cooperation; in v1.0 they are NOT honored
// (see CHANGELOG SI-CS04 "Known sub-limitations").

export const NAME = 'boss-rush';

export const BOSS_RUSH_SCORE_MULTIPLIER = 2;
export const BOSS_RUSH_FIRE_DENSITY_MULTIPLIER = 2;

export function apply(state) {
  state.modifiers ??= {};
  state.modifiers.bossRush = {
    enabled: true,
    onlyEnemyType: 'squid',
    respawnImmediately: true,
  };
  state.scoreMultiplier = (state.scoreMultiplier ?? 1) * BOSS_RUSH_SCORE_MULTIPLIER;
  state.enemyFireDensityMultiplier =
    (state.enemyFireDensityMultiplier ?? 1) * BOSS_RUSH_FIRE_DENSITY_MULTIPLIER;
  return state;
}
