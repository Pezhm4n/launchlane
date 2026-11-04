# Schema baseline intake and disposable bootstrap

Date: 2026-11-04. Related decision: [ADR0039](../decisions/0039-schema-baseline-intake.md).

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

## Completed candidate evidence

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

## Golestan original runner through the product

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

## Measured failures and fixes

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

## Operational limits

Only bounded plain UTF-8 dumps and limited public/unquoted table DDL are accepted.
Literal defaults and sequence dependencies are rejected explicitly in this first adapter.
Original dump rows, COPY and function bodies are excluded from stored schema. No
production SQL, deployed database access, provider write or real model spending is
part of these tests. This is a prerequisite for destination migration, not completion
of that acceptance boundary.
