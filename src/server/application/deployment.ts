import type { Action, Session } from "../../contracts/domain.ts";
import {
  parseWorkloadExpectation,
  canReadDeploymentResult,
  isDeploymentSpec,
  type DeploymentSpec,
  type DeploymentObservation,
} from "../../contracts/deployment.ts";
import { identifier } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { AppError, ensure } from "../errors.ts";
import { LiaraReadClient } from "../liara/client.ts";
import { LiaraDeployClient, type DeploySpec } from "../liara/deploy.ts";
import { WorkloadProbe } from "../liara/probe.ts";
import type { Store } from "../persistence/store.ts";
import { RunBudget } from "../policy/budget.ts";
import { containsCredential } from "../policy/redaction.ts";
import { executeApproved } from "./execute.ts";
import { restoreProjectFlow } from "./project-flows.ts";

type Dependencies = {
  read?: LiaraReadClient;
  write?: LiaraDeployClient;
  probe?: WorkloadProbe;
};
function scopedConfig(config: Config, store: Store, actorId: string, app: string): Config {
  const scoped = connectedLiaraConfig(config, store, actorId, app);
  const origin = config.probeOrigins[app] || store.getProbeOrigin(actorId, scoped.teamId, app);
  return { ...scoped, probeOrigins: origin ? { [app]: origin } : {} };
}
function authorize(
  config: Config,
  store: Store,
  actorId: string,
  spec: DeploymentSpec,
  actionId?: string,
  requireActiveProject = true,
): void {
  const current = scopedConfig(config, store, actorId, spec.scope.app);
  ensure(
    current.enableLiveLiara && current.probeOrigins[spec.scope.app] === spec.workload.origin,
    "DEPLOYMENT_TARGET_CHANGED",
    "نشانی یا دسترسی برنامه تغییر کرده است؛ پیشنهاد تازه لازم است.",
    409,
  );
  if (requireActiveProject) store.assertProjectAction(actorId, spec, actionId);
  else
    ensure(
      store
        .getConnection(actorId, "liara")
        ?.view.apps.some((app) => app.name === spec.scope.app && app.id === spec.targetAppId),
      "SCOPE_DENIED",
      "هویت برنامه بررسی‌شده تغییر کرده است.",
      403,
    );
}
async function checkProject(
  client: LiaraReadClient,
  spec: DeploymentSpec,
  budget: RunBudget,
  signal: AbortSignal,
): Promise<void> {
  const project = await client.project(spec.scope, budget, signal);
  ensure(
    project.id === spec.targetAppId &&
      project.platform === "node" &&
      project.planId === spec.args.planId,
    "DEPLOYMENT_TARGET_CHANGED",
    "هویت برنامه، نوع اجرا یا پلن پس از پیشنهاد تغییر کرده است؛ تأیید تازه لازم است.",
    409,
  );
}

export async function proposeDeployment(
  config: Config,
  store: Store,
  actorId: string,
  input: {
    flowId: string;
    app: string;
    port: number | null;
    workload: unknown;
  },
  signal: AbortSignal,
  dependencies: Dependencies = {},
): Promise<Action> {
  ensure(
    config.enableMutations && config.enableLiveLiara,
    "MUTATIONS_DISABLED",
    "پیشنهاد اجرایی واقعی در این نصب فعال نیست.",
    403,
  );
  const scoped = scopedConfig(config, store, actorId, identifier(input.app));
  const workload = parseWorkloadExpectation(input.workload);
  ensure(
    workload.origin === scoped.probeOrigins[input.app],
    "PROBE_TARGET_DENIED",
    "نشانی بررسی باید قبلاً برای همین برنامه مجاز شده باشد.",
    403,
  );
  ensure(
    !containsCredential(JSON.stringify(workload), [
      scoped.liaraToken,
      scoped.modelKey,
      scoped.operatorToken,
      scoped.sessionSecret,
    ]),
    "SENSITIVE_INPUT",
    "معیار بررسی نباید حاوی اطلاعات محرمانه باشد.",
  );
  const flow = await restoreProjectFlow(scoped, store, actorId, signal, input.flowId);
  ensure(
    flow?.status === "ready" &&
      flow.artifact &&
      flow.profile.runtime === "node" &&
      flow.profile.start && flow.profile.nodeRuntime?.version,
    "PROJECT_INCOMPLETE",
    "ابتدا یک پروژه Node با دستور start مشخص آماده کنید.",
    409,
  );
  const client = dependencies.read ?? new LiaraReadClient(scoped),
    budget = new RunBudget(scoped);
  const project = await client.project({ teamId: scoped.teamId, app: input.app }, budget, signal);
  ensure(
    project.platform === "node" && project.planId,
    "DEPLOYMENT_UNSUPPORTED",
    "انتشار فقط روی برنامه Node موجود با پلن مشخص پشتیبانی می‌شود.",
    409,
  );
  const spec: DeploySpec = {
    version: 5,
    nodeVersion: flow.profile.nodeRuntime.version,
    operation: "deploy",
    scope: { teamId: scoped.teamId, app: input.app },
    sourceHash: flow.profile.sourceHash,
    artifactHash: flow.artifact.archiveHash,
    projectFlowId: flow.id,
    selectionHash: flow.selectionHash,
    targetAppId: project.id,
    workload,
    args: { port: input.port ?? flow.profile.port, planId: project.planId },
  };
  authorize(scoped, store, actorId, spec);
  ensure(!signal.aborted, "CANCELLED", "پیشنهاد متوقف شد.", 409);
  return store.createAction(actorId, spec);
}

export async function executeDeployment(
  config: Config,
  store: Store,
  session: Session,
  id: string,
  signal: AbortSignal,
  dependencies: Dependencies = {},
): Promise<Action> {
  ensure(
    config.enableMutations && config.enableLiveLiara,
    "MUTATIONS_DISABLED",
    "انتشار واقعی در این نصب غیرفعال است.",
    403,
  );
  const action = store.getAction(id, session.actorId);
  ensure(
    action.spec.version === 5,
    "DEPLOYMENT_PROPOSAL_REQUIRED",
    "این پیشنهاد قدیمی قابل انتشار نیست؛ پیشنهاد تازه با نسخه Node و معیار بررسی سایت بسازید.",
    409,
  );
  ensure(
    action.state === "approved" && !action.attemptId && action.expiresAt > Date.now(),
    "ACTION_CONFLICT",
    "این پیشنهاد مجوز اجرا ندارد یا قبلاً مصرف شده است.",
    409,
  );
  const spec = action.spec,
    scoped = scopedConfig(config, store, session.actorId, spec.scope.app);
  authorize(scoped, store, session.actorId, spec, id);
  const budget = new RunBudget(scoped),
    client = dependencies.read ?? new LiaraReadClient(scoped),
    writer = dependencies.write ?? new LiaraDeployClient(scoped);
  // Both writes and their preconditions must fit before consuming approval.
  ensure(
    budget.maxToolCalls - budget.toolCalls >= 4,
    "BUDGET_EXHAUSTED",
    "بودجه برای upload، release و بررسی پیش‌نیاز هر مرحله کافی نیست.",
    409,
  );
  return executeApproved({
    config: scoped,
    store,
    session,
    id,
    currentSpec: spec,
    signal: budget.signal(signal),
    adapter: {
      async preflight(bounded) {
        await checkProject(client, spec, budget, bounded);
        authorize(scoped, store, session.actorId, spec, id);
      },
      async execute(claimed, bounded, source) {
        ensure(source, "ARTIFACT_REQUIRED", "بسته تأییدشده در دسترس نیست.", 409);
        authorize(scoped, store, session.actorId, spec, id);
        store.deploymentStep(claimed.id, session.actorId, "upload_started");
        const sourceId = await writer.upload(spec, source, budget, bounded);
        store.deploymentStep(claimed.id, session.actorId, "uploaded", sourceId);
        await checkProject(client, spec, budget, bounded);
        authorize(scoped, store, session.actorId, spec, id);
        store.deploymentStep(claimed.id, session.actorId, "release_started", sourceId);
        return {
          remoteId: await writer.release(spec, sourceId, budget, bounded),
        };
      },
    },
  });
}

export async function observeDeployment(
  config: Config,
  store: Store,
  session: Session,
  id: string,
  signal: AbortSignal,
  dependencies: Dependencies = {},
): Promise<Action> {
  const action = store.getAction(id, session.actorId);
  ensure(
    isDeploymentSpec(action.spec) &&
      action.deployment &&
      canReadDeploymentResult(action),
    "ACTION_CONFLICT",
    "این انتشار منتظر بررسی نتیجه نیست.",
    409,
  );
  const spec = action.spec,
    scoped = scopedConfig(config, store, session.actorId, spec.scope.app);
  authorize(scoped, store, session.actorId, spec, id, false);
  const started = Date.now(),
    budget = new RunBudget(scoped),
    client = dependencies.read ?? new LiaraReadClient(scoped);
  let result: DeploymentObservation = {
    outcome: "inconclusive",
    code: "RELEASE_RECEIPT_MISSING",
    checkedAt: 0,
    releaseId: action.remoteId,
    releaseState: null,
    status: null,
  };
  try {
    if (
      !action.remoteId &&
      action.state === "uncertain" &&
      ["claimed", "upload_started", "uploaded"].includes(action.deployment.stage)
    ) {
      await checkProject(client, spec, budget, signal);
      // release_started is committed before the only release send. A stopped upload
      // may have left an orphan source, but cannot have started this app's release.
      result = { ...result, outcome: "not_started", code: "RELEASE_NOT_STARTED" };
    } else if (action.remoteId) {
      await checkProject(client, spec, budget, signal);
      const releases = await client.releases(spec.scope, 1, 50, budget, signal);
      const release = releases.releases.find((row) => row.id === action.remoteId);
      result = {
        ...result,
        releaseState: release?.state ?? null,
        code: "RELEASE_NOT_OBSERVED",
      };
      if (release && ["FAILED", "UNHEALTHY", "CANCELED", "TIMEDOUT"].includes(release.state))
        result = { ...result, outcome: "failed", code: "RELEASE_FAILED" };
      else if (release?.state !== "READY")
        result = { ...result, outcome: "pending", code: "RELEASE_PENDING" };
      else if (releases.currentRelease !== action.remoteId)
        result = { ...result, code: "RELEASE_NOT_CURRENT" };
      else {
        const probe = await (dependencies.probe ?? new WorkloadProbe(scoped)).check(
          spec.scope,
          spec.workload.path,
          budget,
          signal,
        );
        ensure(
          probe.scope.teamId === spec.scope.teamId &&
            probe.scope.app === spec.scope.app &&
            probe.origin === spec.workload.origin &&
            probe.path === spec.workload.path &&
            probe.observedAt >= started,
          "EVIDENCE_MISMATCH",
          "پاسخ متعلق به همین انتشار و مقصد نیست.",
          409,
        );
        let revision: unknown = null;
        try {
          const body: unknown = JSON.parse(probe.body);
          if (
            typeof body === "object" &&
            body !== null &&
            !Array.isArray(body) &&
            "revision" in body
          )
            revision = body.revision;
        } catch {
          /* A non-JSON response cannot prove the expected revision. */
        }
        result = {
          ...result,
          status: probe.status,
          outcome:
            probe.outcome === "response" &&
            probe.status === spec.workload.status &&
            revision === spec.workload.revision
              ? "verified"
              : "failed",
          code: "WORKLOAD_MISMATCH",
        };
        if (result.outcome === "verified") {
          // Fence the probe with fresh project/release reads. READY from an older release is insufficient.
          await checkProject(client, spec, budget, signal);
          const current = await client.releases(spec.scope, 1, 50, budget, signal);
          result =
            current.currentRelease === action.remoteId &&
            current.releases.some((row) => row.id === action.remoteId && row.state === "READY")
              ? { ...result, code: "WORKLOAD_VERIFIED" }
              : { ...result, outcome: "inconclusive", code: "RELEASE_CHANGED" };
        }
      }
    }
  } catch (error) {
    if (signal.aborted)
      throw new AppError("CANCELLED", "بررسی نتیجه لغو شد؛ ارسال دوباره انجام نشد.", 409);
    result = {
      ...result,
      outcome: "inconclusive",
      code: error instanceof AppError ? error.code : "OBSERVATION_UNAVAILABLE",
    };
  }
  authorize(scoped, store, session.actorId, spec, id, false);
  result = {
    ...result,
    checkedAt: Math.max(Date.now(), (action.deployment.observation?.checkedAt ?? 0) + 1),
  };
  return store.recordDeploymentObservation(id, session.actorId, result);
}
