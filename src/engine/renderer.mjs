const DEFAULT_BACKGROUND = '#061525';
const DEFAULT_TEXT = Object.freeze({
  font: '14px monospace',
  fill: '#ffffff',
  align: 'left',
  baseline: 'top',
});

function resolveContext(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new TypeError('createRenderer requires a canvas with getContext');
  }

  const context = canvas.getContext('2d');
  if (!context) {
    throw new TypeError('createRenderer requires a 2D canvas context');
  }

  return context;
}

function ensureStyle(canvas) {
  if (!canvas.style) {
    canvas.style = {};
  }

  return canvas.style;
}

export function createRenderer({ canvas, logicalWidth = 800, logicalHeight = 600, dpr } = {}) {
  const context = resolveContext(canvas);
  const scale = dpr ?? globalThis.devicePixelRatio ?? 1;
  const style = ensureStyle(canvas);

  canvas.width = logicalWidth * scale;
  canvas.height = logicalHeight * scale;
  style.width = `${logicalWidth}px`;
  style.height = `${logicalHeight}px`;

  if (typeof context.setTransform === 'function') {
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  return Object.freeze({
    clear(color = DEFAULT_BACKGROUND) {
      context.fillStyle = color;
      context.fillRect(0, 0, logicalWidth, logicalHeight);
    },

    drawSprite(image, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
      context.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    },

    drawRect(x, y, w, h, fill, stroke) {
      if (fill !== undefined && fill !== null) {
        context.fillStyle = fill;
        context.fillRect(x, y, w, h);
      }

      if (stroke !== undefined && stroke !== null) {
        context.strokeStyle = stroke;
        context.strokeRect(x, y, w, h);
      }
    },

    drawText(text, x, y, opts = {}) {
      const {
        font = DEFAULT_TEXT.font,
        fill = DEFAULT_TEXT.fill,
        align = DEFAULT_TEXT.align,
        baseline = DEFAULT_TEXT.baseline,
      } = opts ?? {};

      context.font = font;
      context.fillStyle = fill;
      context.textAlign = align;
      context.textBaseline = baseline;
      context.fillText(text, x, y);
    },

    width() {
      return logicalWidth;
    },

    height() {
      return logicalHeight;
    },

    ctx() {
      return context;
    },
  });
}
