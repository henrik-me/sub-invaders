import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const scriptPath = path.resolve('scripts', 'check-engine-isolation.mjs');

function makeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-engine-isolation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function runLinter(args) {
  return spawnSync('node', [scriptPath, ...args], { encoding: 'utf8' });
}

test('empty engine dir exits 0 with no errors', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  fs.mkdirSync(engineDir, { recursive: true });

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /PASS/);
});

test('engine file with no imports exits 0', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  writeFile(path.join(engineDir, 'main.mjs'), 'export const ok = true;\n');

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('engine file importing sibling engine file exits 0', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  writeFile(path.join(engineDir, 'peer.mjs'), 'export const peer = true;\n');
  writeFile(path.join(engineDir, 'main.mjs'), "import { peer } from './peer.mjs';\nexport { peer };\n");

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('engine file importing node:fs exits 0 because bare specifiers are allowed', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  writeFile(path.join(engineDir, 'main.mjs'), "import fs from 'node:fs';\nexport { fs };\n");

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('engine file importing ../game/foo.mjs exits 1 with file path in violation', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  const mainPath = path.join(engineDir, 'main.mjs');
  writeFile(mainPath, "import foo from '../game/foo.mjs';\nexport { foo };\n");

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /outside engine directories/);
  assert.match(result.stderr, new RegExp(escapeRegExp(path.normalize(mainPath))));
});

test('absolute import specifier exits 1', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  writeFile(path.join(engineDir, 'main.mjs'), "import thing from '/abs/path.mjs';\nexport { thing };\n");

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /import "\/abs\/path\.mjs" resolves to/);
  assert.match(result.stderr, /outside engine directories/);
});

test('import specifier containing literal src/game/ exits 1', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  writeFile(path.join(engineDir, 'main.mjs'), "import bad from 'package/src/game/foo.mjs';\nexport { bad };\n");

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /contains forbidden src\/game\/ path/);
});

test('--quiet suppresses success stdout but keeps error stderr', (t) => {
  const root = makeFixture(t);
  const okDir = path.join(root, 'ok-engine');
  writeFile(path.join(okDir, 'main.mjs'), 'export const ok = true;\n');

  const ok = runLinter(['--dir', okDir, '--quiet']);

  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, '');
  assert.equal(ok.stderr, '');

  const badDir = path.join(root, 'bad-engine');
  writeFile(path.join(badDir, 'main.mjs'), "import bad from '../game/foo.mjs';\nexport { bad };\n");

  const bad = runLinter(['--dir', badDir, '--quiet']);

  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, '');
  assert.match(bad.stderr, /^error:/);
});

test('--dir with no value exits 2 with usage on stderr', () => {
  const result = runLinter(['--dir', '--quiet']);

  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /missing value for --dir/);
  assert.match(result.stderr, /Usage:/);
});

test('--help exits 0 with usage on stdout', () => {
  const result = runLinter(['--help']);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Usage:/);
});

test('multiple --dir flags allow imports between sibling engine dirs', (t) => {
  const root = makeFixture(t);
  const engineA = path.join(root, 'engine-a');
  const engineB = path.join(root, 'engine-b');
  writeFile(path.join(engineA, 'main.mjs'), "import { peer } from '../engine-b/peer.mjs';\nexport { peer };\n");
  writeFile(path.join(engineB, 'peer.mjs'), 'export const peer = true;\n');

  const result = runLinter(['--dir', engineA, '--dir', engineB]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('non-existent dir exits 1 with clear stderr message', (t) => {
  const root = makeFixture(t);
  const missingDir = path.join(root, 'missing-engine');

  const result = runLinter(['--dir', missingDir]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /directory not found/);
  assert.match(result.stderr, new RegExp(escapeRegExp(path.normalize(missingDir))));
});

test('multi-line named static import is parsed and allowed inside engine dir', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  writeFile(path.join(engineDir, 'peer.mjs'), 'export const a = 1;\nexport const b = 2;\n');
  writeFile(
    path.join(engineDir, 'main.mjs'),
    "import {\n  a,\n  b,\n} from './peer.mjs';\nexport { a, b };\n"
  );

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('commented-out imports are ignored', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  writeFile(
    path.join(engineDir, 'main.mjs'),
    "// import bad from '../game/foo.mjs';\n/*\nimport worse from '../game/bar.mjs';\n*/\nexport const ok = true;\n"
  );

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('malformed static import fails closed', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  writeFile(path.join(engineDir, 'main.mjs'), 'import { broken\nexport const value = 1;\n');

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /unable to parse static import statement/);
});

test('side-effect import of sibling engine module is allowed', (t) => {
  const root = makeFixture(t);
  const engineDir = path.join(root, 'engine');
  writeFile(path.join(engineDir, 'setup.mjs'), 'globalThis.__engineSetup = true;\n');
  writeFile(path.join(engineDir, 'main.mjs'), "import './setup.mjs';\nexport const ok = true;\n");

  const result = runLinter(['--dir', engineDir]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
