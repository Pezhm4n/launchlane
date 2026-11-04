# Database — verification evidence

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [Disposable application signing inputs](#disposable-application-inputs)

- [Data-tested prepared artifacts — 2026-10-29](#data-tested-artifact)
- [Disposable PostgreSQL fixture adapter — 2026-10-25](#disposable-postgres-fixture-20261025)
- [Existing managed database selection — 2026-10-28](#existing-managed-database)
- [Named managed databases in one mission — 2026-10-28](#managed-database-targets)
- [Managed database and secure binding — 2026-10-28](#managed-database)
- [Managed fullstack continuation — 2026-10-25](#managed-fullstack-20261025)
- [PostgreSQL data observation tied to a publication](#postgres-data-observation)
- [Source-bound PostgreSQL migration and application data proof — 2026-10-28](#postgres-migration-test)
- [Original migration runners and independent data targets — 2026-10-28](#project-migration-runners)
- [Schema baseline intake and disposable bootstrap](#schema-baseline-intake)
- [SQLite binding and migration ownership — 2026-10-26](#sqlite-binding-20261026)

<a id="data-tested-artifact"></a>

## Data-tested prepared artifacts — 2026-10-29

This slice connects the existing original migration runner and independent disposable data proof to the existing immutable compiled-artifact path. See [ADR0037](../decisions/database.md#0037-data-tested-prepared-artifacts). It is a preparation dependency of complete deployment, not acceptance of production migration or complete deployment.


<a id="data-tested-artifact-product-path"></a>

### Product path

The user selects a project and starts preparation from the publication tab. The shared Agent can propose `compatibilityDatabase: {runnerScript,targets,prepareArtifact:true}` through `propose_project_build`. The existing review explains the source command/hooks, separate targets and independent data criteria, and that artifact creation is included. Nothing executes before that decision. A successful job selects the exact prepared artifact and keeps the mission partially completed for real resources, private configuration and publication decisions. Chat remains optional.

Versions1–3 still produce compatibility evidence only. V4 retains the original runner and API oracle, requires independent schema/fixed-row/fresh-write/replay/second-worker proof for every target, and exports only validated compiled frontend bytes. The database-plan and whole-build hashes have different purposes and are checked separately. The archive contains the existing compiled-byte verifier and provenance. A missing or mismatched data receipt cannot assemble an artifact.

Publication checks require all separate tested targets to resolve to exact approved real resource IDs and private v9 bindings in the selected scope. Missing bindings, swapped binding links and collapsing two tested targets into one resource are rejected. This gate is configuration/resource evidence; it does not establish SQL connectivity or migrated production data.


<a id="data-tested-artifact-validation-record"></a>

### Validation record

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

Private manifests/logs are under `<private-validation>`; browser results/screenshots are in the candidate's `.artifacts/data-artifact-worker/2026-10-29T07-04-26.779Z`. Private state, archives and binaries are excluded from Git.


<a id="data-tested-artifact-retained-failures"></a>

### Retained failures

An early typecheck rejected an invented `public` field on the key/value environment DTO. Privacy is now checked through the existing linked v9 receipts, which record secret classification and exact current values. A related regression requires these bindings even when source need inference is unknown. A contract expectation was updated for the additional optional tool field; negative/source/oracle checks remain.

Early worker attempts found Docker Desktop stopped and failed before creating a fixture. It was started locally; the exact engine and cached image identity were then read back. An attempt during startup and a later positive attempt returned `CANCELLED` without an application receipt. The later cancellation's original cause is unconfirmed; it is not counted as a project-test failure or pass. Final r9 used the ready engine and explicit content cache and passed with unchanged workload/data criteria and deadlines.

The earlier negative export reached the worker but surfaced `POSTGRES_FIXTURE_CALLBACK_FAILED`: the fixture wrapper retained only migration-specific typed errors. It now also preserves host `BUILD_OUTPUT_*` validation failures after confirmed teardown, with a regression. Unknown callback messages remain sanitized, and uncertain/failed cleanup still overrides success. The final actual negative case observes `BUILD_OUTPUT_SENSITIVE`. Legitimate waits for the concurrent runtime worker's shared heavy lock produced no acceptance result; no process, lock or unrelated checkout was displaced.


<a id="data-tested-artifact-remaining-boundary"></a>

### Remaining boundary

This path currently covers the supported root npm/Node fullstack build, original source migration script and one to four temporary logical PostgreSQL targets. It does not implement production migration, framework-specific migration engines, extra non-database build inputs, provider restart/persistence, browser interaction with the deployed application, data-safe rollback or all fourteen runtime families. The next data-plane slice must bind a controlled destination execution and independent schema/data/workload observations to the exact approved resource/artifact/release; local success cannot authorize those writes. Self-review identified that the existing Agent publication-success branch marked a mission completed after release/HTTP/API checks; the follow-up below addresses that v4 outcome boundary without reinterpreting local data proof as production proof.


<a id="data-tested-artifact-publication-outcome-follow-up"></a>

### Publication outcome follow-up

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

<a id="disposable-postgres-fixture-20261025"></a>

## Disposable PostgreSQL fixture adapter — 2026-10-25

Working-tree addition. The initial adapter checkpoint below preceded the subsequent v7 worker integration. Original Golestan, its running deployment, configuration and databases are outside this execution scope.

`src/server/agent/postgres-fixture.ts` implements an executable adapter for a future synthetic-data test slice. It accepts only a host-owned job ID/source hash, parent signal and mandatory asynchronous creation-receipt callback. It never accepts application credentials, arbitrary URLs, environment values, images or commands from a model. The internal command dependency is injectable for deterministic tests.

The image is the official Linux/amd64 PostgreSQL 16 Bookworm manifest `sha256:e92e17ca202da4bb205f6f4a6c8cb30539edfbaa04987b506630f5d5851ff3c8`, configuration image ID `sha256:392c708576858a9a583a1b937503a99df57ca5dae63890748f4d0f2fc848abc6`. These identities were checked against the [official Docker image metadata](https://raw.githubusercontent.com/docker-library/repo-info/master/repos/postgres/remote/16-bookworm.md). The adapter requires the image already in cache and never pulls it.

Before exposing a binding, it verifies job/source labels, image identity, the fixed local Docker endpoint, network `none`, no published ports, no bind or persistent/anonymous volume, read-only root, UID/GID 999, dropped capabilities, no-new-privileges, 512 MiB memory/swap, 0.25 CPU and 128 PIDs. Data and socket use two bounded tmpfs mounts; fixed `mountinfo` readback checks their actual filesystem type and flags. `pg_isready` is readiness only, not proof of schema, SQL behavior or persistence. Trust authentication is restricted to this disposable loopback namespace; no real credential is consumed.

Creation has one owner and no blind retry. A lost create response can be reconciled only for the exact receipt and cleanup, not continued execution. The receipt callback is awaited before start. Lifetime is at most 360 seconds and cannot outlive the parent signal; cleanup has an independent five-second bound and removes only the verified full ID.

Root review found an additional lifecycle defect: cancelling an `abortable(use)` could return while the caller's Node worker was still cleaning up. The adapter now tracks callback settlement during teardown. An unsettled callback or typed uncertain worker cleanup results in `POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED`, even if the database container itself was removed. The caller must retain its durable execution marker and capacity/queue barrier. Two earlier cancellation oracles were strengthened, and late-settlement plus uncertain-worker regressions were added.

Validation: 23/23 synthetic command-transport tests passed, zero failures/skips/cancellations, about 10.9 seconds; TypeScript and lint of both files passed. The initial delegated snapshot had 21 passing tests before the root lifecycle correction. No Docker daemon, PostgreSQL process, native PostgreSQL binary, SQL, package/image download, model call or cloud write was executed for these tests.

Open before integration: durable pre-create marker and recovery barrier, one shared worker-capacity reservation and Docker endpoint, a source/approval-bound disposable test plan, isolation of test inputs from private production environment, unchanged project migrations/tests, real synthetic write/read/restart evidence, and preservation of build-output/artifact provenance. Neither these tests nor readiness complete A14/AC34 or the real Golestan acceptance path. The previously built public candidate and public deployment remain unchanged.


<a id="disposable-postgres-fixture-20261025-subsequent-worker-integration-checkpoint"></a>

### Subsequent worker integration checkpoint

The optional v7 `testDatabase` plan binds only source-validated environment names and declared public relations to the host-pinned image and compatibility-only purpose. Existing plans without this field preserve their canonical bytes. Production environment references and public frontend database keys are rejected. CodeRepair durably records the attempt before creation, shares one capacity reservation and local Docker endpoint with the Node worker, awaits creation receipts, and retains the recovery barrier after uncertain cleanup. Explicit empty proxy variables and inspect readback prevent Docker CLI proxy injection into either container.

The fixed Node program keeps generated test inputs out of installation and frontend compilation. It starts the backend with synthetic loopback database inputs, waits for the declared schema before HTTP checks, and executes the unchanged project test commands. The schema check uses the project's existing locked `pg` dependency and a fixed parameterized relation-existence query. Compatibility success produces no build-output receipt or publication artifact; artifact assembly, project selection and publication verification reject this mode.

Validation: 33/33 targeted regressions passed with zero failures/skips/cancellations (11.8 seconds), covering the adapter, fullstack contracts, execution barrier and actual CodeRepair lifecycle. The fixed guest JavaScript runs in a VM with synthetic process/filesystem/HTTP/PostgreSQL transports; it is **not** real Docker, PostgreSQL or SQL execution. TypeScript passed. Lint of 14 changed files had zero errors, two warnings and one informational finding. These results supersede neither the earlier real Docker checkpoint nor public acceptance.

The Agent continuation now records a compatibility-only receipt without selecting an artifact, recording mission publication provenance or completing the original publication goal. A trusted internal sandbox dependency allows the driver continuation to be tested without accessing a host daemon. The existing `propose_project_build` accepts `compatibilityDatabase` with only environment-key and relation names; host constants and source validation construct the plan. An identical failed compatibility attempt cannot be retried merely because stored production environment inputs differ from the deliberately empty test inputs.

Six additional Agent/MCP regressions passed in root verification: proposal and explicit approval through the actual Agent driver and CodeRepair lifecycle, MCP publication lifecycle/readback using that same registry, reject/expiry, application failure, and ordinary v7 canonical compatibility. Model HTTP and Docker command transports are synthetic; the MCP schedule callback is captured and the driver is invoked with explicit synthetic dependencies. These tests execute no actual Docker, PostgreSQL, compiler, project script or live provider/model request. Twelve related Agent/completion/worker regressions also passed. A test-only exact-optional-property TypeScript failure was corrected by omitting an absent context field; the final TypeScript check passed. Public deployment remains unchanged.

Still unverified: real PostgreSQL image execution, application migrations and SQL behavior with disposable data, restart persistence, the actual Golestan workload and any public rollout of this candidate. No new download, original environment injection, production SQL, model request or cloud resource creation was performed for this checkpoint.

Final review found a missed case in the first Agent fixture: it had imported encrypted inputs but no succeeded, verified v9 configuration. With such a configuration present, three ordinary environment-reference checks in CodeRepair would compare the intentionally null compatibility reference with the real current reference and fail before the worker. Proposal, download and execution now bypass production environment resolution only for a validated v7 disposable-database plan. Ordinary builds retain their original reference checks. This correction does not grant access to real environment inputs or change publication authority.

The final Agent regression file passed 7/7 in root verification after adding this case; TypeScript passed again. The new regression establishes a succeeded/verified v9 action through the real proposal/approval/execution/observation services using a synthetic Liara transport, asserts a non-null current reference, and completes the compatibility proposal/approval/worker/receipt path with a synthetic Docker transport. Stored action rows, encrypted input rows and the current reference remain unchanged. Ordinary build proposals preserve their reference and reject a missing reference with `ENV_REFERENCE_CHANGED`. No actual Liara write or production environment was used.

<a id="existing-managed-database"></a>

## Existing managed database selection — 2026-10-28

This A14 / AC17/22/23/24/32/34 slice adds exact-ID reuse and private rebinding to the shared resource flow. It preserves the earlier v27/v28 creation, original migration-runner and artifact/publication implementations. [ADR0036](../decisions/database.md#0036-existing-managed-database-selection) records the decision. This is resource/configuration capability, not complete application or live data-plane acceptance.


<a id="existing-managed-database-product-behavior-and-use"></a>

### Product behavior and use

The guided publication mission may inspect `read_database_resources` inventory and call `propose_database_attachment` with `consumerRoot`, private `bindingKeys` and the exact `databaseId`. The host checks immutable source evidence and same-account inventory, then privately reads the existing provider detail endpoint. The detail ID/hostname/type/plan must agree with inventory; version and an explicit private network must be known, and the network must match the actual consumer in the selected team. Unknown public/private status, mismatched identities and missing metadata fail closed.

The proposal is ActionSpec v29 `attach_database`. The ordinary resource card shows the existing database name, application, type/version, connection keys, current separate price components and private network. Exact ID, consumer and expiry are available under technical details. The user approves selection, then fresh checks precede the existing atomic claim. Selection performs no create, clone, resize or SQL request. The journal records the observed resource as `selected`; neither execution nor Agent state rehydration labels it `created` or manufactures a cloud change.

The same secure form then obtains private credentials on the server and proposes encrypted v9 environment inputs. Its separate decision, merge-preserving single-send update and configuration readback remain required. The model and browser receive names and receipts, never passwords or raw connection values. The web and MCP Agent goals share this registry and application engine; no public credential/SQL tool is added. This slice does not include a new invocation from an actual MCP client.

Reservations cover v27/v28/v29. An occupied purpose may be selected again only for the identical successfully observed ID, engine, consumer and exact key set. New private credentials for that same identity/purpose may supersede the previous binding, allowing recovery after rotation. A different database or swapped resource links cannot satisfy the publication guard. Uncertain creation is not adopted by hostname.

After a local interruption between recording selection start and acceptance, reconciliation reads only the approved ID and requires the same private detail evidence. It does not renew or repeat claim/approval. This recovery is specific to selection, which has no provider write; v27/v28 unknown create responses still require their returned identity and never receive this exception.

Migration21 only appends a request-key index covering v27/v28/v29. The complete migrations1–20 `{version,sql}` prefix matches immutable base `fc01252d8531da66a9ca0cb4633e53a55b692f22`; aggregate JSON SHA256 is `a93f6875de44efa559d8cb3d0004693f7b5acf8379f4abbbf81c8b17acfbbf5d`. Disposable upgrade tests also preserve sessions and reject a duplicate request key across creation/selection.


<a id="existing-managed-database-revision-and-validation"></a>

### Revision and validation

Base: `fc01252d8531da66a9ca0cb4633e53a55b692f22`. Node24.18.0, npm11.16.0 and pinned dependencies. Final candidate: `database-attachment-r9`, runtime/package SHA256 `170d2b905a1247d5375b0a60daa946ec006621c6522d87bb869a9ef247a35cad`. Source and tests are frozen independently of the main server and the other agent's runtime/component worktree. Heavy checks hold the agreed OS FileStream lock with `FileShare.None`; file existence is not treated as ownership. Servers use isolated disposable state and ports, without modifying port3000 or the main `.next`.

All final results below belong to r9; earlier candidates are not relabelled as its pass:

| Command / boundary | Final result |
| --- | --- |
| `npm run test:domain` | 795/795,260.070s; no skipped/cancelled tests |
| `npm run typecheck` | Passed |
| `npm run lint` | 0errors,48warnings,22infos;542files; no fixes applied |
| `node node_modules/next/dist/bin/next build --webpack` | Passed; nested-snapshot workspace-root warning retained |
| `npm run test:http` | 48/48,28.391s; actual isolated HTTP with synthetic integration transports |
| `node scripts/test-database-attachment-browser.mjs` | Two exact existing IDs and two private bindings;8expanded responsive/axe layouts; keyboard disclosure/decisions, replay409 and reload passed; no browser errors, external requests or secret leaks |
| `node scripts/test-database-targets-browser.mjs` | Prior two-created-resource/private-binding web regression passed;8responsive/axe layouts; synthetic provider/model |
| `node scripts/test-guided-browser.mjs` | 54states at320/360/390/768/1280; synthetic model,0cloud writes |

Final existing-resource run `452cc96b-8ee2-4b85-b3ca-a6cb0865f17d` used6synthetic model requests,0create calls,2synthetic env writes and4durable attempts. Screenshots at320/1280 with expanded ID details were visually inspected. No fresh Docker/runtime-database test was necessary or claimed in this resource-selection slice; the prior original-runner evidence remains separate. Per-file normalized hashes for all23owned code/test paths match the frozen r9 manifest before staging. Private manifests/logs are under `<private-validation>`; artifact outputs are under that candidate's `.artifacts`.

The preceding r8 runtime/package fingerprint was `2d33ea5a3ad1260c9024321abf35b9965c19ea98303268c16c6102d629c241bd`. Its fresh full domain suite passed795/795 in257.951s; typecheck, lint0errors/48warnings/22infos across542files, Webpack build, HTTP48/48 in18.503s, the actual web/API two-existing-resource path, the earlier two-created-resource regression and guided54 all passed. r9 adds the visible existing-resource name, a neutral missing-binding error, an explicit engine match for same-ID reservation reuse and expanded keyboard/disclosure/screenshot checks. Final r9 checks remain separately attributed.

The domain cases cover exact-ID and source-purpose binding, zero-balance selection without purchase, rejected/missing/public/cross-network/changed resource metadata, current catalog/price/source/account/expiry/budget checks before claim, immutable consent/session/actor/replay, inventory-only and mismatched proof denial, interrupted local selection reconciliation, shared Agent continuation, private environment merge and same-resource credential rotation. Existing creation/uncertainty and swapped-link regressions remain in the full suite.

The browser path uses real folder upload, guided mission registration, tools, approval API, Store/journal and private binding application. Provider and model transports are explicitly synthetic and deny every external network request and every unregistered operation. Two existing resources are seeded as fixture metadata. The mission reads inventory, selects each exact resource, obtains two separate selection decisions and two environment decisions, preserves KEEP_KEY and the first connection during the second merge, and stops with migration/data/publication still unverified. There are zero provider create calls, two synthetic environment writes, six synthetic model requests, four durable attempts and zero actual cloud writes. Replay must return409 and reload must preserve usage/limits and issue no new model request or write. Responsive/axe checks cover320/390/768/1280 for each selection, with exact ID disclosure operated by keyboard. Screenshots/logs remain private under the candidate's `.artifacts/database-attachment`.


<a id="existing-managed-database-retained-failures-and-remaining-work"></a>

### Retained failures and remaining work

The first typecheck rejected a nullable connection team ID; the adapter now receives the validated connected config's team scope. An early fixture omitted the required consumer bundle ID and failed before any selection. Expanding the historical pending-action fence indiscriminately also changed an existing reservation error; that unrelated expansion was removed while the existing cross-version uncertainty fence remains. The Agent integration then found state rehydration incorrectly labelling an existing selection as creation; both driver and repository projection now preserve prior effects. Later typechecks found test closure narrowing errors; local validated discriminants replaced them without assertions or relaxed typing. Failed logs remain in the private candidate records; their results are not counted as passing final runs.

Graph project/coverage tools again returned `Transport closed`; exact source/import/caller/contract reads supplied the evidence. No missing capability was inferred from absent graph symbols.

Selection currently requires explicit private detail network/version and a plan/bundle/version still observable in the account catalog with both separate prices known. Legacy resources with missing or retired metadata need a further reviewed contract; no default version, zero price or public endpoint is invented. The source binding is still limited to the supported private URL/URI shapes for PostgreSQL/MySQL/Redis.

Real provider detail/adoption, destination-side original migration execution, independent SQL/schema/data effects, release-bound API/connectivity, database restart/persistence, a complete resource/component plan and data-aware rollback remain open. The next implementation must connect the existing original-runner proof and these exact resource bindings to controlled authorized execution and the tested publishable artifact. A metadata/configuration receipt cannot discharge those requirements. The owner's no-new-model-spending decision was preserved: no real model calls, ledger renewal, actual infrastructure writes, production SQL, original corpus edits, push or rollout occurred.

<a id="managed-database-targets"></a>

## Named managed databases in one mission — 2026-10-28

This A14 / AC17/22/23/24/32/34 slice extends the existing managed database application and Agent loop. It connects distinct source connection names to separate resource proposals and private configuration decisions in the product's actual web path. It is not live provisioning, production migration, SQL/connectivity, a publishable data-test artifact or full application acceptance. [ADR0035](../decisions/database.md#0035-source-bound-managed-database-connections) records the design.


<a id="managed-database-targets-problem-and-resulting-behavior"></a>

### Problem and resulting behavior

The prior disposable runner could verify two logical databases, but managed creation did not bind a connection purpose; the private binding service assumed DATABASE_URL/REDIS_URL and the mission driver refused any second database. A source with AUTH_DB_URL and PROFILE_DB_URL could not complete even its resource/configuration stages. The host must not silently map both to one resource.

New Agent proposals include private `bindingKeys` and mint ActionSpec **v28**, binding those exact keys, consumer root, source/archive/selection, actor/account/team/application, engine/version/network, request ID, separate prices and expiry before creation. Keys must be declared by that consumer's required database requirement, match the current source/evidence manifest and belong to the supported private URL/URI input shape. One proposal creates one resource; multiple listed keys explicitly alias that one resource. Distinct data targets require separate proposals/decisions. The model cannot choose a resource credential, remote ID or approval.

The existing Store transaction rejects overlapping reserved keys, including source/app lineage changes that would otherwise create a duplicate resource for an occupied application input. Rejected, expired unused and known failed/no-resource requests do not hold a reservation; an actual returned resource and unresolved request do. The original team-wide uncertainty fence applies across v27/v28. Historical v27 canonicalization, actions and progress keep their original shape. Migration20 appends a unique request index covering both versions; migrations1–19 are not rewritten.

Before staging, the complete `{version, sql}` prefix for migrations1–19 was compared with the immutable base Git blob and matched byte-for-byte. Its aggregate JSON SHA256 is `5fa4a2b49a5859ae185785524d91802fcf6f84c8b3c60be9549649c9af0cb06c`. The SQLite upgrade/session regression independently executed the19→20 transition in disposable state.

After actual ID-bound identity observation, the existing private detail adapter supplies a URL only to the approved key set inside the encrypted **v9** environment proposal. The separate web decision, single-send update, merge and configuration readback remain authoritative. Before another source connection can obtain a proposal, the application validates the preceding created resource's binding; it checks again before execution. Web and MCP use the same registry/driver/Store. Advancing the current database review pointer does not rewrite earlier action IDs, receipts, limits or usage.

The publication binding check now requires an environment receipt for exactly that resource's approved key set, with private visibility and matching current values. A swapped link between two otherwise successful environment actions is rejected. The environment GET projection also handles the next resource: an older successful environment stage cannot hide the unbound second database's form.


<a id="managed-database-targets-frozen-source-and-configuration"></a>

### Frozen source and configuration

Base: `d101e0fa02dc785d05d5aeddf89775d57a8819b9`, main. Tests use Node **24.18.0**, npm **11.16.0**, the unchanged pinned root lockfile, a frozen production Webpack build and isolated loopback ports/state. The main server/port3000, original corpus projects and their data are untouched. No real model call, allowance renewal, provider write, SQL, push or rollout occurred.

Snapshots `database-targets-r2`, `r3` and final **r4** contain 666 files, with 22 explicitly owned code/test overlays. Their **identical runtime/package fingerprint** is `0ba6f5d1f08a8e4b2c91ccaa2dafe9b3e30bf667aaf730cf3ddbeae6de1c7a3f`. Runtime files and package bytes were compared individually before reusing r2's exact `.next` build in r3/r4. Only test-harness observation/logging changed after r2. This is explicit build reuse of identical application bytes, not a new build or an aggregate assembled from different runtime revisions. Documents added after freezing do not alter that fingerprint.

The source fixture uploaded by the final real browser has hash `fe0407e2e6a1060ab224a72c9a6c6ef25b6ce04d7bda040d9caa2f2c23520e38`. It declares two PostgreSQL consumers at the same root; no source script is run to discover them. Its package/driver/version and the transport's PostgreSQL16.4 offer are **synthetic fixture inputs**, not claims about the current provider catalog. No project-name branch is added to production code.


<a id="managed-database-targets-actual-webapplication-path-with-synthetic-external-transports"></a>

### Actual web/application path with synthetic external transports

`node scripts/test-database-targets-browser.mjs` on r4 passed actual Chromium folder upload, the guided mission form, the shared model adapter/tool registry, two authenticated database decisions, single-owner claim/journals, exact returned-ID observation, two private encrypted environment proposals/decisions, merge/readback, and same-run continuation. It does not intercept or fabricate a browser API response, approval, action, usage row or configuration receipt. The test-only network-denying hook supplies **synthetic model/provider transports**; no request reaches BoxAPI or Liara.

The final run was `4308e767-af41-4913-8f29-de5773af9be2`. It recorded five synthetic model requests, two distinct database actions and two environment actions, with four actual Store attempts. The provider fixture accepted two creates and two environment writes. The first connection URL remained identical during the second merge; the unrelated KEEP_KEY retained its original value in the full encrypted proposal and provider readback. The build-input projection deliberately excludes KEEP_KEY because the source does not consume it. No credential appeared in browser API requests/responses or page text.

Both database reviews were checked at **320/390/768/1280px**: eight layouts, no horizontal overflow or axe violations. Keyboard approval used the real API. Consumed database-decision replay returned **409**. Reload retained the original run, limits, usage, five model calls and provider operation count. Page errors, external browser requests and credential-leak observations were zero. The final result stayed **partially_completed**, with no publication; configuration is not data health. Actual environment-stage screenshots were inspected.

Final r4 checks measured separately:

| Check | Result and scope |
| --- | --- |
| Production build | r2 Webpack build passed; r4 reuses identical validated runtime/package bytes |
| `npm run typecheck` | passed on r4 |
| `npm run lint -- --max-diagnostics=150` | zero errors, 48 warnings, 22 infos; 540 files on r4 |
| `npm run test:domain` | 787/787, zero fail/skip; 297.542 seconds, after heavy browser/build work finished |
| New actual web/API lifecycle | passed as described above; model/provider transports synthetic |
| `node scripts/test-database-browser.mjs` | five responsive layouts, keyboard/reject/expiry/uncertain/reload and legacy v27 views passed; synthetic decision views, zero model/cloud calls |
| `node scripts/test-guided-browser.mjs` | 54 states at 320/360/390/768/1280px; synthetic model/provider |
| `npm run test:http` | 48/48, zero fail/skip; 29.240 seconds; isolated auth/CSRF/scope/replay/disabled-provider boundaries |

Targeted domain preflights passed14/14, covering source/private/cross-consumer key denial, duplicate reservation, changed idempotent intent, expired/rejected unused proposals, old v27 parsing, two-resource mission and merged encrypted binding, swapped resource-link rejection, v27/v28 uncertain/no-ID no-replay behavior and migration19→20/session preservation. The final787/787 full-domain result above is a fresh r4 execution, not a preflight relabelled as its full pass. Real PostgreSQL/runner results from the previous slice remain separately attributed and are not a fresh sandbox aggregate here.

Private manifests, logs and screenshots are under `<private-validation>`, matching command logs and each candidate's `.artifacts/database-targets`. No state database, credential, source archive or screenshot binary is committed.


<a id="managed-database-targets-retained-failures-and-open-boundary"></a>

### Retained failures and open boundary

An early mechanical version expansion mishandled two optional-chain guards; typecheck caught them and they were replaced with explicit non-null/type guards. Another preflight found a test deleting a required property; destructuring now constructs the old v27 fixture without weakening validation. The old synthetic Agent example omitted the newly required bindingKeys and obtained no proposal; it was updated with the source-declared key. An initial lint warning used DOM innerText; the new test uses textContent. These are not claimed as passing final runs.

The r2 browser reached its first successful binding but incorrectly looked for KEEP_KEY in the source-filtered build-input projection. The preserved-value oracle now reads the full encrypted input and checks the provider's actual accepted/read-back state; it was not removed. The r3 browser completed both resource/binding cycles but checked the final run before the asynchronous continuation settled. r4 waits for the real continuation HTTP200 and then the durable final state; failed requests still stop the test. Original source, approval, merge, data-health criteria and production timeouts are unchanged. Earlier browser failures are retained in their own logs and not merged into r4's success.

Graph project/coverage tools again returned `Transport closed`; exact source/import/caller/contract reads supplied the evidence. Graph absence was not used to infer a missing capability.

Live managed-resource creation, current-account private detail shape, actual connection/data effects, destination-side migration, database restart/persistence, resource reuse/replacement recovery, a complete multi-component/resource plan and release-bound fullstack artifact/data verification remain open. The current supported URL/URI names, consumer evidence and provider adapters remain bounded. The next product work must connect these explicit bindings and the existing original-runner test to controlled real execution and independent workload/data evidence, without turning a compatibility fixture or configuration receipt into a production claim.

<a id="managed-database"></a>

## Managed database and secure binding — 2026-10-28

This is an A14/AC34 partial product slice on base `e75fe394aae8e7684b67d61e62bdc5e8d21ae5b9`. It does not complete all fourteen platforms, database migrations, data-plane verification or full application deployment.


<a id="managed-database-product-path-and-host-guarantees"></a>

### Product path and host guarantees

The Agent reads the inspected component requirements and live catalog through `read_database_resources`, then can call `propose_database`. The publication page displays exact engine/version, app, private network and separate plan/bundle prices. Its server-owned decision resumes the same mission, creates once, persists `databaseID`, reads that exact ID and records identity-only proof. Expired, rejected, executing, uncertain and resumable states are represented. Missing response IDs cannot be recovered from a matching hostname.

After identity readback the Agent can request `configure_env`. The existing secure form offers “آماده‌کردن اتصال امن دیتابیس”. The server reads private provider details, validates the same identity and source consumer, creates the URL only from explicit fields and prepares an encrypted v9 proposal. The user separately approves that change; existing application keys are preserved. Readback creates the existing environment reference used by build/publication. Database creation cannot be ignored by publication while the selected environment lacks its verified binding. No database credential is a public tool result.

The application services are `databases.ts` and `database-environment.ts`; provider adapters remain separate from policy/Store/UI. ActionSpec v27, migration 19 and the normal action executor retain approval/claim/single-send ownership. The environment service was factored to allow private resource reads within its existing durable budget; no parallel vault, approval service or execution engine was introduced. [ADR 0032](../decisions/database.md#0032-managed-database-and-private-binding) records exact limits.


<a id="managed-database-provider-evidence-and-unknowns"></a>

### Provider evidence and unknowns

The saved `docs/sources/liara-dbaas.openapi.yaml` was fetched on 2026-10-28 from the official `liara-cloud/openapi`, file blob SHA `6fc68c15e34f709b109c8c9117d2d8e84ebc8041`. Its create response names `databaseID`; its detail schema documents `id`, `username`, `root_password`, `dbName`, `hostname`, `internalPort`, `version`, `publicNetwork` and private-network metadata. The official CLI create file, blob `d3c2277b3214c2b9f77ad863777c0c6ade4bb7c9`, additionally supplies bundle/network request fields. These file-blob IDs are not repository commit IDs. Neither documentary schema proves the actual response in this account.

A credential-scoped read of the actual configured account on 2026-10-28 at 11:26:37 UTC returned `{databases:[]}`. Only keys/types/counts were emitted; no credentials were logged. A fresh identity-bound account read at 11:43:11 UTC reported PostgreSQL versions including 18.4/17.10/16.14/15.18/14.23/13.23. `small-g2` plan was 659.72 toman/hour and its available `basic` bundle was 381.94 toman/hour, reported separately. These historical observations do not authorize a purchase, define combined billing semantics, verify capacity units or prove a connection. The synthetic test catalog uses 16.4/100/10 and must not be mistaken for that live catalog.

There was no live database create, credential detail retrieval, app env write, SQL, migration, resize, data persistence test, database cleanup, release or rollout in this slice. Those require exact resource decisions and actual effect receipts. The original application deployments and databases were not used as a laboratory.


<a id="managed-database-snapshot-and-local-validation"></a>

### Snapshot and local validation

Final candidate `database-r3`, Node 24.18.0, npm 11.16.0, Next 16.4.2, pinned installed dependencies. Runtime source/package SHA-256: `150d3b40a7c14cd543e6122d6890fde5ac45720b07d7408794931a488a1df9c4`. The separate same-drive export contains no real state, credentials, archive or budget ledger; its dependency junction points to the installed pinned tree. Results below are finalized from this candidate, not combined from older subsets.

Final checks on that r3 export:

- `npm run test:domain`: 761/761, zero failures/skips, 238,325.619 ms.
- `npm run typecheck`: passed. `npm run build -- --webpack`: passed.
- `npm run lint -- --max-diagnostics=150`: zero errors, 48 warnings, 20 informational diagnostics.
- `npm run test:http`: 48/48, zero failures/skips, 19,904.245 ms.
- `node scripts/test-database-browser.mjs`: actual Chromium at 320/360/390/768/1280, no horizontal overflow, axe violations or page errors in the recorded layouts. Decision, expiry, uncertainty and private binding controls were exercised; 360/1280 screenshots were inspected. Synthetic provider/action views, zero cloud writes and zero model requests.
- `node scripts/test-guided-browser.mjs`: 54 recorded states across the same five widths, synthetic model/provider, zero cloud writes.

The skill kit's separate `accuracy_report.mjs` was also attempted from the application directory. Its own relative sample/harness paths failed with `MODULE_NOT_FOUND`; this is no application score or acceptance gate pass. Application verification is the explicit domain/HTTP/Chromium evidence above. No new Docker workload was run because this slice introduces no container execution path. Full browser/sandbox aggregates, live provider writes and rollout are not inferred.

Nine focused database tests cover source semantics, identity/prices/private network, exact encrypted binding and preserved env, original cumulative budget, URL password redaction, approval/replay/session/cancellation, delay/lost response, missing ID, malformed/private details, stale source/price/network/account, exhausted budget and 401/429/5xx. The new HTTP boundary uses authenticated requests and exact negative contracts. Providers and model ports in those suites are synthetic; the real Store, source capture, encryption and action state transitions execute.

Browser baseline was captured from `maintenance-r6` before UI changes at 360/1280. The new browser harness exercises the actual cards and secure form with synthetic action/decision views, keyboard approval/rejection, expiry, uncertainty/readback and private binding proposal/rejection. It makes no actual cloud write; domain/HTTP tests supply the server policy evidence. The unrelated disk-baseline harness was initially run with an obsolete absent-card assertion and failed; it is not database acceptance evidence.

Initial implementation failures were retained: TypeScript legacy-union exclusions, Node strip-only constructor syntax, a synthetic project fixture missing existing required fields, the short model allowance below, and an HTTP expectation that omitted the early mutation gate. Fixes preserve the policy/oracles: the HTTP case now requires actual `403 MUTATIONS_DISABLED`, not a weaker success response. Candidate r1/r2 and working-tree subsets are not the final aggregate.


<a id="managed-database-real-active-model-synthetic-provider"></a>

### Real active model, synthetic provider

Both runs used the current installation's `gpt-6-luna`, reasoning `none`, output cap 1024 through `GoalModelClient` and the existing monetary ledger/allowance. No model, provider or credential was switched and no allowance/reserve was changed.

The first fresh disposable mission deliberately capped model requests at 4. It read source/destination/database resources but reached `BUDGET_EXHAUSTED` before proposing: 4 actual requests, 17,691 reported tokens, 0.017774 USD conservative ledger ceiling. It is a failed bounded experiment, not successful resource acceptance.

The second fresh mission used the current product limits, not a renewal of the first run. On the same runtime fingerprint it made 8 actual requests/37,894 reported tokens and 13 accounted tools, including source-file reads, inventory/capability/quote and `propose_database`. It reached the real server-produced `awaiting_approval` card; the harness then rejected it through the normal decision service. Its conservative ceiling was 0.038073 USD. Synthetic Liara transports served the account/resource data; real provider writes were zero. This verifies one real-model tool-selection path, not live provisioning or generalized quality.

The existing 2 USD allowance and 0.887866 USD prior reserves were unchanged. Remaining local aggregate ceiling after both experiments was 0.124621 USD. The amounts are host ceilings, not an invoice or a fresh account balance. The held hosted budget was not spent or renewed. Private sanitized receipts and source manifests remain installation-local under `<private-validation>`.


<a id="managed-database-next-executable-boundary"></a>

### Next executable boundary

Resolve live DBaaS detail shape and private endpoint semantics through an owner-approved disposable app/database, then verify binding and an actual application connection. Add approved, source-bound migration execution with a single owner and explicit uncertainty reconciliation; independently inspect schema/data effects, then verify a write/read across a relevant restart/release. Keep migration permission distinct from a resource create or env approval. Resource reuse, several components/resources and all runtime families remain product backlog, not acceptance granted by this case.

<a id="managed-fullstack-20261025"></a>

## Managed fullstack continuation — 2026-10-25

Working-tree implementation on `main`, base HEAD `6937dfc9a6be4f53a134b55175a53d22512dcf29`. The owner requested no commits, staging, push or visual changes. This report separates source inspection, controlled execution, synthetic provider behavior and public acceptance.


<a id="managed-fullstack-20261025-real-golestan-source-intake"></a>

### Real Golestan source intake

The original `<private-validation>` was inspected read-only at `f0d4f4499e7cf605bb2a2e33e530c4c6dcf237ed`; its Git status remained clean. Product capture retained 419 files / 12,185,491 bytes with source hash `be6f5839db84081ecc1fc2633f5f2722d858329b1e52c8a95f3387702eb6e58b`. No environment values or original database were published or reset.

The actual root `start` serves the frontend only. The fullstack descriptor derives `tsx --tsconfig tsconfig.ai.json server/index.ts`, port 8000, Vite output `build`, the root and `guides` locks, and compatible Node 22. The existing Dockerfile is backend-only. Neither is represented as proof of complete deployment. The source requirements identify an API, PostgreSQL and an external model requirement; analysis diagnostics are empty after excluding inert AST leaves and type metadata from the bounded executable traversal. Runtime TypeScript wrappers, enums, namespaces and JSX expressions retain executable calls.

A later import audit found that filename keyword exclusion had incorrectly dropped three real authentication components: `ForgotPassword.tsx`, `PasswordStrengthIndicator.tsx` and `ResetPassword.tsx`. Executable source names now retain ordinary credential-related vocabulary while credential data files stay excluded and all captured content still passes the secret guard. PascalCase JSX component bindings are distinguished from literal credential getters; nested and installed secret negatives remain unchanged. Fresh source-only capture is now 422 files / 12,201,417 bytes, hash `8efda30dc844d8d2239dfccea20a26607d4e448091f84ce6be2b2631f11ac998`, with all three components and zero analysis diagnostics. The original files and Git stayed unchanged. The earlier 419-file snapshot is historical evidence, not the final full source manifest.

The owner explicitly confirmed that credential-shaped values in these three tests are public synthetic fixtures. The product operator review binds these exact bytes, retains the tests and expires without automatic renewal:

| Test | SHA-256 |
| --- | --- |
| `server/ai/testing/unit/routeAuthCharacterization.test.ts` | `6be2121df875a70f5ab781fa16d6e235b3304c3b7de372096ea126f40093ca64` |
| `server/ai/testing/unit/routes/authRouter.test.ts` | `6f4334900b56c45f11f01077c921ea040320a8a1fd902916bfd08d2cbb49c25b` |
| `server/ai/testing/unit/transportPolicy.test.ts` | `c961b1d75f9aec9877984af7f0376f86cdc416ead76b5ae92327b70d056cbd5b` |

Review ID: `ab189182-09bc-4844-a20c-75e21418ea68`. All three hashes were rechecked against the original files after capture. The signed registry remains private.


<a id="managed-fullstack-20261025-implemented-verification-boundaries"></a>

### Implemented verification boundaries

- Docker build/runtime v6 and deploy/create v21/v22 share the existing policy, approval and journal services. A durable execution marker blocks uncertain daemon work across workers. The built image is an outcome, distinct from the immutable planned environment.
- Fullstack build v7 preserves root/nested locks and declared tests, excludes runtime secrets from frontend build, starts the actual API, verifies frontend assets plus independent JSON assertions, and exports exact output before cleanup. Final publication v23 checks proof, public JS/CSS hashes, API criteria and current release. The original repository remains unchanged.
- `test:ai:history-db` in Golestan emits `SKIP` and exits zero without `AI_HISTORY_TEST_DB_URL`; this is not a passed database test. The runner now rejects explicit skips, missing tests and nonzero skip counters, including TAP-commented and ANSI-colored output. No original test oracle was weakened.
- Source scanning respects bounded root/nested gitignore semantics. Public-fixture reviews never override known secrets; standalone code repair reads fresh actor-specific vault values instead of relying on a stale configuration snapshot.
- The shared Agent/MCP registry exposes read-only database inventory, identity and capabilities. It validates account/team identity, returns no passwords or connection strings, and reports pagination completeness, network/version readback and connectivity as unknown. Seventeen adapter tests plus registry integration passed against synthetic transport. No real database API or SQL was executed.


<a id="managed-fullstack-20261025-validation-and-failures"></a>

### Validation and failures

The initial full domain run after database-tool registration was 571 passed / 15 failed out of 586. Fourteen failures arose from the old 16-definition model input bound, including downstream missing-build proposals; the definition ceiling is now 20, with existing run request/tool/time allowances unchanged and a boundary test rejecting excess definitions before transport. One archive regression arose from applying an entry-path length limit to all source paths. The original long-path archive oracle was retained; source paths now retain the 512-character import limit while native entry paths remain bounded to 240.

The next complete domain run passed 586/586 with zero skips or cancellations. A subsequent concurrent run was 585/586: the unchanged project-library fixture exceeded its three-second setup deadline during competing build work. Its oracle and timeout were preserved. The final serial run passed 586/586, zero failed/skipped/cancelled, in 151.4 seconds. Earlier targeted passes do not erase either failed run above.

Final runtime candidate: source snapshot `59af5e79e717ca716532207e094a26fc6823fe74541e5c8e2c7b2462e971360f`, 530 files, isolated filesystem copy (no Git worktree). `npm run build` and TypeScript passed. `npm run test:http` passed 45/45. `node scripts/test-guided-browser.mjs` passed 54 states at widths 320, 360, 390, 768 and 1280, with synthetic model transport and zero cloud writes. Targeted lint over 18 changed files reported zero errors/warnings and two informational diagnostics. The earlier whole-repository lint had zero errors, 44 warnings and 14 infos; it is not described as warning-free.

The project-library browser suite additionally passed 14 states, zero model requests and one synthetic environment write in disposable local state. Stopped test controllers and their three owned images were removed by verified full IDs after receipts were retained. The production image/restart/health check remained unchanged. A read-only execution-host inventory found no cached PostgreSQL image; no pull, database process or SQL execution followed that inventory.

Four actual Linux/Docker cases passed on the existing execution VPS: pinned Docker build/runtime verification and owned cleanup; offline root/nested fullstack build with runtime-secret phase separation and output export; rejection of healthy HTML with unhealthy API; rejection of exit-zero skipped database tests before output export. The final run took 114.1 seconds; controller exit 0, no OOM. Production image, health, restart/OOM status and compose hash matched before/after. These were controlled fixtures, not Golestan or a native Liara release. The first Docker attempt exposed a missing `Labels` field in official image metadata; readback was corrected using optional map lookup. Earlier harness/path failures remain in private logs.


<a id="managed-fullstack-20261025-open-acceptance"></a>

### Open acceptance

Owner clarification: Golestan is an already deployed production application with thousands of users, supplied as a compatibility example for Launchlane. This work must not change that deployment, its credentials, database, migrations or data. Any subsequent execution uses a separate captured copy and synthetic/disposable data only. A production migration or replacement release is outside this test scope.

Golestan has not completed its actual compiler/test/database/publication path. Its existing startup migrations require a concrete reviewed data plan. Disposable test DB execution, durable AUTH/PROF binding, migration recovery, data persistence after restart and real UI → API → DB behavior remain unverified. No model feature was called, and no new cloud resource, model allowance or budget was created.

The v7 test phase currently receives public build inputs only; private runtime configuration is reserved for start/workload. Database-dependent tests therefore require a separate isolated private-test contract, not disclosure of database credentials to frontend build. Golestan's history test additionally refuses a non-loopback database. A real disposable test database and its migration/cleanup authority must be designed explicitly; pointing it at a production DB is not a workaround.

A read-only dependency preflight found 1,331 Linux-compatible locked tarballs: 1,309 already existed in the operator's content-addressed npm cache, totaling 114,584,441 bytes, and 22 were missing. No package was downloaded by that preflight and no project script ran. This is source-only intake without environment import. A separate attempt to treat every local environment value as a known secret rejected ordinary configuration matches in 221 files; it was not counted as a successful secure environment import. Existing private-value guards were not weakened to bypass it. Public/source selection and later secure configuration remain separate steps.

The final cache helper independently verified those 1,309 actual entries read-only against the new 422-file source's locks. Fourteen temporary-filesystem cache tests and two integration regressions cover SHA512/SHA256 identity, symlink/hardlink/race boundaries, immutable publication, stale locks, malformed/partial quota, bounded entries/bytes and cross-job reuse without another network reservation. `LAUNCHLANE_NPM_CONTENT_CACHE` is an explicit operator `_cacache` path; actual `.env` files were not modified to enable it. No real cache entry was written or deleted by the preflight. The job still verifies and writes its own tarball manifest; missing packages are not fabricated and cache capacity cannot renew model/tool allowances.


<a id="managed-fullstack-20261025-final-checkpoint-after-cache-and-authentication-source-fixes"></a>

### Final checkpoint after cache and authentication-source fixes

The new frozen candidate contains 536 files, snapshot digest `4dc78f3a3cfa42d05eb4f76050d221584ab941610647af98f1c4d2d8a56a36e5`. Its 303 runtime/source inputs have digest `fde37f4e1a05b950b8ecc461e825687e5417a7107884bd1910cdd4570b22ba88`; all candidate file hashes and current runtime-source hashes matched after testing. Build ID: `rBWy741Ndyp_UVe7boCUh`.

- `npm run build` and TypeScript passed on the final candidate.
- Final `npm run test:domain`: 604/604, zero failed/skipped/cancelled, 193.4 seconds. The earlier failures above remain recorded.
- Final HTTP suite: 45/45, zero failed/skipped/cancelled.
- Final project-library browser suite: 14 states, zero model requests, one synthetic environment write in disposable test state. The earlier guided browser checkpoint covered 54 states; the appearance was not redesigned.
- Final whole-repository lint: zero errors, 44 warnings and 14 informational diagnostics. Focused cache/source integration lint was clean.
- The four actual Docker worker cases retain their precise scope above; no actual Golestan compiler, database execution or public release is implied.

At 2026-10-25 17:08:44 UTC the existing public Launchlane health endpoint returned HTTP 200. That is an availability check for the unchanged public deployment, not acceptance of this new candidate. No Git commit/staging/push was performed; original Golestan HEAD/status remained unchanged. PostgreSQL package/image download, disposable database execution and a new public rollout were not performed.

The public Launchlane image remained `sha256:a547236ef28225af76ba331086a371922bcd77b157f87267e6e44494c38c3061`, build ID `6zRBRP24QoZ463cVmnGDS`; these working-tree changes have not been publicly rolled out. Persistent production mounts, configuration and ledgers were not reset. All fourteen official families remain in scope; source detection and controlled Docker fixtures do not complete their individual live acceptance rows.

<a id="postgres-data-observation"></a>

## PostgreSQL data observation tied to a publication

Date: 2026-10-29. Base: `62a844e6b58bf51e874b5ae15033d2007de91a15`. See [ADR0038](../decisions/database.md#0038-independent-postgres-data-observation).


<a id="postgres-data-observation-product-path"></a>

### Product path

Prepare a v4 artifact through the existing reviewed runner/build, approve each exact database resource and private v9 binding, and publish the artifact. The succeeded publication card offers **بررسی دیتابیس‌های این نسخه**. Its button performs a new bounded SQL read; reopening/reloading loads only stored observations. Agent/MCP `read_database_data {actionId,baselineId?}` uses the same application when the direct data-read capability is enabled. The model cannot supply SQL or connection settings.

The installation needs a controlled route to the selected provider private network, explicit `LAUNCHLANE_ENABLE_DATABASE_DATA_READS=true` and a matching server-owned `{accountId,teamId,networkId}` entry in `LAUNCHLANE_DATABASE_READ_NETWORKS`. Both default to denied in the current local installation. No provider public-network change or arbitrary-host fallback obtains access. Empty or foreign account/team/network routes fail before provider credential reads or SQL; private DNS alone is insufficient authority.


<a id="postgres-data-observation-semantics"></a>

### Semantics

The receipt verifies the PostgreSQL major/database/user session, schema/type/nullability, selected fixed-row predicates and selected cell presence/non-nullness. It binds actor/account/team/internal app, accepted publication/release, tested artifact/oracles, exact resource IDs and current private bindings. Provider identity, current release/network/env and private database details are rechecked; mismatch or incomplete reads cannot produce a receipt. Schema/data mismatch produces an explicit failed observation. Values and keyed comparison digests stay private.

Two successful reads compare only selected cell digests. Equality does not prove that migration ran, the application wrote data or provider state survived restart. Those fields stay false and the publication mission stays partial.


<a id="postgres-data-observation-validation-snapshot"></a>

### Validation snapshot

Final candidate `data-read-r8`, base `62a844e6b58bf51e874b5ae15033d2007de91a15`, 693 files/27 owned runtime/test/package paths, runtime/package SHA256 `8ae8da645abfcd27dd925a565d917af36bc3c3289db7f234f5e9157dc61af6dd`. Node24.18.0, npm11.16.0, Next16.4.2, pg/@types/pg8.23.1, TypeScript6.0.3 and Playwright1.62.1. Docker Linux29.0.1 uses the existing pinned PostgreSQL16 and Node22 images. Dependency versions and all27 source/package/test blobs match the immutable manifest. The following results all belong to r8; no earlier revision supplies a missing pass.

| Check | Result and configuration |
| --- | --- |
| `npm run typecheck` | Passed; isolated route generation and tsc, including repeated runtime check |
| `npm run lint` | 0errors,48warnings,22infos;560files; no rule disabled |
| `node node_modules/next/dist/bin/next build --webpack` | Passed without real provider/model keys; existing multiple-lockfile tracing warning retained |
| `npm run test:domain` | 820/820,305.222s; synthetic integrations, temporary SQLite; no real model/provider |
| `npm run test:http` | 49/49,24.304s; authenticated/Origin/CSRF/exact arguments and default-off SQL boundary |
| `node scripts/test-database-data-browser.mjs` | 10captures at280/320/390/768/1280; real Chromium/keyboard/cancel-focus/retry/failed/changed-release/disabled/reload controls, axe0/overflow0; synthetic receipts/data transport,0SQL/model/cloud calls |
| `node scripts/test-guided-browser.mjs` | 54states at320/360/390/768/1280; existing guided regression, synthetic transport |
| `node --test tests/sandbox/postgres-observer.test.ts` | 1/1,12.528s in final runtime run; actual default pg driver, ordinary role, mixed-case/SQLNULL/schema/fresh session/data change/size/custom-type/cleanup cases on the pinned local PostgreSQL |
| `node --test --test-concurrency=1 tests/sandbox/data-artifact.test.ts` | 2/2,128.109s in final runtime run; actual build/SQL/artifact, two private local destination databases and actual data read/comparison through the application/Agent tool, source/oracle integrity and output-leak rejection |

The first r8 runtime attempt passed the driver case but its positive artifact job cancelled after11.36s, before data observation; the negative output case passed. The cancellation's exact initiating transport is unconfirmed. After the cache audit/warm completed, the unchanged r8 runtime cases were rerun with all95 locked tarballs available and all3 passed. The cache path/configuration stayed the same, no timeout/budget/oracle was loosened and no production operation was retried. Failed jobs did not grant an artifact or data receipt. Root `.next`, the main server/port3000 and other agents' worktrees were not used or changed by these checks. Final screenshots were inspected at desktop/mobile, including the stored-error retry state.

Graph coverage recovered only generation2026-10-21: new paths were `not_tracked`, changed files `metadata_changed`, scripts/lockfile excluded. Exact source/import/caller/test reads supplied the evidence; graph absence was not treated as feature absence.

The UI driver uses a disposable account/state and synthetic receipts/transport, with zero SQL/model/provider execution. The standalone Docker case uses the actual default pg driver and an ordinary read role. The artifact case uses the actual v4 build/worker/immutable artifact and SQL against two new local disposable databases; provider/resource/env/release HTTP and model remain synthetic. Destination fixtures are initialized by test setup, not a production migration.

Before images use the unchanged previous `data-outcome-r5` built UI and the same new synthetic publication driver at320/1280: two captures, no SQL/model/cloud calls. Driver setup first failed on a missing disposable state directory and then an actor-less synthetic action fingerprint; both were corrected before captures.

Measured earlier failures remain separate: r1 failed with psql exit2 during destination-fixture setup before product data observation. The fixture had checked a Unix socket; a bootstrap-server shutdown race was the hypothesis. Readiness now requires the final TCP server, with repeated actual-driver/artifact success on later candidates. r3's full domain run was813/814 because the legacy SSR harness could not resolve a newly imported TSX component; the existing recursive test loader was extracted and all original render assertions retained. r4 passed819 domain,49 HTTP,10 data UI/54 guided, type/lint/build and3 actual Docker cases, but predates the explicit network allowlist. r5 passed820 domain and the positive artifact case; the output-leak negative stopped in1.4s with `BUILD_DEPENDENCY_UNAVAILABLE` before build/export. No weaker output oracle was accepted. A cache audit found84/95 exact fixture tarballs available;11 missing locked tarballs were added with `npm cache add --ignore-scripts`, then all95 were verified by the existing lock-integrity reader. The exact failed URL/status in r5 is unknown. r6 detected missing-network metadata but used the legacy adapter's `INVALID_INPUT`; the final application maps that provider shape failure to `DATABASE_DATA_RESOURCE_UNVERIFIED` and saves no new receipt. No successful/failed candidate is relabelled as a pass of the final snapshot.


<a id="postgres-data-observation-actual-provider-read-and-open-boundary"></a>

### Actual provider read and open boundary

The owner selected one exact team/application for read-only Inspector investigation; the private handoff retains that selection. A private process decrypted only that connection, revalidated `/v1/me` user/team identity and read `/v1/databases` in the same team. Both returned200; the observed inventory contained zero databases. No database detail/Inspector origin, actual SQL, control-panel activation, resource creation, app modification or release was performed. Empty inventory does not prove completeness or absence of a provider capability. Credentials were never printed or added to model context.

No new real BoxAPI consumption was authorized or performed; the earlier ledger was not reset/extended. Live PostgreSQL read acceptance, approved destination migration, application writes, restart persistence and rollout remain unconfirmed. Real writes require a concrete source/resource/cost-bound server approval; scope clarification is not that approval.


<a id="postgres-data-observation-postgresql-version-and-continuity-checks"></a>

### PostgreSQL version and continuity checks

New v4 resource proposals and their execution preflight check that the target keys match a tested purpose and that the provider's PostgreSQL major matches the pinned build image. A selected v4 build can supply that evidence when static discovery leaves a pool factory unresolved. The action, resource decision and subsequent private binding must refer to the same project, build and tested key group. Publication also rechecks every approved binding. Provider patch releases within the tested major remain eligible. Checking a historical publication still uses its own source, binding and actual server identity.

The existing data check can compare two observations of the same publication. Each target's private sample records the PostgreSQL start clock and statement clock from its read-only transaction. A later start must be strictly after the earlier sample. Unordered or overlapping windows are inconclusive. The public receipt exposes the comparison and check counts. Clocks, keyed digests and cell contents stay private. A failover can also present a later server start. This comparison cannot attribute the cause of a restart or establish durability for unobserved rows.

Selected cells use PostgreSQL's JSONB text representation before hashing, including in disposable runner and SQL replay checks. Adjacent integers above JavaScript's safe integer range can be distinguished. Historical observations remain readable. Their legacy digests cannot serve as a lossless baseline, so the operator takes a new sample before comparing.

The shared Agent registry now offers managed database tools for a selected v4 build with verified data targets, including when static source detection reports an unknown dependency. The application and Store use the same durable fullstack receipt checks. The existing create/attach approval and encrypted environment decision remain separate. The compiled artifact and output bytes are verified before a new resource proposal or execution.

<a id="postgres-migration-test"></a>

## Source-bound PostgreSQL migration and application data proof — 2026-10-28

This extends the managed database lifecycle toward actual SQL and application data effects. It is a real local PostgreSQL/Node execution path through the existing Agent proposal, web decision, CodeRepairJob and shared budgets. It does not grant production migration or complete-deployment acceptance.


<a id="postgres-migration-test-product-behavior"></a>

### Product behavior

`propose_project_build.compatibilityDatabase.migration` accepts ordered `sqlFiles`, `columns`, synthetic `rows` and `persistence` targets. The host hashes the captured files and creates a v2 disposable database plan inside the existing build7 job. Source-proven connection keys and required relations remain mandatory. No model-supplied URL, credential, image, role or receipt is accepted.

The existing publication review displays the selected SQL, expected schema/data and scope before approval. After approval, the source files execute transactionally as an ordinary PostgreSQL user. A separate host-owned psql reader verifies schema/seed/ledger, then the unchanged original application tests must write a fresh non-null value. A second new application worker reads the same database; independent fingerprints must show the exact written value retained. The receipt names source/plan/file hashes and counts, with `databaseRestartVerified:false` and `production:false`. No artifact is selected or offered for publication from this compatibility test.

Failed schema/data checks are not converted into healthy responses. Changed SQL selection/order is possible only after a measured migration execution/oracle failure, under a fresh review with unchanged behavioral criteria. The source, original oracle and earlier job are preserved. See [ADR0033](../decisions/database.md#0033-source-bound-disposable-migrations) for execution and isolation boundaries.


<a id="postgres-migration-test-exact-candidate-and-configuration"></a>

### Exact candidate and configuration

The final frozen candidate is `migration-r5`, based on `482a83d5111ae6c57b8b74085ff4064b89d8bfae`, with SHA256 of the ordered `src/` and root package-file hash manifest:

`f076ed1fdfbb54b8e39c2167264b35def40b5fbdc664986cf74b792bbd647b4f`

Windows, Node 24.18.0, pinned root dependencies; Next 16.4.2 production Webpack build, isolated free-port servers and temporary state. Port 3000 and the active application were not changed. Graph discovery/coverage was unavailable (`Transport closed`); exact source, imports, callers and tests were read directly.

- `npm run test:domain`: **774/774**, zero failures/skips, synthetic provider/model transports; real Store, source capture, parsers and policy execute.
- `npm run typecheck` and `npm run build -- --webpack`: passed.
- `npm run lint -- --max-diagnostics=150`: zero errors, 48 warnings and 22 informational diagnostics. Existing diagnostics were retained.
- `npm run test:http`: **48/48**, isolated production server, synthetic provider scope, zero real provider writes.
- `node scripts/test-migration-browser.mjs`: actual Chromium review/keyboard approve/reject/result/failure with synthetic job/decision views at 280/320/360/390/768/1280; no recorded overflow, axe violation or page error. Final 360/1280 screenshots inspected. The baseline was captured before UI changes from the prior built database candidate. This is UI evidence, not SQL/provider execution.
- `node scripts/test-guided-browser.mjs`: **54 states** across 320/360/390/768/1280, synthetic transport, zero cloud writes.
- `node --test tests/sandbox/postgres-migration.test.ts`: **2/2**, zero failures/skips, 73.688 seconds. The Agent approval/build/API case took 49.686 seconds; the partial-transaction/checksum cases took 23.177 seconds. Actual Docker Engine 29.0.1 Linux/amd64, fixed Node22 and PostgreSQL16 images, npm lockfile dependency fetch and real compiler/runtime/SQL execute. The model is synthetic and cloud writes are zero. The successful case records exactly one PostgreSQL and two distinct app worker IDs, keeps the original SQL/oracle bytes unchanged and creates no cloud action or artifact.

The application fixture uses pinned pg 8.16.3, Express 5.1.0, React 19.2.0 and Vite 6.4.5 with its committed npm v3 lockfile. Its source SQL creates a seed row; the original API oracle writes a random value once through HTTP and reads it back. A separate original test requires root TCP rejection from the actual app namespace. The host observer verifies actual schema/seed, a change from the pre-app baseline, and retention of the same value after the second worker. The second sandbox test independently confirms a later failing statement leaves no partial table/ledger entry and that an existing different checksum stops before any app starts.

Local private manifests, logs and screenshots are retained under `<private-validation>`. Earlier r1/r2/r3/r4 and working-tree subsets are separate experiments; their passes are not combined into this candidate's result.


<a id="postgres-migration-test-meaningful-regression-boundaries"></a>

### Meaningful regression boundaries

New domain cases cover strict v1/v2 parsing, captured hashes/order, SQL lexical boundaries and source immutability, transaction wrapper quoting, independent schema/seed/ledger readback, fresh write versus echo/unchanged seed, changed or missing data after application replacement, failed application output, budget exhaustion, forged production/success receipts, ordinary-role enforcement, source-backed shared tool proposals and SQL re-selection only after measured failure with an unchanged oracle.

Fixture regressions require exact OCI manifest evidence, immutable container identity, real bounded tmpfs mounts and no ambiguous canonical socket mounts. Migration mode must install/reload its HBA policy and observe actual root TCP denial before handing the namespace to a worker. Cleanup failure or uncertain ownership cannot yield success or blind replay. Existing approval, parent budget, cancellation and no-cloud-write boundaries remain in force.


<a id="postgres-migration-test-retained-failures-and-limits"></a>

### Retained failures and limits

Two actual-model experiments were run on the earlier **r4** runtime fingerprint `968533a69bb1d5cfe1ac8c647400af91b5577366d700002e4c807f9cf77a7b06`, using the current installation's `gpt-6-luna`, reasoning `none`, output cap 1024 and the existing monetary ledger. Neither produced a valid job, ran SQL or started a container. The cold-source run made 9 actual requests / 52,065 reported tokens, ended `partially_completed` and spent a 0.052682 USD conservative ceiling; its private summary did not retain the rejected tool arguments, so the precise cause of that first rejection is unconfirmed. The second experiment supplied host-read public fixture source as explicitly untrusted context, while the model still chose inspection/file reads. It made 4 actual requests / 24,470 reported tokens before a fifth accounted model attempt was blocked by the monetary guard. Its exact proposal put `note:null` in fixed row assertions while also selecting `note` as the changing persistence target. The server correctly rejected it with `MIGRATION_ORACLE_INVALID`; the next request did not reach BoxAPI and the run surfaced the generic transport failure. Its settled ceiling was 0.024750 USD. A separate preparation attempt exceeded the existing 2,000-character user-goal limit before any model request; it was corrected in the experiment harness, without changing the product's input limit.

That measured contradiction led to **r5**, which keeps the same oracle and rejection but returns `MIGRATION_PERSISTENCE_CONFLICT` with an actionable explanation: keep stable values in `rows`, leave the changing target in `persistence`, and retain the write/persistence requirement. The tool description explains the distinction. A regression replays the exact rejected null assertion through the actual Agent loop, reads the real server feedback, submits the corrected proposal with unchanged label/persistence requirements and reaches `needs_approval` with zero containers/cloud actions. Its model is synthetic. Real-model recovery on r5 is **not verified**.

The existing allowance remained 2 USD and earlier reserves remained 0.887866 USD; no grant, reserve or historical run budget was renewed. Remaining local aggregate ceiling is **0.047189 USD**, below the guard's minimum next-request reservation of **0.05 USD**. These are conservative host ceilings, not a BoxAPI invoice or current account balance. Further actual-model validation requires a separately authorized allowance; the held hosted reserve was not spent. Runtime/domain/HTTP/browser/Docker work continued independently.

The first actual Docker attempts stopped before application execution because the existing preflight assumed the old image config ID, then because kernel mountinfo used the pinned image's canonical `/run/postgresql` path. Both were investigated on the exact owned fixture, tightened with negative contract tests, and rerun; no image/mount check was removed. A later self-review found that an ordinary app role alone did not prevent choosing the root username under TCP trust. The HBA separation and actual root rejection requirement address that path before worker execution.

An initial domain test expected the older optional tool-property list and failed after the schema extension. Its expectation now includes `migration`; the migration behavior and original API oracle were not weakened. Type-check issues in test narrowing were fixed without unsafe assertions. Earlier successes before the HBA and selection changes are not the final acceptance result.

The first r5 orchestration started checks before the source export process completed. Five test files failed to import the not-yet-copied helper and only 445 tests were discovered; the early lint also saw 513 instead of 515 files. That partial run is discarded as acceptance evidence. Every one of the 635 exported files was then hash-verified against the completed manifest, and the complete build/type/domain/lint/HTTP/browser/Docker sequence was rerun. No import, test or source was changed to hide this orchestration error.

Only bounded plain SQL and the existing npm-locked Node fullstack build are covered. Framework migration engines, production database SQL, database restart, provider persistence, live deployment with a real resource binding, several components/resources, safe data rollback and the remaining runtime families still require implementation/evidence. A local fixture does not replace the real projects in the deployment corpus.

The next corpus boundary was checked against the unchanged real Golestan source at `f0d4f4499e7cf605bb2a2e33e530c4c6dcf237ed`, read-only. The product's lexical adapter accepted only 2 of its 12 migration files; the other 10 correctly returned `MIGRATION_SQL_UNSUPPORTED`. No SQL or project script was executed. Its original runner owns two database targets, apply/baseline semantics, checksums and transaction handling. Supporting this requires a reviewed adapter for the original runner and separate resource bindings, rather than silently stripping wrappers, changing its data semantics or adding project-name behavior. Factory feed was also read-only at `e50fb16328df8dd1fccee24643c89a88d1b22615`; its actual root declares pnpm 11.19.0, Node >=24 and multiple packages. Current npm/single-component acceptance does not discharge those requirements. Both source worktrees remained clean and their production resources were untouched.


<a id="postgres-migration-test-follow-up-actual-web-approval-to-actual-sql-worker"></a>

### Follow-up: actual web approval to actual SQL worker

Based on `20daa69847763cca9a83be907fe49f77de8427a4`, the runtime/package fingerprint is `c12b89e347e4927046acb73e1aefa285fdc7e719c4f935c0c85c8935325433a6`. The only runtime change selects the fullstack preparation tool mode for a detected fullstack profile even when `requiresPreparation` is absent/false. That source-shape flag had hidden `propose_project_build` in structured missions without a selected destination. The new domain regression requires a local review before any execution, no publication tool without a destination, no cloud authority/action and no artifact. Existing native non-fullstack destination ordering is unchanged.

`migration-web-r3` passed domain **775/775** (262.051 seconds), typecheck and the production Webpack build on Node 24.18.0. The final browser harness `migration-web-r4` has the identical runtime/package fingerprint and reuses that exact frozen `.next` build; only its test selectors/source-provenance assertions changed. The runtime, domain/helper inputs and package bytes match. This is explicit build reuse, not a new full aggregate across unrelated revisions.

`node scripts/test-migration-worker-browser.mjs` then passed with real Chromium at 390px: actual directory upload, the structured publication form, real authenticated HTTP registration and keyboard decision, existing parent budget/claim/job, pinned PostgreSQL16 and two Node22 workers, locked compiler/start/API/original tests, independent SQL data receipt and real UI rendering. The browser does not intercept an API response or fabricate a job, decision, patch, test result or receipt. Only the model transport is synthetic: two recorded responses propose the exact public fixture criteria and explain the actual host receipt. The transport hook is loaded solely by the disposable test server and is not imported by application code. No real model request or cloud write occurred.

The successful mission recorded exactly three distinct container IDs, three column checks, one fixed row and one fresh-write/persistence check across two application runs. The reviewed SQL hash was `6156aa31e0f9536a4d9f089cc651e1f64f7792cf1735a2c5cfd10f0d689a7a24`. The uploaded source hash `8a3fb8b83ffa4010c4609bc6e40a7ce3d92275079f01a55f96ea6c36d5098395` stays bound to the job's base revision; deterministic preparation's actual execution source `6171f4d51385f7d3fcfa62aa0a78e49dfc64e5f37627a90d7cb681ab8997c760` stays bound to the database receipt. Those are distinct identities. The original SQL and API oracle bytes remained unchanged. No publishable artifact or remote action was created, the result stayed `partially_completed`, and the receipt retains `production:false` / `databaseRestartVerified:false`.

Replaying the consumed HTTP decision returned exactly `409 AGENT_CONFLICT`. Reload retained the same usage, limits, model-call count and container IDs, with no new execution. The final screenshot was inspected; no page error or external browser request was recorded. The same final harness also passed guided **54 states** and HTTP **48/48** (19.747 seconds). Full lint passed with zero errors, 48 warnings and 22 informational diagnostics. The full browser/sandbox aggregates and production rollout were not run in this follow-up.

Retained failures: an initial fixture-build junction used the wrong relative directory and the server correctly reported no build. The next harness assumed the package name was the displayed uploaded-folder title and timed out before starting a mission; it now waits for the actual selected project ID and validates the captured fullstack/source evidence. The following run exposed the real `TOOL_DENIED` orchestration gap, now fixed with its domain regression. After that fix, the first UI harness assumed the validation-only button label, but this actual job includes deterministic preparation and correctly uses the existing preparation approval label. The final harness follows the server's actual job type and separately checks original base versus prepared execution provenance. No business oracle, SQL or original test was weakened. Earlier rejected runs remain outside the successful integration result.

The owner explicitly chose development and independent tests without additional model consumption. No allowance or reserve was renewed and the real-model recovery boundary remains unverified. The next implementation boundary is a reviewed original migration-runner adapter with separate resource bindings, followed by approved managed-data effects and the published application's behavior; this local pipeline does not complete those boundaries.

<a id="project-migration-runners"></a>

## Original migration runners and independent data targets — 2026-10-28

The product's existing structured publication mission can propose an existing source migration script against separately bound temporary databases. The same web card, authenticated decision API, parent budget and CodeRepairJob execute it. This closes the plain-SQL adapter's inability to preserve a project's transaction/ledger/procedural-SQL semantics; it does not close production migration or complete deployment acceptance. See [ADR0034](../decisions/database.md#0034-project-migration-runners-and-data-targets).


<a id="project-migration-runners-product-behavior-and-scope"></a>

### Product behavior and scope

`propose_project_build` accepts `compatibilityDatabase: { runnerScript, targets }`. The host reads the captured root package script and actual pre/post hooks, derives their hash and validates the declared connection names against the source. Each target binds its ID, private URL environment key names, required public relations and independent `columns/rows/persistence` criteria. The host derives the aggregate summaries, fixed image, logical database and ordinary role names. URLs are temporary fixture inputs, not real resource credentials. No project-name selection, SQL rewriting, driver installation or missing CLI is introduced.

One owned PostgreSQL fixture contains one to four logical target databases. The measured cases use two. Source execution receives the declared application URLs only. HBA and CONNECT permissions separate each database role; neither root nor the observer can connect over the workers' shared TCP namespace. Actual root rejection is required before any worker starts. The observer uses the PostgreSQL container's unshared Unix socket, a non-superuser read-all-data/BYPASSRLS role, read-only transactions, deadlines and a fixed `pg_catalog` search path. The host's source-SQL apply interface is denied in v3. Schema/type checks precede reading individually selected built-in scalar columns; custom/composite serialization is rejected.

Two fresh runner workers execute the exact existing script and hooks. Two other fresh workers execute the original locked build/start/API/tests. The runner owns its transaction and ledger. The host independently reads schema/fixed data after the first runner, requires a fresh non-null application write in every target, reads again immediately after runner replay, and requires the identical values after the second application. It neither infers per-file skipping from exit zero nor assumes distributed rollback across targets. Selected-oracle replay, not an audit of every table, is the recorded claim.

Schema-only migrations may use `rows: []`; a persistence key may initially be absent. After the first app run that key must identify one real row and a fresh non-null value. Quoted mixed-case table/column names are retained through validated identifier quoting. The new schema-only fixture creates its row through the actual API. A deliberately broken, exit-zero runner that resets stored values fails before the second application can hide that loss. The existing v2 plain-SQL path also gains this immediate post-replay read without changing historical plan canonicalization.

The Farsi review displays the original command/hooks, target/key names and criteria under the existing disclosures. The receipt lists independently measured counts for each target and explicitly keeps `production:false` and `databaseRestartVerified:false`. A successful compatibility job has no publishable artifact, publication action or implicit production-SQL approval. The result remains `partially_completed`; the Agent receives bounded host evidence to continue the original goal.


<a id="project-migration-runners-source-binding-and-isolated-validation"></a>

### Source binding and isolated validation

Runtime: Node **24.18.0**, npm **11.16.0**, pinned root `package-lock.json`, Docker Linux engine **29.0.1**. Worker and PostgreSQL images retain their existing pinned digests. Temporary state, owned containers and free isolated HTTP ports are used; the main server/port3000 and production data are untouched. Only the test model transport is synthetic. Worker PostgreSQL, locked install/build, HTTP API, original source tests and independent SQL reads are actual executions. Real-model requests, allowance renewal, cloud writes, push and rollout are **zero** for this slice, following the owner's explicit no-new-model-spending decision.

The first completed owned snapshot is `runner-r4`, based on `095229c16280a568995cd9bc92aa7421435b1e1d`. Its manifest contains 655 files, including 35 explicitly owned code/test paths. Runtime/package fingerprint: `b5edb20277a206599864f136b6093b404b015b85ba1294484a344d9656c502d6`. Unowned working edits were replaced only in the private export by their base Git blobs; their checkout files were preserved. LF normalization follows the repository attributes. The concurrent UI work later became `8e7c1405c626e91e96ed683d62ab4250cc356aac`.

Measured on **runner-r4**, independently of earlier migration/reference slices:

| Check | Result | Boundary |
| --- | --- | --- |
| `npm run build -- --webpack` | passed | local production build |
| `npm run typecheck` | passed | actual Next type generation and TypeScript |
| `npm run lint -- --max-diagnostics=150` | zero errors, 48 warnings, 22 infos; 531 files | existing diagnostics retained |
| `npm run test:domain` | **783/783**, zero fail/skip; 270.603 seconds | synthetic model/provider transports |
| `npm run test:http` | **48/48**, zero fail/skip; 23.492 seconds | isolated authenticated API, synthetic provider |
| `node --test --test-concurrency=1 tests/sandbox/postgres-migration.test.ts tests/sandbox/postgres-runner.test.ts` | **6/6**, zero fail/skip; 286.344 seconds | actual PostgreSQL/Node/API/original tests, synthetic model |
| `LAUNCHLANE_TEST_RUNNER_BROWSER=true` then `node scripts/test-migration-worker-browser.mjs` | passed; actual upload/mission/HTTP decision/5 containers/receipt/replay409/reload | model transport synthetic; no API response interception |
| default `node scripts/test-migration-worker-browser.mjs` | passed; actual legacy v2 web/SQL/3 containers/receipt/replay409/reload | old SQL route preserved |

The six actual sandbox cases cover the previous SQL application's fresh-write persistence, transactional rollback/checksum rejection, seeded two-target runner, schema-only mixed-case two-target runner, exit-zero replay data loss, and the actual non-superuser/read-only observer plus denied write/unknown-target/host-apply paths. The seeded fixtures keep their original source runner, SQL and API oracle bytes; the failure fixture is a separate disposable copy with its independent oracle unchanged. Four containers, rather than five, are recorded for destructive replay because the second application never starts.

The r4 runner browser recorded two synthetic model responses, one actual authenticated HTTP decision, five distinct container IDs, two runner runs and two app runs. Each target measured five columns, two fixed rows and one persistence criterion. Actual review and receipt were checked at **280/320/390/768/1280px**: ten layouts, no horizontal overflow or axe violations. No page errors or external browser requests occurred. Reload preserved usage, limits and container IDs and did not replay model/worker calls. Desktop/mobile full-page screenshots were inspected.

The uploaded original source hash was `cad4307adc9ab9fb644cb6efa3bcb450fe40fb31b11728b9f627eb318c8d5f00`; deterministic preparation's execution source hash was `6249fea6904a02645af24dd4fc2dd29d03603d6fcaaaa4df3966deddd2f882d9`. The receipt binds the execution source, plan `477231edccb7f13c9aa4c42028b1a0e77fbe3bc1c9ab0eb35f2f866da2b5b4d8` and source runner `656c862e0a8f650b25257b2a8b03aaeeb1bba929fba4315230eb740aec6b3679`. The job still binds its original base source. These are different identities with different purposes.

Integration snapshot **runner-r5** is based on the concurrent committed UI revision `8e7c1405c626e91e96ed683d62ab4250cc356aac`, with 659 exported files and the same 35 owned code/test overlays. Its runtime/package fingerprint is `123eccb3d2928e9461e3bc5a2d78e3b82815a36cbe9d17cd7a092db35f4f6311`. The owned runtime/test inputs match r4 byte-for-byte. This snapshot independently passed build, typecheck, lint (zero errors/48 warnings/22 infos; 534 files), domain **783/783** (278.853 seconds), HTTP **48/48** (19.964 seconds), guided **54 states** and the real five-container runner browser with the same ten responsive/axe layouts, replay409 and no reload replay. r4's six-case sandbox measurement is not relabelled as an r5 full sandbox aggregate.

Final self-review then tightened the target contract: every required relation needs at least one column in the independent schema oracle. Otherwise a source-owned readiness check could claim an additional table exists without a host observation. A regression rejects `public.unobserved` before execution. **runner-r6**, on the same base and 659 files, freezes that one runtime check and its negative test with runtime/package fingerprint `b65546ca8f7199efb588e109799beacb43daf52b46aac8f7da60ef8a34df2b5c`. Only `src/contracts/postgres-runner-test.ts` and its domain regression differ from the r5 code/test set; worker, original fixture inputs and UI bytes stay identical. The completed final checks below are measured afresh on r6, not assembled from r4/r5 subsets.

| Final r6 check | Result |
| --- | --- |
| Webpack production build / typecheck | both passed |
| Full lint | zero errors, 48 warnings, 22 infos; 534 files |
| Complete domain rerun without concurrent heavy work | 783/783, zero fail/skip; 344.715 seconds; same source/assertions/timeouts as the retained failed run |
| Guided browser | 54 states at 320/360/390/768/1280px |
| HTTP boundary | 48/48, zero fail/skip; 28.454 seconds |
| Actual runner web/worker | passed: one real HTTP decision, five distinct containers, two target receipts, replay409, reload without new calls/containers/usage; ten review/receipt layouts, zero overflow/axe/page errors/external browser requests |

The r6 browser measured the same original/prepared source, runner and plan hashes listed for r4; its run was `88258873-bc85-4d74-82a1-97b7edca22b8`. Its actual final structured mission completed only the local compatibility boundary and retained `partially_completed` / no publishable artifact / no cloud action. The six-case sandbox aggregate and legacy v2 browser were measured on r4; they are retained with their own snapshot attribution, not presented as a fresh r6 full sandbox run.

Private reproducibility receipts are under `<private-validation>`, corresponding `runner-r*-*` command logs, and each frozen candidate's `.artifacts/runner-worker` / `.artifacts/migration-worker`. Credentials, private state, source archives and screenshot binaries are excluded from Git. Documentation appended after the runtime freeze does not change its measured runtime/package identity.


<a id="project-migration-runners-retained-failures-and-review-limits"></a>

### Retained failures and review limits

An early full lint found missing `lang` on the new public fixture HTML; it was corrected to `en` and the final snapshots were rerun. An early targeted contract expected the old optional tool properties; the expectation now includes runner fields, with behavioral/negative tests still enforcing exclusivity and source binding. Earlier r1/r2 results precede schema-only/quoted-name/immediate-replay changes and are not final acceptance. A broad r3 export captured another worker's uncommitted artwork; it was discarded for acceptance and never used to overwrite their checkout. The final exports use explicit ownership plus immutable base blobs. No test, failure input or timeout was weakened to hide an application failure.

The first r6 domain run, concurrent with the isolated build/browser/worker sequence, finished **782/783**, one failure, in 340.014 seconds. The existing `fullstack.test.ts:194` expected a negative publication case to be `failed`, but received `observing`; its assertion did not include the underlying observation code. That run is retained as a failure, not a full pass. The unchanged fullstack file then passed **5/5** alone (4.359 seconds). The complete domain rerun with no concurrent build/browser/Docker workload passed **783/783** in 344.715 seconds, with the same source, assertions and timeouts. Resource contention is only a hypothesis: the original inconclusive code was not captured, so neither its exact cause nor a contention fix is claimed. The parser's VM deadline, production observation policy, workload criteria and test timeouts were not relaxed. `runner-r6-domain.txt`, `runner-r6-fullstack-recheck.txt` and `runner-r6-domain-serial.txt` preserve all three results separately; the final pass does not erase the initial failure.

Graph project/coverage tools returned `Transport closed`; graph absence was not used as capability evidence. Exact source, imports, callers, contracts and tests were followed instead. The optional UI kit's own sample self-test could not resolve its relative sample paths from this application and produced no valid app score. Actual app browser/axe/overflow assertions and inspected screenshots supply the UI evidence; no kit percentage is claimed.

This is a reusable **local data-preparation boundary**, not complete publication. It currently needs the supported Node fullstack/root pg/npm-v3-lock path and an existing source script. It does not manufacture Golestan's missing root migration CLI, validate Factory feed's pnpm workspace, run Python/framework-native commands, create separate provider services, execute managed-database SQL, restart the database, prove provider persistence or make rollback data-safe. The original corpus projects and their production resources remain untouched. The next product boundary is connecting source-backed data/component/resource plans to approved real bindings, controlled destination migration, publishable tested artifacts and independent data/workload readback of the exact release. The full fourteen-family mission remains open.

<a id="schema-baseline-intake"></a>

## Schema baseline intake and disposable bootstrap

Date: 2026-11-04. Related decision: [ADR0039](../decisions/database.md#0039-schema-baseline-intake).

The guided publication project view now has an optional initial database structure
panel. A user selects a local plain SQL dump, previews existing table names, selects
only needed tables and saves their schema for the exact project source revision.
The import itself neither starts a model nor contacts a database. Reload reads the
same saved summaries. Cancellation/retry use an abort signal and a stable request key.

The shared Agent/web/MCP registry exposes these summaries and bounded untrusted DDL
reads. A reviewed runner target references the exact source/imported baseline and
limited disposable roles/schemas. The approved CodeRepairJob prepares prerequisites,
executes the original runner and preserves independent schema, fresh application
write, replay and second-worker readback checks. Imported bytes and actor/project/source
scope are rechecked at execution. Source scripts and oracles are not replaced by the
baseline adapter. Migration23 is append-only.


<a id="schema-baseline-intake-completed-candidate-evidence"></a>

### Completed candidate evidence

`baseline-r4` is frozen on `f8fcc994fe4c4454b1d1cad18256f7e622bc2b5e`.
The SHA256 of the ordered source/root package configuration hash manifest is
`d84bde9aca84d52a5fa02cc36f0971c0bb4467c04d34996ebf00b582950d0bc3`.
Node24.18.0 and the committed npm lock were used, with a same-volume dependency
snapshot and Webpack. Domain831/831, HTTP50/50, lint (zero errors,48warnings/22infos),
typecheck and production build passed. The actual PostgreSQL bootstrap sandbox
passed, including ordinary NOLOGIN roles, scoped schema creation, separate target
ownership and a rejected write by the observer.

The actual Chromium upload/preview/import/reload/build-decision/worker flow passed.
Fifteen layout states at280/320/390/768/1280px had no overflow or axe violations.
Invalid UTF-8, preview cancellation/loading, wrong CSRF and malformed/unknown multipart
fields were rejected. Store readback contained no test COPY row marker. The same
mission used three synthetic model responses and one approved build, ran five real
local containers, rejected decision replay with409 and did not replay on reload.
No page errors, external browser requests, real model calls or provider writes occurred.

Later source changes (selected-index preservation, refusal of unsupported dependent
DDL, checkbox layout and interrupted-browser receipt preservation) are frozen as r6.
Its typecheck, lint (zero errors,48warnings/22infos) and domain832/832 passed. Build,
HTTP, actual PG/browser and final corpus rerun still require the shared heavy slot.
The pipeline was stopped after completed domain checks for owner coordination. This is not a combined
full pass for those changes. The lock owner is never stopped by the test scripts.

The subsequent SQL-variant regression reproduced an omitted `CREATE INDEX IF NOT EXISTS`.
That index is now preserved. Unsupported OR REPLACE trigger/rule dependencies are
rejected explicitly, including a rule's ON INSERT TO relation. Focused8/8 tests passed;
no additional heavy check was run while the owner used the other server. Integration
r7 is frozen on72bebaf, excluding concurrent destination/GitHub WIP. Its source/root
package manifest SHA256 is `8f25ff9203692000f844f0431413f8a26124a7bcf0ac26cc9414dc0685e4a1ea`.
Node24.18.0, pinned dependencies and Webpack passed typecheck, lint (zero errors,
48warnings/22infos), domain835/835, build, HTTP50/50 and guided browser57states.
These checks do not establish fresh runner execution on r7.

The subsequent r8 candidate on9c38849 has source/root package manifest SHA256
`a8c04d9e85e1e558a2c9952e4f0a97afb8fc6dec9b8787523c80b77a74304143`.
A reproduced case placed a newly known private value in saved DDL. The existing
credential detector and encrypted actor project values now fence selected imports,
summaries, bounded reads, build proposals and worker execution. Secret values only
inside skipped COPY rows remain excluded rather than imported. Focused domain10/10
passed on this candidate. R8 full gates and the added actual HTTP/UI privacy cases
remain pending on the coordinated integration snapshot; r7 results are not counted
as a full r8 pass.


<a id="schema-baseline-intake-golestan-original-runner-through-the-product"></a>

### Golestan original runner through the product

The corpus source is `f0d4f4499e7cf605bb2a2e33e530c4c6dcf237ed`. The source-derived
runner case preserves all twelve SQL files and the bytes of `migrationRunner.ts`
(SHA256 `ec5edf0325f708988ed2784145b08d4994d74ac8a9732858f5670d0a461908f3`).
The imported `public.users` DDL has SHA256
`3bdee7e368b8cd9aa4ad6b78b2183b33183a0bc8e4f6b0322d504a40eb977682`.
No historical rows were restored. The application fixture source hash is
`45efdf9ea4095bd1c7f38ee4c2d5af2dca9749372c3a847ce17555cfe7e1c7cc`.

On the completed r4 product path, shared Agent proposal, actual existing approval,
CodeRepairJob, original runner and independent observations passed. AUTH and PROF
have separate bindings. The observer checked the checksum/status of seven AUTH and
six PROF ledger entries, five schema columns per target and a fresh API-harness write
per target. Runner replay and two fresh application workers retained the same values.
A compiled artifact was selected; no publication was proposed or executed. Receipt
flags remain `production:false` and `databaseRestartVerified:false`.

The API harness is synthetic and uses original-schema rows. This is original runner /
SQL acceptance through the product, not acceptance of the entire original Golestan
HTTP application. The raw backup and original source/deployed database were not modified.
No real model requests, provider writes or deployed-database connections occurred.
Private receipts and reproducer inputs remain outside Git; no corpus code or data
is copied into the public repository.


<a id="schema-baseline-intake-measured-failures-and-fixes"></a>

### Measured failures and fixes

An initial dependency read was unavailable and stopped before container creation;
the explicit integrity-checked operator npm content cache completed the later run.
The original runner first failed on database-level schema creation permission.
Declaring `private` alone was insufficient: PostgreSQL also checks database CREATE
for IF NOT EXISTS. The reviewed disposable schema contract now grants that privilege
only to the exact ordinary role/database, with no CREATEDB or cross-target access.
The corrected run preserved all original SQL and oracles.

An earlier Docker-off attempt failed closed before create. A startup-adjacent cleanup
readback was unconfirmed; an empty fixture inventory was reconciled before a new test.
A later Chromium target crash failed the test during a working job. Two exact test
containers were matched by job/source/image, creation window, isolated namespace and
read-only disposable host paths, removed and their absence confirmed. The harness
now retains identifiers and cancels/waits for its live job before teardown; uncertain
cleanup retains disposable state. No failed or cancelled attempt is counted as a pass.

Fresh r7 PostgreSQL execution failed at Docker container start, before fixture SQL.
The desktop proxy first timed out on a read. The direct local Linux engine answered
version/info/image reads, created the exact owned pinned fixture, but start remained
pending until the unchanged100-second test deadline. A diagnostic trace measured
image714ms, create1335ms, start approximately97335ms and confirmed cleanup/absence.
The engine inventory retained eleven running containers belonging to other work;
no Docker restart, prune or unrelated stop was attempted. This is a measured local
runtime blocker, not a PostgreSQL or application success. The r4 SQL/worker evidence
above remains historical and separate. Final combined build/HTTP/browser gates are
coordinated with the runtime-components integration to avoid concurrent heavy runs.


<a id="schema-baseline-intake-operational-limits"></a>

### Operational limits

Only bounded plain UTF-8 dumps and limited public/unquoted table DDL are accepted.
Literal defaults and sequence dependencies are rejected explicitly in this first adapter.
Original dump rows, COPY and function bodies are excluded from stored schema. No
production SQL, deployed database access, provider write or real model spending is
part of these tests. This is a prerequisite for destination migration, not completion
of that acceptance boundary.

<a id="sqlite-binding-20261026"></a>

## SQLite binding and migration ownership — 2026-10-26

The fixed Worker runtime implements the observed `prepare/bind/first/all/run/batch` surface using Node 24's actual SQLite engine. It preserves repeated numbered parameters, anonymous parameter ordering and independent bound statements without rewriting quoted literals or comments. Unsupported binding values, named parameters, malformed input and additional statements fail explicitly.

Five domain tests execute the program against real temporary SQLite databases. They check returned query values, a batch rollback after a later SQL error, rejection of another database's statement, checksum-bound migration history, distinct filenames sharing the same numeric prefix, preservation of edited stored data, atomic migration failure and refusal to adopt an unowned populated database. The tests passed without a provider or model.

The same program was used in the actual isolated Qadam build and its independent two-process persistence experiment. Those broader preparation/publication/Agent paths are separate working-tree capabilities and their own evidence is required. This commit alone does not connect or accept an entire deployment path.

The adapter deliberately omits remote D1 access, sessions, replication, bookmarks and `exec`. It does not copy or reset an original application's database. A successful compatibility example is a product capability test, not a substitute for native mission execution, approved resources and actual public workload verification.


<a id="disposable-application-inputs"></a>
## Disposable application signing inputs

Date: 2026-11-04. Decision: [ADR0051](../decisions/database.md#0051-disposable-application-signing-inputs).

The shared `propose_project_build` tool accepts `compatibilityDatabase.testSigningKeys`
only for original-runner v3/v4. Names must be signing/session inputs read by that
source. The existing decision shows the names and temporary scope. Approval still
binds the source, runner, independent oracles and complete build plan. Generated
32-byte values remain stable across the two fresh application workers of one fixture, are sent
through stdin and are filtered from receipts and compiled output.

### Candidate and checks

Candidate `disposable-app-r3` is based on `1af6a15`, with Node24.18.0 and the exact
committed dependency lock. It includes the typed-port inspector, signing contract,
shared proposal/job/worker wiring and their regressions. The private validation
manifest records all changed source/test/script hashes. Its SHA256 is
`799776ddccd340d2dd182ae21f23b303907eb2d949717c09c976c565c06189b1`.
It contains no application credentials or source dumps. All checks below belong to
this same r3 source snapshot. Later documentation integration adds no runtime or
dependency change; its documentation checks are reported separately.

| Check | Result and scope |
| --- | --- |
| Typecheck / lint / Webpack build | Passed; zero lint errors,52 existing warnings/47 infos |
| Full domain | 899/899, no failures/skips/cancellations; synthetic provider/model transports |
| HTTP | 50/50, including actual HTTPS/MCP browser access; provider/model synthetic |
| Signing review and rejection | 15 actual Chromium layouts at280/320/390/768/1280, axe/overflow0, keyboard reject/replay409/reload; two synthetic model requests, no SQL/worker |
| Guided publication regression | 57 actual Chromium states; synthetic integrations |
| PostgreSQL/signing sandbox | 3/3 actual Docker cases: ordinary roles/schema/observer denial; signed application data across four fresh workers; known signing bytes in compiled output rejected with `BUILD_OUTPUT_SENSITIVE` |
| Web to signing worker | Actual upload, imported schema, decision/approval, five containers, original SQL/API/data checks, two fresh applications, replay409 and reload;15 layouts, three synthetic model requests, browser errors/external requests0 |
| Original Golestan runner regression | Actual unchanged runner/twelve SQL files through the shared proposal/approval/worker; separate AUTH/PROF targets,7+6 ledger-row checks, fresh API-harness writes/replay/two applications and selected compiled artifact |

No real model request, provider write, deployment or production migration occurred.
Database restart is not established by these cases. The Golestan regression's API
is an explicit fixture using original schemas, not the complete original HTTP app.

Focused checks passed: typed/string-converted ports retain their lexical scope;
source-backed fullstack preparation needs no manual port; unsupported/mutated and
shadowed expressions remain unknown; signing names need actual source reads; old
canonical plans remain unchanged; missing/foreign/duplicate inputs are rejected;
fresh fixture values differ; two application transports receive the same values while both runner transports receive none
through stdin and redact them from output. These are domain/synthetic checks.

The public browser reproducer supports `LAUNCHLANE_TEST_SIGNING_BROWSER=true` with
`LAUNCHLANE_TEST_REJECT_BUILD=true` for actual upload/schema intake/decision review,
keyboard rejection, replay409 and reload in five widths. This mode executes no worker
or SQL. Without the reject flag, the original positive worker/oracle path is retained.
Actual signing continuity and secret-output rejection have separate cases in
`tests/sandbox/disposable-signing.test.ts`; the table separates those Docker results
from the review-only browser case.

### Golestan and remaining boundaries

The original backend entry at corpus revision `f0d4f4499e7cf605bb2a2e33e530c4c6dcf237ed`
has SHA256 `1de9ba07b04c93f007c42d25267032c3666b35d0412acc0caaa3494aacc06d7e`.
The static inspector now resolves its typed `Number(process.env.PORT || '80')`
listener to candidate80 without execution. A source-derived backend subset reaches
fullstack preparation; that subset is not the complete original application.

Initial complete-project intake stopped at `SENSITIVE_SOURCE` in three original
test files. After the owner explicitly confirmed those public synthetic fixtures,
an exact-hash, seven-day review in a disposable installation admitted them. Known
private values remain blocked. No original test was removed or changed.
All422 admitted files (12,201,417bytes) were copied without reading real environment
files; original/copy source hashes both equal
`8efda30dc844d8d2239dfccea20a26607d4e448091f84ce6be2b2631f11ac998`.
The complete project selects8000 from its own configuration, preserves the root and
guides packages, selects output`build` and retains all three original test scripts.

Full original-app execution remains open: the source calls an exported migration
function during startup but declares no standalone npm migration script. A typed,
source-bound invocation adapter is the next missing contract. The existing scripted
runner regression above does not close that boundary. No important deployed database,
real project configuration, provider write or model allowance was used.

### Retained failures and recovery

R1's full domain run was898/899 because its old exact tool-field expectation omitted
`testSigningKeys`. The expectation now includes the declared field, while arbitrary
values and use outside original-runner mode remain rejected. R2's actual signing
cases failed before API startup: an existing unchanged preflight forbids signing
inputs in migration workers. The product now sends these inputs only to application
workers; the original preflight, API tests and SQL remain unchanged. R3 passed all
recorded gates. No assertion or timeout was relaxed to hide either failure.

The local Docker engine initially timed out even on `/version`. The owner's explicit
restart permission covered the shared runtime interruption. A normal official restart
timed out; official forced stop/start recovered Linux engine access. Owned containers
were cleaned and absence confirmed; no prune or individual unrelated-container
operation was performed. Failed probes are not counted as runtime passes.
