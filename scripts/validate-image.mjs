#!/usr/bin/env node
/**
 * scripts/validate-image.mjs — Container image validator.
 *
 * Validates a locally-present container image before pushing or deploying.
 * Checks: image exists, expected labels present, no :latest tag, expected
 * ENTRYPOINT/CMD, image size under threshold.
 *
 * Usage:
 *   node scripts/validate-image.mjs --image <tag> \
 *     [--labels <key=val,...>] [--max-size-mb <N>] [--quiet]
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more validation failures
 *   2 — usage error or docker/podman not installed
 */

import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// TODO: customize — change to 'podman' or 'buildah' if your environment uses
// a different container runtime.
// ---------------------------------------------------------------------------
const CONTAINER_TOOL = 'docker';

// ---------------------------------------------------------------------------
// TODO: customize — default expected labels (key=value strings).
// Override at call-time with --labels, or change this list to enforce a
// baseline across all images without repeating flags in every CI invocation.
// ---------------------------------------------------------------------------
const DEFAULT_LABELS = [];

// ---------------------------------------------------------------------------
// TODO: customize — default image size cap in megabytes.
// ---------------------------------------------------------------------------
const DEFAULT_MAX_SIZE_MB = 500;

// ---------------------------------------------------------------------------
// TODO: customize — set to a non-empty array to enforce a specific ENTRYPOINT,
// e.g. ['/usr/local/bin/node', 'server.mjs'].  Empty array = skip check.
// ---------------------------------------------------------------------------
const EXPECTED_ENTRYPOINT = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Guard for value-taking flags (LRN-040).
 * Exits 2 with a usage message when the next token is missing or starts with '-'.
 *
 * @param {string[]} args - The full argv array.
 * @param {number}   i    - Index of the current flag.
 * @param {string}   flag - Flag name (for the error message).
 * @returns {string} The value token.
 */
function requireValue(args, i, flag) {
  const next = args[i + 1];
  if (!next || next.startsWith('-')) {
    process.stderr.write(`validate-image: missing value for ${flag}\n`);
    usage();
    process.exit(2);
  }
  return next;
}

function usage() {
  process.stderr.write(
    'Usage: node scripts/validate-image.mjs --image <tag>\n' +
    '         [--labels <key=val,...>] [--max-size-mb <N>] [--quiet]\n' +
    '\n' +
    'Options:\n' +
    '  --image <tag>         Image reference to validate (required)\n' +
    '  --labels <key=val,…>  Comma-separated list of required label key=value pairs\n' +
    '  --max-size-mb <N>     Maximum allowed image size in megabytes (default: 500)\n' +
    '  --quiet               Suppress stdout success messages; errors still go to stderr\n' +
    '  --help                Show this message\n'
  );
}

/**
 * Emit a success line to stdout (suppressed by --quiet).
 *
 * @param {boolean} quiet
 * @param {string}  msg
 */
function pass(quiet, msg) {
  if (!quiet) process.stdout.write(`  \u2713 ${msg}\n`);
}

/**
 * Emit a failure line to stderr.
 *
 * @param {string} msg
 */
function fail(msg) {
  process.stderr.write(`  \u2717 ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

let imageRef = null;
let requiredLabels = [...DEFAULT_LABELS];
let maxSizeMb = DEFAULT_MAX_SIZE_MB;
let quiet = false;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--image') {
    imageRef = requireValue(argv, i, '--image');
    i++;
  } else if (a === '--labels') {
    const raw = requireValue(argv, i, '--labels');
    i++;
    requiredLabels = raw.split(',').map(s => s.trim()).filter(Boolean);
  } else if (a === '--max-size-mb') {
    const raw = requireValue(argv, i, '--max-size-mb');
    i++;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      process.stderr.write(`validate-image: --max-size-mb must be a positive number, got: ${raw}\n`);
      process.exit(2);
    }
    maxSizeMb = n;
  } else if (a === '--quiet') {
    quiet = true;
  } else if (a === '--help') {
    usage();
    process.exit(0);
  } else {
    process.stderr.write(`validate-image: unknown flag: ${a}\n`);
    usage();
    process.exit(2);
  }
}

if (!imageRef) {
  process.stderr.write('validate-image: --image is required\n');
  usage();
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Check that the container tool is available
// ---------------------------------------------------------------------------

const toolCheck = spawnSync(CONTAINER_TOOL, ['--version'], { encoding: 'utf8' });
if (toolCheck.error) {
  process.stderr.write(
    `validate-image: '${CONTAINER_TOOL}' is not installed or not on PATH.\n` +
    `  If you use a different container runtime, set CONTAINER_TOOL in this script.\n`
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Inspect the image
// ---------------------------------------------------------------------------

if (!quiet) {
  process.stdout.write(`Validating image: ${imageRef}\n`);
}

// TODO: customize — adjust the inspect arguments if your tool uses a different
// output format (e.g. 'podman inspect' is compatible; 'buildah inspect' uses
// different flags — swap in the appropriate command below).
const inspect = spawnSync(
  CONTAINER_TOOL,
  ['inspect', '--format', '{{json .}}', imageRef],
  { encoding: 'utf8' }
);

let failures = 0;

// ---------------------------------------------------------------------------
// Check 1: image exists locally
// ---------------------------------------------------------------------------

if (inspect.status !== 0) {
  process.stderr.write(
    `validate-image: image not found locally: ${imageRef}\n` +
    `  Run '${CONTAINER_TOOL} pull ${imageRef}' or build it first.\n`
  );
  // This is a fatal prerequisite — no further checks are meaningful.
  process.exit(1);
}

let meta;
try {
  // docker inspect --format '{{json .}}' returns a JSON object for a single image
  meta = JSON.parse(inspect.stdout.trim());
} catch {
  process.stderr.write(`validate-image: failed to parse inspect output for ${imageRef}\n`);
  process.exit(1);
}

pass(quiet, `image exists: ${imageRef}`);

// ---------------------------------------------------------------------------
// Check 2: no :latest tag
// ---------------------------------------------------------------------------

const repoTags = (meta.RepoTags ?? []);
const hasLatestTag = repoTags.some(t => t.endsWith(':latest'));

if (hasLatestTag) {
  fail(`image is tagged :latest — use an explicit version tag`);
  failures++;
} else {
  pass(quiet, `no :latest tag`);
}

// ---------------------------------------------------------------------------
// Check 3: expected labels present
// ---------------------------------------------------------------------------

const imageLabels = meta.Config?.Labels ?? {};

for (const kv of requiredLabels) {
  const eqIdx = kv.indexOf('=');
  if (eqIdx === -1) {
    process.stderr.write(`validate-image: malformed label spec (expected key=value): ${kv}\n`);
    process.exit(2);
  }
  const key = kv.slice(0, eqIdx);
  const expectedVal = kv.slice(eqIdx + 1);
  const actualVal = imageLabels[key];

  if (actualVal === undefined) {
    fail(`missing label: ${key} (expected ${expectedVal})`);
    failures++;
  } else if (actualVal !== expectedVal) {
    fail(`label mismatch: ${key} = '${actualVal}' (expected '${expectedVal}')`);
    failures++;
  } else {
    pass(quiet, `label ok: ${key}=${actualVal}`);
  }
}

// ---------------------------------------------------------------------------
// Check 4: ENTRYPOINT (if configured)
// ---------------------------------------------------------------------------

if (EXPECTED_ENTRYPOINT.length > 0) {
  const actualEntrypoint = meta.Config?.Entrypoint ?? [];
  const match =
    actualEntrypoint.length === EXPECTED_ENTRYPOINT.length &&
    actualEntrypoint.every((v, i) => v === EXPECTED_ENTRYPOINT[i]);

  if (!match) {
    fail(
      `ENTRYPOINT mismatch: got [${actualEntrypoint.join(', ')}], ` +
      `expected [${EXPECTED_ENTRYPOINT.join(', ')}]`
    );
    failures++;
  } else {
    pass(quiet, `ENTRYPOINT ok: [${actualEntrypoint.join(', ')}]`);
  }
}

// ---------------------------------------------------------------------------
// Check 5: image size under threshold
// ---------------------------------------------------------------------------

// docker inspect reports Size in bytes
const sizeMb = (meta.Size ?? 0) / (1024 * 1024);

if (sizeMb > maxSizeMb) {
  fail(`image size ${sizeMb.toFixed(1)} MB exceeds limit of ${maxSizeMb} MB`);
  failures++;
} else {
  pass(quiet, `image size ok: ${sizeMb.toFixed(1)} MB (limit: ${maxSizeMb} MB)`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

if (failures === 0) {
  if (!quiet) process.stdout.write(`\nAll checks passed.\n`);
  process.exit(0);
} else {
  process.stderr.write(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}
