# Documentation

[فارسی](../README.md) · [English](../README.en.md)

Start with the README for a first local run. Most engineering documents are currently
in Persian; both READMEs contain the same setup and capability boundaries.

## Install and use

| Document | What it answers |
| --- | --- |
| [Setup](setup.md) | Local configuration, services, worker prerequisites, troubleshooting |
| [Hosted access](hosted-access.md) | HTTPS hosting and separate visitor identities |
| [MCP](mcp.md) | Host setup, scoped grants, tools, revocation, and limits |
| [Platform support](platform-support.md) | Detection, local execution, and provider evidence by family |
| [Repository publication](publishing.md) | Remaining owner/account steps before a public push |

## Understand and contribute

| Document | Purpose |
| --- | --- |
| [Contributing](../CONTRIBUTING.md) | Development workflow, checks, and review expectations |
| [Architecture](../ARCHITECTURE.md) | Application, policy, adapters, state, and execution boundaries |
| [Design](../DESIGN.md) | Product flows, tokens, responsive and interaction decisions |
| [Agent experience](agent-experience.md) | Goals, tool use, decisions, and recovery behavior |
| [Acceptance](acceptance.md) | Observable success criteria; not a list of completed claims |
| [API capabilities](api-capabilities.md) | Provider documentation versus implemented contracts |
| [Tasks](../TASKS.md) | Current engineering backlog and completed slices |

## Verify a claim

[Verification](verification.md) is the concise evidence entry point. Individual
reports in [evidence/](evidence/) identify the revision, inputs, checks, failures,
and local/synthetic/live boundaries. Historical runs remain available in
[the verification archive](archive/verification-20261029.md); their dates and counts
are not current test results.

[Architecture decisions](decisions/) record the reasoning behind implemented
contracts. [Deployment corpus](deployment-corpus.md) lists capability probes and
unresolved project needs, not a promise that every listed project deploys today.
