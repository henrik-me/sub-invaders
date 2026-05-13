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
