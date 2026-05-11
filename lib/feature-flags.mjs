/**
 * lib/feature-flags.mjs — Minimal feature-flag reader.
 *
 * Exports:
 *   loadFlags(filePath)           → Promise<Flag[]>
 *   isEnabled(flagName, ctx, flags) → boolean
 *
 * TODO: customize — rollout-strategy: the percent-based hash function below uses
 * a simple djb2 hash. Replace with a cryptographic HMAC or your preferred
 * deterministic bucketing algorithm for production use.
 *
 * TODO: customize — remote-config adapter: replace loadFlags() with a call to
 * your remote feature-flag service (LaunchDarkly, Unleash, Flagsmith, etc.).
 * The isEnabled() contract remains the same; only the data-source changes.
 *
 * @module lib/feature-flags.mjs
 */

import fs from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Flag
 * @property {string}  name        - Unique kebab/snake identifier.
 * @property {string}  description - Human-readable purpose.
 * @property {boolean} default     - Fallback when flag is unresolved.
 * @property {string}  owner       - Responsible team or person.
 * @property {string|null} expires - ISO date string or null.
 * @property {'off'|'percent'|'on'} rollout - Current rollout stage.
 */

/**
 * @typedef {Object} FlagContext
 * @property {string} [userId]    - Optional user identifier for percent rollouts.
 * @property {string} [sessionId] - Optional session identifier fallback.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load flags from a JSON file.
 *
 * The file must be an object with a top-level "flags" array (matching the
 * schema documented in flags/README.md). A "_comment" key is allowed and
 * silently ignored.
 *
 * @param {string} filePath - Absolute or cwd-relative path to flags.json.
 * @returns {Promise<Flag[]>}
 * @throws {Error} If the file cannot be read or is not valid JSON.
 */
export async function loadFlags(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    throw new Error(`feature-flags: cannot read flags file '${filePath}': ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`feature-flags: invalid JSON in '${filePath}': ${err.message}`);
  }

  if (!Array.isArray(parsed.flags)) {
    throw new Error(
      `feature-flags: '${filePath}' must have a top-level "flags" array.`
    );
  }

  return parsed.flags;
}

/**
 * Evaluate whether a named flag is enabled for the given context.
 *
 * Resolution order:
 *   1. If rollout === 'on'  → true
 *   2. If rollout === 'off' → false (or flag.default if flag not found)
 *   3. If rollout === 'percent' → deterministic hash of (name + userId/sessionId)
 *      bucketed into [0, 100). Currently hard-coded at 50% bucket threshold.
 *      TODO: customize — rollout-strategy: adjust the bucket threshold or replace
 *      the hash function with a service-specific bucketing implementation.
 *   4. Flag not found → flag.default (false if absent)
 *
 * @param {string}  flagName - The flag name to look up.
 * @param {FlagContext} ctx  - Evaluation context (userId, sessionId, etc.).
 * @param {Flag[]}  flags    - The loaded flag list from loadFlags().
 * @returns {boolean}
 */
export function isEnabled(flagName, ctx, flags) {
  const flag = flags.find(f => f.name === flagName);
  if (!flag) return false;

  switch (flag.rollout) {
    case 'on':
      return true;
    case 'off':
      return flag.default ?? false;
    case 'percent': {
      const key = ctx?.userId ?? ctx?.sessionId ?? '';
      const bucket = djb2Hash(`${flagName}:${key}`) % 100;
      // TODO: customize — rollout-strategy: replace 50 with a configurable
      // percent threshold (e.g. read from flag.rolloutPercent).
      return bucket < 50;
    }
    default:
      return flag.default ?? false;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * djb2 non-cryptographic hash for deterministic percent bucketing.
 * Returns a non-negative 32-bit integer.
 *
 * TODO: customize — rollout-strategy: swap for HMAC-SHA256 or your
 * preferred algorithm when cryptographic bucketing is required.
 *
 * @param {string} str
 * @returns {number}
 */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // convert to unsigned 32-bit
}
