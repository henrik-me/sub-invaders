// CS04 D2 — speed-run modifier.
// 2x player movement, 2x formation speed, 2x fire rate.
// Pure scene-init mutator; integration row 10 reads the multipliers in play.mjs.

export const NAME = 'speed-run';

export const SPEED_MULTIPLIER = 2;

export function apply(state) {
  state.modifiers ??= {};
  state.modifiers.speedRun = { enabled: true };
  state.playerSpeedMultiplier = (state.playerSpeedMultiplier ?? 1) * SPEED_MULTIPLIER;
  state.formationSpeedMultiplier = (state.formationSpeedMultiplier ?? 1) * SPEED_MULTIPLIER;
  state.fireRateMultiplier = (state.fireRateMultiplier ?? 1) * SPEED_MULTIPLIER;
  return state;
}
