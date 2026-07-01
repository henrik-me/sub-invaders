import test from 'node:test';
import assert from 'node:assert/strict';
import { check, readAggregate, resolveExit } from './coverage-suite.mjs';

test('readAggregate reads monocart .summary shape', () => {
  const agg = readAggregate({ summary: { lines: { pct: 70.5 }, branches: { pct: 60 } } });
  assert.deepEqual(agg, { lines: 70.5, branches: 60 });
});

test('readAggregate reads c8 .total shape', () => {
  const agg = readAggregate({ total: { lines: { pct: 90 }, statements: { pct: 88 } } });
  assert.deepEqual(agg, { lines: 90, statements: 88 });
});

test('readAggregate returns null when no aggregate block', () => {
  assert.equal(readAggregate({ files: [] }), null);
  assert.equal(readAggregate(null), null);
});

test('readAggregate excludes non-finite pct values (NaN/Infinity)', () => {
  const agg = readAggregate({ summary: { lines: { pct: NaN }, branches: { pct: Infinity }, bytes: { pct: 80 } } });
  assert.deepEqual(agg, { bytes: 80 });
});

test('check passes when all metrics meet floors', () => {
  const { failures } = check(
    { lines: 68, statements: 77, functions: 77, branches: 62, bytes: 78 },
    { lines: 69.24, statements: 78.24, functions: 78.39, branches: 63.41, bytes: 79.06 },
  );
  assert.equal(failures.length, 0);
});

test('check flags a metric below its floor', () => {
  const { failures } = check({ lines: 80 }, { lines: 69.24 });
  assert.equal(failures.length, 1);
  assert.equal(failures[0].metric, 'lines');
  assert.equal(failures[0].floor, 80);
});

test('check ignores non-numeric floor metadata (_reason)', () => {
  const { failures } = check({ lines: 68, _reason: 'documented deviation' }, { lines: 69.24 });
  assert.equal(failures.length, 0);
});

test('check fails closed when an expected metric is missing from the aggregate', () => {
  const { failures } = check({ bytes: 78 }, { lines: 69 });
  assert.equal(failures.length, 1);
  assert.equal(failures[0].metric, 'bytes');
  assert.equal(failures[0].got, null);
});

test('check treats a non-finite aggregate value as missing (fail-closed)', () => {
  const { failures } = check({ lines: 68 }, { lines: NaN });
  assert.equal(failures.length, 1);
  assert.equal(failures[0].got, null);
});

test('check does not throw on a null/undefined aggregate (all metrics missing)', () => {
  const { failures } = check({ lines: 68, bytes: 78 }, null);
  assert.equal(failures.length, 2);
  assert.ok(failures.every((f) => f.got === null));
});

test('resolveExit returns 0 when there are no failures', () => {
  assert.equal(resolveExit([]), 0);
});

test('resolveExit returns 1 for a real breach (metric below floor)', () => {
  assert.equal(resolveExit([{ metric: 'lines', got: 60, floor: 70 }]), 1);
});

test('resolveExit returns 2 (fail-closed) when a floored metric is missing', () => {
  assert.equal(resolveExit([{ metric: 'bytes', got: null, floor: 78 }]), 2);
});

test('resolveExit prefers fail-closed (2) when both a breach and a missing metric occur', () => {
  assert.equal(resolveExit([
    { metric: 'lines', got: 60, floor: 70 },
    { metric: 'bytes', got: null, floor: 78 },
  ]), 2);
});
