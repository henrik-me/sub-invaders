# Seeds

Seed scripts populate a dev or test environment with deterministic baseline data.

## Naming convention

Files must follow the pattern `NNN_<slug>.seed.mjs` where:

- `NNN` is a zero-padded three-digit numeric prefix (`001`, `002`, …).
- `<slug>` is a short lowercase kebab-case description (`users`, `sample-categories`).
- The `.seed.mjs` double extension signals the file class to the runner.

The runner sorts seeds lexicographically by filename, so numeric prefixes determine
execution order. Leave gaps (`010`, `020`, …) if you anticipate insertions.

## Idempotency contract

Every seed **must** be safe to run more than once against the same environment. A second
run must not duplicate data, raise errors, or leave the environment in a different state
than after the first run.

<!-- TODO: customize — choose and document your idempotency strategy below -->

Suggested strategies (pick one and update this section):

- **Upsert / conflict-ignore:** use `INSERT OR IGNORE`, `ON CONFLICT DO NOTHING`, or
  equivalent upsert semantics keyed on a stable natural key.
- **Check-then-insert:** query for the existence of a sentinel row before inserting; skip
  the block if the row exists.
- **Truncate-and-repopulate:** acceptable only in isolated test databases where data loss
  is intentional; never use in shared dev environments.

## Authoring a new seed

1. Copy `001_example.seed.mjs` to `NNN_<slug>.seed.mjs`.
2. Replace the adapter import with your real DB/storage client.
3. Implement idempotent inserts using the strategy documented above.
4. Export the async `seed` function — the runner will call it with `{ env, log }`.
5. Run `node scripts/run-seeds.mjs --env dev --only <slug> --dry-run` to confirm the
   runner picks up your new file.

## Running seeds

```
node scripts/run-seeds.mjs --env dev
node scripts/run-seeds.mjs --env test --only users
node scripts/run-seeds.mjs --env dev --dry-run
```

See `scripts/run-seeds.mjs --help` for full flag documentation.
