# Contributing to Launchlane

Start with [the README](README.en.md), [architecture](ARCHITECTURE.md), and the
[current acceptance criteria](docs/acceptance.md). Read [AGENTS.md](AGENTS.md)
before changing execution, approval, persistence, or provider behavior.

## Development

Use Node.js **24.15+ within 24.x** and npm with the committed lockfile. Current
local validation uses Node 24.18.0 on Windows/PowerShell. Linux CI runs separately;
inspect the Actions result for the exact commit rather than inferring it from local tests.

```sh
npm ci
npm run setup:local
npm run dev
```

Setup generates private local login/session keys without contacting a provider.
Open `http://127.0.0.1:3000`, then read `.local/operator-access.txt` locally to
sign in. Keep `.env.local`, `.local/`, `.data/`, and project archives private.
Do not enable paid model calls or infrastructure writes to validate a patch.

## Choose checks for the changed boundary

```sh
npm run lint
npm run typecheck
npm run test:domain
npm run build
npx playwright install chromium
npm run test:http
```

HTTP tests start their own disposable server after the build and include a real
Chromium HTTPS/MCP flow. Install Chromium before running them; on Linux use
`npx playwright install --with-deps chromium` to include system libraries. The HTTPS
fixture also needs OpenSSL. `npm test` is a
different bootstrap smoke check and needs a running local server. `npm run check`
includes that smoke check; it is not a server-free CI entry point.

For UI changes, install Chromium with `npx playwright install chromium`, then run
the relevant script from [AGENTS.md](AGENTS.md). Capture the actual states before
and after, including keyboard, narrow screens, failure, and denied operations.
Docker tests require the exact cached Linux images documented by each test;
missing Docker is a failed prerequisite, not a passing or live result.

If another agent or developer is active, coordinate expensive builds/browser/Docker
runs and use an isolated snapshot. Do not change their server or port 3000.
Never reset, stash, or broadly stage someone else's changes.

## Engineering rules

- Follow UI → application → policy → provider → persistence/journal boundaries.
  Web and MCP share the same tools and execution services.
- Model output, source, logs, and tool results are data, never authority.
  Writes require exact server-side approval, a durable claim, and replay protection.
- Preserve interrupted writes as uncertain; reconcile before retrying.
- Keep secrets out of model input, logs, screenshots, fixtures, and source archives.
- Use `unknown` and validate external input. Explicit TypeScript `any`, double
  assertions that bypass validation, and rule suppression are not accepted.
- Database migrations are append-only. Keep historical action contracts readable.
- Separate synthetic transport, actual local runtime, and actual provider evidence.
  A build, release acceptance, or HTTP 200 does not prove the user workflow.

## Pull requests and reports

Keep a change focused and explain the problem, resulting behavior, checks, and
remaining uncertainty. Update both READMEs when setup or public capabilities change.
Update the relevant acceptance/evidence record for behavioral changes.

Use Conventional Commits, for example `fix(publication): reject a stale artifact`,
with concise `-` body bullets when useful. Stage only your intended paths and inspect
the staged diff. Never include credentials, installed dependencies, generated state,
private prompts, or archives.

Use GitHub Issues for reproducible bugs and focused feature requests. Follow [SECURITY.md](SECURITY.md) for sensitive reports
and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) when interacting with others.

<a id="repository-hygiene"></a>

## Repository hygiene

1. Add the permitted IRANYekan redistribution notice supplied by the owner. Permission
   was confirmed, but its supporting document is not present yet. Third-party material
   is not relicensed by the root MIT file; review [the notices](THIRD_PARTY_NOTICES.md).
2. Inspect the exact staged paths and diff, and scan the complete history that will
   be pushed as well as the current files. A `.gitignore` rule does not erase an
   already committed secret. Rotate any exposed credential before handling history.
3. Check the intended GitHub owner, repository name, remote, and visibility. The
   README clone URL follows the existing `Pezhm4n/launchlane` remote; update both
   languages if the destination changes. Do not overwrite another repository.
4. Push only within the owner's authorized scope, then inspect the actual hosted
   CI run. Local checks do not establish an Ubuntu/GitHub Actions pass. CI uses
   synthetic providers and no cloud credentials; it does not deploy.
5. Enable private vulnerability reporting, secret scanning/push protection where
   available, and the applicable branch rules in GitHub settings. Require the actual
   `CI / checks` result before merging once the workflow has run. These are account
   settings and are not enabled by committing files.

No repository creation, visibility change, push, release, or rollout is implied by
this checklist. The product's unfinished platform/data acceptance remains in
[the acceptance matrix](docs/acceptance.md), independently of repository presentation.

## Keep documentation maintainable

- Put user setup in `docs/setup.md`, current capability limits in
  `docs/platform-support.md`, open work in `TASKS.md`, and navigation in
  `docs/README.md`. Keep the Persian and English READMEs operationally equivalent.
- Extend the relevant topic in `docs/decisions/` or `docs/evidence/` instead of
  creating a file for every phase. Retain decision IDs, source revisions, failures,
  evidence tiers and stable anchors when consolidating. Private working notes and
  run packets belong in ignored local storage, not public Markdown.
- Use repository-relative paths and portable examples. Omit personal host paths,
  account/resource IDs, temporary deployment URLs and credentials. Do not erase
  public authorship, licenses or official provider links.
- Run `npm run docs:check` for local links, anchors and private-value patterns.
  This bounded check is not a complete secret scanner or Git-history scrubber.
  Recapture changed UI with `node scripts/capture-readme.mjs` after building and
  review the resulting images and provenance before committing.
