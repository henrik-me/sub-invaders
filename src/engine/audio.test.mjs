import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAudioPool } from './audio.mjs';

function createStubAudio(src) {
  return {
    src,
    currentTime: 1,
    muted: false,
    playCount: 0,
    pauseCount: 0,
    play() {
      this.playCount += 1;
    },
    pause() {
      this.pauseCount += 1;
    },
  };
}

function createPoolWithEntries() {
  const entries = [];
  const pool = createAudioPool({
    audioFactory(src) {
      const audio = createStubAudio(src);
      entries.push(audio);
      return audio;
    },
  });

  return { entries, pool };
}

test('register creates poolSize stub audio entries', () => {
  const { entries, pool } = createPoolWithEntries();

  pool.register('shot', 'shot.wav', 3);

  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map((entry) => entry.src), ['shot.wav', 'shot.wav', 'shot.wav']);
});

test('play cycles registered audio entries round-robin', () => {
  const { entries, pool } = createPoolWithEntries();
  pool.register('shot', 'shot.wav', 2);

  pool.play('shot');
  assert.deepEqual(entries.map((entry) => entry.playCount), [1, 0]);
  assert.equal(entries[0].currentTime, 0);

  pool.play('shot');
  assert.deepEqual(entries.map((entry) => entry.playCount), [1, 1]);
  assert.equal(entries[1].currentTime, 0);

  pool.play('shot');
  assert.deepEqual(entries.map((entry) => entry.playCount), [2, 1]);
});

test('setMuted toggles muted on all registered entries', () => {
  const { entries, pool } = createPoolWithEntries();
  pool.register('shot', 'shot.wav', 2);
  pool.register('boom', 'boom.wav', 1);

  pool.setMuted(true);

  assert.deepEqual(entries.map((entry) => entry.muted), [true, true, true]);
});

test('play of an unregistered name is a no-op', () => {
  const { entries, pool } = createPoolWithEntries();
  pool.register('shot', 'shot.wav', 1);

  assert.doesNotThrow(() => pool.play('missing'));
  assert.equal(entries[0].playCount, 0);
});

test('register with poolSize 0 produces an empty pool', () => {
  const { entries, pool } = createPoolWithEntries();

  pool.register('quiet', 'quiet.wav', 0);
  pool.play('quiet');

  assert.equal(entries.length, 0);
});

test('register with NaN poolSize normalizes to 0', () => {
  const { entries, pool } = createPoolWithEntries();
  pool.register('weird', 'weird.wav', Number.NaN);

  assert.equal(entries.length, 0);
});

test('register coerces a poolSize float to an integer floor', () => {
  const { entries, pool } = createPoolWithEntries();
  pool.register('shot', 'shot.wav', 2.7);

  assert.equal(entries.length, 2);
});

test('register clamps a negative poolSize to 0', () => {
  const { entries, pool } = createPoolWithEntries();
  pool.register('weird', 'weird.wav', -3);
  assert.equal(entries.length, 0);
});

test('register tolerates a factory that throws', () => {
  let calls = 0;
  const pool = createAudioPool({
    audioFactory() {
      calls += 1;
      throw new Error('boom');
    },
  });
  pool.register('shot', 'shot.wav', 3);
  pool.play('shot'); // no entries created — should be a no-op
  assert.equal(calls, 3);
});

test('register tolerates a factory that returns null', () => {
  const pool = createAudioPool({
    audioFactory: () => null,
  });
  pool.register('shot', 'shot.wav', 2);
  assert.doesNotThrow(() => pool.play('shot'));
});

test('play swallows audio.play throwing synchronously', () => {
  const audio = {
    currentTime: 0,
    muted: false,
    play() { throw new Error('blocked'); },
  };
  const pool = createAudioPool({ audioFactory: () => audio });
  pool.register('shot', 'shot.wav', 1);
  assert.doesNotThrow(() => pool.play('shot'));
});

test('play swallows audio.play() rejected promise', async () => {
  let caught = false;
  const audio = {
    currentTime: 0,
    muted: false,
    play() {
      return Promise.reject(new Error('blocked'));
    },
  };
  const pool = createAudioPool({ audioFactory: () => audio });
  pool.register('shot', 'shot.wav', 1);
  pool.play('shot');
  // Wait a tick to ensure no unhandled rejection escapes.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(caught, false);
});

test('play tolerates audio without a play function', () => {
  const audio = { muted: false }; // no play method
  const pool = createAudioPool({ audioFactory: () => audio });
  pool.register('shot', 'shot.wav', 1);
  assert.doesNotThrow(() => pool.play('shot'));
});

test('play tolerates audio without currentTime support', () => {
  const audio = {
    muted: false,
    playCount: 0,
    play() {
      this.playCount += 1;
      return undefined;
    },
  };
  const pool = createAudioPool({ audioFactory: () => audio });
  pool.register('shot', 'shot.wav', 1);
  pool.play('shot');
  assert.equal(audio.playCount, 1);
});

test('setMuted with truthy/falsy values normalizes via Boolean()', () => {
  const { entries, pool } = createPoolWithEntries();
  pool.register('shot', 'shot.wav', 1);

  pool.setMuted(1);
  assert.equal(entries[0].muted, true);

  pool.setMuted(0);
  assert.equal(entries[0].muted, false);

  pool.setMuted(null);
  assert.equal(entries[0].muted, false);
});

test('newly registered entries inherit the current muted state', () => {
  const { entries, pool } = createPoolWithEntries();

  pool.setMuted(true);
  pool.register('shot', 'shot.wav', 2);

  assert.deepEqual(entries.map((e) => e.muted), [true, true]);
});

test('createAudioPool with no opts uses default Audio factory', () => {
  // Without globalThis.Audio, default factory returns null and play is a no-op.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  delete globalThis.Audio;
  try {
    const pool = createAudioPool();
    pool.register('shot', 'shot.wav', 2);
    assert.doesNotThrow(() => pool.play('shot'));
  } finally {
    if (original) Object.defineProperty(globalThis, 'Audio', original);
  }
});

test('default Audio constructor is used when present', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const created = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.muted = false;
      this.currentTime = 0;
      this.played = 0;
      created.push(this);
    }
    play() { this.played += 1; }
  }
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  try {
    const pool = createAudioPool();
    pool.register('shot', 'shot.wav', 2);
    pool.play('shot');
    assert.equal(created.length, 2);
    assert.equal(created[0].played, 1);
  } finally {
    if (original) {
      Object.defineProperty(globalThis, 'Audio', original);
    } else {
      delete globalThis.Audio;
    }
  }
});

