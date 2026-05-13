export class Entity {
  constructor({ x = 0, y = 0, vx = 0, vy = 0, w = 0, h = 0 } = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.w = w;
    this.h = h;
    this.alive = true;
  }

  aabb() {
    return {
      x: this.x,
      y: this.y,
      w: this.w,
      h: this.h,
    };
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render() {}

  kill() {
    this.alive = false;
  }
}
