import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import checks from './verify-deploy.checks.mjs';

describe('verify-deploy.checks — wired CS02 deliverable 9 probe', () => {
  it('exports an array of checks', () => {
    assert.ok(Array.isArray(checks));
    assert.ok(checks.length >= 1);
  });

  it('each check has name + path + expect.status', () => {
    for (const c of checks) {
      assert.equal(typeof c.name, 'string', 'name must be string');
      assert.ok(c.name.length > 0);
      assert.equal(typeof c.path, 'string', 'path must be string');
      assert.ok(c.path.startsWith('/'), `path "${c.path}" must start with /`);
      assert.ok(c.expect && typeof c.expect === 'object');
      assert.equal(typeof c.expect.status, 'number');
    }
  });

  it('check names are unique', () => {
    const names = checks.map((c) => c.name);
    assert.equal(new Set(names).size, names.length);
  });

  it('covers frontend-root, health, and sprites per CS02 acceptance criterion 11', () => {
    const names = new Set(checks.map((c) => c.name));
    assert.ok(names.has('frontend-root'), 'must include frontend-root check');
    assert.ok(names.has('health'), 'must include health check');
    assert.ok(names.has('sprites'), 'must include sprites check');
  });

  it('frontend-root validator rejects the CS01 stub body (no #game-canvas)', () => {
    const root = checks.find((c) => c.name === 'frontend-root');
    assert.ok(root.expect.body, 'frontend-root must define a body validator');
    const cs01StubBody = '<!doctype html><html><body><h1>Sub Invaders coming soon</h1></body></html>';
    const result = root.expect.body(cs01StubBody, { baseUrl: '', expectedVersion: 'x' });
    assert.notEqual(result, null, 'CS01 stub body must FAIL validation');
    assert.match(result, /game-canvas/);
  });

  it('frontend-root validator accepts a body with the expected canvas + title', () => {
    const root = checks.find((c) => c.name === 'frontend-root');
    const goodBody = '<!doctype html><html><head><title>Sub Invaders</title></head><body><canvas id="game-canvas" width="800" height="600"></canvas></body></html>';
    assert.equal(root.expect.body(goodBody, { baseUrl: '', expectedVersion: 'x' }), null);
  });

  it('frontend-root validator rejects empty body', () => {
    const root = checks.find((c) => c.name === 'frontend-root');
    assert.notEqual(root.expect.body('', { baseUrl: '', expectedVersion: 'x' }), null);
  });

  it('health and sprites validators reject empty bodies', () => {
    for (const name of ['health', 'sprites']) {
      const c = checks.find((x) => x.name === name);
      assert.ok(c.expect.body, `${name} must define a body validator`);
      assert.notEqual(c.expect.body('', { baseUrl: '', expectedVersion: 'x' }), null);
      assert.equal(c.expect.body('non-empty payload', { baseUrl: '', expectedVersion: 'x' }), null);
    }
  });
});
