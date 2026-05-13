function dimensionsFor(image) {
  return {
    width: image.naturalWidth ?? image.width ?? 0,
    height: image.naturalHeight ?? image.height ?? 0,
  };
}

function assertImageLike(image) {
  if (!image || typeof image !== 'object') {
    throw new TypeError('loadSpriteSheet expected an image-like object');
  }
}

function loadWithImageConstructor(src) {
  const ImageCtor = globalThis.Image;
  if (typeof ImageCtor !== 'function') {
    return Promise.reject(new Error('Image constructor is not available'));
  }

  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load sprite sheet: ${src}`));
    image.src = src;
  });
}

export async function loadSpriteSheet(src, opts = {}) {
  const image = opts.imageFactory
    ? await opts.imageFactory(src)
    : await loadWithImageConstructor(src);

  assertImageLike(image);
  const { width, height } = dimensionsFor(image);

  return { image, width, height };
}

export function createFrame({ x, y, w, h }) {
  return Object.freeze({ x, y, w, h });
}

export function createAnimation({ frames, fps = 8, loop = true } = {}) {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new TypeError('createAnimation requires at least one frame');
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError('createAnimation fps must be a positive finite number');
  }

  const animationFrames = Object.freeze(Array.from(frames));
  let elapsed = 0;

  function frameIndex() {
    const advanced = Math.floor(elapsed * fps);
    return loop
      ? advanced % animationFrames.length
      : Math.min(advanced, animationFrames.length - 1);
  }

  return Object.freeze({
    tick(dt) {
      if (Number.isFinite(dt) && dt > 0) {
        elapsed += dt;
      }

      return animationFrames[frameIndex()];
    },

    currentFrame() {
      return animationFrames[frameIndex()];
    },
  });
}
