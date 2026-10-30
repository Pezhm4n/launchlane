# Security reporting

Launchlane can read private source and operate infrastructure. Test only resources,
accounts, and data you own or have explicit permission to use. Keep execution gates
off until the intended scope, cost, and server-side approval are established.

## Reporting a vulnerability

Do not post tokens, connection strings, private code, user data, or an exploitable
production reproduction in a public issue.

When GitHub private vulnerability reporting is enabled, use **Security → Report a
vulnerability** on this repository. If that option is unavailable, open a public
issue asking for a private reporting channel without including sensitive details.
No private email address or response-time commitment is currently published.

A useful private report includes the affected revision, prerequisites, minimal
reproduction, expected versus observed effect, and sanitized evidence. Do not run
paid calls, publish to Liara, mutate a database, or test another tenant to demonstrate
impact without the owner's specific permission.

## Maintenance and boundaries

The project is under active development with no supported stable release series yet.
Report against the current source revision; historical evidence is scoped to its
recorded configuration and is not a security guarantee for a later revision.

See [hosted access](docs/hosted-access.md) before exposing an installation publicly.
The default local setup is authenticated, single-process, and loopback-bound.
Do not use multiple application processes against the same SQLite state.

If a credential is exposed, revoke or rotate it at its issuer. Removing it from the
latest commit does not revoke it or remove earlier Git objects. Preserve deployment
and approval state while investigating interrupted operations.
