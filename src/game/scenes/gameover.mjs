import { CANVAS, PALETTE } from '../constants.mjs';

const rendererWidth = (renderer) => (
  typeof renderer?.width === 'function' ? renderer.width() : CANVAS.width
);

const asScore = (value) => Math.max(0, Math.floor(Number(value) || 0));

export function createGameOverScene(opts = {}) {
  const onRestart = opts.onRestart ?? (() => {});
  const onMenu = opts.onMenu ?? (() => {});

  let score = asScore(opts.score);
  let high = asScore(opts.high);

  return {
    enter(stateFromPlay = {}) {
      score = asScore(stateFromPlay.score ?? score);
      high = asScore(stateFromPlay.high ?? high);
    },

    handleInput(input) {
      if (input?.pressed?.('Space')) {
        onRestart();
      }

      if (input?.pressed?.('KeyM')) {
        onMenu();
      }
    },

    render(renderer) {
      const width = rendererWidth(renderer);

      renderer.clear?.(PALETTE.skyTop);
      renderer.drawText('GAME OVER', width / 2, 128, {
        font: '38px monospace',
        fill: PALETTE.enemyShot,
        align: 'center',
        baseline: 'middle',
      });
      renderer.drawText(`SCORE  ${score}`, width / 2, 208, {
        font: '22px monospace',
        fill: PALETTE.ui,
        align: 'center',
        baseline: 'middle',
      });
      renderer.drawText(`HIGH  ${high}`, width / 2, 244, {
        font: '22px monospace',
        fill: PALETTE.ui,
        align: 'center',
        baseline: 'middle',
      });
      renderer.drawText('PRESS SPACE TO RESTART  •  PRESS M FOR MENU', width / 2, 336, {
        font: '16px monospace',
        fill: PALETTE.ui,
        align: 'center',
        baseline: 'middle',
      });
    },

    state() {
      return { score, high };
    },
  };
}
