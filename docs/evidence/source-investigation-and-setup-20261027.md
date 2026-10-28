# Source investigation, failed-build guidance and secure setup — 2026-10-27

Scope: A02/A03/A07/A17 and AC18/22/24/25/32; bounded local acceptance. Technical reference provenance and coverage remain in the ignored operator-local review packet. No reference code or assets were copied and no dependency was added.

## Current source and ownership

The mission began on `main@017298e5675b8a0d1a3a95f8499f1ce4cb45bf8e` with a nonempty shared index. Another agent advanced HEAD to `f6ef04f178051d8e1e481994073bc7309f1812c0` and staged a subsequent preparation slice during this work. These changes were preserved. That reference-review run performed no staging, commit, push, checkout, production activation or live provider/model operation. The later owner-authorized commit audit is recorded separately below.

Graph discovery and coverage initially returned `Transport closed`; direct current source/import reads supplied the evidence. After transport recovery, generation `2026-10-21T19:24:24Z` still reported current Agent/UI/MCP files as not_tracked and redaction/read-contracts as metadata_changed. Current source remains authoritative. Earlier cumulative documentation is not treated as proof that a currently implemented path is absent. The previous duplicate-source context projection and expired-publication close control remain in use.

## 1. Read a relevant part of a large source file

Baseline: `read_project_file` rejected any file over20KiB even when inspection had accepted it in the immutable manifest. That could prevent investigating a large source file.

The same registry tool now accepts optional1-based `startLine` and `lineCount` (1–200, default80). Full reads keep their original four-field response and20KiB limit. A ranged read returns at most20KiB of complete UTF-8 lines, `totalLines`, `endLine`, `hasMore` and `nextStartLine`. An oversized individual line is rejected rather than silently clipped. Line numbers explicitly refer to **redacted text**, since redaction can remove embedded newlines.

Validation of bounds happens before source I/O or budget consumption. Manifest membership, actor/context, full captured source hash, UTF-8/binary checks and the existing read budget remain enforced. Redaction occurs before slicing so a secret spanning a boundary cannot leak in pieces. Ranged results carry extra metadata and cannot enter the existing strict duplicate-full-source projection. Unique chunks and tool-call/result pairs are preserved. The selected source is not proof of the bytes in a deployed release.

Use: the internal agent or an authorized MCP reader calls `read_project_file` with the same selected project and, for example, `{ "path": "server.mjs", "startLine": 201, "lineCount": 80 }`. No new tool, policy, execution engine or source mutation is introduced.

## 2. Explain recognizable failed-build evidence

Baseline: build logs and failed worker receipts were available, but the person had to interpret raw npm/Python/compiler output inside technical details.

A shared pure classifier now reports at most three signature observations and a bounded next check for missing start scripts, lock mismatch, dependency resolution, missing modules, Python distributions, TypeScript errors, registry rejection, incomplete offline cache and network failures. Both stdout and stderr entries can supply evidence. Provider results retain exact release/app fences, redaction, returned-window/omission metadata and untrusted-data status. Signals are derived only from returned entries; an omitted or out-of-window error cannot become a signal.

The guided publication repair card displays this guidance only for a failed job with a failed current receipt. It does not reuse a failed baseline when the later receipt passed. Successful, active, cancelled, interrupted and proposed jobs acquire no failure note. The note labels the cause unconfirmed and keeps the original receipt disclosure available. Shared `read_build_logs` exposes the same static guidance through Agent/MCP. No source repair, dependency change, oracle change or retry is authorized by a matching log string.

Use: after a failed build/test, open the existing publication card; the next check appears above the receipt details. For a cloud release, the existing agent/MCP `read_build_logs` result includes scoped observations and their limitation.

## 3. Explicit fresh signing values in the secure form

Baseline: people had to invent a value or use an external tool for a fresh application signing secret.

The existing secure environment form offers an explicit WebCrypto32-byte random value for a conservative allowlist of conventional signing/session names: `SESSION_SECRET`, `JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `COOKIE_SECRET`, `COOKIE_SIGNING_SECRET`. This is a user-selected convenience with conditional usage text, **not semantic detection that the program needs a generated secret**. External API credentials, database passwords, encryption keys, generic `SECRET_KEY`, runtime variables and public frontend names receive no generator.

Generation only fills an empty field. It does not replace a manual value, an imported available value or a value awaiting import review. The form warns that replacing an existing signing key can invalidate sessions/tokens; existing remote values are not fetched into the browser. Generated values start hidden and private, cannot be relabeled public while unchanged, and use no draft/localStorage cache. Reload clears unsent values. Unavailable WebCrypto shows an actionable failure and uses no weak fallback. Generation itself sends no request and creates no approval or write.

Use: publication → missing configuration → secure form → conditional “ساخت مقدار تصادفی” → “مرور تغییر اطلاعات برنامه” → the existing v9 review/approval. Reject/expiry/uncertain/readback retain their existing ownership. Configuration readback is not application health, and this mission does not accept live environment writes.

## 4. Known-secret encoding consistency

Baseline: raw, JSON-escaped and canonical URL-encoded installed values were scrubbed, while equivalent percent-escape casing and form encoding could escape both redaction and source rejection.

The existing redactor and unconditional known-value source check now share exact patterns for raw/JSON, `encodeURIComponent`, and `application/x-www-form-urlencoded` forms. Only hexadecimal characters in percent escapes are case-insensitive; raw values remain case-sensitive and literal plus/space semantics are preserved. Known values still take precedence over source-fixture, package, translation and Python syntax exceptions. No entire-output decoding, arbitrary Unicode normalization, raw case folding, base64 substring matching or broad short-value exemption was added. This is not a claim to detect every possible encoding or previously unknown secret.

The change is active at the existing provider-evidence, model-request and source/archive-intake boundaries. No new credential is read, stored or exposed.

## 5. Compare selected source with recorded publication provenance

Baseline: the release reader exposed the provider's current-release ID, while accepted publication records already retained actor/account/team/internal-app identity, source/archive hashes and the release receipt. The reader did not connect those facts, so a selected future source could be mistaken for the running release's source.

The same `read_releases` now adds a read-only comparison against one unambiguous accepted publication record. It uses the actual `currentRelease` field, never the newest READY release. Actor, account, team, public app name and internal app ID must match; the existing Store validates the action fingerprint, and the accepted source/release journal plus matching attempt receipt are required. Missing, corrupt, conflicting, foreign or unattributed records stay unknown. A saved failed workload may still have known publication provenance; this does not make its workload healthy.

The original three-provider-read budget and before/after app-identity fence are unchanged. There is no extra provider/model request, archive read, approval, mutation, migration or allowance. No selected source is required for a service-only investigation. Technical results carry source/archive identity; the correlated step shows a short host-authored Persian notice. Replay reads stored events without repeating investigation. A comparison is explicitly limited to an accepted **recorded source**, not proof of current runtime bytes, configuration or health. It neither selects an old artifact nor authorizes a rollback.

Use: when the agent investigates releases of the selected service, open the existing “مراحل بررسی” disclosure. It distinguishes matching recorded source, different recorded source, unattributed release and missing current-release identity. The same result is exposed through the shared MCP reader. Historical events without this optional notice remain readable.

## Validation and limits

Fresh final validation used frozen snapshot `r6`, base `1db39019174d8bd9bd5e83cc937cb79f869dd917`, manifest `f9ffb051c520ed8e30cd7fe5e0ed5121f5e5513cb383083e194de976b98447da`, Node24.18.0 and the existing pinned dependencies. Disposable SQLite/state, synthetic provider/model transports and isolated loopback ports were used. No credentials, `.env.local`, production database, budget ledger or active server were copied or modified. The earlier owner-authorized four-slice audit remains separate below.

| Actual command | Fresh r6 outcome |
|---|---|
| `npm run lint` | Exit0; zero errors,48warnings,20infos |
| `npm run typecheck` | Passed route generation and TypeScript |
| `npm run build -- --webpack` | Passed installed Next16.4.2 production build |
| `npm run test:domain` |726/726 passed;0fail/skip/cancel;229005.9982ms |
| `npm run test:http` |46/46 passed;0fail/skip/cancel;15892.5161ms |
| `node scripts/test-environment-guidance-browser.mjs` |7recorded states,280/360/768/1280 and200%text;0pageerrors/externalrequests/providerwrites |
| `git diff --check` | No whitespace errors; existing Windows line-ending notices only |

The browser used actual built components and authenticated proposal/rejection APIs; it exercised unavailable WebCrypto, keyboard generation/rejection, manual/imported-value preservation, private generated values, encrypted submission, reload clearing, failed-receipt guidance and a scoped recorded-source notice. An independent reader reviewed the fifth helper, callers and tests, matched13 current software files to r6 and found no blocking issue. Full aggregate browser suites, physical mobile keyboard, fresh live provider/model behavior and production rollout are not implied.

The earlier r5 full-domain attempt was interrupted without a final receipt and was not counted; a separate completed r5 run passed721/721 for the original four changes. The final five-change claim above is entirely the fresh r6 run. One r6 launcher started before the dependency junction finished and reported missing Biome; waiting for snapshot completion fixed orchestration without installing anything. No check from that failed launch is counted.

Earlier attempts are retained: a test initially expected recursively JSON-encoded values beyond the stated scope; the fixture was corrected to test the actual raw/one-level JSON/URL/form representations. The first no-emit check found an inferred nullable cursor type in a new test, corrected with an explicit type. Targeted lint caught an unsupported ARIA label on a generic element; the note now uses a named semantic section. A C-drive snapshot with an I-drive dependency junction failed module resolution before compilation; the same source was then built in a separate I-drive snapshot. None of these orchestration/test failures is counted as a product pass.

Unconfirmed boundaries: live model reasoning/monetary savings, actual Liara build-log variations beyond validated fixtures, live environment updates, actual runtime source-content identity, runtime browser workload execution, DNS/database provisioning/restore and complete platform acceptance. Recorded publication-source comparison is a narrower implemented boundary. Larger lifecycle proposals remain separate scoped work and do not weaken original workload or approval contracts.

## Owner-authorized commit verification — 2026-10-27

The owner requested topical Conventional Commits for the remaining changes, with existing and concurrent work preserved. The audit froze 38 changed files on base `1aca4ff7fa091b2bf7d86b46fc1f65b0d63338da` and validated a separate 595-file export using the existing pinned dependencies. Candidate fingerprint: `1a548f3bf3457bf964216d6500bade56dc1a45dd0e714ba80d0d7d775b91ecd9` (SHA-256 of the base revision and sorted changed-path/blob bindings). No credential, real SQLite state or budget ledger was exported. The source files were committed from those frozen Git blobs, so later working-tree edits would remain unstaged. Only these verification/task documents were updated after validation; runtime bytes did not change.

Fresh checks on that export:

- `npm run lint`: zero errors, 48 warnings and 20 informational diagnostics.
- `npm run typecheck`: passed.
- `npm run test:domain`: 721/721 passed, zero failures/skips (220,192 ms).
- `npm run build -- --webpack`: passed.
- `npm run test:http`: 46/46 passed, zero failures/skips (18,248 ms), including the actual local HTTPS/SDK/stdio/browser MCP fixture.
- `node scripts/test-environment-guidance-browser.mjs`: seven recorded responsive/enlarged-text/review/import states passed, zero page errors, external browser requests or provider writes. Keyboard generation/rejection, unavailable WebCrypto, manual/imported-value preservation, encrypted proposal and reload clearing were exercised.
- Staged diffs and file lists were checked before each commit; no ignored working packet, secret file, archive, generated output or dependency tree was staged.

These are local/synthetic-provider acceptance checks. No Docker image build, live model/provider operation, new allowance, deployment or production-state change was performed by this commit audit. Historical public-release and worker evidence retain their original dates and scopes. The full aggregate browser suite and fresh live deployment are not inferred from these checks.
