# Named managed databases in one mission — 2026-10-28

This A14 / AC17/22/23/24/32/34 slice extends the existing managed database application and Agent loop. It connects distinct source connection names to separate resource proposals and private configuration decisions in the product's actual web path. It is not live provisioning, production migration, SQL/connectivity, a publishable data-test artifact or full application acceptance. [ADR0035](../decisions/0035-source-bound-managed-database-connections.md) records the design.

## Problem and resulting behavior

The prior disposable runner could verify two logical databases, but managed creation did not bind a connection purpose; the private binding service assumed DATABASE_URL/REDIS_URL and the mission driver refused any second database. A source with AUTH_DB_URL and PROFILE_DB_URL could not complete even its resource/configuration stages. The host must not silently map both to one resource.

New Agent proposals include private `bindingKeys` and mint ActionSpec **v28**, binding those exact keys, consumer root, source/archive/selection, actor/account/team/application, engine/version/network, request ID, separate prices and expiry before creation. Keys must be declared by that consumer's required database requirement, match the current source/evidence manifest and belong to the supported private URL/URI input shape. One proposal creates one resource; multiple listed keys explicitly alias that one resource. Distinct data targets require separate proposals/decisions. The model cannot choose a resource credential, remote ID or approval.

The existing Store transaction rejects overlapping reserved keys, including source/app lineage changes that would otherwise create a duplicate resource for an occupied application input. Rejected, expired unused and known failed/no-resource requests do not hold a reservation; an actual returned resource and unresolved request do. The original team-wide uncertainty fence applies across v27/v28. Historical v27 canonicalization, actions and progress keep their original shape. Migration20 appends a unique request index covering both versions; migrations1–19 are not rewritten.

Before staging, the complete `{version, sql}` prefix for migrations1–19 was compared with the immutable base Git blob and matched byte-for-byte. Its aggregate JSON SHA256 is `5fa4a2b49a5859ae185785524d91802fcf6f84c8b3c60be9549649c9af0cb06c`. The SQLite upgrade/session regression independently executed the19→20 transition in disposable state.

After actual ID-bound identity observation, the existing private detail adapter supplies a URL only to the approved key set inside the encrypted **v9** environment proposal. The separate web decision, single-send update, merge and configuration readback remain authoritative. Before another source connection can obtain a proposal, the application validates the preceding created resource's binding; it checks again before execution. Web and MCP use the same registry/driver/Store. Advancing the current database review pointer does not rewrite earlier action IDs, receipts, limits or usage.

The publication binding check now requires an environment receipt for exactly that resource's approved key set, with private visibility and matching current values. A swapped link between two otherwise successful environment actions is rejected. The environment GET projection also handles the next resource: an older successful environment stage cannot hide the unbound second database's form.

## Frozen source and configuration

Base: `d101e0fa02dc785d05d5aeddf89775d57a8819b9`, main. Tests use Node **24.18.0**, npm **11.16.0**, the unchanged pinned root lockfile, a frozen production Webpack build and isolated loopback ports/state. The main server/port3000, original corpus projects and their data are untouched. No real model call, allowance renewal, provider write, SQL, push or rollout occurred.

Snapshots `database-targets-r2`, `r3` and final **r4** contain 666 files, with 22 explicitly owned code/test overlays. Their **identical runtime/package fingerprint** is `0ba6f5d1f08a8e4b2c91ccaa2dafe9b3e30bf667aaf730cf3ddbeae6de1c7a3f`. Runtime files and package bytes were compared individually before reusing r2's exact `.next` build in r3/r4. Only test-harness observation/logging changed after r2. This is explicit build reuse of identical application bytes, not a new build or an aggregate assembled from different runtime revisions. Documents added after freezing do not alter that fingerprint.

The source fixture uploaded by the final real browser has hash `fe0407e2e6a1060ab224a72c9a6c6ef25b6ce04d7bda040d9caa2f2c23520e38`. It declares two PostgreSQL consumers at the same root; no source script is run to discover them. Its package/driver/version and the transport's PostgreSQL16.4 offer are **synthetic fixture inputs**, not claims about the current provider catalog. No project-name branch is added to production code.

## Actual web/application path with synthetic external transports

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

Private manifests, logs and screenshots are under `.local/continuation-20261028/database-targets-r*-manifest.json`, matching command logs and each candidate's `.artifacts/database-targets`. No state database, credential, source archive or screenshot binary is committed.

## Retained failures and open boundary

An early mechanical version expansion mishandled two optional-chain guards; typecheck caught them and they were replaced with explicit non-null/type guards. Another preflight found a test deleting a required property; destructuring now constructs the old v27 fixture without weakening validation. The old synthetic Agent example omitted the newly required bindingKeys and obtained no proposal; it was updated with the source-declared key. An initial lint warning used DOM innerText; the new test uses textContent. These are not claimed as passing final runs.

The r2 browser reached its first successful binding but incorrectly looked for KEEP_KEY in the source-filtered build-input projection. The preserved-value oracle now reads the full encrypted input and checks the provider's actual accepted/read-back state; it was not removed. The r3 browser completed both resource/binding cycles but checked the final run before the asynchronous continuation settled. r4 waits for the real continuation HTTP200 and then the durable final state; failed requests still stop the test. Original source, approval, merge, data-health criteria and production timeouts are unchanged. Earlier browser failures are retained in their own logs and not merged into r4's success.

Graph project/coverage tools again returned `Transport closed`; exact source/import/caller/contract reads supplied the evidence. Graph absence was not used to infer a missing capability.

Live managed-resource creation, current-account private detail shape, actual connection/data effects, destination-side migration, database restart/persistence, resource reuse/replacement recovery, a complete multi-component/resource plan and release-bound fullstack artifact/data verification remain open. The current supported URL/URI names, consumer evidence and provider adapters remain bounded. The next product work must connect these explicit bindings and the existing original-runner test to controlled real execution and independent workload/data evidence, without turning a compatibility fixture or configuration receipt into a production claim.
