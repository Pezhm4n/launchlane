# Exact-artifact rollback through the shared Agent — 2026-10-28

## Workspace-independent maintenance and continuation

Follow-up on `69413935f8b50d6d92e3535c4a58b04dc66387da`: maintenance service reads and historical-archive rollback no longer depend on reopening the selected mutable folder at driver startup. Source/file/build/repair/publication applications still validate the actual selected source at their own boundary. A source tool's `PROJECT_CHANGED` becomes a correlated failed result for the maintenance model to reason about; `AGENT_CONTEXT_CHANGED`, cancellation, exhausted budget and denied scope remain fatal. Ordinary publication/question startup behavior is unchanged. Cached profile metadata is explicitly not fresh source evidence.

`launchlane_resume` now continues paused or process-interrupted maintenance through the same `continueAgentRun` used by web messages. It preserves run ID, limits, counters, remaining elapsed allowance and receipts; duplicate keys schedule once. A competing owner, stale context or exhausted budget cannot resume it. Process recovery still cancels unused publication approvals and retains uncertain effects; continuing never grants a new approval or repeats an accepted write. Pending decisions use their existing web decision controls, and terminal failed/cancelled maintenance is not silently reopened by this path.

Candidate `maintenance-r5`, Node24.18.0/npm11.16.0/Next16.4.2 with existing pinned dependencies, has runtime source/package SHA256 `ce61dadc8e20e8d728eafbfaa76de1970db4ebae93f557e2a2effaa5b8fda18a`. The initial targeted command `node --test tests/domain/agent-publication.test.ts tests/domain/mcp.test.ts tests/domain/agent-conversation.test.ts` passed25/25. It includes changed/missing source, source-read failure followed by exact archived publication with the unchanged oracle, target drift before model/write, restart continuation, duplicate resume, competing owners and exhaustion. The same r5 export subsequently passed751/751 domain, typecheck, lint (zero errors/48warnings/20infos), Webpack production build,47/47 HTTP and five missing-source browser review states. Browser artifacts are in `candidate-maintenance-r5/.artifacts/maintenance/2026-10-28T10-49-42.949Z/` under the private coordination directory. These r5 results are historical, not a fresh r6 pass.

The r5 real-model probe uses that exact runtime source and the active `gpt-6-luna/none`,1024 output tokens. It moved only its owned temporary fixture folder after seeding a synthetic successful historical publication. The goal loop selected `read_publications` then `propose_rollback`: two actual model requests,8323reported tokens,10367ms, three counted tools, exact archive and `awaiting_approval`; the decision was then rejected. The provider/history were synthetic, with zero real cloud writes. Conservative ceiling$0.008377; no allowance or reserve renewal. At r5, accumulated work was eight actual requests/32609reported tokens, ceiling$0.032839; local remaining ceiling$0.188895, allowance$2 and prior reserves$0.887866 unchanged. These are ledger ceilings, not provider invoice or BoxAPI account-balance verification.

Final candidate `maintenance-r6` adds a16KiB row budget to the twenty-record history page. The cursor is the last record actually returned; a byte-limited page never skips later records. A regression uses long UTF-8 criteria and checks full traversal with no missing/duplicate IDs and a bounded response. Final runtime source/package SHA256: `18e33b1751de7a14e136b2f841c9815a1ecfb262e8e65ce4e98c9560b2b0bb27` on the same base6941393 and pinned runtime/dependencies.

| Command on final r6 | Observed result |
| --- | --- |
| `npm run test:domain` |752/752, zero fail/skip/cancel,249832ms |
| `npm run typecheck` |route generation and tsc passed |
| `npm run lint` |exit0, zero errors,48warnings/20infos |
| `npm run build -- --webpack` |passed |
| `npm run test:http` |47/47, zero fail/skip/cancel,23197ms |
| `node scripts/test-maintenance-browser.mjs` |actual SDK→Agent→artifact decision→web keyboard rejection/reload in five widths320/360/390/768/1280, with the original disposable source folder moved; zero measured axe violations/overflow/page errors/external browser requests and zero cloud writes |

Final browser report/screenshots: `candidate-maintenance-r6/.artifacts/maintenance/2026-10-28T10-58-47.413Z/` under `.local/continuation-20261028`;360/1280 images inspected. All rows in this table belong to r6. The model/provider in these suites are synthetic; the actual-model probe is listed separately below. No new Docker worker execution or full aggregate browser run is inferred.

The exact-r6 real-model probe, again with its owned original fixture folder moved, selected history then rollback in two requests/8372reported tokens/9045ms and three tools. The exact archive reached `awaiting_approval` and was rejected with zero real cloud writes. Ceiling$0.008427. Accumulated across this work: ten actual requests/40981reported tokens, conservative ceiling$0.041266; local remaining ceiling$0.180468. Allowance$2 and prior reserves$0.887866 remain unchanged. The synthetic receipt is not proof of a current remote release, live rollback, data compatibility or general model quality across multiple candidate histories.

This supersedes the original-folder startup limitation recorded in the historical r4 section below. Managed DB provision/binding/migration, browser-route workloads, fullstack/data-safe rollback and a live provider rollback remain separate open boundaries.

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

Across the first slice's three real-model probes, six requests reported24286tokens and consumed a conservative$0.024462 from the existing local partition. At that point, remaining local ceiling was$0.197272; allowance$2 and prior reserves$0.887866 stayed unchanged. The original failed harness cleanup remains recorded separately: two real model requests reached `awaiting_approval`, then `cancelAgentRun` correctly rejected cancellation of a pending decision. The test fixture closed in `finally`. The corrected harness rejects the exact decision through `decideAgentPublication`; it does not broaden cancellation or retry a cloud write.

## Failures retained

- The first full domain run was746/747. A no-destination network test retained its sixteen-tool limit and rejected the extra, inapplicable history definition. History/rollback are now offered only with a selected target; the oracle and count limit were preserved.
- Candidate r2 passed747/747 domain. Its first build then caught insufficient TypeScript narrowing in the new test before reading `artifactHash`; the assertions now narrow through `isWorkloadDeploymentSpec`. This build is a failure, not a production artifact.
- A snapshot copy command initially used a repository-relative destination from the snapshot working directory. It failed before overwriting anything; the harness copy was repeated using absolute paths. It is not a failed project assertion.

## Still open and next executable boundaries

- Managed DB provisioning, encrypted credential binding, migrations, connectivity and persistence remain AC34 work. A fresh read-only `/v1/me` on2026-10-28 revalidated the previously evidenced account/team and reported nine database engine families, including PostgreSQL18.4/17.10/16.14/15.18/14.23/13.23. That catalog is not a provision or data-plane receipt.
- The public host `launchlane-live-1023.liara.run` returned503 for `/`, `/api/health` and `/api/workspace` at10:19:54–10:19:58UTC on2026-10-28, and again at10:59:34–10:59:38UTC. No deployment, restart or public-state change was performed. Local acceptance does not repair or verify that release.
- Fullstack/Worker rollback, schema/data/config compatibility, automatic regression-triggered rollback, browser-route workloads and a fresh live Liara rollback remain unverified/unimplemented as applicable. Current configuration and resources continue; the historical artifact is not a database backup.
- Maintenance still initially validates a selected mutable source before starting the model. Recovery when that original folder is changed/unavailable is the next specific boundary; source reads/build/repair must retain their own source validation when that startup dependency is removed.

The graph generation was2026-10-21, with new paths `not_tracked`. Discovery and coverage were requested first; current source/imports/tests supplied the material evidence. Graph absence was not treated as capability absence.
