// CS04 D2 — speed-run modifier.
// Sets state.playerSpeedMultiplier x2 and state.formationSpeedMultiplier x2
// (both honored by play.mjs integration). Also sets state.fireRateMultiplier
// x2 — this is reserved for v1.1+ player-factory cooperation; in v1.0 it is
// NOT honored because the player factory only accepts an absolute
// fireCooldownMs (see CHANGELOG SI-CS04 "Known sub-limitations").
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
