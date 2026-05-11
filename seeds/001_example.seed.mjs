/**
 * Example seed: 001_example
 *
 * Copy this file to NNN_<slug>.seed.mjs and customise the sections marked
 * "TODO: customize" below.
 *
 * The runner calls: await seed({ env, log })
 *   env  {string}   - target environment name (e.g. "dev", "test")
 *   log  {Function} - log(message) writes a progress line (honours --quiet)
 */

// TODO: customize — replace with your real DB/storage adapter import.
// Examples:
//   import { createClient } from '../lib/db.mjs';
//   import { getTableClient } from '../lib/storage.mjs';
const createClient = async (_env) => {
  throw new Error(
    'Replace this stub with your real DB/storage adapter (see TODO: customize above).',
  );
};

/**
 * @param {{ env: string, log: (msg: string) => void }} context
 */
export async function seed({ env, log }) {
  const client = await createClient(env);

  log('Seeding example rows…');

  // TODO: customize — replace with your real data and idempotent insert logic.
  // The insert below is illustrative only; adapt to your storage API.
  //
  // Idempotency pattern: upsert / conflict-ignore so re-runs are safe.
  // Example (SQL):
  //   await client.execute(
  //     `INSERT INTO example_items (id, label) VALUES (?, ?)
  //      ON CONFLICT(id) DO NOTHING`,
  //     [1, 'Example item'],
  //   );
  const rows = [
    { id: 1, label: 'Example item A' },
    { id: 2, label: 'Example item B' },
  ];

  for (const row of rows) {
    await client.upsert('example_items', row);
    log(`  upserted example_items id=${row.id}`);
  }

  log('Done.');
}
