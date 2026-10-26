# ADR 0031 — Single Worker preparation and approved persistent storage

Status: implemented server and Agent boundary with isolated Qadam and synthetic Agent/UI evidence; public storage acceptance remains open.

## Context

Qadam contains a React/Vite frontend and one Hono Worker with one D1 binding, nine SQL migration files and private runtime environment inputs. Publishing its frontend alone loses authentication, synchronization, calendar and data. Running its Worker against an ephemeral filesystem loses writes when the process is replaced. The original repository and its Cloudflare database must remain untouched.

## Decision

Preparation supports a deliberately narrow source shape: one Hono Worker, one D1 binding, one Vite SPA asset binding, an existing npm lock and migration directory. Static inspection never runs project scripts. A reviewed repair workspace receives four fixed, content-verified adapter files, Node 24 configuration, build and start commands. Dependency versions, application code, original test scripts and migration bytes remain unchanged. The actual sandbox builds both frontend and backend, executes the existing tests and probes independent API criteria before assembling immutable compiled output.

The fixed Node adapter implements the observed `prepare/bind/first/all/run/batch` SQL surface using `node:sqlite`. Repeated numbered parameters retain their binding semantics. Batches and migrations use savepoints. The migration ledger binds full filenames and checksums, including distinct files with the same numeric prefix. Populated databases without the ledger, changed applied migrations, unsupported transaction/storage directives and invalid bindings fail closed. This is not a complete Cloudflare D1 emulator, a data migration service, replicated sessions or a general Worker runtime.

Private source environment references allow an isolated build before a destination exists. They bind actor, source lineage, key names and a keyed fingerprint over encrypted imported values. Values enter the approved sandbox through stdin and do not enter its source archive. They do not pretend that cloud configuration has been applied. Publication still requires a succeeded v9 configuration readback for the same values and destination.

ActionSpec v25 creates exactly one 1 GB disk for a fresh, empty, product-created Node destination for this exact artifact. It binds actor, account, team, app object ID, plan/bundle, source and selection, unique disk name, existing inventory, available capacity and a short-lived catalog fingerprint. The current slice refuses existing disks, mounts, reserved storage and a plan change. It does not resize a resource or quote invented extra capacity. The base application cost remains governed by its destination approval.

Migration 18 appends a disk progress table without rewriting migrations 1–17. Approval is single-use and session-bound. Claim and request-start records commit before the sole POST. A missing response stays uncertain; only identity-scoped readback may resolve it. A claimed journal without a send can resolve as not started. Generic healthy receipts cannot confirm a disk. The inventory endpoint uses the provider app object ID, as confirmed by a bounded read-only account check; the create endpoint follows the pinned API and official CLI name-based request.

ActionSpec v26 extends compiled fullstack publication with the succeeded v25 disk identity and `/data` mount. Proposal, preflight, the boundary after source upload and final observation check the exact disk. The release request includes only that mount. READY, correct HTML, API and compiled proof cannot confirm an unexpected/missing mount. A failed read remains inconclusive and never authorizes replay. Historical action canonicalization remains unchanged.

## Alternatives and limits

Copying the original D1 data was rejected because it changes the privacy and migration scope. Serving just the frontend was rejected because it omits required behavior. A separate database service adds an unneeded service and a new SQL compatibility boundary for this application. The bounded SQLite adapter preserves the application's observed SQL and permits a dedicated persistent disk, while explicitly retaining unsupported D1 features as gaps.

The Qadam sandbox checks and full container replacement establish isolated application compatibility with new synthetic data. They do not prove native Node 24 release behavior, provider disk permissions, Liara restart persistence or the hosted Agent loop. The same application service is available through a source-scoped `propose_disk` Agent tool and the publication review card. Optional read-only chat cannot obtain that tool. Parent run identity, decisions, claim, cancellation and recovery share the existing budget and journal. MCP missions use that same driver and registry; live MCP storage acceptance remains unverified. No live disk or Qadam destination was created for this evidence.

Documentary references: [Liara Node version selection](https://raw.githubusercontent.com/liara-cloud/docs/master/src/pages/paas/nodejs/how-tos/choose-version.mdx), [official CLI 9.6.0 disk creation](https://github.com/liara-cloud/cli/blob/v9.6.0/src/commands/disk/create.ts), [official CLI release request](https://github.com/liara-cloud/cli/blob/v9.6.0/src/commands/deploy.ts). Actual account fields and configured limits still require fresh readback at approval and execution.

See [measured Qadam evidence](../evidence/qadam-worker-storage-20261026.md).
