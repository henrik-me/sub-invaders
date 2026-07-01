import { CANVAS, PALETTE } from '../constants.mjs';

const rendererWidth = (renderer) => (
  typeof renderer?.width === 'function' ? renderer.width() : CANVAS.width
);

const rendererHeight = (renderer) => (
  typeof renderer?.height === 'function' ? renderer.height() : CANVAS.height
);

export function createMenuScene(opts = {}) {
  const onStart = opts.onStart ?? (() => {});
  const onLeaderboard = opts.onLeaderboard ?? null;
  const getHighScore = opts.getHighScore ?? (() => 0);
  const now = opts.now ?? (() => Date.now());
  const dailyOption = opts.dailyOption ?? null;
  const modeOption = opts.modeOption ?? null;

  return {
    handleInput(input) {
      if (input?.pressed?.('Space')) {
        onStart();
      }

      if (onLeaderboard && input?.pressed?.('KeyL')) {
        onLeaderboard();
      }

      dailyOption?.handleInput?.(input);
      modeOption?.handleInput?.(input);
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
        const prompt = onLeaderboard
          ? 'PRESS SPACE TO START  •  PRESS L FOR LEADERBOARD'
          : 'PRESS SPACE TO START';
        renderer.drawText(prompt, width / 2, height - 96, {
          font: '18px monospace',
          fill: PALETTE.ui,
          align: 'center',
          baseline: 'middle',
        });

        const dailyPrompt = dailyOption?.promptText?.();
        if (dailyPrompt) {
          renderer.drawText(dailyPrompt, width / 2, height - 64, {
            font: '18px monospace',
            fill: PALETTE.ui,
            align: 'center',
            baseline: 'middle',
          });
        }
      }

      const modePrompt = modeOption?.promptText?.();
      if (modePrompt) {
        renderer.drawText(modePrompt, width / 2, height - 128, {
          font: '18px monospace',
          fill: PALETTE.ui,
          align: 'center',
          baseline: 'middle',
        });
      }
    },
  };
}
