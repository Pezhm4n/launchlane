# Independent reference improvements — 2026-10-23

Scope: A02/A03/A17 and AC13/18/24/32, with partial acceptance. Two small changes were implemented in the existing Launchlane application. Publication, worker execution, authority, journal, persistence and resource contracts were not changed by this slice.

## Source and coordination

- Launchlane base: `main`, `1890c3ff8657750662ccb3a977911556dfff4e62`, with concurrent uncommitted work. This is a working-tree subset result, not a frozen candidate or a full aggregate pass.
- Reference: [liara-copilot](https://github.com/ssepehrnoush/liara-copilot/tree/828efd6d7b86c5509719a2faa659fc397053c501), reused clean clone at `.local/reference-review/liara-copilot`. `git ls-remote origin HEAD` returned the same revision. The older research clone was not used as current evidence.
- Two limited read-only reviewers examined product/UX and engine/integration source. Reference scripts, model and cloud operations were not executed.
- Graph generation `2026-10-21T19:24:24Z` was confirmed. Relevant current files were `not_tracked`; `.local` was excluded. Exact current source supplied the evidence instead of negative graph claims.
- The primary agent explicitly reserved the two shared-file hunks below. It retained staging and commit ownership during implementation, then delegated one exclusive Git window for these exact six paths after the owner's explicit commit request. Unrelated staged changes remain under its ownership. Main publication work, TASKS and aggregate verification remain with the primary agent. Browser timing and no-emit typecheck were coordinated; no branch/worktree/push operation was performed by this slice.
- The reference revision's MIT license was reviewed. No reference code or assets were copied; these are independent implementations of selected ideas.

## Decisions from the comparison

| Reference behavior and source | Launchlane comparison | Decision |
| --- | --- | --- |
| Grouped, correlated activity and failure expansion, `web/app.js:251–340` | Existing staged `AgentSteps` and summary regressions already cover this | Existing; no duplicate implementation |
| Plan price explanation and monthly projection, `src/tools/index.js:466–488` | Existing `DestinationPlans` derives 24-hour/30-day values from the quote and labels exclusions | Existing; no new calculator |
| Readable service errors and env discovery | Error taxonomy was committed in `53844bd`; current env discovery is staged in the primary agent's slice | Existing/in progress; preserve ownership |
| Request-only model projection, `src/agent.js:74–85`, and schema-aware `forModel`, `src/tools/index.js:317–336` | All persisted messages previously went unchanged into the 96KiB request boundary | Implement a conservative, lossless duplicate-source reference |
| Local recovery action on a blocked proposal, `web/app.js:489–495` | Expired publication had no close control and sent users to chat, although the server already accepted rejecting an expired proposal | Implement the missing control in the same publication card |
| Generic transport retry, `src/liara/client.js:74–104`; approval notification before execution, `src/agent.js:125–141` and `web/app.js:504–510` | Launchlane keeps write uncertainty and execution evidence separate | Reject these patterns |

## 1. Duplicate source content in the model view

Problem: `GoalModelClient` permits a maximum 96KiB request body and 80 messages, while a successful source read may approach 20KiB. Repeated reads across continuation can consume the body allowance even when the same source is already present. Arbitrary clipping or dropping old source would be unsafe: the run also rejects identical reads within a drive.

`src/server/agent/context-projection.ts` now creates a request-only view when serialized messages exceed 48KiB. It only replaces an old successful `read_project_file` body when a later, full paired result has exactly the same arguments and complete payload, including path, source hash and trust marker. The replacement explicitly points to that full result's tool-call ID. The latest four tool results remain complete.

Message count, order, IDs, assistant calls, user/system content and durable history remain unchanged. Unique source, unknown schemas, failures, logs, metrics, quotes, proposals, host receipts and the original workload/authority are not projection candidates. Protocol validation still runs first; redaction, the 96KiB limit, request reservation and all budget limits retain their existing positions and behavior. An irreducible oversized context still fails before a request or reservation.

The integration is one import and one call in `src/server/agent/model.ts`. It adds no provider requests, persistence schema or context engine.

Measured synthetic transport case: original serialized messages **102,502 bytes**; final outbound request **70,165 bytes**; existing limit **98,304 bytes**. One synthetic request and one reservation were recorded. This is a byte-size result, not a measurement of model quality, billed tokens or monetary savings.

## 2. Closing expired publication proposals

`src/components/AgentPublication.tsx` now shows **بستن پیشنهاد منقضی‌شده** only while the current run is awaiting a decision and its publication is expired. It calls the existing `onDecision("reject")`. Expired approval remains unavailable, pending decisions disable the button, and historical or uncertain cards do not acquire a new action. The expiry text refers to a fresh proposal instead of requiring chat.

Current backend source (`decideAgentPublication` and `Store.decide`) already accepts rejecting an expired proposal and atomically leaves the run in `needs_input`. No backend decision policy was changed. The browser harness exercises the actual React component and callback; the full authenticated API/replan round trip is not established by that harness.

## Validation actually executed

| Command / check | Observed result |
| --- | --- |
| `node --test tests/domain/context-projection.test.ts tests/domain/agent-publication-expiry-ui.test.ts` | 10 passed; zero failed/cancelled/skipped |
| `node --test --test-concurrency=1 tests/domain/agent.test.ts tests/domain/agent-conversation.test.ts tests/domain/agent-completion.test.ts` | 17 existing tests passed; zero failed/cancelled/skipped; synthetic model/provider |
| `node node_modules/@biomejs/biome/bin/biome lint src/server/agent/context-projection.ts src/server/agent/model.ts src/components/AgentPublication.tsx tests/domain/context-projection.test.ts tests/domain/agent-publication-expiry-ui.test.ts` | Five files checked; no fixes or diagnostics |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` | Exit 0; no type-generation/build step and no incremental state written |
| Isolated Chromium, before and after, 360×1000 and 1280×1000 | Actual component with local product CSS/fonts; no horizontal overflow, zero reported axe violations, zero page errors/external requests; Tab reaches disclosure then close, Enter calls only reject and displays cancelled status |
| Focused final diff review / `git diff --check` | Only the agreed shared-file hunks changed by this slice; no whitespace errors |

The transport regression first failed with `MODEL_INPUT_LIMIT` before the helper was connected and passed after the two-line integration. Two expiry SSR assertions first failed before the control existed. The first browser harness assertion incorrectly assumed close was the first tab stop; the existing native disclosure is first. The oracle was corrected to verify disclosure→close without changing product focus behavior.

Private before/after captures, harness, ownership agreement and handoff are under `.local/coordination/reference-review-2026-10-23/`; they are excluded from Git. No screenshots or private notes belong to this commit package.

## Limits and remaining acceptance

- No live model/cloud request, new allowance, credential, primary server, real SQLite or budget-ledger change was made for this slice.
- General long-context compaction is not implemented. Unique evidence and oversized prompts/tool definitions still meet the existing limit. The 80-message and durable history limits remain in force.
- Effect on real-model reasoning and monetary cost is UNCONFIRMED.
- Chromium covers the isolated actual component and keyboard callback; whole-page recovery, physical mobile keyboard and primary-server deployment remain UNCONFIRMED here.
- No new full build, HTTP boundary suite, full domain suite or aggregate pass is claimed. The primary agent owns frozen-candidate validation and activation.
