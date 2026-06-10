# CS14 — Introduce esbuild bundler in sub-invaders frontend

**Status:** active
**Owner:** yoga-si
**Branch:** cs14/content
**Started:** 2026-06-10
**Closed:** —
**Filed by:** yoga-si (Claude Opus 4.7) on 2026-06-10, as precursor to CS13 (engine extraction). User chose "introduce a bundler" as the resolution to the bare-specifier browser-resolution blocker GPT-5.5 surfaced during CS13's R1 plan review, then delegated sequencing to the agent ("work autonomously, make good decisions"). Agent autonomously split bundler intro into its own CS per OPERATIONS.md "Keep PRs small and focused" doctrine. **Revised 2026-06-10** after GPT-5.5 R1 plan review returned `Needs-Fix` with 3 major + 2 minor findings (E2E build trigger; coverage/source-map handling; CONVENTIONS update must move to Phase B; SWA/Oryx wording; README deliverable missing). Revision addresses all 5 R1 findings. **Re-revised 2026-06-10** after GPT-5.5 R2 plan review returned `Needs-Fix` with 1 major + 1 minor finding (sourcemap normalization claim was wrong — `normalize()` doesn't handle `../game/` paths; SWA R2 risk wording still inaccurate). Re-revision corrects `normalize()` spec and Risks R2 wording.
**Depends on:** CS02 (initial frontend shape: `src/index.html` + `src/game/main.mjs` ES-module entry), CS03 (SWA deploy pipeline owns the production upload path that this CS will reshape).

## Goal

Introduce a minimal-footprint JavaScript bundler (`esbuild`) into sub-invaders' frontend build pipeline, **preserving 100% of current game behavior**, so that future CSes (immediately: CS13 engine extraction) can consume external npm/git-URL ESM dependencies whose import specifiers are bare-package-name (e.g. `from 'canvas-game-engine/loop.mjs'`) and that browsers cannot resolve from a plain `src/` directory.

After CS14 closes:

- `package.json` `devDependencies` includes `esbuild` at a pinned exact version.
- A new `npm run build` script bundles `src/game/main.mjs` (plus any other entry points) into a single output module under `src/dist/` (gitignored), resolving any non-relative ESM imports through `node_modules`.
- `src/index.html` loads the bundled output (`./dist/main.mjs`) instead of `./game/main.mjs`. Source maps are inline or sibling-`.map` so the existing Playwright + dev-tools debugging story works unchanged.
- Local dev (`npx http-server src`) works after a single `npm install && npm run build` (or `npm run dev` if a watch script is added — see CS14-3).
- SWA deploy (`.github/workflows/swa-deploy.yml`) runs the build before the upload step so `src/dist/main.mjs` exists in the uploaded artifact. The deployed game behaves identically to today's deploy.
- All existing tests (`npm run test:unit`, `npm run test:unit:coverage`, `dotnet test api/`, Playwright `npm run test:e2e`) pass post-bundler. Coverage thresholds remain unchanged (the engine + game `.mjs` files are still the units being measured — bundling is build-output only).
- The CONVENTIONS.md "no bundler in v1" clause is amended to reflect v1+ reality (v1 shipped; the constraint is retired) and to document the bundler choice.
- A rollback path is documented: revert the CS14 PR and `src/index.html` is restored to load `./game/main.mjs` directly; the next deploy reverts to the pre-bundler artifact shape.

**Out of scope (deferred to follow-up CSes):**
- TypeScript / `.ts` adoption (bundler enables it; CS14 does not adopt it).
- Code minification beyond what esbuild does for free.
- Code splitting into multiple chunks (one bundle is enough at current size).
- Tree-shaking optimization tuning (esbuild's default is sufficient).
- HMR / dev server upgrade (current `http-server src` + manual reload stays).
- CSS bundling (the game has no CSS).
- Asset hashing / cache-busting in filenames (CS08 owns SW + cache strategy).

## Background

By CS14 claim, sub-invaders' frontend is a "no bundler in v1" canvas game (CONVENTIONS.md project-local block, lines 161-166): "ES2022 modules (`.mjs` extension), strict mode by default. Browser-loaded as ES modules; no bundler in v1." The entry point is `src/index.html:70` which loads `./game/main.mjs` as `<script type="module">`. SWA deploys `app_location: "src"` (`.github/workflows/swa-deploy.yml:64`), uploading the raw `src/` tree without any build step. `node_modules` is not in the upload because it's not under `src/`.

This works for the current consumption pattern (every import is a relative path within `src/`) but breaks the moment a non-relative ESM specifier appears, because:
1. Browsers do not resolve bare specifiers (`from 'canvas-game-engine/loop.mjs'`) — they require either an import map (additional infrastructure) or a bundler (this CS).
2. `node_modules` is not deployed to SWA, so even with an import map the runtime cannot find the dep's files.

The "no bundler in v1" rule was an MVP shortcut, not a permanent architectural commitment. v1 shipped (CS01..04 done, plus CS07/CS09/CS10/CS11/CS12 hardening). The cost of the rule going forward is that any external dep consumption requires bespoke vendor infrastructure (postinstall copy + import map). CS14 retires the rule by introducing the standard modern solution: a bundler that resolves and inlines ESM dependencies at build time.

**Grounding (verified against `main` at CS14 authoring, HEAD `714a356`):**

| Area | Current state | Reference |
|---|---|---|
| Frontend entry | `<script type="module" src="./game/main.mjs">` | `src/index.html:70` |
| Frontend imports | all relative paths within `src/` | `grep -r "from '" src/ | grep -v "from '\\.\\./\\?" | wc -l` returns 0 non-relative |
| SWA upload | `app_location: "src"` direct upload, no build | `.github/workflows/swa-deploy.yml:64` |
| CI runs | unit tests + lint + e2e (Playwright); no bundler invocation | `.github/workflows/ci.yml`, `.github/workflows/e2e.yml` |
| `package.json` deps | runtime: none; dev: existing test/lint deps only | `package.json` |
| Bundler-related config | none — no `vite.config.*`, `esbuild.config.*`, `webpack.config.*`, `rollup.config.*` anywhere in repo | `find . -name '*.config.*' -not -path '*/node_modules/*'` |
| "No bundler" clause | "no bundler in v1" in project-local block | `CONVENTIONS.md:162-166` |

## Decisions (SI-CS14-specific)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS14-1 | Bundler choice | **esbuild** at a pinned exact version (latest stable at execution time, no `^` or `~` range). | Smallest plausible bundler footprint (~20 LOC config), fastest CI build (single-digit milliseconds for the game's size), zero plugin ecosystem buy-in, native ESM output, native sourcemap support, single binary install. Vite is a richer option but ships a dev server + HMR + plugin ecosystem we don't need yet; if HMR becomes a felt need later, swapping esbuild for vite (which uses esbuild internally) is straightforward. Rollup is feature-equivalent but slower and more config-heavy. Parcel is zero-config but slower and less ubiquitous. |
| CS14-2 | Build entry points | Single entry: `src/game/main.mjs` → `src/dist/main.mjs`. No code-splitting (one bundle is fine at current size). | Matches the one-script-tag setup. Adding entry points is a one-line config change later if needed (e.g. for a separate `worker.mjs`). |
| CS14-3 | Build script + watch | `npm run build` for one-shot production build; `npm run build:watch` for local dev rebuild-on-save. NO dev server change — `npx http-server src` continues to serve. | One-shot build is what CI + SWA deploy need; watch is what local devs need. Both shell out to the same `esbuild` invocation with the `--watch` flag toggled. Avoids introducing a competing dev server. |
| CS14-4 [R1,R2] | Output location | `src/dist/`. Added to `.gitignore`. **MUST be excluded from c8 coverage inputs** (R1 finding #2): every c8 invocation in `package.json` `test:unit:coverage` and `.github/workflows/ci.yml`'s coverage job MUST add `--exclude "src/dist/**"` alongside the existing `--exclude "src/**/*.test.mjs"` and `--exclude "src/game/test-hooks.mjs"` flags. **AND `scripts/coverage-perfile.mjs` `normalize()` MUST be updated** (R2 finding #1): today's `normalize()` only prepends `src/` for paths that START EXACTLY with `engine/` or `game/`; esbuild sourcemaps for the bundle reference relative paths like `../game/main.mjs` and `../engine/loop.mjs` which would silently bypass the per-file gate. Required: add a `(\.\./)+` strip step before the existing `engine/`/`game/` detection so single- and multi-segment relative prefixes both resolve to `src/<dir>/<file>`. Add regression test cases. (Without both fixes, the per-file gate would either gate the bundle or report bogus zero-coverage rows for the relative paths.) See R1-finding #2 + R2-finding #1 in plan-review table. | Stays under `src/` so SWA's `app_location: "src"` continues to deploy it without changing the upload root. Gitignored because it's pure build artifact. Coverage exclusion + normalizer update together prevent the bundler output from contaminating the per-file gate. |
| CS14-5 | Source maps | External `.map` sibling files emitted next to the bundle (`src/dist/main.mjs` + `src/dist/main.mjs.map`). Production builds keep maps (no minification — see CS14-7). | External maps over inline keeps the served `.mjs` byte-identical for caching purposes. Playwright + browser DevTools find the sibling map automatically. |
| CS14-6 | Minification | **Off.** Keep the bundle readable in DevTools and View Source. | The game is small (~30KB JS); the cost of minification (debuggability loss, source-map dependency, contributor friction) outweighs the bandwidth savings. Can be flipped on with `--minify` in a one-line config change if profiling later shows real benefit. |
| CS14-7 | Target | ES2022 (matches CONVENTIONS.md project-local block's "ES2022 modules" requirement). esbuild flag: `--target=es2022`. | Sub-invaders explicitly commits to ES2022 (no transpile-down to ES5). esbuild needs the target flag to know what syntax to preserve vs. transform. |
| CS14-8 | Module format | Output `format=esm` (still ES modules; bundler just resolves + concatenates). | Browsers load via `<script type="module">`; no need for IIFE or CJS. |
| CS14-9 [R1] | SWA deploy integration | Insert a frontend-build pre-step into `.github/workflows/swa-deploy.yml`'s `build-and-deploy` job, **before** the `Azure/static-web-apps-deploy@…` action: (a) add `actions/setup-node@<sha>` with `node-version: '20'` and `cache: npm` (verified missing today — the job currently goes straight from `checkout` to the SWA action); (b) run `npm ci`; (c) run `npm run build` to produce `src/dist/main.mjs`. The SWA action then uploads the prebuilt `src/` (including `src/dist/`). **Note on SWA/Oryx wording (R1 finding #4):** today's workflow has `app_location: "src"` with NO `src/package.json`, so Oryx's auto-detect was never building the frontend at the root npm project — the frontend was unbuilt-and-static all along. CS14 makes the root npm project's `build` script the canonical frontend build, run explicitly before upload. After validating the API build (`api/`) is unaffected by the first prod deploy, optionally add `skip_app_build: true` to the SWA action input to bypass any Oryx auto-detect on the upload step (followup; default to leaving Oryx alone). | Explicit beats implicit; the SWA action no longer has to guess what to do with the npm project. API build path (`api_location: "api"`) is unchanged. |
| CS14-10 | Local dev workflow | Document in README: `npm install` (one-time), then `npm run build:watch` (terminal A) + `npx http-server src` (terminal B). | Two-terminal workflow is standard for non-HMR bundler setups. README diff is small (~6 lines). |
| CS14-11 | Test:unit unchanged | Unit tests continue to invoke `node --test src/**/*.test.mjs` against the **source files**, not the bundle. The bundle is a deploy artifact; the unit test target is the source. | Bundling is an output transformation; correctness of the source is what unit tests assert. Bundling correctness is implicitly tested by Playwright E2E (which exercises the deployed bundle). |
| CS14-12 [R1] | Test:e2e + Playwright config | Playwright today already declares a `webServer` block in `playwright.config.mjs` running `npm run serve` (`http-server src -p 4173`) when `useWebServer` is true. That serves `src/` but does NOT build `src/dist/main.mjs` first — a clean checkout or stale dist would either fail to load or test an old bundle. **Required (R1 finding #1):** make E2E self-building by adding `pretest:e2e` and `pretest:e2e:coverage` npm scripts that run `npm run build`, AND updating both `playwright.config.mjs` and `playwright.coverage.config.mjs` `webServer.command` to `npm run build && npm run serve` (so locally-invoked Playwright also rebuilds). For CI: the existing `coverage` job in `.github/workflows/ci.yml` (which runs `npm run test:e2e:coverage`) MUST also have an explicit `npm run build` step after `npm ci` and before the Playwright step (defense in depth — the npm pretest hook covers it, but an explicit CI step makes the dependency visible to anyone reading the workflow file). Same applies to `.github/workflows/e2e.yml`'s `e2e-local` job. | Eliminates the "stale dist" foot-gun; makes the bundle/Playwright dependency explicit at every entry point (pretest hook, webServer command, CI step). |
| CS14-13 | CI workflow updates | `.github/workflows/ci.yml` and `e2e*.yml` add an `npm run build` step after `npm ci` and before the test step that needs the bundle (e2e). Unit tests don't need the bundle. | Explicit, idempotent, ~3-line YAML diff per workflow. |
| CS14-14 [R1] | CONVENTIONS.md update | Project-local block currently says "Browser-loaded as ES modules; no bundler in v1." (the "no bundler in v1" wording is in the JavaScript/browser game code subsection of CONVENTIONS.md). Replace with: "Browser-loaded as ES modules. Bundled by esbuild (`npm run build`) for browser delivery — see CS14 for the rationale of retiring the v1 'no bundler' constraint. Source files remain hand-authored ES2022 `.mjs`; the bundle is a build artifact under `src/dist/` (gitignored)." **This update MUST land in the Phase B PR (NOT deferred to Phase C / follow-up).** Per R1 finding #3, deferring the doc update would allow a PR that retires the "no bundler" constraint to merge while CONVENTIONS.md still asserts the constraint. Phase C contains only verification that the doc update landed correctly — not a fallback doc PR. | The "no bundler" rule is retired in fact; the doc must match BEFORE the constraint-retiring PR merges, not after. Citing CS14 preserves the historical context. |
| CS14-15 | Rollback story | (a) Pre-merge: `git restore src/index.html package.json .github/workflows/swa-deploy.yml CONVENTIONS.md && git rm -r src/dist` — no published state changed. (b) Post-merge: revert the CS14 PR; the next deploy reverts to the pre-bundler `<script>` tag and unbuilt `src/` upload. esbuild devDep stays in `package.json` until a separate cleanup PR (cosmetic only). | Two-step rollback (revert + optional cosmetic cleanup) keeps each step small. The runtime behavior reverts atomically on the revert PR merge + deploy. |
| CS14-16 | User-approval gates | Orchestrator MUST pause for user approval before: (1) merging the CS14 PR (the first deploy with a bundler in the pipeline is the first irreversible production-visible moment). All other steps proceed autonomously. | Single gate. The bundler intro changes the deploy artifact shape; user should consciously approve the first deploy that uses it. |

## Deliverables

### Phase A — Local introduction + verification

1. **Branch** `cs14/introduce-esbuild` from `main`.
2. **Add esbuild devDependency**: `npm install --save-dev --save-exact esbuild` (writes exact-pinned version to `package.json`). Commit the `package-lock.json` update.
3. **Add `.gitignore` entry** for `src/dist/`.
4. **Add build script** `package.json` `scripts.build`: `esbuild src/game/main.mjs --bundle --format=esm --target=es2022 --outfile=src/dist/main.mjs --sourcemap`. Add `scripts.build:watch`: same command with `--watch=forever`. **Also add (per CS14-12 / R1 finding #1):** `scripts.pretest:e2e: "npm run build"` and `scripts.pretest:e2e:coverage: "npm run build"` so any local `npm run test:e2e[:coverage]` invocation rebuilds first.
5. **Run `npm run build`** locally. Verify `src/dist/main.mjs` and `src/dist/main.mjs.map` are produced. Inspect bundle size (expect ~30-60 KB unminified for the current game).
6. **Update `src/index.html`** line 70: change `<script type="module" src="./game/main.mjs"></script>` to `<script type="module" src="./dist/main.mjs"></script>`.
7. **Manual smoke**: `npm run serve` (already-existing script: `http-server src -p 4173 --silent -c-1`) and load `http://localhost:4173/` in a browser. Verify the game boots, the menu renders, a wave plays without console errors, the daily-challenge flag toggles correctly (if enabled), and the leaderboard fetch round-trips (if backend is reachable).
8. **Run unit tests**: `npm run test:unit`. Must pass unchanged (tests target source, not bundle).
9. **Run coverage (per CS14-4 / R1 finding #2 + R2 finding #1):** Update `package.json` `test:unit:coverage` to add `--exclude "src/dist/**"` to its c8 invocation (alongside existing `--exclude "src/**/*.test.mjs"` and `--exclude "src/game/test-hooks.mjs"`). Then run `npm run test:unit:coverage`; verify (a) the run completes and (b) no `src/dist/**` files appear in `coverage-report-unit/coverage-summary.json`. **CORRECTED per R2 finding #1:** the existing `scripts/coverage-perfile.mjs` `normalize()` does NOT handle esbuild sourcemap paths correctly. Today it only prepends `src/` when the path starts EXACTLY with `engine/` or `game/`. Esbuild sourcemaps for `src/dist/main.mjs` reference relative paths like `../game/main.mjs` and `../engine/loop.mjs`; those would pass through unchanged and silently miss the per-file gate. **Required edit to `scripts/coverage-perfile.mjs` `normalize()`:** add a relative-prefix-stripping step BEFORE the existing `engine/`/`game/` detection — e.g. after the URL/backslash strip, collapse any leading `(\.\./)+` to remove parent-dir segments, so `../game/main.mjs` and `../../game/main.mjs` both normalize to `game/main.mjs` and then get `src/` prepended. Add regression test cases in `scripts/coverage-perfile.test.mjs` covering both single (`../game/main.mjs`) and double (`../../game/main.mjs`) parent-dir prefixes, plus the existing absolute and `engine/`-prefix cases. Verify `npm run test:e2e:coverage` after the bundler edit reports SOURCE files (`src/game/main.mjs`, etc.) — NOT `src/dist/main.mjs`, NOT raw `../game/main.mjs`, NOT zero files. Per-file gate MUST attest source files only.
10. **Update Playwright `webServer.command`** in both `playwright.config.mjs` and `playwright.coverage.config.mjs` (per CS14-12 / R1 finding #1): change `npm run serve` to `npm run build && npm run serve` so locally-invoked Playwright rebuilds before serving. (CI gets explicit `npm run build` steps in Phase B; this covers the local-dev path.)
11. **Run e2e tests**: `npm run test:e2e`. Must pass against the bundled output. The `pretest:e2e` hook + updated `webServer.command` together guarantee the bundle is fresh.

### Phase B — CI + deploy integration + docs (CONVENTIONS update lands here, not Phase C)

12. **Update `.github/workflows/swa-deploy.yml`** at the `build-and-deploy` job (lines 44-67) per CS14-9 / R1 finding #4: add `actions/setup-node@<sha>` with `node-version: '20'` and `cache: npm` (verified MISSING today — the job currently goes straight from `checkout` to the SWA action), then add a `npm ci` step, then a `npm run build` step, all **before** the `Azure/static-web-apps-deploy@…` action. The SWA action then uploads `src/` with `src/dist/main.mjs` already present. Do NOT set `skip_app_build: true` in this PR — leave Oryx alone for the first prod cycle; a follow-up PR may add it after confirming the API build path (`api_location: "api"`) is unaffected.
13. **Update `.github/workflows/ci.yml`** — TWO jobs affected: (a) the `coverage` job: change the c8 invocation in the "Unit test coverage (with threshold guard)" step to add `--exclude "src/dist/**"` alongside the existing excludes (mirrors the `package.json` `test:unit:coverage` change from Phase A step 9); ADD an explicit `npm run build` step BEFORE the "E2E test coverage" step that runs `npm run test:e2e:coverage` (defense in depth even though `pretest:e2e:coverage` covers it). (b) the `js-tests` job: NO change needed (unit tests target source files, not the bundle).
14. **Update `.github/workflows/e2e.yml`** `e2e-local` job: add an explicit `npm run build` step between "Install npm dependencies" and "Run Chromium E2E suite". Inspect `e2e-nightly.yml` and `e2e-coverage.yml` (if present) for similar additions.
15. **Update `.github/workflows/pr-evidence-lint.yml`**: verify no changes needed (lint runs against source, not bundle).
16. **Update `CONVENTIONS.md`** per CS14-14 (MOVED FROM PHASE C per R1 finding #3): rewrite the "no bundler in v1" wording in the JavaScript/browser game code subsection (currently 2 lines near line 162). This update MUST land in the SAME PR that introduces the bundler — NOT a follow-up doc PR. Verification: `grep -n "no bundler" CONVENTIONS.md` MUST return zero matches after this step.
17. **Update root `README.md`** with the local-dev workflow per CS14-10 (new deliverable per R1 finding #5): document `npm install` (one-time), `npm run build:watch` (terminal A) + `npm run serve` (terminal B), plus a one-line note that `npm run test:e2e` self-rebuilds via the `pretest:e2e` hook. Insert under the "Local development" or equivalent section; create a new section if absent.
18. **Open PR** titled `CS14: Introduce esbuild bundler (precursor to CS13 engine extraction)`. Body cites this CS, lists the files changed, includes the local Phase A verification evidence (bundle size, smoke checklist results, test run output).
19. **Land rubber-duck pre-merge review** per `REVIEWS.md` (GPT-5.5 primary). Iterate to `Go` verdict.
20. **Land `harness copilot-engage`** per the A5+A16 gate ordering doctrine.
21. **Merge** Phase B PR (squash). **Gates on user approval per CS14-16(1).**

### Phase C — Production validation + close-out

22. **Watch the post-merge SWA deploy.** Verify the deploy succeeds, `/api/health` returns 200, and the deployed game loads + plays one wave end-to-end. Compare bundle size on the deployed URL vs. local build (sanity check — should be identical).
23. **Verify CONVENTIONS.md update landed in the Phase B PR** (was step 19 in the pre-R1 draft as a fallback; per R1 finding #3 it's now Phase B step 16). Phase C contains verification only: `grep -n "no bundler" CONVENTIONS.md` on `main` post-merge MUST return zero matches. If somehow missed (which would mean a Phase B-review escape), file a follow-up doc PR same-day — do NOT close CS14 with a stale CONVENTIONS.md.
24. **Append `LEARNINGS.md` entry** summarising: bundle size observed, build time observed, any CI step-time regression, any Playwright config friction encountered.
25. **Rename** `project/clickstops/active/active_cs14_introduce-esbuild-bundler.md` → `project/clickstops/done/done_cs14_introduce-esbuild-bundler.md`; fill `## Plan-vs-implementation review` with the canonical analyzed_head SHA and verdict.
26. **Update `WORKBOARD.md`** Active Work (remove CS14 when complete).
27. **CS13 unblocks** automatically — Phase B step 16 of CS13 (`npm install canvas-game-engine ...`) now produces a dep whose `from 'canvas-game-engine/loop.mjs'` imports the bundler can resolve.

## User-approval gates

Per CS14-16, one explicit user-approval gate:

1. **Before merging the Phase B PR.** This is the first deploy that puts a bundler in the production pipeline. Trivially revertible (CS14-15) but worth a conscious pause.

All other steps proceed autonomously.

## Exit criteria

1. `npm run build` produces `src/dist/main.mjs` (+ sibling source map) locally and in CI without errors.
2. `src/index.html` loads `./dist/main.mjs`; deployed game runs end-to-end (manual smoke + Playwright suite both green).
3. `npm run test:unit`, `npm run test:unit:coverage`, `dotnet test api/`, `npm run test:e2e`, and `harness lint` all pass on `main` post-merge.
4. SWA deploy workflow includes `npm ci && npm run build` before the upload action; `/api/health` returns 200 post-deploy.
5. CONVENTIONS.md no longer says "no bundler in v1"; the project-local block accurately describes the bundler-backed build (verified IN the Phase B PR, not deferred).
6. Root README.md documents the local-dev two-terminal workflow (`npm install`, `npm run build:watch`, `npm run serve`) and notes that `npm run test:e2e` self-rebuilds.
7. CS14 file lives in `project/clickstops/done/` with a Go plan-vs-implementation review row attached.
8. CS13 (engine extraction) can be claimed without any additional bundler-related work.

## Risks + open questions

1. **R1 — esbuild + ESM imports of `.mjs` extension.** Some bundlers require explicit `.mjs` extensions in import statements (sub-invaders writes them) or strip them. Verify esbuild preserves `.mjs` resolution and doesn't trip on the `.mjs` (as distinct from `.js`) extension during bundling. Mitigation: this is a documented esbuild capability; Phase A step 5 is the verification point. If broken, switch the build entry to `.js` extension or add an esbuild `--resolve-extensions` flag.
2. **R2 — SWA deploy auto-detection (CORRECTED per R2 finding #2).** With `app_location: "src"` and NO `src/package.json`, no app-level npm auto-build is expected from the SWA action — the frontend was never being npm-built by Oryx; it was uploaded as static assets. Post-CS14, the explicit `npm ci && npm run build` step at the workflow level (NOT inside `src/`) does the build BEFORE the SWA upload. Mitigation: monitor the first prod deploy for any unexpected Oryx processing or interaction with the API build under `api/`. If anything goes sideways, add `skip_app_build: true` to the SWA action input in a same-day follow-up to fully bypass any Oryx auto-detect on the frontend upload. The API build path (`api_location: "api"`) is independent of this CS and stays under Oryx.
3. **R3 — Playwright webServer dependency.** VERIFIED at CS14 authoring: `playwright.config.mjs` already declares a `webServer` block running `npm run serve` (conditional on `useWebServer` heuristic). The remaining gap: `npm run serve` does NOT build first — a stale `src/dist/` or first-run-after-checkout fails. Mitigation: CS14-12 requires updating `webServer.command` to `npm run build && npm run serve` AND adding `pretest:e2e[:coverage]` npm scripts that run `npm run build` (Phase A step 4 + step 10).
4. **R4 — Coverage tool + bundled vs. source target.** VERIFIED: `scripts/coverage-perfile.mjs` does NOT glob files — it normalizes report entries from c8 (unit) or monocart (e2e) summaries. Three distinct risks: (a) c8's existing `--include "src/**/*.mjs"` pattern WOULD match `src/dist/main.mjs` if c8 runs after the bundler (CI coverage job will, since Playwright self-builds via the new pretest hook); fix is `--exclude "src/dist/**"` in both `package.json` `test:unit:coverage` AND `.github/workflows/ci.yml` coverage job (Phase A step 9 + Phase B step 13). (b) Esbuild sourcemaps reference relative paths (`../game/main.mjs`, `../engine/loop.mjs`); `normalize()`'s existing `engine/`/`game/` prefix detection does NOT handle the leading `../`. Required (per CS14-4 + R2 finding #1): update `normalize()` to collapse leading `(\.\./)+` before the prefix check, AND add regression tests for the relative-path shape (Phase A step 9). (c) After both fixes, verify `npm run test:e2e:coverage` reports source files only — not `src/dist/main.mjs`, not raw `../game/main.mjs`, not zero files.
5. **R5 — Source-map paths in production.** External `.map` files reveal source paths (e.g. `src/game/main.mjs`). For a public-tier hobby game this is intentional (debugability for users + developers). If the game ever moves private-tier or sensitive, source maps should be reconsidered. Mitigation: documented as known behavior, not a blocker.
6. **R6 — `npm ci` requires `package-lock.json` to be in sync.** If a contributor commits `package.json` edits without `package-lock.json` updates, CI breaks. Mitigation: standard npm hygiene; the `harness lint` suite does not enforce this today but it's caught immediately by the next CI run.
7. **R7 — Bundle size growth invisible.** Without a bundle-size budget, future engine additions may bloat the deployed game silently. Out of scope for CS14 v1; track as a follow-up if observed. Mitigation: LEARNINGS entry records baseline bundle size; future contributors can eyeball deltas.
8. **R8 — Service worker (CS08) interaction.** CS08 introduces a service worker with a SHA-versioned cache; the SW will need to know about `src/dist/main.mjs` instead of `src/game/main.mjs` in its precache list. CS08 is still planned at CS14 authoring, so this is a forward-looking note for whoever claims CS08. Mitigation: CS08 author reads CS14 close-out LEARNINGS for the file-path change.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Phase A: branch + esbuild devDep + `.gitignore` for `src/dist/` | planned | sub-agent #1 | Exact-pinned esbuild version. Deliverables 1–3. |
| Phase A: `build` + `build:watch` scripts + `pretest:e2e[:coverage]` hooks + first verified build + retarget `<script>` tag | planned | sub-agent #1 | esbuild only; no minify; ES2022; ESM. Deliverables 4–6. |
| Phase A: manual smoke + unit tests (unchanged) + coverage `--exclude "src/dist/**"` + `normalize()` update for `(../)+` + regression tests | planned | sub-agent #2 | Test esbuild source-map shapes explicitly. Deliverables 7–9. |
| Phase A: Playwright `webServer.command` self-build + e2e tests pass against bundle | planned | sub-agent #2 | Both Playwright configs. Deliverables 10–11. |
| Phase B: SWA workflow setup-node + `npm ci` + `npm run build` before deploy | planned | sub-agent #3 | Verify Oryx does not double-build. Deliverable 12. |
| Phase B: CI coverage job explicit build step + `--exclude "src/dist/**"` on c8 + e2e workflow explicit build step + pr-evidence-lint no-op verify | planned | sub-agent #3 | Mirrors local pretest. Deliverables 13–15. |
| Phase B: CONVENTIONS.md update to retire "no bundler in v1" clause + README local-dev workflow section | planned | sub-agent #4 | Lines ~162–166. Deliverables 16–17. |
| Phase B: open PR + rubber-duck Go + `copilot-engage` + user-approval merge | planned | orchestrator | User-approval gate before merge. Deliverables 18–21. |
| Phase C: first prod deploy verify + bundle-size + SWA behavior LEARNINGS + WORKBOARD + active→done rotation + close-out commit | planned | orchestrator | Captures R7 baseline for future tracking. Deliverables 22–27. |

## Notes / Learnings

Filled during execution. At minimum, record: first-deploy bundle size baseline (gzipped + raw), observed SWA/Oryx behavior with the explicit `npm run build` step (whether `skip_app_build: true` is needed), `normalize()` regression-test coverage on actual esbuild source-map paths emitted, and any cold-start contributor friction with the new `npm ci` requirement.

## Model audit

| Field | Value |
|---|---|
| Implementer models | claude-opus-4.8 |
| Reviewer model | gpt-5.5 |
| Implementer agent | yoga-si |
| Reviewer agent | rubber-duck |

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.7-1m-internal | rubber-duck dispatched (orchestrator: yoga-si) | 51e531463980 | 2026-06-10T15:30:00Z | Needs-Fix | E2E `webServer` doesn't build (stale dist); coverage must exclude `src/dist/**` + verify sourcemap normalize; CONVENTIONS update into Phase B; SWA `app_location:src` wording; README missing. |
| R2 | gpt-5.5 | claude-opus-4.7-1m-internal | rubber-duck dispatched (orchestrator: yoga-si) | 9adc0290acbb | 2026-06-10T16:00:00Z | Needs-Fix | Sourcemap-normalize claim wrong: `normalize()` only handles `engine/`/`game/` prefixes, not `../game/`/`../engine/` from esbuild; SWA R2 risk wording still inaccurate. |
| R3 | gpt-5.5 | claude-opus-4.7-1m-internal | rubber-duck dispatched (orchestrator: yoga-si) | 6124c5e14b7c | 2026-06-10T16:30:00Z | Go | No findings; R3 addresses normalize(), regression coverage, build-before-test handoffs, CI/SWA ordering, and prior inconsistencies. |

## Plan-vs-implementation review

> _(filled at close-out per the gate — required only when this file lives in `active/` or `done/`)_
