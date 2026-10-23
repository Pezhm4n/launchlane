import type { Action, Session } from "../../contracts/domain.ts";
import {
  parseWorkloadExpectation,
  parseWorkloadContract,
  matchesWorkload,
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
import { currentEnvironment, environmentFingerprint, projectEnvironmentValues } from "../environment/secrets.ts";
import { LiaraEnvironmentClient } from "../liara/environment.ts";
import { parseNodeVersion } from "../../contracts/node-runtime.ts";
import { actionPlatform, profilePlatform } from "../../contracts/platform.ts";

type Dependencies = {
  read?: LiaraReadClient;
  write?: LiaraDeployClient;
  probe?: WorkloadProbe;
  budget?: RunBudget;
  environment?: LiaraEnvironmentClient;
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
  if (requireActiveProject) {
    store.assertProjectAction(actorId, spec, actionId);
    if (spec.version === 10 || (spec.version === 11 || spec.version === 17) && spec.environment !== null) projectEnvironmentValues(store, current.sessionSecret, actorId, spec.projectFlowId, spec.environment);
  }
  else
    ensure(
      store
        .getConnection(actorId, "liara")
        ?.view.apps.some((app) => app.name === spec.scope.app && app.id === spec.targetAppId),
      "SCOPE_DENIED",
      "هویت برنامه بررسی‌شده تغییر کرده است.",
      403,
    );
  ensure((spec.version !== 7 && spec.version !== 10 && spec.version !== 11 && spec.version !== 15 && spec.version !== 17) || store.getConnection(actorId, "liara")?.view.identityId === spec.accountId,
    "SCOPE_DENIED", "حساب انتشار تغییر کرده است.", 403);
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
      project.platform === actionPlatform(spec) &&
      project.planId === spec.args.planId,
    "DEPLOYMENT_TARGET_CHANGED",
    "هویت برنامه، نوع اجرا یا پلن پس از پیشنهاد تغییر کرده است؛ تأیید تازه لازم است.",
    409,
  );
}
async function checkEnvironment(config: Config, spec: DeploymentSpec, budget: RunBudget, signal: AbortSignal, client?: LiaraEnvironmentClient) {
  if (spec.version !== 10 && spec.version !== 11 && spec.version !== 17) return;
  const reference = spec.environment;
  if (reference === null) return;
  const current = await (client ?? new LiaraEnvironmentClient(config)).read(spec, budget, signal);
  ensure(current.planId === spec.args.planId && environmentFingerprint(config.sessionSecret, current.values) === reference.fingerprint,
    "ENV_REFERENCE_CHANGED", "اطلاعات مقصد با نسخه ساخته‌شده برابر نیست؛ انتشار یا سلامت تأیید نمی‌شود.", 409);
}

async function prepareDeployment(
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
  generic = false,
): Promise<Action> {
  ensure(
    config.enableMutations && config.enableLiveLiara,
    "MUTATIONS_DISABLED",
    "پیشنهاد اجرایی واقعی در این نصب فعال نیست.",
    403,
  );
  const scoped = scopedConfig(config, store, actorId, identifier(input.app));
  const workload = generic ? parseWorkloadContract(input.workload) : parseWorkloadExpectation(input.workload);
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
      ...scoped.projectSecretValues,
    ]),
    "SENSITIVE_INPUT",
    "معیار بررسی نباید حاوی اطلاعات محرمانه باشد.",
  );
  const flow = await restoreProjectFlow(scoped, store, actorId, signal, input.flowId);
  ensure(
    flow?.status === "ready" &&
      flow.artifact &&
      flow.profile.start && (flow.profile.runtime === "node" && flow.profile.nodeRuntime?.version || flow.profile.runtime === "python" && flow.profile.pythonRuntime || flow.profile.runtime === "static" && flow.profile.staticRuntime),
    "PROJECT_INCOMPLETE",
    "پروژه هنوز آمادهٔ انتشار نیست؛ نتیجهٔ بررسی فایل‌ها و روش اجرای آن را ببینید.",
    409,
  );
  const client = dependencies.read ?? new LiaraReadClient(scoped),
    budget = dependencies.budget ?? new RunBudget(scoped);
  const project = await client.project({ teamId: scoped.teamId, app: input.app }, budget, signal);
  ensure(
    project.platform === profilePlatform(flow.profile) && project.planId,
    "DEPLOYMENT_UNSUPPORTED",
    "نوع مقصد باید با runtime پروژه برابر و پلن آن مشخص باشد.",
    409,
  );
  const common = {
    operation: "deploy" as const,
    scope: { teamId: scoped.teamId, app: input.app },
    sourceHash: flow.profile.sourceHash,
    artifactHash: flow.artifact.archiveHash,
    projectFlowId: flow.id,
    selectionHash: flow.selectionHash,
    targetAppId: project.id,
    args: { port: input.port ?? flow.profile.port, planId: project.planId },
  };
  const connection = store.getConnection(actorId, "liara")?.view;
  ensure(connection?.status === "connected", "LIARA_AUTH_REQUIRED", "ابتدا حساب را متصل کنید.", 409);
  const environment = currentEnvironment(store, scoped.sessionSecret, actorId, flow.id);
  ensure(generic || !environment, "ENV_PUBLICATION_REQUIRED", "انتشار با اطلاعات امن از مسیر مرحله‌ای و تصمیم متصل به همان اطلاعات ادامه می‌یابد.", 409);
  const spec: DeploySpec = flow.profile.runtime === "static" && flow.profile.staticRuntime
    ? { ...common, version: 15, operation: "deploy", sourceHash: flow.profile.sourceHash, nodeVersion: null, runtime: flow.profile.staticRuntime, accountId: connection.identityId, workload: parseWorkloadContract(workload) }
    : flow.profile.nextRuntime ? { ...common, version: 17, operation: "deploy", sourceHash: flow.profile.sourceHash, nodeVersion: flow.profile.nextRuntime.version,
      runtime: flow.profile.nextRuntime, environment, accountId: connection.identityId, workload: parseWorkloadContract(workload) }
    : flow.profile.runtime === "python" && flow.profile.pythonRuntime
    ? { ...common, version: 11, operation: "deploy", nodeVersion: null, runtime: flow.profile.pythonRuntime, environment, accountId: connection.identityId, workload: parseWorkloadContract(workload) }
    : generic
    ? environment ? { ...common, nodeVersion: parseNodeVersion(flow.profile.nodeRuntime?.version), sourceHash: flow.profile.sourceHash, version: 10, operation: "deploy", accountId: connection.identityId, workload: parseWorkloadContract(workload), environment }
      : { ...common, nodeVersion: parseNodeVersion(flow.profile.nodeRuntime?.version), version: 7, accountId: connection.identityId, workload: parseWorkloadContract(workload) }
    : { ...common, nodeVersion: parseNodeVersion(flow.profile.nodeRuntime?.version), version: 5, workload: parseWorkloadExpectation(workload) };
  authorize(scoped, store, actorId, spec);
  await checkEnvironment(scoped, spec, budget, signal, dependencies.environment);
  ensure(!signal.aborted, "CANCELLED", "پیشنهاد متوقف شد.", 409);
  return store.createAction(actorId, spec);
}

export function proposeDeployment(...args: Parameters<typeof prepareDeployment>): Promise<Action> {
  return prepareDeployment(...args);
}
export function proposeWorkloadDeployment(
  config: Config, store: Store, actorId: string,
  input: Parameters<typeof prepareDeployment>[3], signal: AbortSignal, dependencies: Dependencies = {},
): Promise<Action> {
  return prepareDeployment(config, store, actorId, input, signal, dependencies, true);
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
    action.spec.version === 5 || (action.spec.version === 7 || action.spec.version === 10 || action.spec.version === 11 || action.spec.version === 15 || action.spec.version === 17),
    "DEPLOYMENT_PROPOSAL_REQUIRED",
    "این پیشنهاد قدیمی قابل انتشار نیست؛ پیشنهاد تازه با نسخه اجرا و معیار بررسی سایت بسازید.",
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
  const budget = dependencies.budget ?? new RunBudget(scoped),
    client = dependencies.read ?? new LiaraReadClient(scoped),
    writer = dependencies.write ?? new LiaraDeployClient(scoped);
  // Both writes and their preconditions must fit before consuming approval.
  ensure(
    budget.maxToolCalls - budget.toolCalls >= 4,
    "BUDGET_EXHAUSTED",
    "بودجه برای upload، release و بررسی پیش‌نیاز هر مرحله کافی نیست.",
    409,
  );
  try { return await executeApproved({
    config: scoped,
    store,
    session,
    id,
    currentSpec: spec,
    signal: budget.signal(signal),
    adapter: {
      async preflight(bounded) {
        await checkProject(client, spec, budget, bounded);
        await checkEnvironment(scoped, spec, budget, bounded, dependencies.environment);
        // Leave room for both writes and the second identity read, including its one connect retry.
        ensure(budget.maxToolCalls - budget.toolCalls >= ((spec.version === 10 || (spec.version === 11 || spec.version === 17) && spec.environment !== null) ? 6 : 4), "BUDGET_EXHAUSTED", "بودجه ادامه انتشار و بررسی مقصد کافی نیست.", 409);
        authorize(scoped, store, session.actorId, spec, id);
      },
      async execute(claimed, bounded, source) {
        ensure(source, "ARTIFACT_REQUIRED", "بسته تأییدشده در دسترس نیست.", 409);
        authorize(scoped, store, session.actorId, spec, id);
        store.deploymentStep(claimed.id, session.actorId, "upload_started");
        const sourceId = await writer.upload(spec, source, budget, bounded);
        store.deploymentStep(claimed.id, session.actorId, "uploaded", sourceId);
        await checkProject(client, spec, budget, bounded);
        await checkEnvironment(scoped, spec, budget, bounded, dependencies.environment);
        authorize(scoped, store, session.actorId, spec, id);
        store.deploymentStep(claimed.id, session.actorId, "release_started", sourceId);
        return {
          remoteId: await writer.release(spec, sourceId, budget, bounded),
        };
      },
    },
  }); } catch (error) {
    if ((spec.version === 10 || (spec.version === 11 || spec.version === 17) && spec.environment !== null) && error instanceof AppError && error.code === "ENV_REFERENCE_CHANGED")
      return store.invalidateEnvironmentPublication(id, session.actorId);
    throw error;
  }
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
    budget = dependencies.budget ?? new RunBudget(scoped),
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
      await checkEnvironment(scoped, spec, budget, signal, dependencies.environment);
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
          (spec.version === 7 || spec.version === 10 || spec.version === 11 || spec.version === 15 || spec.version === 17) ? 65536 : 4096,
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
            ((spec.version === 7 || spec.version === 10 || spec.version === 11 || spec.version === 15 || spec.version === 17)
              ? matchesWorkload(spec.workload, probe.status, probe.body)
              : revision === spec.workload.revision)
              ? "verified"
              : "failed",
          code: "WORKLOAD_MISMATCH",
        };
        // Provider current/READY can precede the public route switching from the old response.
        // Waiting never changes the approved assertion; a persistent mismatch still fails at the deadline.
        if (result.outcome === "failed" && (spec.version === 7 || spec.version === 10 || spec.version === 11 || spec.version === 15 || spec.version === 17) && probe.outcome === "response" &&
          action.deployment.releaseAcceptedAt !== undefined &&
          probe.observedAt >= action.deployment.releaseAcceptedAt &&
          probe.observedAt - action.deployment.releaseAcceptedAt < 300_000)
          result = { ...result, outcome: "pending", code: "WORKLOAD_STARTING" };
        if (result.outcome === "verified") {
          // Fence the probe with fresh project/release reads. READY from an older release is insufficient.
          await checkProject(client, spec, budget, signal);
          await checkEnvironment(scoped, spec, budget, signal, dependencies.environment);
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
