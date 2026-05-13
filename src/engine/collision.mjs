const defaultAabbOf = (entity) => ({
  x: entity.x,
  y: entity.y,
  w: entity.w,
  h: entity.h,
});

const isCollisionCandidate = (entity) => entity?.alive !== false;

/**
 * AABBs use closed intervals: touching edges or corners count as overlap.
 */
export const aabbOverlap = (a, b) => (
  a.x <= b.x + b.w
  && a.x + a.w >= b.x
  && a.y <= b.y + b.h
  && a.y + a.h >= b.y
);

export const groupCollisions = (groupA, groupB, opts = {}) => {
  const { aabbOf = defaultAabbOf } = opts ?? {};
  const pairs = [];

  for (const a of groupA ?? []) {
    if (!isCollisionCandidate(a)) {
      continue;
    }

    const aAabb = aabbOf(a);

    for (const b of groupB ?? []) {
      if (!isCollisionCandidate(b)) {
        continue;
      }

      if (aabbOverlap(aAabb, aabbOf(b))) {
        pairs.push({ a, b });
      }
    }
  }

  return pairs;
};
