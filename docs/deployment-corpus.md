# Deployment capability corpus

## Product goal

The user clarified on 2026-10-26 that the supplied projects test Launchlane's ability to deploy complete applications. Finishing a set of manually operated deployments is not the product objective. A private controller, direct helper or a successful frontend is only evidence for the boundary it actually exercises.

The general product must derive a deployment plan from the source and actual provider capabilities: components, build and runtime environments, long-running processes, persistent resources, external services, private inputs, dependencies between steps, cost and verification criteria. The plan must use the shared application services and policy from the web experience and MCP. Project names must not select production behavior. New runtime/resource support belongs in reusable capabilities with independent positive and negative examples.

"Any project" is the extensibility objective, not a verified statement that arbitrary size, runtime or application behavior already works. Provider limits and bounded analysis/execution remain real constraints. A project exceeding a current bound needs the appropriate streaming, partitioning or execution capability; silently dropping components or removing limits is not acceptance. Source complexity alone does not measure production capacity. Plan recommendations distinguish source requirements, measured build/start behavior, current provider offers and unknown production load.

## Evidence ladder

1. Source evidence identifies the actual components, commands, runtime constraints, required inputs and data without executing uploaded scripts.
2. A source-bound plan covers every required runtime/resource and the order of build, configuration, migration, publication and observation. Unknown costs or unsupported capabilities remain explicit implementation gaps.
3. The product's own worker prepares a derived copy and executes the original meaningful build/tests plus independent criteria. It exports the exact successful artifact and records failures without weakening tests.
4. The web or MCP mission proposes and executes approved provider operations through the same registry, server policy and durable journals. Helper execution alone cannot pass this level.
5. Acceptance observes the current release, public origin, correct compiled assets, API and intended user/business path. Data-dependent applications additionally need the approved schema/data path and persistence after a real replacement/restart. Required queues, workers, schedules and external services remain part of the application.
6. Failure recovery uses actual evidence to choose investigation/repair and publishes the exact retested artifact under valid authority. Reconnect, cancellation and an uncertain write must never create an extra write or new allowance.

The corpus is an adversarial sample for this ladder. Passing one application does not close a runtime family or prove unbounded scale. Existing production deployments and original repositories are not mutated as part of compatibility testing.

## Current corpus boundaries

| Project/reference | Distinguishing capability | First unresolved product boundary |
| --- | --- | --- |
| Qadam | Vite SPA + Hono Worker + D1 SQL + private auth/sync/calendar | Exact build and isolated persistence passed; Agent storage path has synthetic evidence, while live storage/restart and the complete hosted mission remain unverified |
| Eyewear | Next frontend + FastAPI + PostgreSQL/Redis + Celery worker/beat | Complete multi-process/resource plan and execution; private source findings require proper handling |
| Foodino | Frontend + Supabase Auth/RLS/RPC | Preserve the actual external service contract and safe configuration; generic PostgreSQL is not an automatic replacement |
| Data Agent | Python pyproject/Docker + SQLite/DuckDB + reports and model service | Exact 19 test fixtures are owner-reviewed; after shared syntax corrections eight other source findings, locked preparation and the actual Python/Docker packaging path remain open |
| Factory feed | Vite/Nest + pnpm + PostgreSQL inventory ledger | Supported package-manager build, approved database/migration binding and original business invariants |
| Zarinpal challenge | Next application and runtime corpus | Exact native artifact publication has operator-controlled live evidence; this is not fresh acceptance of the complete hosted Agent path |
| Liara challenge | Next + model/Redis and runtime corpus | Complete dependent services, source intake and real application/Agent acceptance |
| Arvancloud challenge | WordPress/PHP + MariaDB + persistent uploads and schedules | PHP/WordPress build/start, approved resources and complete plugin/business path |
| Golestan compatibility reference | Vite/Node + PostgreSQL + external model | Controlled runner fixtures exist; actual full compiler/test/database path is not accepted. The existing production app and its data remain outside mutation scope |

These rows reconcile the eight explicitly listed candidate repositories with the separately supplied Golestan compatibility reference. Their actual source revisions, private findings and run receipts remain installation-local. The table is not a claim that all nine can currently be deployed by Launchlane.

## Active implementation order

Close a missing product boundary before adding another manually driven destination. First connect tested capabilities to native mission tools, review cards, cancellation/recovery and shared MCP execution. Then extend generic component/resource planning and runtime/dependency preparation against the next corpus gap. Each slice must include an unchanged failure case, independent meaningful behavior checks, exact artifacts and evidence at its measured level. A live test is scheduled only when the product path is ready and the concrete resource/cost decision is authorized.
