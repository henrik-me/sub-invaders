#!/usr/bin/env node
// Enforces per-file coverage thresholds defined in coverage-thresholds.json.
// Reads c8's coverage-summary.json (unit) or monocart's coverage-report.json (e2e).
// Exits non-zero if any file is below its (default or overridden) per-file floor.
//
// Usage:
//   node scripts/coverage-perfile.mjs --suite=unit --summary=coverage-report-unit/coverage-summary.json
//   node scripts/coverage-perfile.mjs --suite=e2e  --summary=coverage-report/coverage-report.json

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

// Normalize file key to repo-relative posix path: src/engine/loop.mjs
export function normalize(key) {
  if (!key) return null;
  let p = key;
  // Strip http://host:port/ prefix (monocart URLs)
  p = p.replace(/^https?:\/\/[^/]+\//, '');
  // Strip absolute repo prefix (c8 keys are absolute paths)
  p = p.replace(/\\/g, '/');
  const idx = p.lastIndexOf('/src/');
  if (idx >= 0) p = p.slice(idx + 1);
  // esbuild sourcemaps reference parent-relative paths (../game/main.mjs,
  // ../game/scenes/play.mjs, and ../../engine/loop.mjs from a deeper bundle
  // dir); collapse any leading ../ segments before the engine/|game/ prefix
  // detection so they resolve to src/<dir>/<file> like the absolute and
  // bare-prefix forms.
  p = p.replace(/^(?:\.\.\/)+/, '');
  // monocart strips the /src/ segment, so engine/loop.mjs -> src/engine/loop.mjs
  if (!p.startsWith('src/') && (p.startsWith('engine/') || p.startsWith('game/'))) {
    p = 'src/' + p;
  }
  return p;
}

// Pull per-file entries from either summary format.
function loadFiles(suite, summaryPath) {
  const raw = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const out = [];
  if (suite === 'unit') {
    for (const [k, v] of Object.entries(raw)) {
      if (k === 'total') continue;
      const file = normalize(k);
      if (!file || !file.startsWith('src/')) continue;
      out.push({
        file,
        metrics: {
          lines: v.lines?.pct,
          statements: v.statements?.pct,
          functions: v.functions?.pct,
          branches: v.branches?.pct,
        },
      });
    }
  } else {
    for (const f of raw.files || []) {
      const file = normalize(f.url || f.sourcePath || f.id);
      if (!file || !file.startsWith('src/')) continue;
      const m = (k) => (typeof f[k]?.pct === 'number' ? f[k].pct : null);
      out.push({
        file,
        metrics: {
          lines: m('lines'),
          statements: m('statements'),
          functions: m('functions'),
          branches: m('branches'),
          bytes: m('bytes'),
        },
      });
    }
  }
  return out;
}

function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const m = a.match(/^--([^=]+)=(.*)$/);
      return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
    }),
  );

  const suite = args.suite;
  const summaryPath = args.summary;
  if (!suite || !summaryPath) {
    console.error('Usage: --suite=<unit|e2e> --summary=<path>');
    process.exit(2);
  }

  const cfgPath = path.join(repoRoot, 'coverage-thresholds.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))[suite];
  if (!cfg) {
    console.error(`No config block for suite '${suite}' in coverage-thresholds.json`);
    process.exit(2);
  }

  const defaults = cfg.perFileDefaults;
  const overrides = cfg.overrides || {};

  const files = loadFiles(suite, summaryPath);
  const failures = [];

  for (const { file, metrics } of files) {
    const ovr = overrides[file] || {};
    if (ovr._skip) continue;
    for (const [k, def] of Object.entries(defaults)) {
      const floor = ovr[k] !== undefined ? ovr[k] : def;
      const got = metrics[k];
      // Skip metrics that the suite doesn't report (e.g. bytes for unit).
      if (got === null || got === undefined || got === '') continue;
      if (got < floor) {
        failures.push({ file, metric: k, got, floor, source: ovr[k] !== undefined ? 'override' : 'default' });
      }
    }
  }

  if (failures.length) {
    console.error(`\n❌ Per-file coverage gate failed for ${suite} suite (${failures.length} miss${failures.length === 1 ? '' : 'es'}):`);
    console.error('   ' + 'file'.padEnd(45) + 'metric'.padEnd(12) + 'got'.padStart(8) + ' < '.padStart(4) + 'floor'.padStart(7) + '   source');
    for (const f of failures) {
      console.error('   ' + f.file.padEnd(45) + f.metric.padEnd(12) + String(f.got.toFixed(2)).padStart(8) + ' < '.padStart(4) + String(f.floor).padStart(7) + '   ' + f.source);
    }
    console.error('\nFix one of the following:');
    console.error('  - add tests to raise the file above its floor');
    console.error('  - if the gap is dead-in-production code, lower the per-file override in coverage-thresholds.json with a documented _reason');
    console.error('  - if the file is test infrastructure, exclude it from c8 includes / monocart entryFilter');
    process.exit(1);
  }

  console.log(`✅ Per-file coverage gate passed for ${suite} suite (${files.length} files checked).`);
}

// Run the gate only when invoked directly. Importing this module (e.g. from
// the unit test that exercises normalize() in isolation) must not trigger it.
if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  main();
}
