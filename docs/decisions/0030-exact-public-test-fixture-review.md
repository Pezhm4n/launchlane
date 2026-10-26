# ADR 0030 — Exact review of public test fixtures

Date: 2026-10-25. Status: implemented; used locally with explicit owner confirmation.

Some real projects contain intentionally public password/token examples in authentication tests. Inferring that all credentials in all test files are harmless would weaken the source boundary. Dropping or rewriting those tests would change the project being validated.

An operator can run `npm run review:source-fixtures -- --project <absolute-path> --file <test-path> ... --confirmed-public-test-fixtures` after explicit owner confirmation. The product records exact relative test paths and SHA-256 values with a seven-day maximum expiry. A domain-separated installation HMAC, bounded regular-file reads and atomic locked writes protect the private registry. Repeating an active identical review reuses it; recovery does not renew it.

Inspection retains the original bytes and records applied review IDs, hashes and expiry in the project profile and shared Agent/MCP inspection. A changed file, expired review, invalid signature or known installed/imported secret is not exempted. An inspector without an installation key has no review authority and uses ordinary strict scanning. The registry is operator configuration, never a model-supplied tool argument, cloud approval or budget allowance.

The registry lives under the configured private state directory as `source-fixture-reviews.json`. Do not commit it or copy its signature between installations with different keys. A public installation must validate a separately installed review with the same approved bytes and remaining expiry. See the evidence report for the three owner-confirmed Golestan files.
