# Feature Flags

This directory holds the declarative feature-flag configuration for this project.

## Flag lifecycle

```
created → ramped → removed
```

1. **created** — A new flag is added with `"rollout": "off"` (or `"percent"`) and a future
   `"expires"` date. The flag is dark by default (`"default": false`) until deliberately
   enabled.

2. **ramped** — `"rollout"` progresses from `"off"` → `"percent"` → `"on"` as confidence
   grows. The `"percent"` rollout strategy uses a deterministic hash of the user/request
   context to give a stable, incrementally widening slice of traffic.

3. **removed** — Once a flag has been fully on (`"rollout": "on"`) for a sufficient soak
   period (see `"expires"`), the flag and all conditional branches gated on it are deleted
   from the codebase. Running `check-feature-flag-policy.mjs` will warn when a fully-on
   flag is past its expiry date.

## Schema

Each entry in `flags.json` under the `"flags"` array must contain:

| Field         | Type                            | Required | Description                                  |
|---------------|---------------------------------|----------|----------------------------------------------|
| `name`        | `string`                        | ✓        | Unique kebab/snake identifier                |
| `description` | `string`                        | ✓        | Human-readable purpose                       |
| `default`     | `boolean`                       | ✓        | Fallback value when flag is not resolved     |
| `owner`       | `string`                        | ✓        | Team or person responsible for this flag     |
| `expires`     | `"YYYY-MM-DD"` or `null`        |          | Date after which the flag should be removed  |
| `rollout`     | `"off"` \| `"percent"` \| `"on"` |          | Current rollout stage                        |

## Adding a flag

1. Add an entry to `flags.json` with all required fields.
2. Set `"rollout": "off"` and a realistic `"expires"` date.
3. Reference the flag in code via `isEnabled("flag-name", ctx)` from `lib/feature-flags.mjs`.

## Removing a flag

1. Delete the entry from `flags.json`.
2. Remove all code branches gated on the flag.
3. Commit both changes together so the codebase stays consistent.
