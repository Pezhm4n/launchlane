# Data-tested prepared artifacts — 2026-10-29

This slice connects the existing original migration runner and independent disposable data proof to the existing immutable compiled-artifact path. See [ADR0037](../decisions/0037-data-tested-prepared-artifacts.md). It is a preparation dependency of complete deployment, not acceptance of production migration or complete deployment.

## Product path

The user selects a project and starts preparation from the publication tab. The shared Agent can propose `compatibilityDatabase: {runnerScript,targets,prepareArtifact:true}` through `propose_project_build`. The existing review explains the source command/hooks, separate targets and independent data criteria, and that artifact creation is included. Nothing executes before that decision. A successful job selects the exact prepared artifact and keeps the mission partially completed for real resources, private configuration and publication decisions. Chat remains optional.

Versions1–3 still produce compatibility evidence only. V4 retains the original runner and API oracle, requires independent schema/fixed-row/fresh-write/replay/second-worker proof for every target, and exports only validated compiled frontend bytes. The database-plan and whole-build hashes have different purposes and are checked separately. The archive contains the existing compiled-byte verifier and provenance. A missing or mismatched data receipt cannot assemble an artifact.

Publication checks require all separate tested targets to resolve to exact approved real resource IDs and private v9 bindings in the selected scope. Missing bindings, swapped binding links and collapsing two tested targets into one resource are rejected. This gate is configuration/resource evidence; it does not establish SQL connectivity or migrated production data.

## Validation record

Frozen candidate **data-artifact-r9** is based on `b29ad87576362d9cd81d0b447bb6f429b3036d4d`, with 677 exported files and 25 explicitly owned code/test overlays. Runtime/package SHA256: `a4ecbff6d63d744f701fd67db64f43880780c606e17e7a50f2ea4ddbfa0144ce`. Node24.18.0/npm11.16.0, pinned root dependencies, Next16.4.2 and Docker Linux29.0.1 were used. The main server, port3000 and root `.next` were untouched. Documentation is appended after the runtime freeze.

The original runner fixtures accept an explicit `LAUNCHLANE_TEST_NPM_CACHE` content-cache path. Workers still perform actual locked offline installs and validate package bytes; host cache misses use the existing bounded public npm reader. The cache audit found 95 lock entries and 15 misses before the final run. No package, lockfile, oracle or deadline was weakened. PostgreSQL16 and Node22 images retain their pinned digests; no image pull was performed.

Measured on r9:

| Check | Result and boundary |
| --- | --- |
| `npm run typecheck` | passed; actual Next type generation and TypeScript |
| `npm run lint` | zero errors, 48 existing warnings, 22 infos; 546 files |
| `node node_modules/next/dist/bin/next build --webpack` | passed; local production build |
| `npm run test:http` | 48/48, zero fail/skip; 25.266 seconds; isolated authenticated API and synthetic providers |
| `npm run test:domain` | 799/799, zero fail/skip; 299.279 seconds; synthetic model/provider transports |
| `node --test --test-concurrency=1 tests/sandbox/data-artifact.test.ts` | 2/2, zero fail/skip; 111.057 seconds; actual PostgreSQL/Node/original runner/API/tests/export/archive/selection, synthetic model |
| `LAUNCHLANE_TEST_DATA_ARTIFACT_BROWSER=true` then `node scripts/test-migration-worker-browser.mjs` | passed; actual folder upload, mission, keyboard decision/API, five containers, exact artifact selection, replay409 and reload without new execution |
| `node scripts/test-database-attachment-browser.mjs` | passed; two exact existing-resource decisions, two private env decisions, merge/readback, replay/reload and eight responsive layouts; synthetic providers/model |
| `node scripts/test-guided-browser.mjs` | passed; 54 states at 320/360/390/768/1280px; synthetic providers/model |
| `node --test --test-concurrency=1 tests/sandbox/postgres-migration.test.ts tests/sandbox/postgres-runner.test.ts` | 6/6, zero fail/skip; 340.298 seconds; actual legacy SQL/runner/data/read-only-observer regressions |

The positive sandbox case requires local fullstack provenance, actual archive-byte hashing, rejection before real bindings exist, and subsequent acceptance after two independent existing-resource decisions plus two private configuration decisions. These resource/configuration transitions use the real application/approval/Store but synthetic provider transports; they make no actual Liara write. The negative worker case embeds a reserved temporary database marker in a disposable source copy and requires `BUILD_OUTPUT_SENSITIVE`, no artifact and no publication. The original runner and API oracle bytes remain unchanged in both cases.

The browser recorded two synthetic model responses, one authenticated HTTP decision, five distinct container IDs, two runner runs and two app runs. It checked review and receipt at 280/320/390/768/1280px: ten layouts, zero overflow/axe violations/page errors/external browser requests. Replay returned409; reload preserved usage, limits and container IDs. The resulting compiled artifact, publication provenance and output receipt were asserted and the exact artifact was selected. Desktop/mobile screenshots were inspected and compared with the earlier runner card; the earlier screenshots are historical UI context, not new acceptance.

Browser run `ee0f0742-5099-484f-904e-5465b61f5a15` binds original source `cad4307adc9ab9fb644cb6efa3bcb450fe40fb31b11728b9f627eb318c8d5f00`, prepared execution source `6249fea6904a02645af24dd4fc2dd29d03603d6fcaaaa4df3966deddd2f882d9`, database plan `3a2ce595e8bfdce244415182bd0c7d6c0427b7597478f6f344abcafe59e1fbaf` and original runner `656c862e0a8f650b25257b2a8b03aaeeb1bba929fba4315230eb740aec6b3679`. The database-plan hash is not the complete build-plan hash. Each of two targets measured five columns, two fixed rows and one fresh-write/persistence criterion. Both `production` and `databaseRestartVerified` remain false.

All listed checks completed on this same r9 snapshot; earlier candidates are not combined into its pass. No fresh real model consumption, allowance renewal, actual cloud write, production SQL, push or rollout was performed.

The graph became reachable again, but coverage generation `2026-10-21T19:24:24Z` reports the relevant paths as not tracked or metadata changed, and scripts as excluded. Exact source/import/caller/contract/test reads supply the evidence; absent graph symbols are not treated as absent capabilities.

Private manifests/logs are under `.local/continuation-20261028/data-artifact-r9-*`; browser results/screenshots are in the candidate's `.artifacts/data-artifact-worker/2026-10-29T07-04-26.779Z`. Private state, archives and binaries are excluded from Git.

## Retained failures

An early typecheck rejected an invented `public` field on the key/value environment DTO. Privacy is now checked through the existing linked v9 receipts, which record secret classification and exact current values. A related regression requires these bindings even when source need inference is unknown. A contract expectation was updated for the additional optional tool field; negative/source/oracle checks remain.

Early worker attempts found Docker Desktop stopped and failed before creating a fixture. It was started locally; the exact engine and cached image identity were then read back. An attempt during startup and a later positive attempt returned `CANCELLED` without an application receipt. The later cancellation's original cause is unconfirmed; it is not counted as a project-test failure or pass. Final r9 used the ready engine and explicit content cache and passed with unchanged workload/data criteria and deadlines.

The earlier negative export reached the worker but surfaced `POSTGRES_FIXTURE_CALLBACK_FAILED`: the fixture wrapper retained only migration-specific typed errors. It now also preserves host `BUILD_OUTPUT_*` validation failures after confirmed teardown, with a regression. Unknown callback messages remain sanitized, and uncertain/failed cleanup still overrides success. The final actual negative case observes `BUILD_OUTPUT_SENSITIVE`. Legitimate waits for the concurrent runtime worker's shared heavy lock produced no acceptance result; no process, lock or unrelated checkout was displaced.

## Remaining boundary

This path currently covers the supported root npm/Node fullstack build, original source migration script and one to four temporary logical PostgreSQL targets. It does not implement production migration, framework-specific migration engines, extra non-database build inputs, provider restart/persistence, browser interaction with the deployed application, data-safe rollback or all fourteen runtime families. The next data-plane slice must bind a controlled destination execution and independent schema/data/workload observations to the exact approved resource/artifact/release; local success cannot authorize those writes. Self-review also identified that the existing Agent publication-success branch marks a mission completed after release/HTTP/API checks; v4 needs an explicit partial outcome until production data is independently verified. That follow-up must not reinterpret the local receipt as production proof.
