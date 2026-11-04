# Account settings as a page — 2026-11-04

## Problem, implementation and user path

The account settings dialog constrained Liara destination controls, GitHub and coding
tool access to one scrolling overlay. It could not be addressed directly, survived
neither a reload nor browser history as settings, and hid browser sign-out on desktop.

The header's «حساب‌ها» now opens `?view=accounts`. This is a normal document page with
an h1, section navigation, a wider primary account area and separate GitHub, coding
tool and session sections. The existing tokens, fonts, glyphs and two task tabs are
retained. Mobile uses wrapped navigation and document scrolling; desktop gives the
section navigation its own column. Obsolete modal-only account CSS was removed.

`from=incident` retains the investigation destination; other/missing return values
resolve to publication. The existing validated project ID is retained. Reload and
authentication preserve the settings URL; Back/Forward restore the appropriate
view without starting an agent or deployment. The publication/investigation views
remain mounted, preserving their form state. The active account header control is
announced and the task-tab indicator is hidden while neither task is selected.

«بازگشت به فضای پروژه» returns to the previous task and the initiating control.
Escape does not dismiss the page. GitHub and MCP retain their scoped child flows;
closing them returns focus to the page's trigger. Cancelling sign-out preserves
the page, session and focus. Choosing a GitHub project returns to publication.

`ConnectionDialog` becomes `ConnectionPage`; existing connection actions, encrypted
credentials, account/team scope, CSRF and APIs are reused. No provider, policy,
persistence, grant engine, dependency or infrastructure authority is added.
An existing read-failure bug is also fixed: failed metadata no longer leaves an
endless loading message. A single in-flight read supports retry, ignores aborted
results and is cancelled when leaving the page. Auth expiry returns to sign-in.

## Exact candidate and validation

Frozen product candidate: `199cd76e0f08a869e57be9f4247ebbe85da76aaf` plus fifteen owned
source/test paths, Node24.18.0, the pinned lockfile and installed Chromium.
The committed schema-baseline slice is retained; runtime-component branch changes
are not part of this candidate. Final unified-tree acceptance is a separate gate.
Build/typecheck used r4; r5 changed only the workbench browser synchronization harness, with identical product source.
Only disposable build caching was disabled in the candidate; product Next config
was unchanged. No `.env`, private state, credentials or model allowance was copied.

| Check | Result |
| --- | --- |
| `npm run build -- --webpack` | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed; 0 errors, 46 warnings, 22 infos |
| Targeted domain | 14/14 passed |
| Accounts page browser | 13 states passed; no page errors/external requests |
| Responsive browser | 47 states passed; no recorded failures |
| MCP settings browser | 24 states passed; no page errors/external requests |
| Workbench browser | 75 states passed; no browser errors/external requests |
| Domain guide browser | 22 states passed; no browser errors/external requests |
| Active guided publication browser | 57 states passed; synthetic model, zero cloud writes |
| Destination plan browser | 14 states passed; zero provider writes/model calls |
| HTTP/HTTPS/stdio | 33/33 passed |
| Historical assistant-first browser | Failed before the changed account path; see boundary below |

Commands in the frozen candidate:

```text
node --test tests/domain/publication-mission.test.ts tests/domain/connections.test.ts tests/domain/mcp-setup-guide.test.ts
node scripts/test-accounts-page-browser.mjs
node scripts/test-responsive-browser.mjs
node scripts/test-mcp-settings-browser.mjs
node scripts/test-browser.mjs
node scripts/test-domain-browser.mjs
node scripts/test-guided-browser.mjs
node scripts/test-destination-plans-browser.mjs
node --test --test-concurrency=1 tests/http/api.test.mjs tests/http/mcp.test.mjs tests/http/mcp-hosted.test.mjs
```

The new accounts suite uses the actual built UI, session, source inspection, URL
and history. It covers direct URL through login, reload with the same project,
Back/Forward, Escape, child-flow cancellation/focus, loading, 503, 403, retry,
leaving during a pending read and 401. Layouts include 280/320/390/768/1280px,
200% text, short landscape and axe. Connection read failures are synthetic.
Existing suites retain original selection, site validation and grant assertions;
their account locators/navigation now assert a region and return action instead of
a modal and Escape. MCP grants/download/revocation and HTTP/stdio remain actual local
operations with synthetic model/provider transports. No real GitHub account login,
external host installation, model spending or cloud mutation is included.

## Retained failures and evidence

An initial C-drive snapshot with an I-drive dependency junction failed Webpack
resolution (`./I:/.../next/dist/client/next.js` and `app-next.js`). Windows PowerShell
initially truncated stderr at the first native error; a repeat exposed the complete
diagnostic. The frozen source was moved to I outside the product root. No product
resolver, dependency, oracle or timeout was altered. An initial lint error on an
effect-only retry counter was fixed by reusing one abortable metadata read callback.
The workbench browser also exposed an existing sample transition race: the previous
incident report remained visible while a new sample request was pending, so keyboard
Enter could be sent to a disabled latency button. The harness now waits for the new
incident ID and the same control's enabled state. Its original latency oracle, keyboard
interaction and deadlines remain intact; the complete75-state workbench rerun passed.

`node scripts/test-agent-browser.mjs` failed at its unchanged line127 before exercising
account settings: it expects the historical h1 «میز کار پروژه» and a default assistant
view, whereas the pre-task199cd76 WorkspaceIntro already renders the guided publication
hero. Only its account navigation locators were adapted; this slice does not restore
the old product or claim that historical suite passed. The active guided suite is
reported separately. These failed attempts are not included in passing totals.

Before: the clean disposable UI at390/1280 was captured before editing, using the
previous source-matched UI candidate. After: actual r4 screenshots/reports are under
`I:\Computer\dev\starcoach\.launchlane-accounts-page-20261104\candidate1\.artifacts`.
The ignored `.local/coordination/accounts-page-20261104/` packet holds manifests,
exact logs, failed-attempt notes and the integration handoff. Images/build/state
and private coordination are not committed.

## Integration boundary

The separate design kit self-test ran and exited1: only12/52 checks passed (23%).
Its own Playwright, fixture/hook and Windows command setup remain incomplete; this
is not a product score. Product Chromium/axe checks above actually ran.

The owner separately authorized coordination with the integration chat. It owns
the unified main/runtime merge and final root runtime activation. This slice does
not restart the old runtime-components task or move env/state. At this commit, root
runtime activation is owned by that integration and is not claimed by the isolated
UI checks. The handoff includes the exact SHA, commands and retained failures.
