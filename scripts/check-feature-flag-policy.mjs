#!/usr/bin/env node
/**
 * scripts/check-feature-flag-policy.mjs — Consumer-shipped feature-flag linter.
 *
 * Reads the project's flags file and enforces structural and lifecycle policy
 * rules. Intended to run in CI and as a local pre-commit check.
 *
 * Usage:
 *   node scripts/check-feature-flag-policy.mjs [options]
 *
 * Options:
 *   --cwd <path>        Working directory to resolve relative paths
 *                       (default: process.cwd())
 *   --config <path>     Path to harness.config.json
 *                       (default: <cwd>/harness.config.json)
 *   --flags-file <path> Path to the flags JSON file
 *                       (default: <cwd>/flags/flags.json, or value from config)
 *   --quiet             Suppress success output; only print failures
 *   --help              Print this help text
 *
 * Exit codes:
 *   0 — all rules passed
 *   1 — at least one rule failed
 *   2 — usage error (bad arguments, missing required value)
 *
 * @module scripts/check-feature-flag-policy.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/**
 * Guard: require a value token after a flag. Rejects tokens starting with '-'.
 * Exits 2 with a usage message on failure.
 *
 * @param {string[]} args - Full argv slice.
 * @param {number}   i    - Index of the current flag token.
 * @param {string}   name - Flag name for the error message.
 */
function requireValue(args, i, name) {
  const next = args[i + 1];
  if (!next || next.startsWith('-')) {
    process.stderr.write(
      `check-feature-flag-policy: missing value for ${name}\n` +
      `Run with --help for usage.\n`
    );
    process.exit(2);
  }
}

let cwdArg = null;
let configArg = null;
let flagsFileArg = null;
let quiet = false;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--cwd') {
    requireValue(argv, i, '--cwd');
    cwdArg = argv[++i];
  } else if (a === '--config') {
    requireValue(argv, i, '--config');
    configArg = argv[++i];
  } else if (a === '--flags-file') {
    requireValue(argv, i, '--flags-file');
    flagsFileArg = argv[++i];
  } else if (a === '--quiet') {
    quiet = true;
  } else if (a === '--help' || a === '-h') {
    process.stdout.write(
      'Usage: check-feature-flag-policy.mjs [options]\n\n' +
      'Lint feature flag declarations against structural and lifecycle policy rules.\n\n' +
      'Options:\n' +
      '  --cwd <path>        Working directory for resolving relative paths\n' +
      '                      (default: process.cwd())\n' +
      '  --config <path>     Path to harness.config.json\n' +
      '                      (default: <cwd>/harness.config.json)\n' +
      '  --flags-file <path> Path to the flags JSON file\n' +
      '                      (default: <cwd>/flags/flags.json)\n' +
      '  --quiet             Suppress success lines; print only failures\n' +
      '  --help              Print this help text\n\n' +
      'Exit codes:\n' +
      '  0  all rules passed\n' +
      '  1  at least one rule failed\n' +
      '  2  usage error\n'
    );
    process.exit(0);
  } else {
    process.stderr.write(`check-feature-flag-policy: unknown flag: ${a}\n`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------

const cwd = cwdArg ? path.resolve(cwdArg) : process.cwd();
const configPath = configArg ? path.resolve(cwd, configArg) : path.join(cwd, 'harness.config.json');

// ---------------------------------------------------------------------------
// Load optional harness config for linter sub-config
// ---------------------------------------------------------------------------

// Config shape for this linter (all fields optional):
//   linters['check-feature-flag-policy']:
//     flagsFile:          string   — path to flags JSON (overrides --flags-file)
//     stalenessThreshold: string   — ISO date; flags with expires < this are STALE
//                                   (default: today)
//     namePattern:        string   — regex string for flag name validation
//                                   (default: '^[a-z][a-z0-9_-]*$')
//     fullyOnMaxDays:     number   — warn when rollout:'on' flag is older than N days
//                                   (default: 90; set to 0 to disable)
// TODO: customize — staleness threshold: adjust stalenessThreshold default or set it
// in harness.config.json linters['check-feature-flag-policy'].stalenessThreshold.

let linterConfig = {};

if (fs.existsSync(configPath)) {
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    process.stderr.write(
      `check-feature-flag-policy: cannot read config '${configPath}': ${err.message}\n`
    );
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(
      `check-feature-flag-policy: invalid JSON in config '${configPath}': ${err.message}\n`
    );
    process.exit(1);
  }
  const lintersBlock = parsed?.linters;
  if (lintersBlock && typeof lintersBlock === 'object') {
    const sub = lintersBlock['check-feature-flag-policy'];
    if (sub && typeof sub === 'object') {
      linterConfig = sub;
    }
  }
}

// ---------------------------------------------------------------------------
// Resolve flags file
// ---------------------------------------------------------------------------

// Priority: --flags-file CLI > config.flagsFile > default
const flagsFilePath = flagsFileArg
  ? path.resolve(cwd, flagsFileArg)
  : linterConfig.flagsFile
    ? path.resolve(cwd, linterConfig.flagsFile)
    : path.join(cwd, 'flags', 'flags.json');

// ---------------------------------------------------------------------------
// Parse linter config values
// ---------------------------------------------------------------------------

// TODO: customize — staleness threshold: today is the default; set
// linters['check-feature-flag-policy'].stalenessThreshold in harness.config.json
// to a fixed date (e.g. "2025-01-01") to shift the threshold.
const stalenessThreshold = linterConfig.stalenessThreshold
  ? new Date(linterConfig.stalenessThreshold)
  : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

// TODO: customize — flag-name regex strictness: the default pattern allows
// kebab-case and snake_case names starting with a lowercase letter. Set
// linters['check-feature-flag-policy'].namePattern to a stricter regex string
// (e.g. "^[a-z][a-z0-9-]*$" to enforce kebab-only).
const namePatternSrc =
  typeof linterConfig.namePattern === 'string'
    ? linterConfig.namePattern
    : '^[a-z][a-z0-9_-]*$';

let namePattern;
try {
  namePattern = new RegExp(namePatternSrc);
} catch (err) {
  process.stderr.write(
    `check-feature-flag-policy: invalid namePattern regex '${namePatternSrc}': ${err.message}\n`
  );
  process.exit(1);
}

// fullyOnMaxDays: warn when a rollout:'on' flag has an expires date that is
// more than N days in the past (i.e. should have been removed already).
// Default 90 days; set to 0 to disable.
const fullyOnMaxDays =
  typeof linterConfig.fullyOnMaxDays === 'number'
    ? linterConfig.fullyOnMaxDays
    : 90;

// ---------------------------------------------------------------------------
// Load and parse flags file — fail-closed (LRN-033)
// ---------------------------------------------------------------------------

if (!fs.existsSync(flagsFilePath)) {
  process.stderr.write(
    `check-feature-flag-policy: flags file not found: '${flagsFilePath}'\n`
  );
  process.exit(1);
}

let rawFlags;
try {
  rawFlags = fs.readFileSync(flagsFilePath, 'utf8');
} catch (err) {
  process.stderr.write(
    `check-feature-flag-policy: cannot read flags file '${flagsFilePath}': ${err.message}\n`
  );
  process.exit(1);
}

let parsedFlags;
try {
  parsedFlags = JSON.parse(rawFlags);
} catch (err) {
  // Fail-closed: malformed JSON is an error, not a skip (LRN-033).
  process.stderr.write(
    `check-feature-flag-policy: invalid JSON in '${flagsFilePath}': ${err.message}\n`
  );
  process.exit(1);
}

if (!parsedFlags || typeof parsedFlags !== 'object' || !Array.isArray(parsedFlags.flags)) {
  process.stderr.write(
    `check-feature-flag-policy: '${flagsFilePath}' must have a top-level "flags" array.\n`
  );
  process.exit(1);
}

const flags = parsedFlags.flags;

// ---------------------------------------------------------------------------
// Rule enforcement
// ---------------------------------------------------------------------------

/** @type {string[]} Failure messages (rule violations) */
const errors = [];
/** @type {string[]} Warning messages (advisory, do not affect exit code) */
const warnings = [];

const REQUIRED_FIELDS = ['name', 'description', 'default', 'owner'];
const VALID_ROLLOUT = new Set(['off', 'percent', 'on']);

const seenNames = new Map(); // name → first index

for (let idx = 0; idx < flags.length; idx++) {
  const flag = flags[idx];
  // Guard against null / non-object entries (per CS10 R1 review): a flags
  // array containing `null` or a primitive must produce a formatted error,
  // not an uncaught TypeError stack trace.
  if (flag === null || flag === undefined || typeof flag !== 'object' || Array.isArray(flag)) {
    errors.push(`flag[${idx}]: entry must be a non-null object.`);
    continue;
  }
  const label = flag.name ? `flag[${idx}] "${flag.name}"` : `flag[${idx}]`;

  // Rule 1: Required fields
  for (const field of REQUIRED_FIELDS) {
    if (flag[field] === undefined || flag[field] === null || flag[field] === '') {
      errors.push(`${label}: missing required field "${field}".`);
    }
  }

  // Rule 2: Name pattern (only if name exists and passed required-field check)
  if (typeof flag.name === 'string' && flag.name.length > 0) {
    if (!namePattern.test(flag.name)) {
      errors.push(
        `flag[${idx}] "${flag.name}": name does not match pattern /${namePatternSrc}/.`
      );
    }

    // Rule 3: Duplicate names
    if (seenNames.has(flag.name)) {
      errors.push(
        `flag[${idx}] "${flag.name}": duplicate name — also defined at index ${seenNames.get(flag.name)}.`
      );
    } else {
      seenNames.set(flag.name, idx);
    }
  }

  // Rule 4: Stale expires date
  if (flag.expires !== undefined && flag.expires !== null) {
    if (typeof flag.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(flag.expires)) {
      errors.push(
        `${label}: "expires" must be a "YYYY-MM-DD" string or null, got: ${JSON.stringify(flag.expires)}.`
      );
    } else {
      const expiresDate = new Date(flag.expires + 'T00:00:00.000Z');
      if (isNaN(expiresDate.getTime())) {
        errors.push(`${label}: "expires" is not a valid date: "${flag.expires}".`);
      } else if (expiresDate < stalenessThreshold) {
        errors.push(
          `${label}: STALE — "expires" date ${flag.expires} is in the past. ` +
          `Remove this flag or update its expiry date.`
        );
      }
    }
  }

  // Rule 5 (optional warning): rollout:'on' flags with past expires should be removed
  if (
    fullyOnMaxDays > 0 &&
    flag.rollout === 'on' &&
    flag.expires !== null &&
    typeof flag.expires === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(flag.expires)
  ) {
    const expiresDate = new Date(flag.expires + 'T00:00:00.000Z');
    if (!isNaN(expiresDate.getTime())) {
      const ageMs = stalenessThreshold.getTime() - expiresDate.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > fullyOnMaxDays) {
        warnings.push(
          `${label}: rollout is "on" and expires was ${flag.expires} ` +
          `(${Math.floor(ageDays)} days ago). Consider removing this flag and all its code branches.`
        );
      }
    }
  }

  // Rule: rollout value validity (bonus structural check)
  if (flag.rollout !== undefined && !VALID_ROLLOUT.has(flag.rollout)) {
    errors.push(
      `${label}: "rollout" must be "off", "percent", or "on"; got: ${JSON.stringify(flag.rollout)}.`
    );
  }

  // Rule: default must be boolean
  if (flag.default !== undefined && typeof flag.default !== 'boolean') {
    errors.push(
      `${label}: "default" must be a boolean; got: ${JSON.stringify(flag.default)}.`
    );
  }
}

// ---------------------------------------------------------------------------
// Report — stdout for results, stderr for hard errors (LRN-044)
// ---------------------------------------------------------------------------

const rel = path.relative(cwd, flagsFilePath) || flagsFilePath;

if (errors.length > 0) {
  process.stdout.write(`check-feature-flag-policy: FAIL (${rel})\n`);
  for (const msg of errors) {
    process.stdout.write(`  ERROR: ${msg}\n`);
  }
  for (const msg of warnings) {
    process.stdout.write(`  WARN:  ${msg}\n`);
  }
  process.stdout.write(
    `\n${errors.length} error(s), ${warnings.length} warning(s) — ${flags.length} flag(s) checked.\n`
  );
  process.exit(1);
}

if (warnings.length > 0) {
  if (!quiet) {
    process.stdout.write(`check-feature-flag-policy: PASS with warnings (${rel})\n`);
    for (const msg of warnings) {
      process.stdout.write(`  WARN:  ${msg}\n`);
    }
    process.stdout.write(
      `\n0 errors, ${warnings.length} warning(s) — ${flags.length} flag(s) checked.\n`
    );
  }
  process.exit(0);
}

if (!quiet) {
  process.stdout.write(
    `check-feature-flag-policy: PASS — ${flags.length} flag(s) checked. (${rel})\n`
  );
}
process.exit(0);
