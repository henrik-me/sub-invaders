#!/usr/bin/env node
// Enforces SUITE-LEVEL (aggregate) coverage floors defined in
// coverage-thresholds.json under "<suite>.suite". Complements the per-file gate
// (scripts/coverage-perfile.mjs): that one gates each source file; this one gates
// the whole-suite aggregate percentages.
//
// Motivation (CS18): the monocart reporter's coverage.onEnd hook set
// process.exitCode = 1 on a floor breach, but Playwright derives its exit code
// from test results, not a late reporter mutation, so `playwright test` exited 0
// even when the aggregate was below the floor -- the check was cosmetic. This
// script runs AFTER `playwright test` and has a real, reliable exit code.
//
// Usage:
//   node scripts/coverage-suite.mjs --suite=e2e --summary=coverage-report/coverage-report.json
//
// Exit codes: 0 = all floors met; 1 = a floor breached; 2 = misconfig / summary
// missing or malformed (fail-closed).

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

// Extract the aggregate {metric: pct} map from a coverage summary file.
// Supports monocart's coverage-report.json (top-level `.summary`) and c8's
// json-summary coverage-summary.json (top-level `.total`).
export function readAggregate(summaryJson) {
  const agg = summaryJson?.summary ?? summaryJson?.total;
  if (!agg || typeof agg !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(agg)) {
    if (v && Number.isFinite(v.pct)) out[k] = v.pct;
  }
  return out;
}

// Pure comparison: returns { failures: [{metric, got, floor}] }.
// Only numeric-valued floor keys are compared; metadata like `_reason` is ignored.
// A metric that is absent, non-object, or non-finite (NaN/Infinity) in the
// aggregate fails closed (got: null) so a malformed/changed summary can't yield a
// silent false pass. Robust to a null/undefined aggregate (optional chaining).
export function check(floors, aggregate) {
  const failures = [];
  for (const [metric, floor] of Object.entries(floors)) {
    if (typeof floor !== 'number') continue; // ignore _reason and other metadata
    const got = aggregate?.[metric];
    if (!Number.isFinite(got)) {
      failures.push({ metric, got: null, floor });
      continue;
    }
    if (got < floor) failures.push({ metric, got, floor });
  }
  return { failures };
}

// Map a failure list to a process exit code:
//   0 = no failures; 1 = real breach(es) below floor; 2 = fail-closed, because a
//   floored metric is ABSENT from the aggregate (the summary shape changed /
//   is malformed, so the numbers can't be trusted). A missing metric takes
//   precedence over a plain breach.
export function resolveExit(failures) {
  if (!failures.length) return 0;
  return failures.some((f) => f.got === null) ? 2 : 1;
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
  let floors;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))[suite];
    floors = cfg && cfg.suite;
  } catch (e) {
    console.error(`\u274c Cannot read coverage-thresholds.json: ${e.message}`);
    process.exit(2);
  }
  if (!floors || typeof floors !== 'object') {
    console.error(`\u274c No suite-level floors for '${suite}' in coverage-thresholds.json ([${suite}].suite).`);
    process.exit(2);
  }

  let aggregate;
  try {
    const raw = JSON.parse(fs.readFileSync(path.resolve(repoRoot, summaryPath), 'utf8'));
    aggregate = readAggregate(raw);
  } catch (e) {
    console.error(`\u274c Cannot read coverage summary '${summaryPath}': ${e.message}`);
    process.exit(2);
  }
  if (!aggregate) {
    console.error(`\u274c Coverage summary '${summaryPath}' has no aggregate (.summary/.total) block.`);
    process.exit(2);
  }

  const { failures } = check(floors, aggregate);
  const code = resolveExit(failures);
  if (code === 0) {
    console.log(`\u2705 Suite-level coverage gate passed for ${suite} suite.`);
    return;
  }

  const breaches = failures.filter((f) => f.got !== null);
  const missing = failures.filter((f) => f.got === null);

  if (breaches.length) {
    console.error(`\n\u274c ${suite.toUpperCase()} suite-level coverage floor breached (${breaches.length} miss${breaches.length === 1 ? '' : 'es'}):`);
    for (const f of breaches) {
      console.error(`   - ${f.metric}: ${f.got.toFixed(2)}% < floor ${f.floor}%`);
    }
    console.error('\nFix one of the following:');
    console.error('  - add tests to raise the aggregate above the floor');
    console.error(`  - if the gap is covered by another suite, lower the floor in coverage-thresholds.json ([${suite}].suite) with a documented _reason`);
  }

  if (missing.length) {
    // Fail-closed (exit 2): a floored metric is absent from the summary, so the
    // report shape likely changed -- do NOT treat this as a coverage regression.
    console.error(`\n\u274c Coverage summary is missing floored metric(s) -- cannot verify the ${suite} suite floor (fail-closed):`);
    for (const f of missing) {
      console.error(`   - ${f.metric}: not present in the aggregate (expected floor ${f.floor}%)`);
    }
    console.error('  This usually means the coverage report shape changed; fix the reporter/summary, not the floor.');
  }

  process.exit(code);
}

// Run the gate only when invoked directly; importing (e.g. from the unit test)
// must not trigger it.
if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  main();
}
