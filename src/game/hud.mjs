import { CANVAS, PALETTE, SPRITES } from './constants.mjs';

const numberOrZero = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const nonNegativeInt = (value) => Math.max(0, Math.floor(numberOrZero(value)));
const positiveInt = (value) => Math.max(1, Math.floor(numberOrZero(value)));

const rendererWidth = (renderer) => (
  typeof renderer?.width === 'function' ? renderer.width() : CANVAS.width
);

const lifeIconFrame = (sprites) => {
  const candidate = sprites?.lifeIcon;
  return candidate && Number.isFinite(candidate.x) ? candidate : SPRITES.lifeIcon;
};

const lifeIconImage = (sprites) => (
  sprites?.lifeIcon?.image ?? sprites?.image ?? sprites?.lifeIcon ?? {}
);

export function createHud(opts = {}) {
  const font = opts.font ?? '16px monospace';
  const fill = opts.fill ?? PALETTE.ui;
  const padding = opts.padding ?? 16;
  const lifeIconSpacing = opts.lifeIconSpacing ?? 4;

  let score = 0;
  let high = 0;
  let lives = 0;
  let wave = 1;

  const api = {
    setScore(nextScore) {
      score = nonNegativeInt(nextScore);
      return api;
    },

    setHigh(nextHigh) {
      high = nonNegativeInt(nextHigh);
      return api;
    },

    setLives(nextLives) {
      lives = nonNegativeInt(nextLives);
      return api;
    },

    setWave(nextWave) {
      wave = positiveInt(nextWave);
      return api;
    },

    render(renderer, sprites = {}) {
      const width = rendererWidth(renderer);
      const scoreY = padding;
      const livesY = scoreY + 24;
      const textOpts = { font, fill, align: 'left', baseline: 'top' };

      renderer.drawText(`SCORE  ${score}`, padding, scoreY, textOpts);
      renderer.drawText(`HIGH  ${high}`, width / 2, scoreY, {
        ...textOpts,
        align: 'center',
      });
      renderer.drawText(`WAVE  ${wave}`, width - padding, scoreY, {
        ...textOpts,
        align: 'right',
      });
      renderer.drawText('LIVES', padding, livesY, textOpts);

      const frame = lifeIconFrame(sprites);
      const image = lifeIconImage(sprites);
      const iconStartX = padding + 56;

      for (let index = 0; index < lives; index += 1) {
        renderer.drawSprite(
          image,
          frame.x,
          frame.y,
          frame.w,
          frame.h,
          iconStartX + index * (frame.w + lifeIconSpacing),
          livesY + 4,
          frame.w,
          frame.h,
        );
      }

      return api;
    },
  };

  return api;
}
