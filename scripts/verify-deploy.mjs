#!/usr/bin/env node
/**
 * scripts/verify-deploy.mjs — Post-deployment verification runner.
 *
 * Runs a sequence of named checks against a deployed service. Confirms that
 * the deployed version matches the expected SHA or tag, that key endpoints
 * respond correctly, and that deployment metadata is consistent.
 *
 * Distinct from smoke (lightweight reachability) and health-check (ongoing
 * readiness probe): this is a one-shot, comprehensive post-deploy gate.
 *
 * Usage:
 *   node scripts/verify-deploy.mjs \
 *     --url <base-url> \
 *     --expected-version <sha-or-tag> \
 *     [--checks <name,name,...>] \
 *     [--quiet]
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 *   2 — usage/invocation error (missing or invalid argument)
 *
 * @module scripts/verify-deploy.mjs
 */

import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Guard: assert that argv[i+1] exists and is not a flag token.
 * Exits 2 on violation (LRN-040).
 *
 * @param {string[]} argv
 * @param {number} i      — index of the flag token (e.g. '--url')
 * @param {string} flagName
 * @returns {string}      — the value token
 */
function requireValue(argv, i, flagName) {
  const next = argv[i + 1];
  if (!next || next.startsWith('-')) {
    process.stderr.write(`verify-deploy: missing value for ${flagName}\n`);
    process.exit(2);
  }
  return next;
}

function printUsage(stream) {
  stream.write(
    'Usage: node scripts/verify-deploy.mjs \\\n' +
    '  --url <base-url> \\\n' +
    '  --expected-version <sha-or-tag> \\\n' +
    '  [--checks <name,name,...>] \\\n' +
    '  [--quiet]\n' +
    '\n' +
    'Exit codes: 0=all passed  1=check failures  2=usage error\n',
  );
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

let baseUrl = null;
let expectedVersion = null;
let checksFilter = null;
let quiet = false;

const argv = process.argv.slice(2);

if (argv.includes('--help')) {
  printUsage(process.stdout);
  process.exit(0);
}

if (argv.length === 0) {
  printUsage(process.stderr);
  process.exit(2);
}

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--url') {
    baseUrl = requireValue(argv, i, '--url');
    i++;
  } else if (a === '--expected-version') {
    expectedVersion = requireValue(argv, i, '--expected-version');
    i++;
  } else if (a === '--checks') {
    checksFilter = requireValue(argv, i, '--checks').split(',').map((s) => s.trim());
    i++;
  } else if (a === '--quiet') {
    quiet = true;
  } else {
    process.stderr.write(`verify-deploy: unknown flag: ${a}\n`);
    printUsage(process.stderr);
    process.exit(2);
  }
}

if (!baseUrl) {
  process.stderr.write('verify-deploy: --url is required\n');
  printUsage(process.stderr);
  process.exit(2);
}
if (!expectedVersion) {
  process.stderr.write('verify-deploy: --expected-version is required\n');
  printUsage(process.stderr);
  process.exit(2);
}

baseUrl = baseUrl.replace(/\/$/, '');

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

/**
 * Perform a GET request and return status + body text.
 *
 * @param {string} url
 * @returns {Promise<{ status: number, body: string }>}
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https://') ? https : http;
    const req = lib.get(url, { timeout: 10_000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`request timed out: ${url}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Check runner
// ---------------------------------------------------------------------------

/**
 * @typedef {{ expectedVersion: string, baseUrl: string }} CheckContext
 *
 * @typedef {{
 *   name: string,
 *   path: string,
 *   expect: {
 *     status: number,
 *     json?: (body: unknown, ctx: CheckContext) => string | null
 *   }
 * }} CheckDef
 */

/**
 * Run a single check and return a pass/fail outcome.
 *
 * @param {CheckDef} check
 * @param {CheckContext} ctx
 * @returns {Promise<{ name: string, passed: boolean, message: string }>}
 */
async function runCheck(check, ctx) {
  const url = ctx.baseUrl + check.path;
  let res;
  try {
    res = await httpGet(url);
  } catch (err) {
    return { name: check.name, passed: false, message: `network error: ${err.message}` };
  }

  if (res.status !== check.expect.status) {
    return {
      name: check.name,
      passed: false,
      message: `HTTP ${res.status} (expected ${check.expect.status})`,
    };
  }

  if (check.expect.json) {
    let body;
    try {
      body = JSON.parse(res.body);
    } catch {
      return { name: check.name, passed: false, message: 'response body is not valid JSON' };
    }
    const failure = check.expect.json(body, ctx);
    if (failure != null) {
      return { name: check.name, passed: false, message: failure };
    }
  }

  return { name: check.name, passed: true, message: 'ok' };
}

// ---------------------------------------------------------------------------
// Load checks
// ---------------------------------------------------------------------------

// TODO: customize — rename scripts/verify-deploy.checks.example.mjs to
// scripts/verify-deploy.checks.mjs, then update this import path to match.
const checksModule = await import(
  pathToFileURL(path.join(__dirname, 'verify-deploy.checks.example.mjs')).href
);

/** @type {CheckDef[]} */
let checks = checksModule.default;

if (checksFilter) {
  checks = checks.filter((c) => checksFilter.includes(c.name));
  if (checks.length === 0) {
    process.stderr.write(
      `verify-deploy: no checks match filter: ${checksFilter.join(',')}\n`,
    );
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

/** @type {CheckContext} */
const ctx = { expectedVersion, baseUrl };

let passed = 0;
let failed = 0;

for (const check of checks) {
  const outcome = await runCheck(check, ctx);
  if (outcome.passed) {
    passed++;
    if (!quiet) process.stdout.write(`  ✓ ${outcome.name}\n`);
  } else {
    failed++;
    process.stderr.write(`  ✗ ${outcome.name}: ${outcome.message}\n`);
  }
}

if (!quiet) {
  const total = passed + failed;
  process.stdout.write(
    `\n${total} check${total === 1 ? '' : 's'}: ${passed} passed, ${failed} failed\n`,
  );
}

// TODO: customize — add post-failure rollback or alert logic here if needed.
// The `failed` variable holds the count of failed checks. Example:
//   if (failed > 0) { await triggerRollback(); }

process.exit(failed > 0 ? 1 : 0);
