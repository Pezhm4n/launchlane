# ADR0019 — Required private network with separate unknown-cost consent

Status: implemented; live verification pending. Date: 2026-10-23.

The bounded publication trial stopped before any model or provider write because the selected team's `GET /v1/networks` returned an empty list. An earlier preflight had observed an unused network. Liara documents automatic deletion of unused networks; that explains a possible cause, but the deletion event was not observed. Requiring an existing network forever would leave a fresh account unable to use publication.

## Evidence and decision

The [official private-network guide](https://docs.liara.ir/paas/details/private-network/) requires shared networks for private app/database access, describes network creation during resource setup and automatic deletion of unused networks. The [Node creation guide](https://docs.liara.ir/paas/nodejs/how-tos/create-app/) documents `liara network create`. The actually installed official CLI 9.4.7's `lib/commands/network/create.js` sends one `POST v1/networks` with `{networkName}`; its base network chooser fails when the list is empty. The pinned OpenAPI has no network-create entry. The CLI does not consume a returned ID, so Launchlane does not invent its response schema.

ActionSpec v13 authorizes one network for an exact actor, account/team, project selection, source archive, prospective app and optional host-owned parent run. A nonce in the host-generated network name correlates the later account-scoped read. No independent network tariff was found in the documented catalog: cost stays `unknown`, with null amount/currency/period. It is never shown or authorized as zero. Approval requires the explicit `acknowledgeUnknownCost` decision recorded in the same transaction and checked again at claim; generic legacy approvals and model prose cannot grant it. This is outside MissionPlan v1's existing-app publication authority.

Migration 12 only appends `network_progress`; migrations 1–11 and ActionSpec v1–v12 canonicalization remain intact. The existing action, session, attempt, audit and AgentRun stores own both transports. Web routes and the agent tool delegate to the same application functions. Stdio never owns SQLite writes.

## Execution and recovery

Preparation and preflight read the selected identity and require an empty network list. Existing networks are reused instead of creating extras. The durable stages are `claimed → request_started → accepted → created`. Acceptance is a successful HTTP response, independent of its body. A separate identity/list read must find exactly the nonce name before recording the actual provider ID and success. This is network configuration evidence, never application health or publication.

After a lost write response the stage remains `request_started` and uncertain; a coincident name alone does not prove acceptance. The request is never retried. An accepted but not-yet-visible network can be read again without creating another. Unresolved network writes block further network creation for the entire team even when a different future app name is supplied. Restart, expiry, source/account change and another session cannot renew authority. Agent review and resume retain the same run counters and limits. Network receipt continuation leads to a separately reviewed app/plan, then the existing publication program.

## Limits

The first implementation creates only a missing private network, not additional networks, a network migration, a database or arbitrary resource changes. Existing apps cannot change networks through this path. The provider has no documented create idempotency key or authoritative lost-response query; an uncertain request without an accepted receipt requires operator reconciliation. Unused-network cleanup follows the documented provider lifecycle; no undocumented delete endpoint is assumed. Network pricing remains unknown until authoritative information is available. Local/synthetic transport tests do not establish live API availability or billing.
