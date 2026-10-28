# Exact-artifact rollback through the shared Agent — 2026-10-28

## Problem and product behavior

Commit `9d66e5e` already implements rollback through an immutable artifact flow and the normal publication service. This slice connects that existing capability to the actual goal loop and MCP. It does not implement a second rollback executor.

- `read_publications` returns twenty successful historical publication records at a time, scoped to actor, account, team, public app name and internal app ID. `nextBeforeActionId` resumes in insertion order. History is not the current remote release, current health or data compatibility.
- For an explicit rollback goal, `propose_rollback(actionId)` reuses `proposeRollback`. The host verifies the historical receipt/flow/archive, adopts the artifact flow into the same AgentRun before further budget persistence and creates an ordinary publication decision.
- A `maintenance` channel persists in the existing run JSON. No migration or ActionSpec canonicalization changes. Maintenance progress and publication decisions are restored in the publication tab; the optional question channel stays read-only.
- `launchlane_maintain(requestKey, goal)` uses the same `createAgentRun`/driver, session scope, durable usage and configured model as the web API `POST /api/agent/runs` with `operation=maintain`. A repeated registration joins the same run, including after host-owned artifact selection. MCP still has no approve/execute tool.
- The review URL opens the existing publication card. The host explains that current configuration/plan continue and schema/data compatibility is unverified. Approval/rejection, claim, upload/release and observation use the existing services and journals.
- Ordinary structured publication and question tools cannot acquire rollback authority. An active unrelated mission blocks standalone rollback. The previous-version selector now filters account/team/internal identity before choosing a candidate, instead of selecting by public name alone and rejecting the wrong account afterwards.

## Acceptance and configuration

Partial AC30, AC31, AC24 and AC17. Base: `e125a38bfcfd1d3bf0b44259b36a903e370cbb0f`. Final candidate `rollback-r4` is an independent same-drive export of tracked files and this slice, with the installed pinned dependency tree linked read-only by convention. Node24.18.0, npm11.16.0, Next16.4.2. Runtime source/package SHA256: `f55350a7dbfb173b183db66daeee43a58f2014e205161adb530ed988ff089d6e`. The private per-file manifest and command logs are in `.local/continuation-20261028` and are not product inputs.

| Command on r4 | Observed result |
| --- | --- |
| `npm run test:domain` |748/748, zero fail/skip/cancel,264179ms; includes context adoption, exact bytes/unchanged oracle, scope/cursor separation, schema bounds, duplicate registration, denied/revoked grants and one-share/two-read persistent-budget race |
| `npm run typecheck` |passed, including route generation |
| `npm run lint` |exit0,48warnings and20infos, zero errors |
| `npm run build -- --webpack` |passed |
| `npm run test:http` |47/47, zero fail/skip/cancel,18202ms; isolated production servers and local HTTPS/SDK/stdio fixture |
| `node scripts/test-maintenance-browser.mjs` |five states at320/360/390/768/1280; actual SDK maintenance registration, duplicate join, shared loop/tool results, web review, keyboard rejection and reload; zero axe violations, overflow, page errors and external browser requests in measured states |

Browser artifacts: `.local/continuation-20261028/candidate-rollback-r4/.artifacts/maintenance/2026-10-28T10-35-47.476Z/`. The360/1280 screenshots were inspected. The browser's model transport and historical/provider fixtures are synthetic; its two model requests are not real-model requests. The first browser attempt incorrectly accessed private usage through the public AgentView and failed before reviewing the UI. The corrected harness checks usage in the disposable Store; no public API field was added. Runtime source was unchanged between those browser attempts. No fresh full aggregate browser or Docker execution is claimed for this slice.

## Real model boundary

The installed configuration was read without printing credentials: `gpt-6-luna`, `reasoning_effort=none`, output limit1024. The model test uses the normal `GoalModelClient`, `driveAgentRun`, tool registry, Store and rollback/publication application path. Its source, Liara reads, historical publication and provider writes are disposable synthetic fixtures. No human approval for live publication was created and no real cloud write occurred.

The pre-existing local financial partition was read and consumed through `openModelBudget`; neither the two-dollar allowance nor prior reserves were changed. The separately reserved hosted partition was preserved. Prices/account balance and this conservative model ceiling are not invoices.

The final real-model probe was on r3, source/package SHA256 `355c20028f70bfa0a1feb3257c29a469527bcfeff722fcc6930f1c4767643cd4`: two requests,8098reported tokens,8641ms, three counted tool operations, `read_publications` followed by `propose_rollback`, exact historical archive and `awaiting_approval`. Its conservative receipt ceiling was$0.008159. It then rejected the exact decision without sending publication. The later r4 changes accept multiline maintenance goals through the same text parser as web and add a paused-maintenance budget regression; this real-model probe is not relabelled as an r4 run.

Across all three real-model probes in this work, six requests reported24286tokens and consumed a conservative$0.024462 from the existing local partition. Remaining local ceiling was$0.197272; allowance$2 and prior reserves$0.887866 stayed unchanged. The original failed harness cleanup remains recorded separately: two real model requests reached `awaiting_approval`, then `cancelAgentRun` correctly rejected cancellation of a pending decision. The test fixture closed in `finally`. The corrected harness rejects the exact decision through `decideAgentPublication`; it does not broaden cancellation or retry a cloud write.

## Failures retained

- The first full domain run was746/747. A no-destination network test retained its sixteen-tool limit and rejected the extra, inapplicable history definition. History/rollback are now offered only with a selected target; the oracle and count limit were preserved.
- Candidate r2 passed747/747 domain. Its first build then caught insufficient TypeScript narrowing in the new test before reading `artifactHash`; the assertions now narrow through `isWorkloadDeploymentSpec`. This build is a failure, not a production artifact.
- A snapshot copy command initially used a repository-relative destination from the snapshot working directory. It failed before overwriting anything; the harness copy was repeated using absolute paths. It is not a failed project assertion.

## Still open and next executable boundaries

- Managed DB provisioning, encrypted credential binding, migrations, connectivity and persistence remain AC34 work. A fresh read-only `/v1/me` on2026-10-28 revalidated the previously evidenced account/team and reported nine database engine families, including PostgreSQL18.4/17.10/16.14/15.18/14.23/13.23. That catalog is not a provision or data-plane receipt.
- The public host `launchlane-live-1023.liara.run` returned503 for `/`, `/api/health` and `/api/workspace` at10:19:54–10:19:58UTC on2026-10-28. No deployment, restart or public-state change was performed. Local acceptance does not repair or verify that release.
- Fullstack/Worker rollback, schema/data/config compatibility, automatic regression-triggered rollback, browser-route workloads and a fresh live Liara rollback remain unverified/unimplemented as applicable. Current configuration and resources continue; the historical artifact is not a database backup.
- Maintenance still initially validates a selected mutable source before starting the model. Recovery when that original folder is changed/unavailable is the next specific boundary; source reads/build/repair must retain their own source validation when that startup dependency is removed.

The graph generation was2026-10-21, with new paths `not_tracked`. Discovery and coverage were requested first; current source/imports/tests supplied the material evidence. Graph absence was not treated as capability absence.
