import type { Action, Session } from "../../contracts/domain.ts";
import { parseWorkloadTarget } from "../../contracts/deployment.ts";
import {
  canReadRestartResult,
  type RestartObservation,
  type RestartSpec,
} from "../../contracts/restart.ts";
import type { Config } from "../config.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { AppError, ensure } from "../errors.ts";
import { LiaraReadClient } from "../liara/client.ts";
import { WorkloadProbe } from "../liara/probe.ts";
import { LiaraRestartClient } from "../liara/restart.ts";
import type { Store } from "../persistence/store.ts";
import { RunBudget } from "../policy/budget.ts";
import { containsCredential } from "../policy/redaction.ts";
import { restartEvidenceHash } from "../policy/restart.ts";
import { executeApproved } from "./execute.ts";

type Dependencies = { read?: LiaraReadClient; write?: LiaraRestartClient; probe?: WorkloadProbe };
function scopedConfig(config: Config, store: Store, actorId: string, app: string): Config {
  const scoped = connectedLiaraConfig(config, store, actorId, app);
  const origin = config.probeOrigins[app] || store.getProbeOrigin(actorId, scoped.teamId, app);
  return { ...scoped, probeOrigins: origin ? { [app]: origin } : {} };
}
export function validateRestartAction(
  config: Config,
  store: Store,
  actorId: string,
  spec: RestartSpec,
  requireEvidence = true,
): Config {
  const scoped = scopedConfig(config, store, actorId, spec.scope.app);
  ensure(
    scoped.probeOrigins[spec.scope.app] === spec.target.origin,
    "RESTART_TARGET_CHANGED",
    "نشانی یا دسترسی برنامه تغییر کرده است؛ پیشنهاد تازه لازم است.",
    409,
  );
  store.assertRestartAction(actorId, spec, requireEvidence);
  return scoped;
}
async function readTarget(
  client: LiaraReadClient,
  spec: RestartSpec,
  budget: RunBudget,
  signal: AbortSignal,
): Promise<string> {
  const project = await client.project(spec.scope, budget, signal);
  ensure(
    project.id === spec.targetAppId &&
      project.platform === "node" &&
      project.planId === spec.targetPlanId,
    "RESTART_TARGET_CHANGED",
    "هویت برنامه، نوع اجرا یا پلن تغییر کرده است؛ پیشنهاد تازه لازم است.",
    409,
  );
  const releases = await client.releases(spec.scope, 1, 50, budget, signal);
  ensure(
    releases.currentRelease &&
      releases.releases.some(
        (release) => release.id === releases.currentRelease && release.state === "READY",
      ),
    "RESTART_RELEASE_UNAVAILABLE",
    "نسخه فعلی آماده مشاهده نیست. وضعیت انتشار را در لیارا بررسی کنید.",
    409,
  );
  return releases.currentRelease;
}

export async function proposeRestart(
  config: Config,
  store: Store,
  actorId: string,
  incidentRunId: string,
  signal: AbortSignal,
  deps: Dependencies = {},
): Promise<Action> {
  ensure(
    config.enableMutations && config.enableLiveLiara,
    "MUTATIONS_DISABLED",
    "راه‌اندازی دوباره واقعی در این نصب غیرفعال است.",
    403,
  );
  const run = store.getIncidentRun(actorId, incidentRunId);
  ensure(
    run?.kind === "live" && run.appId,
    "RESTART_INCIDENT_REQUIRED",
    "ابتدا مشکل همین برنامه را بررسی کنید؛ نمونه آزمایشی قابل اجرا نیست.",
    409,
  );
  ensure(
    run.symptom === "unavailable" || run.symptom === "errors",
    "RESTART_SYMPTOM_UNSUPPORTED",
    "این اقدام فقط با بررسی پاسخ صفحه همراه است؛ بهبود سرعت یا محتوای صفحه را اثبات نمی‌کند.",
    409,
  );
  const scoped = scopedConfig(config, store, actorId, run.evidence.scope.app),
    connection = store.getConnection(actorId, "liara")?.view,
    origin = scoped.probeOrigins[run.evidence.scope.app];
  ensure(
    connection?.identityId && origin,
    "PROBE_TARGET_DENIED",
    "ابتدا نشانی همین سایت و حساب متصل را بررسی کنید.",
    409,
  );
  const target = parseWorkloadTarget({ origin, path: run.path });
  ensure(
    !containsCredential(JSON.stringify(target), [
      scoped.liaraToken,
      scoped.modelKey,
      scoped.sessionSecret,
      scoped.operatorToken,
    ]),
    "SENSITIVE_INPUT",
    "نشانی بررسی نباید حاوی اطلاعات محرمانه باشد.",
  );
  const budget = new RunBudget(scoped),
    client = deps.read ?? new LiaraReadClient(scoped),
    bounded = budget.signal(signal);
  ensure(budget.maxToolCalls >= 2, "BUDGET_EXHAUSTED", "بودجه بررسی مقصد کافی نیست.", 409);
  const project = await client.project(run.evidence.scope, budget, bounded);
  ensure(
    project.id === run.appId && project.platform === "node" && project.planId,
    "RESTART_TARGET_CHANGED",
    "برنامه بررسی‌شده تغییر کرده است یا از نوع Node پشتیبانی‌شده نیست.",
    409,
  );
  const releases = await client.releases(run.evidence.scope, 1, 50, budget, bounded),
    current = releases.releases.find((release) => release.id === releases.currentRelease);
  ensure(
    current?.state === "READY",
    "RESTART_RELEASE_UNAVAILABLE",
    "نسخه فعلی آماده نیست؛ ابتدا وضعیت انتشار را بررسی کنید.",
    409,
  );
  const spec: RestartSpec = {
    version: 6,
    operation: "restart",
    scope: run.evidence.scope,
    sourceHash: null,
    args: { port: null, planId: null },
    accountId: connection.identityId,
    targetAppId: project.id,
    targetPlanId: project.planId,
    targetReleaseId: current.id,
    incidentRunId: run.id,
    evidenceHash: restartEvidenceHash(run),
    target,
  };
  validateRestartAction(config, store, actorId, spec);
  ensure(!bounded.aborted, "CANCELLED", "آماده‌سازی پیشنهاد متوقف شد.", 409);
  return store.createAction(actorId, spec);
}

export async function executeRestart(
  config: Config,
  store: Store,
  session: Session,
  id: string,
  signal: AbortSignal,
  deps: Dependencies = {},
): Promise<Action> {
  ensure(
    config.enableMutations && config.enableLiveLiara,
    "MUTATIONS_DISABLED",
    "راه‌اندازی دوباره واقعی در این نصب غیرفعال است.",
    403,
  );
  const action = store.getAction(id, session.actorId);
  ensure(
    action.spec.version === 6,
    "RESTART_PROPOSAL_REQUIRED",
    "پیشنهاد تازه با برنامه و بررسی مشخص لازم است.",
    409,
  );
  ensure(
    action.state === "approved" && !action.attemptId && action.expiresAt > Date.now(),
    "ACTION_CONFLICT",
    "این پیشنهاد مجوز اجرا ندارد یا قبلاً مصرف شده است.",
    409,
  );
  const spec = action.spec,
    scoped = validateRestartAction(config, store, session.actorId, spec),
    budget = new RunBudget(scoped),
    client = deps.read ?? new LiaraReadClient(scoped),
    writer = deps.write ?? new LiaraRestartClient(scoped);
  ensure(
    budget.maxToolCalls >= 3,
    "BUDGET_EXHAUSTED",
    "بودجه بررسی مقصد و ارسال درخواست کافی نیست.",
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
        ensure(
          (await readTarget(client, spec, budget, bounded)) === spec.targetReleaseId,
          "RESTART_RELEASE_CHANGED",
          "نسخه برنامه تغییر کرده است؛ پیشنهاد تازه دریافت کنید.",
          409,
        );
        ensure(budget.maxToolCalls - budget.toolCalls >= 1, "BUDGET_EXHAUSTED", "بودجه ارسال درخواست کافی نیست.", 409);
        validateRestartAction(config, store, session.actorId, spec);
      },
      async execute(claimed, bounded) {
        validateRestartAction(config, store, session.actorId, spec);
        store.startRestartRequest(claimed.id, session.actorId);
        await writer.restart(spec, budget, bounded);
        return { restartAccepted: true };
      },
    },
  });
}

export async function observeRestart(
  config: Config,
  store: Store,
  session: Session,
  id: string,
  signal: AbortSignal,
  deps: Dependencies = {},
): Promise<Action> {
  ensure(config.enableLiveLiara, "LIVE_LIARA_DISABLED", "خواندن واقعی برنامه در این نصب غیرفعال است؛ تغییری ارسال نشد.", 403);
  const action = store.getAction(id, session.actorId);
  ensure(
    action.spec.version === 6 && action.restart && canReadRestartResult(action),
    "ACTION_CONFLICT",
    "این اقدام منتظر بررسی نتیجه نیست.",
    409,
  );
  const spec = action.spec,
    progress = action.restart,
    scoped = validateRestartAction(config, store, session.actorId, spec, false),
    client = deps.read ?? new LiaraReadClient(scoped),
    budget = new RunBudget(scoped),
    bounded = budget.signal(signal),
    started = Date.now();
  ensure(
    budget.maxToolCalls >= 5,
    "BUDGET_EXHAUSTED",
    "بودجه بررسی صفحه و تطبیق دوباره مقصد کافی نیست.",
    409,
  );
  let observation: RestartObservation = {
    outcome: "inconclusive",
    code: "RESTART_OBSERVATION_UNAVAILABLE",
    checkedAt: 0,
    observedAt: null,
    status: null,
    releaseId: null,
  };
  try {
    const current = await readTarget(client, spec, budget, bounded);
    observation = { ...observation, releaseId: current };
    if (progress.stage === "claimed" && action.state === "uncertain")
      observation = { ...observation, outcome: "not_started", code: "RESTART_NOT_STARTED" };
    else if (current !== spec.targetReleaseId)
      observation = { ...observation, outcome: "changed", code: "RESTART_RELEASE_CHANGED" };
    else {
      const probe = await (deps.probe ?? new WorkloadProbe(scoped)).check(
        spec.scope,
        spec.target.path,
        budget,
        bounded,
      );
      ensure(
        probe.scope.teamId === spec.scope.teamId &&
          probe.scope.app === spec.scope.app &&
          probe.origin === spec.target.origin &&
          probe.path === spec.target.path &&
          probe.observedAt >= started,
        "EVIDENCE_MISMATCH",
        "پاسخ متعلق به همین برنامه و صفحه نیست.",
        409,
      );
      const finalRelease = await readTarget(client, spec, budget, bounded);
      observation =
        finalRelease !== spec.targetReleaseId
          ? {
              ...observation,
              outcome: "changed",
              code: "RESTART_RELEASE_CHANGED",
              releaseId: finalRelease,
            }
          : {
              ...observation,
              outcome:
                probe.outcome === "response" && probe.status >= 200 && probe.status < 300
                  ? "responding"
                  : "unhealthy",
              status: probe.status,
              observedAt: probe.observedAt,
              code: "RESTART_PAGE_CHECKED",
            };
    }
  } catch (error) {
    if (signal.aborted)
      throw new AppError("CANCELLED", "بررسی لغو شد؛ درخواست راه‌اندازی دوباره تکرار نشد.", 409);
    observation = {
      ...observation,
      outcome: "inconclusive",
      code: error instanceof AppError ? error.code : "OBSERVATION_UNAVAILABLE",
    };
  }
  validateRestartAction(config, store, session.actorId, spec, false);
  return store.recordRestartObservation(
    id,
    session.actorId,
    {
      ...observation,
      checkedAt: Math.max(Date.now(), (progress.observation?.checkedAt ?? 0) + 1),
    },
    progress.observation?.checkedAt ?? null,
  );
}
