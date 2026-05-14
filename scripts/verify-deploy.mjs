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
  return httpRequest({ url, method: 'GET' });
}

/**
 * Generic HTTP request helper for state-carrying checks. Returns the response
 * status, body, and parsed JSON when applicable. Used by `check.run(ctx)`
 * handlers to drive multi-step probes (e.g. POST /session → POST /score →
 * GET /leaderboard) against a deployed environment.
 *
 * @param {{
 *   url?: string,
 *   path?: string,
 *   baseUrl?: string,
 *   method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
 *   headers?: Record<string, string>,
 *   body?: string,
 *   timeoutMs?: number,
 * }} options
 * @returns {Promise<{ status: number, body: string, json: unknown }>}
 */
function httpRequest(options) {
  const url = options.url
    ?? `${(options.baseUrl ?? '').replace(/\/$/, '')}${options.path ?? ''}`;
  if (!url) {
    return Promise.reject(new Error('httpRequest: url or baseUrl+path is required'));
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  const method = options.method ?? 'GET';
  const headers = { ...(options.headers ?? {}) };
  const body = options.body;
  if (body && headers['Content-Type'] == null && headers['content-type'] == null) {
    headers['Content-Type'] = 'application/json';
  }

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https://') ? https : http;
    const req = lib.request(url, { method, headers, timeout: timeoutMs }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let json = null;
        if (text) {
          try { json = JSON.parse(text); } catch { json = null; }
        }
        resolve({ status: res.statusCode, body: text, json });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`request timed out: ${method} ${url}`));
    });
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Check runner
// ---------------------------------------------------------------------------

/**
 * @typedef {{ expectedVersion: string, baseUrl: string, httpRequest: typeof httpRequest }} CheckContext
 *
 * @typedef {{
 *   name: string,
 *   path?: string,
 *   expect?: {
 *     status: number,
 *     json?: (body: unknown, ctx: CheckContext) => string | null,
 *     body?: (text: string, ctx: CheckContext) => string | null
 *   },
 *   run?: (ctx: CheckContext) => Promise<string | null>
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
  if (typeof check.run === 'function') {
    try {
      const failure = await check.run(ctx);
      if (failure == null) {
        return { name: check.name, passed: true, message: 'ok' };
      }
      return { name: check.name, passed: false, message: String(failure) };
    } catch (err) {
      return { name: check.name, passed: false, message: `error: ${err?.message ?? err}` };
    }
  }

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

  if (check.expect.body) {
    const failure = check.expect.body(res.body, ctx);
    if (failure != null) {
      return { name: check.name, passed: false, message: failure };
    }
  }

  return { name: check.name, passed: true, message: 'ok' };
}

// ---------------------------------------------------------------------------
// Load checks
// ---------------------------------------------------------------------------

const checksModule = await import(
  pathToFileURL(path.join(__dirname, 'verify-deploy.checks.mjs')).href
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
const ctx = { expectedVersion, baseUrl, httpRequest };

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
