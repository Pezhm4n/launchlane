# Documentation

[فارسی](../README.md) · [English](../README.en.md)

Start with the README to inspect a sample locally. Use the guides below for operation and engineering detail. The interface and much of the engineering documentation are Persian; the two READMEs share the same operational contract.

## Install and operate

| Guide | Reader question |
| --- | --- |
| [Setup](setup.md) | How do I install, sign in, enable services, change ports, and stop safely? |
| [Hosted access](hosted-access.md) | How are HTTPS, separate visitor identities, and persistent state configured? |
| [MCP](mcp.md) | How do I grant, configure, verify, and revoke coding-tool access? |
| [Platform support](platform-support.md) | Which source/runtime/artifact paths exist, and what remains unverified? |
| [Deployment corpus](deployment-corpus.md) | Which real-project gaps guide implementation? |

## Understand and contribute

| Reference | Purpose |
| --- | --- |
| [Architecture](../ARCHITECTURE.md) | UI/application/policy/provider/state boundaries |
| [Design](../DESIGN.md) | Current product flows, tokens, interaction and responsive behavior |
| [Agent experience](agent-experience.md) | Goals, decisions, tool use, progress and recovery |
| [Acceptance criteria](acceptance.md) | Observable success requirements, including full-project behavior |
| [API capabilities](api-capabilities.md) | Provider documentation versus implemented contracts |
| [Open work](../TASKS.md) | Current backlog and next unproven boundaries |
| [Contributing](../CONTRIBUTING.md) | Checks, review and repository hygiene |
| [Third-party notices](../THIRD_PARTY_NOTICES.md) | Fonts, marks, dependency and reference attribution |

## Decisions and evidence

The [verification index](verification.md) separates source inspection, synthetic transports, actual local execution and live provider evidence. Counts and dates belong to the exact recorded revision.

| Topic | Architecture decisions | Versioned evidence |
| --- | --- | --- |
| Agent and repair | [Agent contracts](decisions/agent.md) | [Agent runs and coding](evidence/agent.md) |
| Runtime and artifacts | [Build/runtime decisions](decisions/runtime.md) | [Runtime cases](evidence/runtime.md) |
| Accounts and MCP | [Access decisions](decisions/access.md) | [Access and hosting](evidence/access.md) |
| Data and runners | [Database decisions](decisions/database.md) | [Database evidence](evidence/database.md) |
| Publication and operations | [Operational decisions](decisions/operations.md) | [Publication and recovery](evidence/operations.md) |
| Interface | [Design](../DESIGN.md) | [UI evidence](evidence/interface.md) |
| Corpus and references | [Corpus contract](deployment-corpus.md) | [Project cases](evidence/corpus.md), [reference review](evidence/references.md) |

Original ADR identifiers remain section anchors within these topic references. The [historical verification archive](archive/verification-20261029.md) retains older receipts; it does not report current passing checks. [Image provenance](assets/readme/README.md) explains the actual README captures.

## Keep the documentation small

Extend the owning guide or topic section before adding another Markdown file. Put a new decision under a stable ADR identifier and record evidence with its revision, commands, oracle, failure and verification level. Keep host paths, private resource identities, raw logs and coordination notes outside tracked docs. Run `npm run docs:check` after moving or linking material; update both README editions when the public workflow changes.
