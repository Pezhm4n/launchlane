# Destination choice, assistant integration and stopped missions — 2026-10-23

The bounded implementation covers A05/AC20/AC23 and A08/AC24. It does not complete all-platform publication. [ADR0021](../decisions/0021-destination-choice-and-resume.md) records the policy and migration; the following candidate checks are distinct from provider evidence.

## Expected behavior, fixed before execution

- An empty connected account can review a destination and actual available plan prices inside Launchlane. App creation still requires the exact cost/scope decision.
- Changing the plan cancels old consent atomically, preserves the parent and consumes only the required catalog/network/absence reads. The same selection, refresh and opening/closing the assistant consume no model or infrastructure write.
- The assistant answers current price questions through the common catalog/quote application. Its explicit publication control displays the same live review panel. There is one mission and one copy of each decision card.
- A stopped mission resumes the same source, workload, allowance and usage after its owner exits. Uncertain provider/external execution blocks continuation. A competing run or decision remains blocked.
- Revoked programs retain their historical step/artifact receipts; a successor needs a new exact decision. Migration from populated v14 preserves bytes, hashes and foreign keys.

## Observed manual-work comparison

| Existing user task | Launchlane behavior in this slice | Automated part | Essential decision | Evidence boundary |
| --- | --- | --- | --- | --- |
| Select/create the PaaS app in the provider console | Empty-account destination proposal inside the publication flow | Account-scoped catalog/network reads, source-bound review and identity-bound create application | Destination name, actual price and cost permission | Creation has prior controlled live evidence; this candidate's changed selection is browser/contract evidence until its separate live receipt |
| Compare plan names and prices | Source summary, low-cost starting option and priced alternatives | Fresh available offers and exact hourly unit; unknown prices excluded | Select an offer; capacity remains unmeasured | Domain plus real browser against a synthetic catalog |
| Repeat the decision after changing a plan | Server revokes the old proposal and returns a fresh one | Transaction/CAS, quote/source binding and old-consent rejection | Approve the newly selected cost | Domain race and browser HTTP application path |
| Recreate work after pressing stop | Continue the same mission | Preserved ID/source/usage, revoked unattempted consent, journal checks | A fresh program decision when prior consent was revoked | Domain, including another pending owner and unknown external dispatch |
| Move between assistant and publication | The same panel moves between the two views | Same callbacks, action/run and persisted progress | Meaningful cost/program decisions only | Browser plan change in assistant, close, refresh and one-run assertion |

No time or click savings were measured. This table makes no numerical savings claim.

## Candidate and checks

Candidate15 is a frozen index export on base `086c5d1`, tree `1748e8eb2a007dcf1b110fbaeb80162356db6982`; 310 runtime/test/config files match digest `09fb5e59246cf00144fb71789650ebb235a17c278c29b0f5205623581eb7a214` after text line-ending normalization. Concurrent unstaged UI changes are excluded. Build, typecheck and lint passed, with 35 warnings/9 infos and zero lint errors.

The new plan browser runner passed 12 states at widths320/390/768/1280, with native radio keyboard selection, server-side replacement, an empty account, assistant/main shared view, refresh,200% text, zero axe violations in tested states, no page errors and no external browser requests. Model/provider writes were disabled; this is not live pricing or cloud execution. Baseline images were captured on candidate10 in a fresh browser profile. Candidate15 mobile and desktop images were inspected; real device/screen reader/user walkthrough remains unconfirmed.

Candidate15 additionally passed351 domain,38HTTP,54 guided browser states and4 related actual-container cases. Candidate14 independently passed351 domain and38HTTP tests. Its first assistant layout passed axe/overflow but failed visual inspection; its guided suite also caught optional chat overlapping secure environment entry. The layout/host geometry and secure-entry block were fixed before candidate15. Candidate12's guided process ended with Windows status `-1073741819` and no output; its cause is unknown. These results are not merged into a fresh candidate15 full pass.

Candidate16 added the authoritative current decision state after historical model messages and the explicit cancellation receipt. It passed351 domain/38HTTP/12 plan browser states and the real Codex-to-Liara cycle in [the live report](codex-product-publication.md). Its guided suite failed before the missing-account oracle: the synthetic model hook assumed the last protocol message must be user/tool and tried to decode the new system message as a tool result. The hook now selects the last non-system conversation message; the original missing-account, secret-entry, cancellation and workload assertions are unchanged.

Final regression candidate17, tree `539a91ac44b9934cc328dbbd0d9d1d5762d4087e`, contains that fixture correction and identical application source to live candidate16. Its310 runtime/test/config files match digest `68cb4787fdae81228d0eaebf02f2b922c0e48b82369c0ad48fb74dafcd54a0ed`. A fresh build/typecheck/lint,351 domain,38HTTP,12 plan browser states,54 guided states and4 related actual-container cases all passed on this export. Container cases cover ineffective-patch rejection, a raw dependency-free build, pre-dispatch fallback and lost external response without parallel internal work. Patch model/cloud transports in these four tests are synthetic. The broader browser aggregate is recorded separately after completion; these counts are not an all-runtime full pass.

The candidate17 aggregate `test:browser` passed the workbench75, deployment27, restart27, domain22 and guided54-state suites, then failed starting the destination suite's isolated production server: `ECONNREFUSED`, empty captured server output. Its cause is unconfirmed. A separate destination rerun passed5 states; that rerun does not turn the aggregate into a full pass. No test deadline or concurrency was changed to label the cause fixed.

The subsequent studio check found a real regression at200% text: verbose new mode buttons consumed reading space. Short visible labels with full accessible names fixed it on candidate18, which passed43 studio and12 plan states. Its independent chat audit then measured396.1px of reading space in a619px panel at width768, below the existing65% reading-area criterion. The new shell gap was reduced from the existing spacing3 token to spacing1 to remove that overhead. The criterion and assertions were retained.

Candidate19 is **invalid as feature acceptance**. Concurrent UI commit `6083088` changed the shared index during snapshot preparation; the candidate lacked the new plan runner and package command, despite its unrelated studio/chat checks passing. Its outputs are retained but do not verify the new controls. Subsequent exports use a separately captured immutable tree/private index, and validate both file membership and bytes against that tree. The committed UI work is preserved in the next combined candidate; it is not staged or claimed as this feature's work.

The valid combined candidate20 passed351domain/38HTTP and13chat states, but initially failed studio contrast. A diagnostic studio rerun passed43states; the separate plans audit reproduced an empty-account contrast failure (axe measured2.33:1). Candidate21 removed reduced-motion dialog fades, then exposed the same issue after moving publication back into the main panel: its reduced-motion panel entrance still faded text. Reduced-motion dialogs, backdrops and panel entrances now settle immediately; normal-motion interactions are preserved. This explains the observed animation-related failures; the earlier isolated-server/timeouts remain separately unconfirmed.

Candidate22 is a new immutable-tree export on `6083088`, tree `fdbdef9e7d3248d2d137225bea6ebb4402635e76`,312runtime/test/config files, normalized digest `7df371d8e94f337af994dc17a42cb564eb939f18ea4ca5246345ec67794e8734`, zero mismatches. Its fresh production build and12plan/43studio/13chat states passed. These counts are candidate-specific; candidate20 domain/HTTP results are not relabeled as a fresh candidate22 full pass. No provider/model live request was added by these regressions.

## Preserved failures

Candidate11 first failed one of349 domain tests because the SSR test loader could not load a nested TSX/CSS-module import. The loader now recursively transpiles the trusted component imports and maps actual CSS class names; the original Node/Python render assertions were retained. Candidate13 lint caught a non-semantic group element; it was corrected before candidate14. Neither failure was hidden by changing an application oracle.

The original live product attempt on candidate10 consumed5 model calls/23040 tokens, proposed executable build before destination and stopped before consent, Codex execution or a cloud write. The source/run remain intact. The first continuation on candidate12 failed `AGENT_BUSY` before another model or cloud request: the idle check treated the same paused owner as a competing mission. The regression reproduces the five-call/23040-token owner, confirms another pending decision still blocks, and then resumes that exact owner without renewing its allowance. This was corrected on candidate14/15. A new run is not the recovery mechanism.
