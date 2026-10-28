# Managed database and secure binding — 2026-10-28

This is an A14/AC34 partial product slice on base `e75fe394aae8e7684b67d61e62bdc5e8d21ae5b9`. It does not complete all fourteen platforms, database migrations, data-plane verification or full application deployment.

## Product path and host guarantees

The Agent reads the inspected component requirements and live catalog through `read_database_resources`, then can call `propose_database`. The publication page displays exact engine/version, app, private network and separate plan/bundle prices. Its server-owned decision resumes the same mission, creates once, persists `databaseID`, reads that exact ID and records identity-only proof. Expired, rejected, executing, uncertain and resumable states are represented. Missing response IDs cannot be recovered from a matching hostname.

After identity readback the Agent can request `configure_env`. The existing secure form offers “آماده‌کردن اتصال امن دیتابیس”. The server reads private provider details, validates the same identity and source consumer, creates the URL only from explicit fields and prepares an encrypted v9 proposal. The user separately approves that change; existing application keys are preserved. Readback creates the existing environment reference used by build/publication. Database creation cannot be ignored by publication while the selected environment lacks its verified binding. No database credential is a public tool result.

The application services are `databases.ts` and `database-environment.ts`; provider adapters remain separate from policy/Store/UI. ActionSpec v27, migration 19 and the normal action executor retain approval/claim/single-send ownership. The environment service was factored to allow private resource reads within its existing durable budget; no parallel vault, approval service or execution engine was introduced. [ADR 0032](../decisions/0032-managed-database-and-private-binding.md) records exact limits.

## Provider evidence and unknowns

The saved `docs/sources/liara-dbaas.openapi.yaml` was fetched on 2026-10-28 from the official `liara-cloud/openapi`, file blob SHA `6fc68c15e34f709b109c8c9117d2d8e84ebc8041`. Its create response names `databaseID`; its detail schema documents `id`, `username`, `root_password`, `dbName`, `hostname`, `internalPort`, `version`, `publicNetwork` and private-network metadata. The official CLI create file, blob `d3c2277b3214c2b9f77ad863777c0c6ade4bb7c9`, additionally supplies bundle/network request fields. These file-blob IDs are not repository commit IDs. Neither documentary schema proves the actual response in this account.

A credential-scoped read of the actual configured account on 2026-10-28 at 11:26:37 UTC returned `{databases:[]}`. Only keys/types/counts were emitted; no credentials were logged. A fresh identity-bound account read at 11:43:11 UTC reported PostgreSQL versions including 18.4/17.10/16.14/15.18/14.23/13.23. `small-g2` plan was 659.72 toman/hour and its available `basic` bundle was 381.94 toman/hour, reported separately. These historical observations do not authorize a purchase, define combined billing semantics, verify capacity units or prove a connection. The synthetic test catalog uses 16.4/100/10 and must not be mistaken for that live catalog.

There was no live database create, credential detail retrieval, app env write, SQL, migration, resize, data persistence test, database cleanup, release or rollout in this slice. Those require exact resource decisions and actual effect receipts. The original application deployments and databases were not used as a laboratory.

## Snapshot and local validation

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

## Real active model, synthetic provider

Both runs used the current installation's `gpt-6-luna`, reasoning `none`, output cap 1024 through `GoalModelClient` and the existing monetary ledger/allowance. No model, provider or credential was switched and no allowance/reserve was changed.

The first fresh disposable mission deliberately capped model requests at 4. It read source/destination/database resources but reached `BUDGET_EXHAUSTED` before proposing: 4 actual requests, 17,691 reported tokens, 0.017774 USD conservative ledger ceiling. It is a failed bounded experiment, not successful resource acceptance.

The second fresh mission used the current product limits, not a renewal of the first run. On the same runtime fingerprint it made 8 actual requests/37,894 reported tokens and 13 accounted tools, including source-file reads, inventory/capability/quote and `propose_database`. It reached the real server-produced `awaiting_approval` card; the harness then rejected it through the normal decision service. Its conservative ceiling was 0.038073 USD. Synthetic Liara transports served the account/resource data; real provider writes were zero. This verifies one real-model tool-selection path, not live provisioning or generalized quality.

The existing 2 USD allowance and 0.887866 USD prior reserves were unchanged. Remaining local aggregate ceiling after both experiments was 0.124621 USD. The amounts are host ceilings, not an invoice or a fresh account balance. The held hosted budget was not spent or renewed. Private sanitized receipts and source manifests remain installation-local under `.local/continuation-20261028/`.

## Next executable boundary

Resolve live DBaaS detail shape and private endpoint semantics through an owner-approved disposable app/database, then verify binding and an actual application connection. Add approved, source-bound migration execution with a single owner and explicit uncertainty reconciliation; independently inspect schema/data effects, then verify a write/read across a relevant restart/release. Keep migration permission distinct from a resource create or env approval. Resource reuse, several components/resources and all runtime families remain product backlog, not acceptance granted by this case.
