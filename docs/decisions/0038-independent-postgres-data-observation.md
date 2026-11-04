# 0038 — Independent PostgreSQL observation for an exact publication

Date: 2026-10-29. Status: implemented; validation is recorded in [the evidence](../evidence/postgres-data-observation.md).

## Problem and decision

A v4 data-tested artifact has independent disposable SQL evidence, but its release, HTML/assets and API response do not prove that the destination database is reachable or has the tested schema/data. Add one bounded read capability through the existing application and Agent registry. It cannot execute migration SQL or complete the production-data mission.

`read_database_data {actionId,baselineId?}` and the publication card call the same application service. The host derives v4 runner targets/oracles from the succeeded build job and validates complete build/output provenance and immutable artifacts. No query, URL, table, credential or oracle argument is accepted. The selected actor/account/team/internal app/project/selection must match the succeeded publication. Every logical target resolves to a distinct exact database ID with an approved resource receipt and private v9 binding.

Before SQL and before saving a receipt, read current provider account/team, application network, release and private environment; read private database details again and compare current credentials to the approved URL values. Context changes and incomplete transport fail without a fabricated observation. Fresh sessions execute only host SELECTs inside repeatable-read, read-only transactions. Schema/type/nullability, optional fixed rows and selected present/non-null cells are checked independently of application output.

`LAUNCHLANE_ENABLE_DATABASE_DATA_READS` defaults false. `LAUNCHLANE_DATABASE_READ_NETWORKS` defaults to an empty list and must contain explicit `{accountId,teamId,networkId}` routes authorized by the server operator. An RFC1918 DNS answer alone cannot prove membership in the selected provider network: the three-part allowlist is checked before requesting provider credentials or connecting SQL. A controlled route from Launchlane to that network remains an operator responsibility. Only exact provider-validated host/port/database credentials are accepted; DNS must return exclusively RFC1918 IPv4 and the client pins one checked address. No public-network enable, Inspector activation or external-address fallback occurs. The application uses explicit private-network transport. The adapter also supports certificate-verified TLS, but Liara TLS availability/configuration has not been established and is never inferred. Private DNS/IP and credentials are an operational trust boundary, not cryptographic server authentication in plain private-network mode.

## Dependency and authority

Pin `pg` and `@types/pg` 8.23.1. A protocol driver permits independent reads from the trusted server without executing source, installing tools inside an application or trusting its output. It adds protocol dependencies, not a worker, scheduler, approval service, provider endpoint or persistence engine. Existing resource/env/publication approvals remain unchanged. The read gate and authenticated invocation do not authorize SQL writes.

An ordinary read role is tested separately. Production credentials currently come from the separately approved provider/v9 binding and can be the provider's administrative user. Only fixed read-only queries run. This does not establish application-role/RLS semantics; `row_security=off` refuses silently filtered observations. Custom/domain/array data types are rejected before value reads. Builtin scalar cells have server-side size guards and result limits. Queries, statements, locks, the observation, abort and session cleanup are bounded.

## Durable evidence and limits

Append SQLite migration22; migrations1–21 are unchanged. Store public checks separately from private HMAC-SHA256 cell digests. No raw cell, private hostname/URL, password or digest reaches tools/UI. A private binding HMAC includes actor, exact publication spec, environment reference/values and resource identities/specs. A baseline from another binding or action is rejected. Matching successful reads report only `same_selected_values`; failed schema/data reads are not comparable.

Evidence is labelled with its time. GET/reload reads local receipts, never SQL or model. New POST/read-tool calls use the existing bounded tool budget. Scope changes, late cancellation and errors do not alter the accepted publication or manufacture success. Provider readback is an observation at particular times, not an atomic provider snapshot or proof of runtime bytes.

`migrationVerified`, `applicationWriteVerified` and `restartPersistenceVerified` remain false. The v4 publication outcome stays partial. Running the original runner on the actual target, proving a fresh application write, restart retention, backup/data compatibility and live provider acceptance remain necessary. PostgreSQL major identity is checked; exact server patch-version equivalence is not asserted.

## Provider investigation

The official [Inspector OpenAPI](https://github.com/liara-cloud/openapi/blob/main/spec/database-inspector.yaml) documents queries but leaves its assigned service origin variable. The served public console bundle `main.6b3849eb.js` exposes Inspector navigation for MongoDB and uses a different URL shape. This is a contract/availability uncertainty, not proof that PostgreSQL Inspector can never exist. No guessed endpoint receives account credentials. [DBaaS OpenAPI](https://github.com/liara-cloud/openapi/blob/main/spec/dbaas.yaml) documents control-panel activation as a write; investigation did not invoke it.
