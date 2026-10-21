# ADR 0001 — Durable approvals in a single local process

Status: accepted, 2026-10-21. Applies to the P1 operator-local MVP.

## Context

A request may be accepted by the provider before its response is lost. Process
memory cannot distinguish that case from an action that never started. A fresh
approval must not become permission to repeat a possibly committed write.

## Decision

Use native `node:sqlite`, verified on Node 24.18.0, with short `BEGIN IMMEDIATE`
transactions, WAL, FULL synchronous commits and checksummed append-only
migrations. Atomically consume approval and persist the unique attempt before
entering the provider callback. Bind approval to actor, session, team, app,
operation, exact arguments, source hash and expiry.

Recover interrupted `executing` actions as `uncertain`; preserve `observing` as a
read-only continuation. Block conflicting app actions until evidence resolves
the earlier effect. A missing secret, timeout or new approval cannot erase an
attempt. Durable storage failure closes mutation; there is no memory fallback.

Use one local server process. A shared database service, ORM and queue add
coordination and deployment cost without solving the current bounded workflow.
Multi-process ownership and durable worker execution require a separate design
before they are enabled.

## Consequences and evidence

Tests cover independent SQLite connections racing to claim one action, expiry,
replay, lost response, process recovery and migration/storage failure. Those are
offline invariants. They do not establish provider idempotency or live deployment
success. The live executor is intentionally disconnected until the relevant
adapter and outcome verification are implemented.
