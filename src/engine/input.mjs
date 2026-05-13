const recognizedCodes = new Set([
  'ArrowLeft',
  'ArrowRight',
  'KeyA',
  'KeyD',
  'Space',
  'KeyW',
  'ArrowUp',
  'Escape',
  'KeyM',
  'KeyL',
]);

const touchOptions = { passive: true };

const touchAt = (touches, index) => {
  if (touches == null) {
    return undefined;
  }

  return touches[index] ?? touches.item?.(index);
};

const firstTouch = (touches) => touchAt(touches, 0);

const touchByIdentifier = (touches, identifier) => {
  const length = touches?.length ?? 0;

  for (let index = 0; index < length; index += 1) {
    const touch = touchAt(touches, index);

    if ((touch?.identifier ?? 0) === identifier) {
      return touch;
    }
  }

  return undefined;
};

const isWindowTarget = (target) => (
  typeof globalThis.window !== 'undefined'
  && target === globalThis.window
);

const isCanvasTarget = (target) => {
  const tagName = target?.tagName ?? target?.nodeName;
  return typeof tagName === 'string' && tagName.toUpperCase() === 'CANVAS';
};

const suppressesKeyboardDefaults = (target) => isWindowTarget(target) || isCanvasTarget(target);

const defaultAttachTarget = () => (
  typeof globalThis.window === 'undefined' ? undefined : globalThis.window
);

export const createInput = (opts = {}) => {
  const held = new Set();
  const pressedThisFrame = new Set();
  const releasedThisFrame = new Set();
  const fallbackTarget = opts.target;

  let attachedTarget;
  let activeTouchIdentifier;
  let lastTouchX = 0;
  let frameTouchDx = 0;

  const maybePreventKeyboardDefault = (event) => {
    if (attachedTarget !== undefined && suppressesKeyboardDefaults(attachedTarget)) {
      event.preventDefault?.();
    }
  };

  const onKeyDown = (event) => {
    const { code } = event;

    if (!recognizedCodes.has(code)) {
      return;
    }

    maybePreventKeyboardDefault(event);

    if (!held.has(code)) {
      pressedThisFrame.add(code);
    }

    held.add(code);
  };

  const onKeyUp = (event) => {
    const { code } = event;

    if (!recognizedCodes.has(code)) {
      return;
    }

    maybePreventKeyboardDefault(event);

    if (held.has(code)) {
      held.delete(code);
      releasedThisFrame.add(code);
    }
  };

  const onTouchStart = (event) => {
    const touch = firstTouch(event.changedTouches) ?? firstTouch(event.touches);

    if (touch === undefined) {
      return;
    }

    activeTouchIdentifier = touch.identifier ?? 0;
    lastTouchX = touch.clientX ?? 0;
  };

  const addTouchDelta = (touch) => {
    const x = touch.clientX ?? lastTouchX;
    frameTouchDx += x - lastTouchX;
    lastTouchX = x;
  };

  const onTouchMove = (event) => {
    if (activeTouchIdentifier === undefined) {
      return;
    }

    const touch = touchByIdentifier(event.changedTouches, activeTouchIdentifier)
      ?? touchByIdentifier(event.touches, activeTouchIdentifier);

    if (touch !== undefined) {
      addTouchDelta(touch);
    }
  };

  const onTouchEnd = (event) => {
    if (activeTouchIdentifier === undefined) {
      return;
    }

    const touch = touchByIdentifier(event.changedTouches, activeTouchIdentifier);

    if (touch !== undefined) {
      addTouchDelta(touch);
      activeTouchIdentifier = undefined;
    }
  };

  const addListeners = () => {
    attachedTarget.addEventListener('keydown', onKeyDown);
    attachedTarget.addEventListener('keyup', onKeyUp);
    attachedTarget.addEventListener('touchstart', onTouchStart, touchOptions);
    attachedTarget.addEventListener('touchmove', onTouchMove, touchOptions);
    attachedTarget.addEventListener('touchend', onTouchEnd, touchOptions);
  };

  const removeListeners = () => {
    attachedTarget.removeEventListener('keydown', onKeyDown);
    attachedTarget.removeEventListener('keyup', onKeyUp);
    attachedTarget.removeEventListener('touchstart', onTouchStart, touchOptions);
    attachedTarget.removeEventListener('touchmove', onTouchMove, touchOptions);
    attachedTarget.removeEventListener('touchend', onTouchEnd, touchOptions);
  };

  const api = {
    down: (code) => held.has(code),
    pressed: (code) => pressedThisFrame.has(code),
    released: (code) => releasedThisFrame.has(code),
    touchDx: () => frameTouchDx,
    attach: (target = fallbackTarget ?? defaultAttachTarget()) => {
      if (attachedTarget === target) {
        return api;
      }

      api.detach();

      if (target === undefined || target === null) {
        return api;
      }

      attachedTarget = target;
      addListeners();
      return api;
    },
    detach: () => {
      if (attachedTarget === undefined) {
        return api;
      }

      removeListeners();
      attachedTarget = undefined;
      activeTouchIdentifier = undefined;
      return api;
    },
    endFrame: () => {
      pressedThisFrame.clear();
      releasedThisFrame.clear();
      frameTouchDx = 0;
      return api;
    },
  };

  return api;
};
