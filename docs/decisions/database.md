# Database — architecture decisions

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [ADR 0032 — Managed database creation and private application binding](#0032-managed-database-and-private-binding)
- [ADR 0033 — Source-bound migration and data-effect testing](#0033-source-bound-disposable-migrations)
- [ADR 0034 — Original migration runners and separate disposable data targets](#0034-project-migration-runners-and-data-targets)
- [ADR 0035 — Source-bound managed database connections](#0035-source-bound-managed-database-connections)
- [ADR 0036 — Reuse an existing managed database through the shared approval path](#0036-existing-managed-database-selection)
- [ADR 0037 — Prepare an exact artifact after independent disposable data proof](#0037-data-tested-prepared-artifacts)
- [0038 — Independent PostgreSQL observation for an exact publication](#0038-independent-postgres-data-observation)
- [ADR0039 — Source-bound schema baseline intake for disposable runner tests](#0039-schema-baseline-intake)

<a id="0032-managed-database-and-private-binding"></a>

## ADR 0032 — Managed database creation and private application binding

Status: implemented with bounded local and real-model evidence; live database creation and data-plane acceptance remain open.

Launchlane previously read database inventory, engine versions and separate plan/bundle quotes. A complete application cannot discharge a database dependency with those reads or a successful frontend response. The next executable boundary uses the existing action, approval, claim, journal, environment vault and AgentRun services.

ActionSpec v27 proposes a private database for a source-backed required PostgreSQL, MySQL or Redis consumer. It binds actor/account/team/internal app, source/archive/selection, consumer root, engine/version/plan/bundle, the actual destination network, request key, parent mission and five-minute separate prices. Provider catalog versions remain dynamic. Supabase, D1 and other service semantics are never replaced by this mapping. Unknown prices stay unknown; the two database price components are not added into an invented total. Capacity, tax and traffic are not measured by this proposal.

Approval and the mission transition commit together. Fresh identity, quote, network and inventory checks precede the single durable write claim. The official CLI supplies the create request fields; the official DBaaS specification supplies the `databaseID` response field. Only that returned ID may correlate a readback. Missing/lost/invalid responses stay uncertain even if the hostname later appears. Generic deployment receipts and generic healthy observations cannot confirm the database. Observation proves only identity/type/observed plan metadata, not version, network settings, readiness or data access.

Migration 19 appends `database_progress`, unique actor/request keys and the relation from existing environment actions to their database creation receipt. Applied migrations 1–18 are unchanged. Recovery, cancellation, context invalidation and competing-write checks include database ownership. Reads spend the same cumulative mission allowance; a reload or interrupted response grants no new write or budget.

The existing secure environment form offers private binding after an exact database receipt. A server-only adapter reads the documented detail endpoint, validates identity and explicit private configuration, and requires complete username/password/database/internal-port fields. Currently it maps only the exact source consumer's `DATABASE_URL` or `REDIS_URL`; unsupported aliases/shapes fail closed. No default username, password, port, engine version, Redis database number or public endpoint is fabricated. MySQL/Redis parser paths have no live acceptance.

Private values pass directly into the same encrypted, merge-preserving v9 environment proposal. They do not become a model tool result, browser value, source archive or log. URL passwords are included in the host's known-secret redaction set. An environment write still requires its own decision and configuration readback. Its succeeded receipt is not connectivity, migration, restart or persistence proof. Publication preflight and claim validation require a product-created database in the source lineage to retain its verified private binding in the selected environment; unrelated settings cannot silently discharge it.

Web and MCP continue to share AgentRun and the tool registry. `propose_database` is offered only for an applicable source requirement and selected destination. MCP returns the same web review URL; it gains no approval transport or second executor. Source-only detection remains evidence of a requirement, not proof that a resource is running.

Open boundaries are resource reuse/adoption across independent missions, several managed resources in one mission, component deployment plans, user-selected non-URL bindings, least-privilege application DB users, approved migration execution and effect checks, data-plane connectivity/persistence, safe database cleanup and live end-to-end acceptance. A complete product claim requires those boundaries; this ADR does not redefine the mission around a provisioned database.

See [implementation and validation evidence](../evidence/database.md#managed-database), the [saved official DBaaS specification](../sources/liara-dbaas.openapi.yaml), [official CLI create implementation](https://github.com/liara-cloud/cli/blob/master/src/commands/db/create.ts), and [official DBaaS source](https://github.com/liara-cloud/openapi/blob/main/spec/dbaas.yaml).

<a id="0033-source-bound-disposable-migrations"></a>

## ADR 0033 — Source-bound migration and data-effect testing

Status: implemented for bounded plain SQL and Node fullstack compatibility tests. Production migration, database restart and public data-plane acceptance remain separate boundaries.

A database dependency cannot be discharged by a catalog, a create receipt or an application that returns a plausible JSON object. The existing disposable PostgreSQL path now has an opt-in v2 contract carrying ordered source SQL files, independently checked columns and seed rows, and a selected application-written value that must survive application replacement. Legacy v1 contracts remain readable and keep their historical behavior.

The shared `propose_project_build` tool accepts paths and semantic expectations. The host captures SQL hashes from the selected source; the model cannot supply a database image, password, connection string, role, checksum or receipt. The existing `CodeRepairJob` review, parent budget, cancellation, container identity receipts and cleanup own execution. Neither a second executor nor a cloud SQL tool is introduced. The web review explains the exact files, isolated synthetic data and expected effect before any project script or SQL runs. MCP uses the same registry and web decision.

The adapter deliberately accepts bounded plain SQL rather than pretending to understand framework migration engines. It rejects psql metacommands, transaction control, administrative statements, functions and quoted identifiers, without rewriting the original files. The selected set executes in one transaction with `ON_ERROR_STOP`, lock/statement deadlines, an advisory transaction lock and a host-owned file/checksum ledger. Replaying the same files skips applied changes; a changed checksum fails. Selecting different SQL after a measured migration execution/oracle failure requires a new job and decision while the prior schema, seed, persistence and connection criteria remain immutable. A network/cache failure does not authorize changing SQL.

SQL and the application use a non-superuser role without database/role creation or replication. PostgreSQL trust authentication inside a shared network namespace would otherwise allow the application to choose the fixture root username. Migration mode installs a fixed HBA policy: only the app role may connect over loopback TCP; root uses the PostgreSQL container's unshared Unix socket. Before exposing the namespace, the host requires an actual root TCP attempt to fail with the expected PostgreSQL policy rejection. An acknowledgement of configuration reload is insufficient. Private root readback is host-generated and read-only.

The independent observer verifies actual column type/nullability, unique seed rows and the exact migration ledger. It reads a baseline fingerprint, runs the unchanged original application/API tests, requires a fresh non-null value in the actual database, replays the exact SQL and starts a second newly created application worker. The last independent read must match the first application's stored value. Output claiming success, unchanged seed values, memory-only responses and altered data do not satisfy this contract. Row values stay out of the receipt; it carries counts, source/plan/file identity and explicit limits.

This proof concerns data retained across two application workers on the same disposable PostgreSQL instance. The database itself uses bounded tmpfs and is removed after the test. The result creates no publishable artifact, production credential binding or publication authority. It does not prove database restart, a durable provider volume, live migration, schema rollback compatibility or an arbitrary project's workflow. Legacy v1 hidden environment flags are not inherited by v2: migration mode injects only the declared disposable connection URL keys.

Actual execution also exposed two provider-local runtime assumptions. Docker 29's inspected image ID on this installation is the pinned OCI manifest digest rather than the historical config digest. Both identities are accepted only under exact digest/platform/volume/OnBuild checks; the manifest form additionally requires a matching approved manifest descriptor, and the verified identity is frozen through cleanup. The pinned Debian image resolves `/var/run/postgresql` to `/run/postgresql` in kernel mountinfo. Only those exact alternatives are recognized and duplicate/ambiguous or non-tmpfs mounts still fail closed.

See [validation and retained failures](../evidence/database.md#postgres-migration-test). The next product boundary is separately approved migration and independent data verification against the exact managed resource/binding and published artifact, with uncertainty reconciliation and safe recovery. Framework migration adapters, component/resource planning and the remaining runtime families remain in scope.

The real web/worker integration exposed a separate orchestration mistake: `requiresPreparation` describes a source-shape conversion, not proof that an ordinary fullstack artifact is already built or that disposable data compatibility is unnecessary. Structured missions now select the fullstack tool mode for every detected supported fullstack profile, allowing an explicit local build/data review before choosing an account or destination. Native non-fullstack destination ordering is unchanged. No destination means no publication tool; local approval still grants no cloud resource, environment or publication authority. The host's actual receipt decides whether an artifact exists, and compatibility tests still cannot create one.

<a id="0034-project-migration-runners-and-data-targets"></a>

## ADR 0034 — Original migration runners and separate disposable data targets

Status: implemented for the existing Node fullstack/npm/pg worker path; validation and remaining production boundaries are recorded separately.

The plain-SQL v2 adapter owns its transaction and checksum ledger. Applying that adapter to a project's framework runner would change its semantics: the original runner may own transactions, locks, ledger formats, quoted identifiers and procedural SQL. A v3 disposable database plan therefore runs an existing root package script and its declared pre/post hooks inside the same bounded container worker. The host derives and verifies the script chain and hash from captured `package.json`; the model supplies only the script name and source-backed target/oracle criteria. SQL is neither rewritten nor wrapped by the host. Whole-source identity still binds the job, including code consumed or generated by its reviewed build scripts.

One to four logical databases can share the owned, network-isolated temporary PostgreSQL server. The host generates distinct database/role names; the approved plan binds each target ID to its declared connection environment keys and independent criteria. Each app role has no superuser, database creation, role creation or replication permission. CONNECT grants and HBA rules permit only that role's own database. No private real configuration or legacy hidden flags enter v3. This is logical database separation on one temporary server, not several provider resources, a cost quote or distributed atomicity. If the source runner commits one target before another fails, the test fails and the owned fixture is removed; the host does not invent cross-database rollback.

The original runner executes twice, each time in a fresh worker. Two other fresh workers execute the unchanged original build/start/API/tests. All execution stays in the existing CodeRepairJob, parent budget, approval, ownership receipts, cancellation and uncertainty lifecycle. There is no new Store, policy engine, shell tool or cloud SQL endpoint. Completed compatibility tests still have no publishable artifact, source selection or cloud authority. Recovery cannot blindly recreate a possibly executing fixture.

Independent observation uses a separate non-superuser role on the PostgreSQL container's unshared Unix socket, READ ONLY transactions, a fixed `pg_catalog` search path and deadlines. The role receives `pg_read_all_data` and explicit `BYPASSRLS` so source-defined row policies cannot hide required effects; neither attribute is granted to the application. PostgreSQL documents that the predefined read role does not itself bypass RLS. TCP access for root and observer is denied; actual root rejection is required before any worker receives the namespace. See [PostgreSQL 16 predefined roles](https://www.postgresql.org/docs/16/predefined-roles.html) and [read-only transaction semantics](https://www.postgresql.org/docs/16/sql-set-transaction.html).

The host checks relation kind, column type/nullability and built-in scalar type identity before it reads values. Every required relation must have at least one column in this independent schema oracle; application readiness alone cannot verify an additional required table. It serializes individual validated columns, not an application-owned composite row, view, domain, array or custom type. Quoted mixed-case ORM identifiers are preserved through validated, quoted references. This bounded observer deliberately rejects unsupported types rather than invoking source-defined serialization with a privileged reader.

Fixed row expectations remain invariant across every observation. A schema-only migration may specify no fixed rows, and a persistence key may initially be absent. After the first application's original tests, every target must contain its unique row with a fresh non-null value, independently different from baseline. The same value must remain immediately after runner replay, before another application could hide data loss by writing it again, and after the second application. Missing rows, echo/memory-only results, unchanged seeds or replay resets cannot produce a success receipt. The older v2 path also gains this immediate post-replay observation without changing its historical canonical contract or renewing its budget.

The v3 receipt says `selected_oracles_unchanged`, not that every migration was skipped or every table was audited. It binds the prepared execution source, full data plan, runner hash and per-target measured counts, with `production:false` and `databaseRestartVerified:false`. The existing web review displays the source command/hooks, target names, environment key names and independent criteria, then the same decision/API executes the job. Web and MCP continue to use the same registry and runtime.

This adapter does not manufacture a missing CLI, run an exported module with guessed arguments or install a new driver. The current path requires supported Node fullstack source, existing npm v3 locks and a root pg dependency. A project whose migrations are exported functions without a suitable script needs a separately reviewed preparation/runner adapter. Python/framework-native commands, pnpm workspaces, managed-resource SQL, separate provider services and persistence after database restart remain product work. The real Golestan runner and its production data are not silently replaced by this local protocol.

<a id="0035-source-bound-managed-database-connections"></a>

## ADR 0035 — Source-bound managed database connections

Status: implemented; scoped validation is recorded in [the evidence](../evidence/database.md#managed-database-targets). Real provider writes, production SQL and release data persistence remain unverified.

The v3 disposable runner already tests multiple logical databases, but managed creation v27 did not identify a connection slot, private binding assumed DATABASE_URL/REDIS_URL, and the Agent blocked any second database. A real application with AUTH_DB_URL and PROFILE_DB_URL could not continue through its actual resource setup. Reusing one URL for both would silently change its topology.

New Agent proposals therefore use ActionSpec v28 with explicit source-backed bindingKeys. Each key is private, unique and read by the required consumer's database requirement; source/evidence hashes and the selected profile are checked. The existing database catalog, separate prices, network, approval, claim, one-send adapter and ID-bound journal remain authoritative. v27 canonicalization, approvals and progress are preserved without adding a default field. Migration20 appends only a cross-version unique request index; migrations1–19 are unchanged.

One proposal creates one resource. Several listed keys explicitly alias that same resource, as the review explains; distinct data targets require separate proposals. Keys enter the approval fingerprint before creation. Inside the existing Store transaction, a second request cannot reserve any occupied key in the same actor/account/team/application. Rejected or expired unused proposals do not renew or retain a reservation. Executing, observing and uncertain writes remain blocked by the existing team journal, across v27/v28. Known failed requests without a returned resource do not reserve a slot; a returned resource ID still does. The bounded active-resource review fails closed if incomplete.

The server's private credential adapter feeds all and only the approved keys into the existing encrypted, merge-preserving v9 environment proposal. It returns no credential to the model/browser. Its separate decision and configuration readback remain necessary. The binding receipt must name exactly the created resource's approved key set; a different successful environment action or swapped resource links cannot satisfy publication. The current environment must retain every approved connection value. This is configuration evidence, not database connectivity or data health.

After identity readback and verified binding, the same Agent mission may propose a distinct source connection. It retains the original usage, limits, scope and history; old database actions and progress are not overwritten when the current review pointer advances. The application checks prior bindings before a new proposal and again before execution; model guidance cannot authorize another write. A possibly committed response cannot be adopted by name or silently retried.

The environment GET projection distinguishes the new resource from an earlier completed environment stage. When the latest resource has no successful binding, an older successful action does not hide its setup card. This uses the existing action/binding tables and form; no second resource engine, Store, approval route or secret UI is introduced. Web and MCP retain the same registry and mission driver.

This slice closes named and sequential multi-resource configuration. It does not build a complete multi-component resource graph, infer aliases, migrate real databases, promote disposable data into production, create a publishable compatibility artifact, prove connectivity/persistence, or complete all fourteen runtimes. Those require their own approved execution and independent release-bound evidence.

<a id="0036-existing-managed-database-selection"></a>

## ADR 0036 — Reuse an existing managed database through the shared approval path

Status: implemented; validation and limits are recorded in [the evidence](../evidence/database.md#existing-managed-database).

The resource flow could create a database and bind its connection names, but could not approve an existing resource. Creating an empty replacement for an application with existing data changes its meaning. A model-selected hostname or an unresolved creation must not confer authority to adopt that resource.

ActionSpec v29 therefore represents `attach_database`, distinct from v27/v28 `create_database`. It binds the exact provider ID, source/archive/selection, consumer root, private connection keys, account/team/application, observed engine/version/plan/bundle/private network, request key, separate current price components and expiry. The provider ID comes from same-account inventory; private details must agree and explicitly identify the consumer's private network. The initial implementation requires the actual plan, bundle and version to remain observable in the account catalog. It neither substitutes a newer version nor invents an absent price. Account credit is not a purchase prerequisite for selecting an existing resource.

The existing Store, approval, claim and database journal own the selection. After approval, fresh identity/configuration checks precede the atomic claim. This operation issues no provider write. Its accepted ID must equal the approved ID, and successful observation requires private detail evidence for version/network as well as inventory identity/plan/bundle. Its terminal stage is `selected`, never `created`. Agent execution and state rehydration preserve prior effects; merely selecting an existing resource cannot claim a remote change.

Credentials continue through the existing private detail adapter and encrypted v9 environment proposal, with a separate human decision, merge-preserving single-send update and configuration readback. No secret enters the new tool arguments, model context, source archive or browser. No second execution engine or persistence store is added. The same tool registry/application serves web and MCP Agent goals.

Connection reservations include v29. An occupied connection can be selected again only for the identical successfully observed database ID, consumer and exact key set. A later private binding for that same identity/purpose may supersede earlier credentials, allowing rotation/recovery; binding another resource cannot discharge the old requirement. Unresolved creation still blocks selection and is never reconciled by hostname. Migration21 appends a request-key index across v27/v28/v29; migrations1–20 and historical canonicalization remain unchanged.

Selection and configuration readback do not prove schema/data compatibility, migration, SQL connectivity, application behavior or persistence. They authorize no SQL, migration, clone, resize, restore or deletion. Those operations need explicit contracts, policy and independent workload/data receipts. Existing-resource adoption is part of the complete deployment goal, not a replacement for its remaining data-plane stages.

<a id="0037-data-tested-prepared-artifacts"></a>

## ADR 0037 — Prepare an exact artifact after independent disposable data proof

Status: implemented; acceptance and remaining boundaries are recorded in [the evidence](../evidence/database.md#data-tested-artifact).

The original-runner compatibility test could verify migrations, application writes and selected data retention, but deliberately produced no artifact. Consequently a database-dependent application could not carry that preparation into destination and resource planning. A successful compatibility receipt must retain its historical meaning; it must not silently become publication authority.

The existing `propose_project_build` tool therefore accepts `prepareArtifact:true` only with the original-runner `compatibilityDatabase` shape. The host creates DisposableTestDatabase v4 with purpose `prepare_artifact`. Versions1–3 keep their existing canonical forms and no-artifact behavior. Promotion from a completed v3 test requires the identical runner, targets and independent oracles, plus a fresh preparation decision and execution. The model cannot promote the previous receipt into a new success.

The same CodeRepairJob, budget, source capture and isolated PostgreSQL/Node workers execute the original script/hooks, locked build, original API tests and independent schema/data observations. Both runner runs and both application runs use fresh workers. Every target must receive a fresh application write; the selected data must remain unchanged immediately after runner replay and after the second application. SQL, transactions and the migration ledger remain owned by the source runner.

Only explicit v4 preparation exports the compiled frontend from the tested application worker. The existing bounded exporter, output store, compiled-byte verifier and immutable fullstack archive assemble the result. Export uses the same operator-selected Docker endpoint as execution and rejects reserved temporary database/role markers. No fixture database, imported credential or temporary connection input is archived. Source, database-plan hash, complete-build hash, output hash and archive hash remain distinct identities and are validated at their respective boundaries.

Local artifact selection permits destination/resource planning. Cloud publication additionally resolves every tested database purpose to a separately approved, successfully identified PostgreSQL resource in the same actor/account/team/app/project lineage, with the exact private connection key set and verified v9 binding. Two independent tested targets cannot silently collapse onto one provider ID. Missing, changed, ambiguous or incomplete bindings fail closed. This preparation mode currently tests database URL inputs only; additional source-consumed environment inputs require a new supported preparation decision. Unrelated preserved configuration is handled by the existing merge path.

No ActionSpec, Store, migration history, execution engine or dependency is duplicated. Web and MCP share the tool/application registry; decisions remain in the existing web review. This slice creates local preparation evidence and a deployable package, not production migration permission, schema compatibility for existing live data, provider persistence, database restart proof or release data-plane acceptance. Controlled destination migration and independent observations of the exact published release remain required product work.

The Agent publication caller reuses this shared verification rather than repeating the old environment-equality check against a null temporary environment. Ordinary builds still undergo that equality check in the shared verifier; v4 undergoes its exact resource/private-binding checks. The original workload criterion remains independently bound.

The publication-success branch also checks the same completed build/provenance for the acting user. For v4, a verified release/page/API establishes that limited remote effect but retains `partially_completed` for the overall mission. The source, complete-build and output hashes, output directory and API criteria must match the accepted publication binding. Local data proof cannot promote itself into a production-data receipt, and model text cannot override this outcome. Preparations without v4 retain their prior completion behavior.

<a id="0038-independent-postgres-data-observation"></a>

## 0038 — Independent PostgreSQL observation for an exact publication

Date: 2026-10-29. Status: implemented; validation is recorded in [the evidence](../evidence/database.md#postgres-data-observation).


<a id="0038-independent-postgres-data-observation-problem-and-decision"></a>

### Problem and decision

A v4 data-tested artifact has independent disposable SQL evidence, but its release, HTML/assets and API response do not prove that the destination database is reachable or has the tested schema/data. Add one bounded read capability through the existing application and Agent registry. It cannot execute migration SQL or complete the production-data mission.

`read_database_data {actionId,baselineId?}` and the publication card call the same application service. The host derives v4 runner targets/oracles from the succeeded build job and validates complete build/output provenance and immutable artifacts. No query, URL, table, credential or oracle argument is accepted. The selected actor/account/team/internal app/project/selection must match the succeeded publication. Every logical target resolves to a distinct exact database ID with an approved resource receipt and private v9 binding.

Before SQL and before saving a receipt, read current provider account/team, application network, release and private environment; read private database details again and compare current credentials to the approved URL values. Context changes and incomplete transport fail without a fabricated observation. Fresh sessions execute only host SELECTs inside repeatable-read, read-only transactions. Schema/type/nullability, optional fixed rows and selected present/non-null cells are checked independently of application output.

`LAUNCHLANE_ENABLE_DATABASE_DATA_READS` defaults false. `LAUNCHLANE_DATABASE_READ_NETWORKS` defaults to an empty list and must contain explicit `{accountId,teamId,networkId}` routes authorized by the server operator. An RFC1918 DNS answer alone cannot prove membership in the selected provider network: the three-part allowlist is checked before requesting provider credentials or connecting SQL. A controlled route from Launchlane to that network remains an operator responsibility. Only exact provider-validated host/port/database credentials are accepted; DNS must return exclusively RFC1918 IPv4 and the client pins one checked address. No public-network enable, Inspector activation or external-address fallback occurs. The application uses explicit private-network transport. The adapter also supports certificate-verified TLS, but Liara TLS availability/configuration has not been established and is never inferred. Private DNS/IP and credentials are an operational trust boundary, not cryptographic server authentication in plain private-network mode.


<a id="0038-independent-postgres-data-observation-dependency-and-authority"></a>

### Dependency and authority

Pin `pg` and `@types/pg` 8.23.1. A protocol driver permits independent reads from the trusted server without executing source, installing tools inside an application or trusting its output. It adds protocol dependencies, not a worker, scheduler, approval service, provider endpoint or persistence engine. Existing resource/env/publication approvals remain unchanged. The read gate and authenticated invocation do not authorize SQL writes.

An ordinary read role is tested separately. Production credentials currently come from the separately approved provider/v9 binding and can be the provider's administrative user. Only fixed read-only queries run. This does not establish application-role/RLS semantics; `row_security=off` refuses silently filtered observations. Custom/domain/array data types are rejected before value reads. Builtin scalar cells have server-side size guards and result limits. Queries, statements, locks, the observation, abort and session cleanup are bounded.


<a id="0038-independent-postgres-data-observation-durable-evidence-and-limits"></a>

### Durable evidence and limits

Append SQLite migration22; migrations1–21 are unchanged. Store public checks separately from private HMAC-SHA256 cell digests. No raw cell, private hostname/URL, password or digest reaches tools/UI. A private binding HMAC includes actor, exact publication spec, environment reference/values and resource identities/specs. A baseline from another binding or action is rejected. Matching successful reads report only `same_selected_values`; failed schema/data reads are not comparable.

Evidence is labelled with its time. GET/reload reads local receipts, never SQL or model. New POST/read-tool calls use the existing bounded tool budget. Scope changes, late cancellation and errors do not alter the accepted publication or manufacture success. Provider readback is an observation at particular times, not an atomic provider snapshot or proof of runtime bytes.

`migrationVerified`, `applicationWriteVerified` and `restartPersistenceVerified` remain false. The v4 publication outcome stays partial. Running the original runner on the actual target, proving a fresh application write, restart retention, backup/data compatibility and live provider acceptance remain necessary. PostgreSQL major identity is checked; exact server patch-version equivalence is not asserted.


<a id="0038-independent-postgres-data-observation-provider-investigation"></a>

### Provider investigation

The official [Inspector OpenAPI](https://github.com/liara-cloud/openapi/blob/main/spec/database-inspector.yaml) documents queries but leaves its assigned service origin variable. The served public console bundle `main.6b3849eb.js` exposes Inspector navigation for MongoDB and uses a different URL shape. This is a contract/availability uncertainty, not proof that PostgreSQL Inspector can never exist. No guessed endpoint receives account credentials. [DBaaS OpenAPI](https://github.com/liara-cloud/openapi/blob/main/spec/dbaas.yaml) documents control-panel activation as a write; investigation did not invoke it.

<a id="0039-schema-baseline-intake"></a>

## ADR0039 — Source-bound schema baseline intake for disposable runner tests

Status: implemented; acceptance is bounded by the recorded tests.
Date: 2026-11-04


<a id="0039-schema-baseline-intake-problem"></a>

### Problem

A migration runner may depend on tables created before its tracked migrations.
Golestan's original runner exposed this boundary on an empty database. A historical
local dump contains the missing `users` DDL and real rows. Restoring that dump would
copy data and does not belong in an automatic preparation experiment.


<a id="0039-schema-baseline-intake-decision"></a>

### Decision

The authenticated project application accepts an explicitly chosen UTF-8 plain SQL
dump up to 8 MiB. A lexical reader skips COPY payloads, comments, strings and function
bodies while identifying table definitions. The user selects one to eight public,
unquoted tables. Only their limited CREATE TABLE / ADD CONSTRAINT / CREATE INDEX DDL is retained;
raw input and rows are not stored, archived or projected to a model. This adapter
rejects quoted names, string/dollar literals and selected unsupported default, sequence,
trigger or row-security dependencies rather than silently omitting them or rewriting
the source. Other dump dialects, sequence dependencies and literal defaults need
explicit adapters before acceptance.

Migration23 appends actor/project/source-bound immutable baseline records. A request
key is idempotent only for the same selected DDL. GET and inspect_project expose
summaries. The existing bounded/redacted read_project_file can read a baseline's
virtual path as untrusted source. No SQL authority comes from this read.
The existing source-credential policy also checks selected DDL against installation
and encrypted actor project secrets at import, read, proposal and execution. A value
newly registered as private cannot later escape through a previously saved schema.
Skipped COPY rows remain excluded and are not projected as source.

The existing v3/v4 runner target has an optional bootstrap plan. It binds exact source
SQL hashes or imported baseline IDs/hashes/bytes, plus at most eight ordinary NOLOGIN
role names and eight local schema names. Declaring schemas also grants the exact
ordinary app role CREATE on its disposable database, because PostgreSQL checks that
privilege even for CREATE SCHEMA IF NOT EXISTS. This is shown in the review and
grants no CREATEDB, role administration or access to another target. Historical plans without bootstrap keep
their canonical bytes. A fresh existing build approval binds the complete plan.
A failed job can propose prerequisites again with fresh approval while its runner,
API, schema and data oracles remain unchanged. An already successful job cannot
silently replace prerequisites.

The host revalidates imported bytes before worker execution. Only the existing
isolated fixture can prepare roles/schemas and apply baseline DDL as the exact
ordinary target owner before the unchanged project runner. Targets remain separate.
Baseline failure stops the runner and application. Root/observer identities,
external credentials and provider routes cannot be supplied by this contract.
There is no second approval engine or alternate deployment path.


<a id="0039-schema-baseline-intake-limits"></a>

### Limits

This operation reads no deployed database and applies nothing to Liara. The runner's
own ledger still owns migrations. A successful local receipt/artifact is not permission
to execute destination SQL or proof of the original complete Golestan application,
production data compatibility or provider persistence. Destination migration needs
its own exact resource/credential/runner authority and reconciliation contract.
