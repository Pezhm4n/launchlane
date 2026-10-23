# Executable Codex worker — bounded evidence, 2026-10-23

This is Launchlane → Codex execution, independently of Codex → Launchlane MCP. An actual external patch round trip passed real unchanged Node22 tests and continued the same bounded parent. Planning/publication transports were synthetic; this is **not** live external-agent publication or acceptance of a UI selector. A06/AC26 remains partial.

## Candidate, configuration and oracle

Base `195f7e4` plus the owned worker patch under development. Live probes preceded the final accounting changes; private runtime hashes and original outputs are retained under `.local/codex-executable/`. Do not present these as a live pass on a later frozen candidate.

Installed `codex-cli 0.163.0-alpha.11`, separate existing ChatGPT authentication, packet-only ephemeral execution, disabled device tools and no inherited model/cloud credentials. The restricted Windows sandbox probe failed before its canary because the elevated backend is unavailable. There was no escalation or host-shell fallback. See [ADR0020](../decisions/0020-codex-packet-worker.md).

The controlled invoice source had a quantity fault. The predeclared oracle required total73 and retained empty, zero-quantity and decimal cases. Only `invoice.mjs` was editable. The host reproduced the failure, sent the correlated source/base/failure packet, applied a replacement independently and ran unchanged tests/build/start/workload in the pinned Node22 container. Tests and original source were not overwritten.

## Observed executions, including failures

| Probe | Actual result | Subsequent action |
| --- | --- | --- |
| 01, `bfe3433b-434b-4c6a-9c18-b47a49b2d52a` | CLI closed; host rejected non-fatal ErrorItem. Usage not retained, remains unknown; no artifact/publication. Old driver consumed synthetic planning slots until budget stop. | Preserve unknown cost/failure; stop parent immediately on uncertain execution. Do not retry this job. |
| 02, `ba152b84-448a-4a58-8eff-e558a5d1c4d3` | Same decoder defect; completed metadata-only response,13317 tokens. Driver stopped without fallback/artifact. | Verify SDK semantics and fix decoder. Reconcile completed metadata/no device operation and unchanged workspace only. Job remains failed; lost patch is not accepted. |
| 03, `dac2d2ce-7a33-4d2d-8171-5a501776340c` | Actual patch,13351 tokens, only invoice.mjs changed, before failed/after passed, exact derived artifact selected. | Same parent/authority, remaining second repair slot; continuation and two publication writes used synthetic transport. No new program or budget. |

Parent02/03 `9b3f88cd-3a18-4729-9e9b-9d4f7a141610`; authority `187658b7-6cda-4b0e-aabf-3cedb5b97513`; successful job `1a2a02a1-fa53-4a56-86e2-c3b8a2b38902`.

Root `5d488e5af1f4bc6964450f7a9b8003d5502f186472e4c1a71d6c2d547c8cbfdd`; derived source `fd5c323de9ec0a6622894628094d85d10073412694f179962e25b03398e9dee9`; archive `90fec298e81d22af87ed1745fb351c7b916a3d39e935cbc8f2d9b9005cd86ed3`. No real app/release or cloud cleanup exists for this spike.

## Usage and recovery

Three actual Codex executions,26668 known tokens plus unknown probe01 usage. Subscription cost and underlying request/retry count remain unknown. No new BoxAPI calls/allowance were used. The earlier0.240970USD remainder is **BoxAPI-only**, not a balance including unpriced subscription use.

Accounting initially showed13617 parent tokens after03. Separate corrective receipts, preserving that failure, produce26968 tokens:26668 actual Codex plus300 synthetic planner tokens. Four version/auth reads were charged. Final same-parent usage:7 model slots,28 tools,26968 tokens, unknown0,69274ms. Seven slots are not seven actual HTTP model requests. Limits24/160/600000ms and authority are unchanged. The original session remained expired; a new fixture session permitted historical receipt settlement only. Replaying settlement added no usage/executions. Probe01's separate unknown cost remains unresolved.

Regressions cover operation denial, diagnostics, duplicate dispatch, credential isolation, usage reservations, rejected-result reconciliation, crash/uncertain blocking and exact-once accounting without renewed authority. Final candidate regression is recorded separately; it does not retroactively make these pre-final probes a fresh live candidate pass.

First remaining boundaries: product selection and versioned authority, permitted pre-dispatch fallback with a real job, persisted final-patch recovery, monetary handling of unpriced accounts, actual external-worker publication/cancellation/reconnect and independent Claude Code/OpenCode execution. MCP connectivity closes none of these boundaries.
