import { CANVAS, PALETTE } from './constants.mjs';

const MAX_MODIFIER_NAME_LENGTH = 24;
const DEFAULT_PADDING = 16;
const DEFAULT_LINE_HEIGHT = 20;
const DEFAULT_FONT = '16px monospace';

const rendererWidth = (renderer) => (
  typeof renderer?.width === 'function' ? renderer.width() : CANVAS.width
);

const finiteNumberOr = (value, fallback) => (
  Number.isFinite(Number(value)) ? Number(value) : fallback
);

const truncateModifierName = (modifierName) => (
  String(modifierName ?? '').slice(0, MAX_MODIFIER_NAME_LENGTH)
);

export function createDailyHudOverlay({ daily = null, hudConfig = {} } = {}) {
  return {
    render(renderer) {
      if (!daily) {
        return;
      }

      const padding = finiteNumberOr(hudConfig.padding, DEFAULT_PADDING);
      const lineHeight = finiteNumberOr(hudConfig.lineHeight, DEFAULT_LINE_HEIGHT);
      const waveCounterY = finiteNumberOr(hudConfig.waveCounterY, padding);
      const x = finiteNumberOr(hudConfig.dailyBadgeX, rendererWidth(renderer) - padding);
      const y = finiteNumberOr(hudConfig.dailyBadgeY, waveCounterY + lineHeight);
      const modifierName = truncateModifierName(daily.modifierName);

      renderer.drawText(`DAILY · ${daily.utcDate} · ${modifierName}`, x, y, {
        font: hudConfig.font ?? DEFAULT_FONT,
        fill: hudConfig.fill ?? PALETTE.ui,
        align: hudConfig.align ?? 'right',
        baseline: hudConfig.baseline ?? 'top',
      });
    },
  };
}
