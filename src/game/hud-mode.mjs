const DEFAULT_PADDING = 16;
const DEFAULT_BADGE_Y = 64;
const DEFAULT_FONT = '16px monospace';
const RANKED_FILL = '#ffd23f';
const PRACTICE_FILL = '#22d3ee';

const finiteNumberOr = (value, fallback) => (
  Number.isFinite(Number(value)) ? Number(value) : fallback
);

const normalizedMode = (mode) => (mode === 'practice' ? 'practice' : 'ranked');

export function createModeBadgeOverlay({ getMode, hudConfig = {} } = {}) {
  return {
    render(renderer) {
      const mode = normalizedMode(getMode?.());
      const x = finiteNumberOr(hudConfig.padding, DEFAULT_PADDING);
      const y = finiteNumberOr(hudConfig.badgeY, DEFAULT_BADGE_Y);

      renderer.drawText(mode === 'practice' ? 'PRACTICE' : 'RANKED', x, y, {
        font: hudConfig.font ?? DEFAULT_FONT,
        fill: mode === 'practice' ? PRACTICE_FILL : RANKED_FILL,
        align: 'left',
        baseline: 'top',
      });
    },
  };
}
