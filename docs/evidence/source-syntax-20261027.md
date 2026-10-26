# Source intake syntax corrections, 2026-10-27

Acceptance boundaries: AC02 source intake, AC04 private data, AC19 evidence, and the corpus source-to-artifact boundary. This slice changes the shared scanner used by capture and archive. It does not exempt a project, run uploaded code or grant a publication/model/resource decision.

## Reproduced problem and change

Four fresh regressions initially failed: compound Python f-strings containing only runtime references, a Python comment referring to the Bearer header, exact omission markers in Markdown setup instructions, and actual DOM input reads through native document methods or one locally proven selector alias. Treating these expressions as embedded credential values prevented valid source intake.

The Python classifier accepts simple variable/member expressions with only separators or a Bearer/Basic prefix; quoted constants and nonempty static fragments stay scannable. The JavaScript syntax pass tracks bindings and writes before recognizing a narrow DOM input expression. Reassigned or shadowed aliases, imported/shadowed document objects, explicit method mutations and fallback constants remain blocked. Exact `...`, `sk-...`, `sk-or-...` and `sk-ant-...` are omission markers only in Markdown; they are not runtime credential defaults.

Installed/imported known-secret checks run before normalization, including JSON and URL-encoded variants. The ordinary log redactor is unchanged. Syntax classification never imports or executes the inspected project and does not rewrite the original bytes. An integration test captures and archives the original JavaScript/Python bytes, then requires both capture and archive to reject an adjacent literal credential. The first negative archive fixture omitted its required source hash and failed with `INVALID_INPUT`; it now supplies the valid earlier hash and preserves the `SENSITIVE_SOURCE` oracle.

## Owner-reviewed test fixtures and remaining boundary

The owner's confirmation was applied only to the same 19 hash-listed Data Agent test files through the product's installation-signed review command. Review `11ba3d69-7467-4eb7-a93a-61364b660bcb` expires at 2026-11-02 17:32:22.037 UTC. No review was installed for source or documentation, and recovery does not renew it.

A fresh actual Data Agent capture still fails closed with `SENSITIVE_SOURCE` at eight other paths. They include source, Markdown and a JSON verification result. The original repository is unchanged and no publishable archive was issued. The remaining candidates need their actual syntax/value semantics or a proper private preparation path; test-fixture confirmation cannot authorize them. No cloud resource, public deployment or model allowance was created.

## Checks and limits

`node --test tests/domain/source-runtime-references.test.ts tests/domain/source-placeholders.test.ts tests/domain/source-fixture-review.test.ts` passed 21/21 with zero skips. Scoped Biome lint passed with zero errors/warnings and one informational template-string suggestion. An attempted unsupported Biome command-line flag failed before lint; the actual `biome lint` command supplied this result.

The complete selected snapshot `ef0a665c0a0d9aa8c5a214511b586d3b4a87c7a7`, based on `dbbeadc`, then passed 697/697 domain tests in 201,278 ms and 40/40 HTTP tests in 7,069 ms, with zero skips. Type generation/checking and the production Webpack build passed. Source lint checked 444 files with zero errors, 48 warnings and 20 infos. The Git-blob export contained 575 tracked files, no private installation state and zero known-private-value matches; dependencies came from the existing pinned cache. Provider/model transports were synthetic. Only evidence/TASKS text changed after these checks; the runtime/test blobs did not. No UI changed in this slice, so earlier UI evidence keeps its recorded snapshot identity.

This is a bounded static classification improvement, not proof of absence of every possible semantic secret or support for arbitrary dynamic language syntax. Complete Data Agent intake, pyproject dependency preparation, Docker packaging, actual storage and application publication remain UNCONFIRMED. Source-to-plan-to-execution product work continues under [the corpus contract](../deployment-corpus.md).
