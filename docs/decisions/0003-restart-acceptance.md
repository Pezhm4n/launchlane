# Restart acceptance and same-page readback

Status: implemented contract, 2026-10-22. Live restart remains unverified.

The pinned Liara OpenAPI describes HTTP 200 from
`POST /v1/projects/{name}/actions/restart` as submission acceptance, with no
operation ID or response body. Installed official CLI 9.4.7 sends that POST
without a body. Neither source establishes a completion event that Launchlane
can correlate to this request. A responding page may also have been served by
the old process while a restart was queued.

Use ActionSpec v6 for this operation. Bind approval to the operator, connected
account, team, internal app identity, current plan and READY release, incident
ID, evidence hash and exact approved page. No archive, upload, release creation,
plan change or environment change belongs to this action. Fresh HTTP error
evidence from the same page is required; latency and content correctness are
outside this readback contract.

Migration 7 adds a separate restart journal. The existing atomic claim persists
an attempt before `request_started`, which is persisted before the only POST.
Only HTTP 200 records `acceptedAt`; no fabricated release/operation ID is used.
Cancellation, unexpected status or lost response after the write boundary stays
uncertain. Recovery before `request_started` can establish that no send began;
recovery after it cannot. No automatic replay or write retry is supported.

Readback checks the same internal app, plan and current READY release before and
after a bounded, redirect-blocked page probe. Acceptance and a same-page 2xx may
finish the action as `succeeded`, meaning **the request was accepted and the page
responded**. UI and evidence must describe exactly that. This state does not
certify container replacement, every replica, application correctness or the
cause of recovery. A non-2xx response remains unhealthy; failed accepted checks
can be read again without sending another restart. Lost acceptance cannot become
success solely because a page responds; it keeps the conflict lock.

An alternative was to infer completion from HTTP 200, elapsed time, logs or an
unverified applet timestamp. That would manufacture causal evidence. Keeping
every acknowledged request permanently uncertain would discard the documented
acceptance and prevent ordinary follow-up work. The selected contract exposes
both its useful observations and its completion limit. Revisit it only after an
authorized live check establishes a provider completion marker and correlation
rule. Project/release reads are not an atomic provider transaction; external
changes between a preflight and POST remain a limitation.

Evidence: `tests/domain/restart.test.ts` uses synthetic transports and real
temporary SQLite; HTTP tests use an isolated production server with blank
provider keys. No new live request is implied by these checks.
