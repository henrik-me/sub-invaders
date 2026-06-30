import { Entity } from 'canvas-game-engine/entity.mjs';

const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_PLAYER_Y = 560;
const DEFAULT_PLAYER_SPEED = 240;
const DEFAULT_FIRE_COOLDOWN_MS = 350;
const DEFAULT_INVULN_MS = 1500;
const DEFAULT_BLINK_MS = 120;
const DEFAULT_TORPEDO_SPEED = 540;

const SUBMARINE_FRAME = Object.freeze({ x: 0, y: 0, w: 32, h: 16 });
const TORPEDO_FRAME = Object.freeze({ x: 40, y: 0, w: 4, h: 10 });

const LEFT_CODES = Object.freeze(['ArrowLeft', 'KeyA']);
const RIGHT_CODES = Object.freeze(['ArrowRight', 'KeyD']);
const FIRE_CODES = Object.freeze(['Space', 'KeyW', 'ArrowUp']);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finiteOrZero = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

function inputActive(input, method, codes) {
  return codes.some((code) => input?.[method]?.(code) === true);
}

function imageFromSprites(sprites) {
  return sprites?.image ?? sprites?.sheet?.image ?? sprites?.spriteSheet?.image ?? sprites;
}

function frameFromSprites(sprites, key, fallback) {
  return sprites?.frames?.[key] ?? sprites?.[key] ?? fallback;
}

function drawSpriteFrame(renderer, sprites, key, fallback, x, y, w, h) {
  if (typeof renderer?.drawSprite !== 'function') {
    return false;
  }

  const image = imageFromSprites(sprites);
  const frame = frameFromSprites(sprites, key, fallback);

  if (!image || !frame) {
    return false;
  }

  renderer.drawSprite(image, frame.x, frame.y, frame.w, frame.h, x, y, w, h);
  return true;
}

class Torpedo extends Entity {
  constructor(opts = {}) {
    const speed = opts.speed ?? DEFAULT_TORPEDO_SPEED;
    const w = opts.w ?? TORPEDO_FRAME.w;
    const h = opts.h ?? TORPEDO_FRAME.h;

    super({
      x: opts.x ?? 0,
      y: opts.y ?? 0,
      vx: opts.vx ?? 0,
      vy: opts.vy ?? -speed,
      w,
      h,
    });

    this.speed = speed;
    this.sprite = opts.sprite ?? 'torpedo';
  }

  update(dt) {
    super.update(finiteOrZero(dt));

    if (this.y + this.h < 0) {
      this.kill();
    }
  }

  render(renderer, sprites) {
    return drawSpriteFrame(renderer, sprites, this.sprite, TORPEDO_FRAME, this.x, this.y, this.w, this.h);
  }
}

class Player extends Entity {
  constructor(opts = {}) {
    const canvasWidth = opts.canvasWidth ?? DEFAULT_CANVAS_WIDTH;
    const w = opts.w ?? SUBMARINE_FRAME.w;
    const h = opts.h ?? SUBMARINE_FRAME.h;
    const centerX = (canvasWidth - w) / 2;
    const x = clamp(opts.x ?? centerX, 0, Math.max(0, canvasWidth - w));
    const y = opts.y ?? opts.spawnY ?? DEFAULT_PLAYER_Y;

    super({ x, y, w, h });

    this.canvasWidth = canvasWidth;
    this.speed = opts.speed ?? DEFAULT_PLAYER_SPEED;
    this.lives = opts.lives ?? 3;
    this.fireCooldownMs = opts.fireCooldownMs ?? DEFAULT_FIRE_COOLDOWN_MS;
    this.invulnMs = opts.invulnMs ?? DEFAULT_INVULN_MS;
    this.blinkMs = opts.blinkMs ?? DEFAULT_BLINK_MS;
    this.spawnY = opts.spawnY ?? y;
    this.torpedoSpeed = opts.torpedoSpeed ?? DEFAULT_TORPEDO_SPEED;
    this.torpedoW = opts.torpedoW ?? TORPEDO_FRAME.w;
    this.torpedoH = opts.torpedoH ?? TORPEDO_FRAME.h;
    this.torpedoSprite = opts.torpedoSprite ?? 'torpedo';
    this.currentTorpedo = null;
    this.fireCooldownRemainingMs = 0;
    this.invulnRemainingMs = 0;
    this.invulnElapsedMs = 0;
    this.sprite = opts.sprite ?? 'submarine';
  }

  centerX() {
    return (this.canvasWidth - this.w) / 2;
  }

  update(dt, input) {
    const seconds = finiteOrZero(dt);
    const milliseconds = seconds * 1000;
    const left = inputActive(input, 'down', LEFT_CODES);
    const right = inputActive(input, 'down', RIGHT_CODES);
    const direction = (right ? 1 : 0) - (left ? 1 : 0);

    this.vx = direction * this.speed;
    super.update(seconds);
    this.x = clamp(this.x, 0, Math.max(0, this.canvasWidth - this.w));

    if (this.fireCooldownRemainingMs > 0) {
      this.fireCooldownRemainingMs = Math.max(0, this.fireCooldownRemainingMs - milliseconds);
    }

    if (this.invulnRemainingMs > 0) {
      this.invulnRemainingMs = Math.max(0, this.invulnRemainingMs - milliseconds);
      this.invulnElapsedMs += milliseconds;
    }
  }

  tryFire(input) {
    if (!inputActive(input, 'pressed', FIRE_CODES)) {
      return null;
    }

    if (this.activeTorpedo() !== null || this.fireCooldownRemainingMs > 0) {
      return null;
    }

    const torpedo = createTorpedo({
      x: this.x + (this.w / 2) - (this.torpedoW / 2),
      y: this.y - this.torpedoH,
      w: this.torpedoW,
      h: this.torpedoH,
      speed: this.torpedoSpeed,
      sprite: this.torpedoSprite,
    });

    this.currentTorpedo = torpedo;
    this.fireCooldownRemainingMs = this.fireCooldownMs;
    return torpedo;
  }

  activeTorpedo() {
    if (this.currentTorpedo?.alive !== false && this.currentTorpedo !== null) {
      return this.currentTorpedo;
    }

    this.currentTorpedo = null;
    return null;
  }

  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    return this.lives;
  }

  respawn() {
    this.alive = true;
    this.x = clamp(this.centerX(), 0, Math.max(0, this.canvasWidth - this.w));
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.invulnRemainingMs = this.invulnMs;
    this.invulnElapsedMs = 0;
    return this;
  }

  isInvulnerable() {
    return this.invulnRemainingMs > 0;
  }

  isDead() {
    return this.lives <= 0;
  }

  render(renderer, sprites) {
    if (this.isInvulnerable() && Math.floor(this.invulnElapsedMs / this.blinkMs) % 2 === 1) {
      return false;
    }

    return drawSpriteFrame(renderer, sprites, this.sprite, SUBMARINE_FRAME, this.x, this.y, this.w, this.h);
  }
}

export function createTorpedo(opts = {}) {
  return new Torpedo(opts);
}

export function createPlayer(opts = {}) {
  return new Player(opts);
}
