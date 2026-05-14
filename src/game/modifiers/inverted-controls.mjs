// CS04 D2 — inverted-controls modifier.
// Left arrow moves right and right arrow moves left for the whole run.
// Pure scene-init mutator that flips the input remap; integration row 10
// reads state.invertHorizontalControls in play.mjs's input handler.

export const NAME = 'inverted-controls';

export function apply(state) {
  state.modifiers ??= {};
  state.modifiers.invertedControls = { enabled: true };
  state.invertHorizontalControls = true;
  return state;
}

// Pure remap helper that tests + integration row 10 can reuse.
export function remapHorizontalCode(code) {
  if (code === 'ArrowLeft') return 'ArrowRight';
  if (code === 'ArrowRight') return 'ArrowLeft';
  if (code === 'KeyA') return 'KeyD';
  if (code === 'KeyD') return 'KeyA';
  return code;
}
