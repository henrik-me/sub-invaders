// CS04 D2 — one-shot modifier.
// Single life only; starting `lives` is reset to 1.
// Pure scene-init mutator.

export const NAME = 'one-shot';

export const ONE_SHOT_LIVES = 1;

export function apply(state) {
  state.modifiers ??= {};
  state.modifiers.oneShot = { enabled: true };
  state.startingLives = ONE_SHOT_LIVES;
  return state;
}
