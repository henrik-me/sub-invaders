// CS04 D2 — boss-rush modifier.
// Only the Squid row spawns (11 enemies), enemy fire density is higher,
// each clear respawns immediately, and scoring uses a x2 multiplier.

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
