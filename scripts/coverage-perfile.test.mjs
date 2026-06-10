import assert from 'node:assert/strict';
import test from 'node:test';

import { normalize } from './coverage-perfile.mjs';

// CS14: esbuild bundles src/game/main.mjs -> src/dist/main.mjs. The emitted
// sibling sourcemap references each original source as a parent-relative path
// (verified against the real build): ../engine/<x>.mjs, ../game/<x>.mjs, and
// nested ../game/scenes/<x>.mjs / ../game/modifiers/<x>.mjs. normalize() must
// collapse the leading ../ so the per-file gate attests the SOURCE file, not a
// raw relative path that would silently bypass the override map.

test('esbuild single-parent game path -> src/game', () => {
  assert.equal(normalize('../game/main.mjs'), 'src/game/main.mjs');
});

test('esbuild single-parent engine path -> src/engine', () => {
  assert.equal(normalize('../engine/loop.mjs'), 'src/engine/loop.mjs');
});

test('esbuild double-parent game path -> src/game', () => {
  assert.equal(normalize('../../game/main.mjs'), 'src/game/main.mjs');
});

test('esbuild double-parent engine path -> src/engine', () => {
  assert.equal(normalize('../../engine/loop.mjs'), 'src/engine/loop.mjs');
});

test('esbuild nested scenes path keeps subdir', () => {
  assert.equal(normalize('../game/scenes/play.mjs'), 'src/game/scenes/play.mjs');
});

test('esbuild nested modifiers path keeps subdir', () => {
  assert.equal(normalize('../game/modifiers/fog-of-war.mjs'), 'src/game/modifiers/fog-of-war.mjs');
});

// Pre-existing shapes must keep normalizing exactly as before the CS14 change.

test('posix absolute path slices at last /src/', () => {
  assert.equal(
    normalize('/home/runner/work/sub-invaders/sub-invaders/src/game/main.mjs'),
    'src/game/main.mjs',
  );
});

test('windows absolute path with backslashes slices at last /src/', () => {
  assert.equal(normalize('C:\\src\\sub-invaders\\src\\engine\\loop.mjs'), 'src/engine/loop.mjs');
});

test('monocart localhost URL strips host and prepends src/', () => {
  assert.equal(normalize('http://localhost:4173/game/main.mjs'), 'src/game/main.mjs');
});

test('bare engine/ prefix gets src/ prepended', () => {
  assert.equal(normalize('engine/loop.mjs'), 'src/engine/loop.mjs');
});

test('bare game/ prefix gets src/ prepended', () => {
  assert.equal(normalize('game/main.mjs'), 'src/game/main.mjs');
});

test('already-normalized src/ path is unchanged', () => {
  assert.equal(normalize('src/game/main.mjs'), 'src/game/main.mjs');
});

// The bundle itself (and anything under src/dist/) must NOT be coerced into a
// source path; it stays outside the src/{engine,game}/ tree so loadFiles()'s
// startsWith('src/') filter (plus the c8 --exclude "src/dist/**") drops it.

test('relative dist bundle path is not promoted to a gated source', () => {
  assert.equal(normalize('../dist/main.mjs'), 'dist/main.mjs');
});

test('monocart dist bundle URL is not promoted to a gated source', () => {
  assert.equal(normalize('http://localhost:4173/dist/main.mjs'), 'dist/main.mjs');
});

test('falsy keys return null', () => {
  assert.equal(normalize(''), null);
  assert.equal(normalize(null), null);
  assert.equal(normalize(undefined), null);
});
