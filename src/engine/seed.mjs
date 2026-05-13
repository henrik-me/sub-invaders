export function createRng(seed = 1) {
  let state = 0;

  function reseed(value) {
    state = Number(value) >>> 0;
    return state;
  }

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  reseed(seed);

  return {
    next,
    range,
    int,
    seed: reseed,
  };
}
