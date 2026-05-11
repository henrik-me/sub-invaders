#!/usr/bin/env node
/**
 * run-seeds.mjs — seed runner
 *
 * Usage:
 *   node scripts/run-seeds.mjs --env <name> [--only <pattern>] [--dry-run] [--quiet]
 *
 * Flags:
 *   --env <name>       Target environment name (required).
 *   --only <pattern>   Run only seeds whose filename contains <pattern>.
 *   --dry-run          List which seeds would run without invoking them. Exit 0.
 *   --quiet            Suppress per-seed progress lines; print only the summary.
 *   --help, -h         Print usage and exit 0.
 *
 * Exit codes:
 *   0  All seeds passed (or dry-run completed).
 *   1  At least one seed failed.
 *   2  Usage error (bad flags or missing required value).
 */

import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function usage(msg) {
  if (msg) process.stderr.write(`error: ${msg}\n\n`);
  process.stderr.write(
    [
      'Usage: node scripts/run-seeds.mjs --env <name> [options]',
      '',
      'Options:',
      '  --env <name>       Target environment name (required).',
      '  --only <pattern>   Run only seeds whose filename contains <pattern>.',
      '  --dry-run          List seeds without running them.',
      '  --quiet            Suppress per-seed progress lines.',
      '  --help, -h         Show this help.',
      '',
      'Exit codes: 0 pass, 1 failure, 2 usage error.',
      '',
    ].join('\n'),
  );
  process.exit(msg ? 2 : 0);
}

/**
 * Guard that the next CLI token exists and is not itself a flag.
 * LRN-040: never use bare args[i+1]; always validate before consuming.
 *
 * @param {string[]} args
 * @param {number}   i     Index of the flag token (e.g. "--env").
 * @param {string}   flag  Flag name for the error message.
 * @returns {string}       The value token.
 */
function requireValue(args, i, flag) {
  const value = args[i + 1];
  if (value === undefined || value.startsWith('-')) {
    usage(`${flag} requires a value`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let env = null;
let only = null;
let dryRun = false;
let quiet = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--help':
    case '-h':
      usage();
      break;
    case '--env':
      env = requireValue(args, i, '--env');
      i++;
      break;
    case '--only':
      only = requireValue(args, i, '--only');
      i++;
      break;
    case '--dry-run':
      dryRun = true;
      break;
    case '--quiet':
      quiet = true;
      break;
    default:
      usage(`unknown flag: ${args[i]}`);
  }
}

if (!env) {
  usage('--env <name> is required');
}

// TODO: customize — validate the env name against your project's allowed values.
// Example:
//   const ALLOWED_ENVS = ['dev', 'test', 'ci'];
//   if (!ALLOWED_ENVS.includes(env)) {
//     usage(`unknown env "${env}"; allowed values: ${ALLOWED_ENVS.join(', ')}`);
//   }

// ---------------------------------------------------------------------------
// Discover and filter seeds
// ---------------------------------------------------------------------------

const SEEDS_DIR = resolve(process.cwd(), 'seeds');
const SEED_PATTERN = /^\d{3}_[a-z0-9-]+\.seed\.mjs$/;

let entries;
try {
  entries = await readdir(SEEDS_DIR);
} catch (err) {
  process.stderr.write(`error: cannot read seeds/ directory: ${err.message}\n`);
  process.exit(1);
}

const seedFiles = entries
  .filter((name) => SEED_PATTERN.test(name))
  .filter((name) => !only || name.includes(only))
  .sort();

if (seedFiles.length === 0) {
  if (!quiet) process.stdout.write('No seeds matched — nothing to run.\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Dry-run: list and exit
// ---------------------------------------------------------------------------

if (dryRun) {
  process.stdout.write(`Would run ${seedFiles.length} seed(s) against env "${env}":\n`);
  for (const name of seedFiles) {
    process.stdout.write(`  ${name}\n`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Run seeds
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

for (const name of seedFiles) {
  const filePath = join(SEEDS_DIR, name);
  const fileUrl = pathToFileURL(filePath).href;

  if (!quiet) process.stdout.write(`[seed] ${name} (env=${env})\n`);

  let mod;
  try {
    mod = await import(fileUrl);
  } catch (err) {
    process.stderr.write(`[seed] FAIL ${name}: import error: ${err.message}\n`);
    failed++;
    continue;
  }

  if (typeof mod.seed !== 'function') {
    process.stderr.write(`[seed] FAIL ${name}: no exported "seed" function\n`);
    failed++;
    continue;
  }

  const log = quiet
    ? () => {}
    : (msg) => process.stdout.write(`  ${msg}\n`);

  try {
    await mod.seed({ env, log });
    if (!quiet) process.stdout.write(`[seed] OK   ${name}\n`);
    passed++;
  } catch (err) {
    process.stderr.write(`[seed] FAIL ${name}: ${err.message}\n`);
    if (err.stack && !quiet) process.stderr.write(`${err.stack}\n`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const total = passed + failed;
process.stdout.write(`\nSeeds: ${passed}/${total} passed`);
if (failed > 0) process.stdout.write(`, ${failed} failed`);
process.stdout.write(` (env=${env})\n`);

process.exit(failed > 0 ? 1 : 0);
