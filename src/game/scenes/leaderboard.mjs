import { CANVAS, PALETTE } from '../constants.mjs';

const rendererWidth = (renderer) => (
  typeof renderer?.width === 'function' ? renderer.width() : CANVAS.width
);

const STATE = Object.freeze({
  loading: 'loading',
  ready: 'ready',
  error: 'error',
});

function formatScore(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0)));
}

function shortenError(err) {
  const message = err?.message ?? String(err);
  return message.length > 80 ? `${message.slice(0, 77)}...` : message;
}

export function createLeaderboardScene(opts = {}) {
  const apiClient = opts.apiClient;
  const onMenu = opts.onMenu ?? (() => {});
  const onRestart = opts.onRestart ?? (() => {});
  const top = Math.max(1, Math.floor(opts.top ?? 10));

  let state = STATE.loading;
  let entries = [];
  let errorMessage = '';

  function load() {
    state = STATE.loading;
    entries = [];
    errorMessage = '';
    if (!apiClient || typeof apiClient.getLeaderboard !== 'function') {
      state = STATE.error;
      errorMessage = 'leaderboard unavailable';
      return;
    }
    Promise.resolve(apiClient.getLeaderboard({ period: 'all' })).then(
      (result) => {
        entries = (result?.entries ?? []).slice(0, top);
        state = STATE.ready;
      },
      (err) => {
        errorMessage = shortenError(err);
        state = STATE.error;
      },
    );
  }

  return {
    enter() {
      load();
    },

    handleInput(input) {
      if (input?.pressed?.('Space')) {
        onRestart();
        return;
      }
      if (input?.pressed?.('KeyM')) {
        onMenu();
      }
    },

    render(renderer) {
      const width = rendererWidth(renderer);
      renderer.clear?.(PALETTE.skyTop);
      renderer.drawText('LEADERBOARD', width / 2, 80, {
        font: '32px monospace',
        fill: PALETTE.ui,
        align: 'center',
        baseline: 'middle',
      });

      if (state === STATE.loading) {
        renderer.drawText('LOADING...', width / 2, 200, {
          font: '20px monospace',
          fill: PALETTE.ui,
          align: 'center',
          baseline: 'middle',
        });
      } else if (state === STATE.error) {
        renderer.drawText('UNABLE TO LOAD', width / 2, 200, {
          font: '20px monospace',
          fill: PALETTE.enemyShot,
          align: 'center',
          baseline: 'middle',
        });
        renderer.drawText(errorMessage, width / 2, 232, {
          font: '12px monospace',
          fill: PALETTE.ui,
          align: 'center',
          baseline: 'middle',
        });
      } else {
        if (entries.length === 0) {
          renderer.drawText('NO SCORES YET', width / 2, 200, {
            font: '20px monospace',
            fill: PALETTE.ui,
            align: 'center',
            baseline: 'middle',
          });
        } else {
          let y = 140;
          for (const entry of entries) {
            const rank = String(entry.rank).padStart(2, ' ');
            const score = formatScore(entry.score).padStart(8, ' ');
            renderer.drawText(`${rank}.  ${score}`, width / 2, y, {
              font: '18px monospace',
              fill: PALETTE.ui,
              align: 'center',
              baseline: 'middle',
            });
            y += 24;
          }
        }
      }

      renderer.drawText('PRESS SPACE TO RESTART  •  PRESS M FOR MENU', width / 2, 360, {
        font: '14px monospace',
        fill: PALETTE.ui,
        align: 'center',
        baseline: 'middle',
      });
    },

    state() {
      return { phase: state, entries: entries.slice(), error: errorMessage };
    },
  };
}

export const __forTesting = { STATE, formatScore, shortenError };
