# PostgreSQL data observation tied to a publication

Date: 2026-10-29. Base: `62a844e6b58bf51e874b5ae15033d2007de91a15`. See [ADR0038](../decisions/0038-independent-postgres-data-observation.md).

## Product path

Prepare a v4 artifact through the existing reviewed runner/build, approve each exact database resource and private v9 binding, and publish the artifact. The succeeded publication card offers **بررسی دیتابیس‌های این نسخه**. Its button performs a new bounded SQL read; reopening/reloading loads only stored observations. Agent/MCP `read_database_data {actionId,baselineId?}` uses the same application when the direct data-read capability is enabled. The model cannot supply SQL or connection settings.

The installation needs a controlled route to the selected provider private network, explicit `LAUNCHLANE_ENABLE_DATABASE_DATA_READS=true` and a matching server-owned `{accountId,teamId,networkId}` entry in `LAUNCHLANE_DATABASE_READ_NETWORKS`. Both default to denied in the current local installation. No provider public-network change or arbitrary-host fallback obtains access. Empty or foreign account/team/network routes fail before provider credential reads or SQL; private DNS alone is insufficient authority.

## Semantics

The receipt verifies the PostgreSQL major/database/user session, schema/type/nullability, selected fixed-row predicates and selected cell presence/non-nullness. It binds actor/account/team/internal app, accepted publication/release, tested artifact/oracles, exact resource IDs and current private bindings. Provider identity, current release/network/env and private database details are rechecked; mismatch or incomplete reads cannot produce a receipt. Schema/data mismatch produces an explicit failed observation. Values and keyed comparison digests stay private.

Two successful reads compare only selected cell digests. Equality does not prove that migration ran, the application wrote data or provider state survived restart. Those fields stay false and the publication mission stays partial.

## Validation snapshot

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

## Actual provider read and open boundary

The owner selected one exact team/application for read-only Inspector investigation; the private handoff retains that selection. A private process decrypted only that connection, revalidated `/v1/me` user/team identity and read `/v1/databases` in the same team. Both returned200; the observed inventory contained zero databases. No database detail/Inspector origin, actual SQL, control-panel activation, resource creation, app modification or release was performed. Empty inventory does not prove completeness or absence of a provider capability. Credentials were never printed or added to model context.

No new real BoxAPI consumption was authorized or performed; the earlier ledger was not reset/extended. Live PostgreSQL read acceptance, approved destination migration, application writes, restart persistence and rollout remain unconfirmed. Real writes require a concrete source/resource/cost-bound server approval; scope clarification is not that approval.
