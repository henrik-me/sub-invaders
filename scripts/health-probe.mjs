#!/usr/bin/env node
// health-probe.mjs — external HTTP health probe runner
// Usage: node scripts/health-probe.mjs --url <url> [--timeout-ms <N>] [--retries <N>]
//        [--expect-key <key>] [--expect-value <value>] [--quiet]
// Exit codes: 0 = pass, 1 = fail, 2 = usage error

import http from 'node:http';
import https from 'node:https';

// TODO: customize — adjust default timeout and retry count to match your SLA
const DEFAULTS = {
  timeoutMs: 5000,
  retries: 3,
  expectKey: 'status',
  expectValue: 'ok',
};

const USAGE = `Usage: node scripts/health-probe.mjs --url <url>`
  + ` [--timeout-ms <N>] [--retries <N>]`
  + ` [--expect-key <key>] [--expect-value <value>] [--quiet]\n`;

function usage(msg) {
  process.stderr.write(`${msg}\n\n${USAGE}`);
  process.exit(2);
}

function showHelp() {
  process.stdout.write(`health-probe: HTTP health check probe runner.\n\n${USAGE}`);
  process.exit(0);
}

function requireValue(args, i, flagName) {
  const next = args[i + 1];
  if (next === undefined || next.startsWith('-')) {
    usage(`Flag ${flagName} requires a value.`);
  }
  return next;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    url: null,
    timeoutMs: DEFAULTS.timeoutMs,
    retries: DEFAULTS.retries,
    expectKey: DEFAULTS.expectKey,
    expectValue: DEFAULTS.expectValue,
    quiet: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        opts.url = requireValue(args, i, '--url');
        i++;
        break;
      case '--timeout-ms':
        opts.timeoutMs = parseInt(requireValue(args, i, '--timeout-ms'), 10);
        i++;
        break;
      case '--retries':
        opts.retries = parseInt(requireValue(args, i, '--retries'), 10);
        i++;
        break;
      case '--expect-key':
        opts.expectKey = requireValue(args, i, '--expect-key');
        i++;
        break;
      case '--expect-value':
        opts.expectValue = requireValue(args, i, '--expect-value');
        i++;
        break;
      case '--quiet':
        opts.quiet = true;
        break;
      case '--help':
        showHelp();
        break;
      default:
        usage(`Unknown flag: ${args[i]}`);
    }
  }

  if (!opts.url) {
    usage('--url is required.');
  }
  return opts;
}

function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
  });
}

async function probe(opts) {
  const { url, timeoutMs, retries, expectKey, expectValue, quiet } = opts;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { status, body } = await httpGet(url, timeoutMs);

      if (status !== 200) {
        process.stderr.write(`Attempt ${attempt}/${retries}: HTTP ${status} (expected 200)\n`);
        continue;
      }

      let json;
      try {
        json = JSON.parse(body);
      } catch {
        process.stderr.write(`Attempt ${attempt}/${retries}: response is not valid JSON\n`);
        continue;
      }

      // TODO: customize — adjust the expected key/value if your health response differs
      const actual = json[expectKey];
      if (String(actual) !== String(expectValue)) {
        process.stderr.write(
          `Attempt ${attempt}/${retries}: `
          + `expected ${expectKey}=${expectValue}, got ${expectKey}=${actual}\n`,
        );
        continue;
      }

      if (!quiet) {
        process.stdout.write(`Health check passed: ${url} (attempt ${attempt}/${retries})\n`);
      }
      return true;
    } catch (err) {
      process.stderr.write(`Attempt ${attempt}/${retries}: ${err.message}\n`);
    }
  }

  return false;
}

const opts = parseArgs(process.argv);
const passed = await probe(opts);
process.exit(passed ? 0 : 1);
