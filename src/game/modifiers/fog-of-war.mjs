// CS04 D2 — fog-of-war modifier.
// Limits visibility to a circular halo around the player. The halo is rendered
// as a darkened canvas pass with a circular punch-out at the player position.
// This module is a pure scene-init mutator + an overlay renderer; integration
// row 10 wires it into play.mjs's render pipeline.

export const NAME = 'fog-of-war';

export const DEFAULT_HALO_RADIUS = 96;

export function apply(state, { haloRadius = DEFAULT_HALO_RADIUS } = {}) {
  state.modifiers ??= {};
  state.modifiers.fogOfWar = { enabled: true, haloRadius };
  return state;
}

export function renderOverlay(renderer, { player, canvasWidth, canvasHeight, haloRadius = DEFAULT_HALO_RADIUS } = {}) {
  if (!renderer || !player) return;
  const ctx = typeof renderer.ctx === 'function' ? renderer.ctx() : renderer.ctx;
  if (!ctx || typeof ctx.save !== 'function') return;
  const px = player.x + (player.w ?? 0) / 2;
  const py = player.y + (player.h ?? 0) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  ctx.arc(px, py, haloRadius, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.restore();
}
