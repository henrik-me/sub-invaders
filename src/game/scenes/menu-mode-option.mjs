const PROMPT_SUFFIX = '  (\u2190 \u2192 to change)';

const normalizedMode = (mode) => (mode === 'practice' ? 'practice' : 'ranked');

const nextModeFor = (mode) => (normalizedMode(mode) === 'practice' ? 'ranked' : 'practice');

export function createModeMenuOption({ getMode, setMode } = {}) {
  return {
    enabled: true,

    handleInput(input) {
      if (input?.pressed?.('ArrowLeft') || input?.pressed?.('ArrowRight')) {
        setMode(nextModeFor(getMode?.()));
        return true;
      }
      return false;
    },

    promptText() {
      return `MODE: ${normalizedMode(getMode?.()).toUpperCase()}${PROMPT_SUFFIX}`;
    },
  };
}
