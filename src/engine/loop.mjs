const DEFAULT_FIXED_DT = 1 / 60;
const DEFAULT_MAX_ACCUMULATOR = 0.25;
const EPSILON = 1e-12;

function getDefaultRaf() {
  return globalThis.requestAnimationFrame?.bind(globalThis);
}

function getDefaultCancelRaf() {
  return globalThis.cancelAnimationFrame?.bind(globalThis);
}

function getDefaultNow() {
  return globalThis.performance?.now.bind(globalThis.performance);
}

function assertFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`createLoop requires ${name} to be a function`);
  }
}

export function createLoop(opts = {}) {
  const {
    update = () => {},
    render = () => {},
    raf = getDefaultRaf(),
    cancelRaf = getDefaultCancelRaf(),
    fixedDt = DEFAULT_FIXED_DT,
    maxAccumulator = DEFAULT_MAX_ACCUMULATOR,
  } = opts;
  const rawNow = opts.now ?? getDefaultNow();
  const nowScale = opts.now === undefined ? 1 / 1000 : 1;

  assertFunction(update, 'update');
  assertFunction(render, 'render');
  assertFunction(raf, 'raf');
  assertFunction(rawNow, 'now');

  if (!(fixedDt > 0)) {
    throw new RangeError('createLoop requires fixedDt to be greater than 0');
  }

  if (!(maxAccumulator >= 0)) {
    throw new RangeError('createLoop requires maxAccumulator to be greater than or equal to 0');
  }

  let running = false;
  let paused = false;
  let frameId = null;
  let lastTime = 0;
  let accumulator = 0;

  const readNow = () => rawNow() * nowScale;

  const scheduleNextFrame = () => {
    if (!running) {
      return;
    }

    frameId = raf(frame);
  };

  const consumeAccumulator = () => {
    while (accumulator + EPSILON >= fixedDt) {
      update(fixedDt);
      accumulator -= fixedDt;
    }

    if (Math.abs(accumulator) < EPSILON) {
      accumulator = 0;
    }
  };

  const renderFrame = () => {
    const alpha = fixedDt === 0 ? 0 : Math.min(Math.max(accumulator / fixedDt, 0), 1);
    render(alpha);
  };

  function frame() {
    if (!running) {
      return;
    }

    const currentTime = readNow();

    if (paused) {
      lastTime = currentTime;
      renderFrame();
      scheduleNextFrame();
      return;
    }

    const elapsed = Math.max(0, currentTime - lastTime);
    lastTime = currentTime;
    accumulator = Math.min(accumulator + elapsed, maxAccumulator);

    consumeAccumulator();
    renderFrame();
    scheduleNextFrame();
  }

  const start = () => {
    if (running) {
      return;
    }

    running = true;
    paused = false;
    accumulator = 0;
    lastTime = readNow();
    scheduleNextFrame();
  };

  const stop = () => {
    if (!running) {
      return;
    }

    running = false;
    paused = false;
    accumulator = 0;

    if (frameId !== null && typeof cancelRaf === 'function') {
      cancelRaf(frameId);
    }

    frameId = null;
  };

  const pause = () => {
    if (!running || paused) {
      return;
    }

    paused = true;
    lastTime = readNow();
  };

  const resume = () => {
    if (!running || !paused) {
      return;
    }

    paused = false;
    lastTime = readNow();
  };

  return {
    start,
    stop,
    pause,
    resume,
    isRunning: () => running,
    isPaused: () => paused,
  };
}
