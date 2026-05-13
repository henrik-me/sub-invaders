import { CANVAS, PALETTE } from '../constants.mjs';

const rendererWidth = (renderer) => (
  typeof renderer?.width === 'function' ? renderer.width() : CANVAS.width
);

const rendererHeight = (renderer) => (
  typeof renderer?.height === 'function' ? renderer.height() : CANVAS.height
);

export function createMenuScene(opts = {}) {
  const onStart = opts.onStart ?? (() => {});
  const getHighScore = opts.getHighScore ?? (() => 0);
  const now = opts.now ?? (() => Date.now());

  return {
    handleInput(input) {
      if (input?.pressed?.('Space')) {
        onStart();
      }
    },

    render(renderer) {
      const width = rendererWidth(renderer);
      const height = rendererHeight(renderer);
      const highScore = Math.max(0, Math.floor(Number(getHighScore()) || 0));

      renderer.clear?.(PALETTE.skyTop);
      renderer.drawText('SUB INVADERS', width / 2, 96, {
        font: '40px monospace',
        fill: PALETTE.player,
        align: 'center',
        baseline: 'middle',
      });
      renderer.drawText('ARROWS / A D — Move    SPACE / W — Fire', width / 2, 164, {
        font: '16px monospace',
        fill: PALETTE.ui,
        align: 'center',
        baseline: 'middle',
      });
      renderer.drawText(`HIGH  ${highScore}`, width / 2, 212, {
        font: '20px monospace',
        fill: PALETTE.ui,
        align: 'center',
        baseline: 'middle',
      });

      if (Math.floor(now() / 500) % 2 === 0) {
        renderer.drawText('PRESS SPACE TO START', width / 2, height - 96, {
          font: '18px monospace',
          fill: PALETTE.ui,
          align: 'center',
          baseline: 'middle',
        });
      }
    },
  };
}
