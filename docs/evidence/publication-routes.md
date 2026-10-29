# Publication-bound route observations — 2026-10-29

Path B, worktree runtime-components; preceding commit d312350cf355292485fb34774a598e71c799a092. Main checkout, production state and corpus projects are outside mutation scope. No real model consumption, infrastructure write or database SQL is authorized or performed by this slice.

The existing read_workload registry is extended with publicationActionId and checks. The application verifies accepted action/attempt/source/release correlation and the archived bytes before evaluating the unchanged primary criterion and explicit nested JSON API expectations. Existing origin/DNS/redirect/timeout/budget and asset behavior is reused. A host-owned notice is persisted through the existing AgentRun and rendered in its steps. It never changes a publication journal or creates an approval.

## Verification scope

Domain tests use the real Store/action/attempt transitions, archive reader, application, Agent transport and probe validators with controlled synthetic provider/model/DNS/TLS/workload ports. They cover original-page plus two nested JSON routes and an asset; wrong/missing values, logged-out state, redirect, HTML fallback, arrays, changed/unready/missing releases, app/account changes, altered archive/attempt, invalid/duplicate/oversized paths, private DNS, budget exhaustion, stale/future/foreign probe receipts and replay without authority renewal.

The browser harness uses disposable state and the actual application/Agent to produce and persist its observations. A real isolated production server serves authenticated HTTP/reload and the unchanged step UI. Provider, DNS/TLS, workload and model ports for those observations are synthetic; the server's live gates remain off. MCP SDK schema discovery and denial through its real HTTP facade are checked separately. Neither a synthetic provider port nor a real UI is public-runtime acceptance.

All heavy checks use the shared FileShare.None lock, independent ports and disposable state. No existing evidence is relabelled as live.

## Measured candidates and preserved failures

r2 runtime manifest56b2423de953f6ee06ffd8bf92355cc1eb386a88fa8f907342575ecc03a2a9d3 passed focused18/18, lint/typecheck/Webpack build, full domain800/800(260.477s), HTTP48/48(15.737s), guided54states and the real browser in15layouts. Its model/provider/workload ports are synthetic. The receipt is .artifacts/publication-routes/2026-10-29T07-20-02.725Z. This precedes the two review corrections below and is not relabelled as their final evidence.

1. A test expecting rejection of JSON value [REDACTED] failed with Missing expected rejection: a redacted secret could be mistaken for expected data. The new mode now rejects such expectations before any read, for additional API fields and stored JSON/text primary criteria. A response with unrelated redacted fields still passes its public assertions.
2. A data-context tool set omits read_publications. Its read_releases comparison originally exposed no accepted action ID, so a regression failed undefined versus the exact recorded ID. It now returns nullable recordedActionId after the existing unique scoped accepted-receipt correlation. The actual Agent/browser sequence consumes this returned ID in the next read_workload; it does not choose by project name or invent an action.

The private routes-review-before.log preserves both failing assertions (9/11), followed by positive and negative regression coverage. r3 runtime manifest e355426f702c64354cc50e7843eb436dc317da6002e07fed0f5f68a083715446 passes the focused25/25, lint0errors/48warnings/24infos, typecheck and Webpack build. The final full matrix on the identical runtime follows below. Its real browser sequence has three synthetic model turns per outcome (nine total),21 synthetic provider reads and9 probes; all15layouts passed, schema discovery and the live gate denial passed, reload made no reads. The test-server-only model/provider/workload ports remain synthetic; no live model cost or cloud writes occurred.

## Final isolated configuration

The final full matrix retains the exact r3 application/package manifest. Child TEMP/TMP is explicitly C:\Users\Ariike.ir\.codex\worktrees\runtime-components\launchlane\.local\rt, so even disposable state is under this managed checkout. Earlier independently cleaned system-temp receipts remain separately labelled above. Host Node24.18.0, pinned package lock and the existing image digests are unchanged. Ports are independently allocated; production/main/port3000 are untouched by this lane.

| Check | Final measured result |
| --- | --- |
| npm run lint; npm run typecheck; npm run build -- --webpack | exit0; lint48warnings/24infos, no errors |
| npm run test:domain | 803/803,269.455s, no skips |
| npm run test:http | 48/48,17.837s |
| node scripts/test-publication-routes-browser.mjs | 15layouts, direct persisted outcome/action/release/artifact assertions, nine synthetic model turns,21 synthetic provider reads,9 probes; no axe/overflow/browser/external errors; reload0reads; real MCP SDKschema/closed-gate denial |
| node scripts/test-pnpm-worker-browser.mjs | One real pinned worker from actual directory upload/mission/HTTP decision; five layouts, replay409/reload stable; two synthetic model turns, no artifact/cloud write |
| node scripts/test-pnpm-browser.mjs | Six widths and keyboard approve/reject, no axe/overflow/browser errors |
| node scripts/test-guided-browser.mjs | 54states in five widths, synthetic model, no cloud writes |
| node --test --test-concurrency=1 tests/sandbox/pnpm-workspace.test.ts tests/sandbox/native-build.test.ts tests/sandbox/fullstack-build.test.ts | 13/13 actual container cases,184.650s, no skips; original test/workload/release-age/skip/source-change failures retained |

Final route screenshots/receipt: .artifacts/publication-routes/2026-10-29T07-46-35.462Z. Pnpm worker receipt: .artifacts/pnpm-worker/2026-10-29T07-46-53.099Z. Review: .artifacts/pnpm-review/after-2026-10-29T07-47-30.043Z. Guided: .artifacts/guided-publication/2026-10-29T07-47-39.808Z. These private generated artifacts are ignored, not committed. The runtime/package manifest remained unchanged through all final checks.

## UNCONFIRMED

Current provider fixture/live availability, public routing lag, immutable public-release URLs, actual browser user journeys, authentication/session transitions, application data effects/persistence and background worker/scheduler behavior remain unconfirmed. Fences show identity at their observations, not an atomic remote snapshot or attested executable content. Runtime-specific compiled artifacts, pnpm component publication and the Factory feed raw intake remain the separate open boundaries recorded in [pnpm evidence](pnpm-workspaces.md).
