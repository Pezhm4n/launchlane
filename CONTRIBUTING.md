# Contributing to Launchlane

Start with [the README](README.en.md), [architecture](ARCHITECTURE.md), and the
[current acceptance criteria](docs/acceptance.md). Read [AGENTS.md](AGENTS.md)
before changing execution, approval, persistence, or provider behavior.

## Development

Use Node.js **24.15+ within 24.x** and npm with the committed lockfile. Current
local validation uses Node 24.18.0 on Windows/PowerShell. Linux CI is configured
separately; its first hosted result is pending until the workflow runs.

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
npm run build -- --webpack
npm run test:http
```

HTTP tests start their own disposable server after the build. `npm test` is a
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

Use GitHub Issues for reproducible bugs and focused feature requests after the
repository is published. Follow [SECURITY.md](SECURITY.md) for sensitive reports
and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) when interacting with others.
