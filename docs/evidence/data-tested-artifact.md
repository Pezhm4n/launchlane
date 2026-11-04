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

This path currently covers the supported root npm/Node fullstack build, original source migration script and one to four temporary logical PostgreSQL targets. It does not implement production migration, framework-specific migration engines, extra non-database build inputs, provider restart/persistence, browser interaction with the deployed application, data-safe rollback or all fourteen runtime families. The next data-plane slice must bind a controlled destination execution and independent schema/data/workload observations to the exact approved resource/artifact/release; local success cannot authorize those writes. Self-review identified that the existing Agent publication-success branch marked a mission completed after release/HTTP/API checks; the follow-up below addresses that v4 outcome boundary without reinterpreting local data proof as production proof.

## Publication outcome follow-up

After preparation commit `401b6f707e9700f67ab0a363b900092c7d759504`, the Agent's existing publication-success path now revalidates the completed build for the acting user against the accepted source/build/output hashes, output directory and API criteria. V4 remains `partially_completed` with an explicit destination-data notice even after a successful release/page/API observation. The limited remote publication effect remains verified; no destination migration/data receipt is invented. Missing, foreign or mismatched build evidence fails closed. Fullstack preparations without v4 retain their prior behavior; this is not fresh acceptance of other data-dependent publication paths.

Isolated `data-outcome-r5` is based on that preparation commit. Runtime/package SHA256: `1436a2c3f8ef77bc97c73af4b1a96e605a9ab35dca6d0ac27712d0184b09c167`; 680 files, six explicitly owned code/test overlays. Runtime/dependencies/explicit cache are the same configuration described above; the main server and port3000 are untouched. The test first builds/selects a real data-tested artifact and binds two synthetic provider resources through real decisions. It then uses the actual Agent, approval, upload/release journal, exact archive hash and observation path with synthetic provider/public-workload transports. Even successful proof/assets/API responses must leave the mission partial, and rehydration must preserve that outcome and allowance. This is not a real Liara release or production data-plane test.

| Follow-up r5 check | Result |
| --- | --- |
| `npm run typecheck` | passed |
| `npm run lint` | zero errors, 48 existing warnings, 22 infos; 547 files |
| Webpack production build | passed |
| `npm run test:http` | 48/48, zero fail/skip; 19.681 seconds |
| `npm run test:domain` | 799/799, zero fail/skip; 295.842 seconds |
| Guided browser | 54 states at 320/360/390/768/1280px; synthetic model/provider |
| `node --test --test-concurrency=1 tests/sandbox/data-artifact.test.ts` | 2/2, zero fail/skip; 114.210 seconds; actual local data/build/artifact and real Agent/application transitions, synthetic provider/public-workload/model transports |

The positive case requires one synthetic model response for publication and exactly two synthetic upload/release writes, with zero writes before approval. Its successful release observation is `WORKLOAD_VERIFIED`; the mission nevertheless remains partial with the destination-data notice. A new repository read retains its outcome, usage and limits. Unit regressions also reject another actor and source/build/output mismatches. All follow-up checks completed on r5; no earlier revision's pass is substituted for it. The six-case legacy PostgreSQL aggregate and ten-layout data-worker browser above belong to preparation r9 and are not relabelled as fresh r5 runs. Actual cloud writes, production SQL, actual model requests, allowance renewal, push and rollout remain zero.

The owned source/test files are frozen in `data-outcome-r5-manifest.json`; runtime checks are in `data-outcome-r5-runtime.log`, and lint/build/HTTP/guided/domain checks in `data-outcome-r5-validation.log`. A later graph coverage request returned `Transport closed`; the exact caller/callee source was followed, including the shared environment verifier and the duplicate Agent gate. Private state and receipts remain excluded from Git.

The first follow-up attempts did not form a publication proposal; the repeated-tool guard then reported `AGENT_NO_PROGRESS`, initially hiding the first tool error in the assertion. Source tracing found the actual caller defect: after `fullstackVerification` had already validated the real database bindings, `propose_publication` repeated the legacy build-environment equality check. V4 intentionally has a null temporary-test environment, so this second check rejects the separately approved real environment. The caller now reuses the shared verifier and separately preserves the original workload check. Ordinary builds still pass their original environment validation inside that verifier; no authorization is removed.

Fixture review also found an omitted environment-read port. It is now explicitly injected with a GET assertion before publication can reach that boundary. The earlier caller rejection occurred before that adapter, so a default provider request is not claimed as an observed event; the initial harness hypothesis was not the demonstrated root cause. App/release/write/probe/environment transports are synthetic, and no valid provider credential or provider write is used. Failed attempts are retained and count as no acceptance result. No workload expectation, approval or timeout was weakened.
