# Local setup and configuration

[فارسی](../README.md) · [English](../README.en.md) · [Documentation](README.md)

## Private local installation

Use Node **24.15+ within 24.x** and npm with the committed lockfile. The currently
validated local host is Windows/PowerShell on Node24.18.0. From the repository root:

```sh
npm ci
npm run setup:local
npm run dev
```

Setup creates `.env.local` and `.local/operator-access.txt`, preserves existing
nonempty settings, and prints no token. Read the access file privately, then sign in
at `http://127.0.0.1:3000`. No Liara/model key is required to inspect a sample and
see disabled integration states. Do not copy another installation's secrets/state.

The interface is Persian with two main tabs: publication and site investigation.
Select a folder through the browser; original files are preserved. The server-local
workspace browser is a separate optional route. Imported configuration uses the
encrypted environment flow, never the source archive.

`Ctrl+C` stops a foreground server. Keep `.data/`, the session secret, and private
archives together when backing up an installation. Do not erase them to fix a
migration, approval, or schema error. SQLite is supported for a **single application
process**; do not run replicas against the same state.

## Production build on loopback

When no operation is running, stop the development server before using its port:

```sh
npm run build -- --webpack
npm start
```

Webpack is the explicitly validated build route for recent snapshots; `npm run build`
still invokes Next's default bundler. A build does not contact or validate a real
provider. Public hosting is separate: follow [hosted access](hosted-access.md),
configure the exact HTTPS origin and visitor auth mode, and validate the hosted
runtime/sandbox. Local operator setup is not public sign-up.

## Configuration

Setup writes minimum values rather than copying every optional key. Use
[.env.example](../.env.example) for the starting configuration and
`src/server/config.ts` for validation/defaults. Next loads `.env.local`; restart the
server after changes when no live operation is in progress.

| Key | Meaning |
| --- | --- |
| `LAUNCHLANE_ORIGIN` | Exact origin; default `http://127.0.0.1:3000`, no path/trailing slash |
| `LAUNCHLANE_AUTH_MODE` | `operator` by default; `liara` for explicit visitor identities |
| `LAUNCHLANE_OPERATOR_TOKEN` | Private local login token, at least 32 characters |
| `LAUNCHLANE_SESSION_SECRET` | Independent signing/encryption secret, at least 32 characters; preserve it |
| `LAUNCHLANE_STATE_DIR` | Private SQLite/archive directory; default `.data` |
| `LAUNCHLANE_WORKSPACE_ROOT` | Optional server-local allowed source root in operator mode |
| `LIARA_TEAM_ID`, `LAUNCHLANE_APP_ALLOWLIST` | Operator scope restrictions; visitors do not inherit them |
| `MODEL_API_KEY`, `MODEL_ID` | BoxAPI credential and explicitly permitted model; both default empty |
| `MODEL_REASONING_EFFORT` | Default `none`; compatibility must be checked for the selected model |

No secret may use `NEXT_PUBLIC_`. Model and provider endpoints are fixed to BoxAPI
and Liara. Select a currently permitted model and establish a bounded allowance
before a live run. Do not silently renew stored budgets or treat historical model
or pricing observations as today's availability.

All of these gates default to `false`:

- `LAUNCHLANE_ENABLE_LIVE_MODEL`: paid model requests; keys alone do not enable it.
- `LAUNCHLANE_ENABLE_LIVE_LIARA`: provider reads within the connected scope.
- `LAUNCHLANE_ENABLE_MUTATIONS`: approved infrastructure writes.
- `LAUNCHLANE_ENABLE_LOCAL_REPAIR`: scoped code repair with reviewed worker inputs.
- `LAUNCHLANE_ENABLE_DATABASE_DATA_READS`: independent bounded PostgreSQL reads.

Connect Liara through **حساب‌ها** (Accounts). Inventory/capabilities are validated
before proposals. A gate is never an approval: writes still need the exact
actor/account/team/app/arguments/artifact decision, durable claim, and journal.
A possibly accepted write must be reconciled before another write.

PostgreSQL reads also require `LAUNCHLANE_DATABASE_READ_NETWORKS`, a server-controlled
JSON array of exact `{accountId,teamId,networkId}` entries; it defaults empty.
IDs must be 24 lowercase hex characters. Configure only a verified private route.
A model-supplied URL, host, SQL, or credential cannot create read authority. See
[ADR0038](decisions/0038-independent-postgres-data-observation.md).

## Worker and GitHub prerequisites

Inspection never runs project scripts. Build/repair needs the applicable reviewed
worker, Docker Linux engine, exact prescribed image, and allowed dependency inputs.
Images are pinned in `src/contracts/`; arbitrary images are not silently pulled.
[AGENTS.md](../AGENTS.md) lists runtime commands/prerequisites. Docker/local proof
is not cloud acceptance.

On Windows x64, `npm run setup:github` installs the checksum-verified official
GitHub CLI into private local tools without altering global PATH or signing you in.
Account access uses explicit device grant and credential storage. An existing
operator CLI may be selected with `LAUNCHLANE_GITHUB_CLI_PATH`. See
[the account decision](decisions/0001-account-connections.md).

## Another local port

Set matching values in `.env.local`, for example
`LAUNCHLANE_ORIGIN=http://127.0.0.1:3100` and `PORT=3100`, then restart. Set
`TEST_BASE_URL=http://127.0.0.1:3100` for bootstrap smoke. Do not change another
developer's process or reuse their state. HTTP/browser suites allocate their own ports.

## Troubleshooting

| Symptom | Meaning and next action |
| --- | --- |
| Authentication is not configured | Run local setup and restart; keep both secrets private |
| Assistant is disabled | Check current model settings and allowance; do not enable paid calls just to dismiss the notice |
| Server/storage version changed | Stop only this installation when current work settles, then restart; do not delete SQLite |
| Incomplete or unsupported project | Inspect the missing runtime, dependency, component, or workload evidence; do not force a false successful release |
| Uncertain write | Inspect/reconcile the durable journal before a conflicting action; reload grants no retry authority |
| Docker/image/cache failed | Prepare the exact required inputs and rerun the bounded test; preserve the failure and its oracle |

See [contributing](../CONTRIBUTING.md), [verification](verification.md), and
[platform support](platform-support.md) for checks and current limits.
