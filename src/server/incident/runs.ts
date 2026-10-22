import { randomUUID } from "node:crypto";
import type { Diagnosis, EvidenceBundle } from "../../contracts/incident.ts";
import { parseDiagnosis, parseEvidenceBundle } from "../../contracts/incident.ts";
import { symptoms, type IncidentRun, type Symptom } from "../../contracts/incident-run.ts";
import { string, text } from "../../contracts/validation.ts";
import { BoxApiClient } from "../agent/boxapi.ts";
import type { Config } from "../config.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { AppError, ensure } from "../errors.ts";
import { LiaraReadClient } from "../liara/client.ts";
import { WorkloadProbe } from "../liara/probe.ts";
import type { Store } from "../persistence/store.ts";
import { RunBudget } from "../policy/budget.ts";
import { containsCredential, redact } from "../policy/redaction.ts";
import { collectEvidence } from "./collect.ts";
import { diagnose } from "./diagnose.ts";
import { practiceComparison, runPractice, type PracticeScenario } from "./practice.ts";

export function incidentConfig(config: Config, store: Store, actorId: string, app: string): Config {
  const scoped = connectedLiaraConfig(config, store, actorId, app),
    origin = config.probeOrigins[app] || store.getProbeOrigin(actorId, scoped.teamId, app);
  return { ...scoped, probeOrigins: origin ? { [app]: origin } : {} };
}
function selectedAppId(store: Store, actorId: string, app: string): string | null {
  const connection = store.getConnection(actorId, "liara")?.view;
  return connection?.status === "connected" && connection.selectedApp === app
    ? (connection.apps.find((row) => row.name === app)?.id ?? null)
    : null;
}
export function incidentPath(value: unknown, origin: string | undefined): string {
  const raw = string(value, 512);
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new AppError(
        "INCIDENT_PATH_INVALID",
        "نشانی صفحه معتبر نیست. صفحه اصلی یا مسیر دیگری را انتخاب کنید.",
      );
    }
    ensure(
      origin && url.origin === origin && !url.username && !url.password && !url.search && !url.hash,
      "INCIDENT_PATH_INVALID",
      "نشانی باید متعلق به همین سایت و بدون اطلاعات محرمانه یا بخش اضافی باشد.",
    );
    path = url.pathname;
  }
  ensure(
    path.length <= 200 &&
      /^\/[A-Za-z0-9/_~.%-]*$/.test(path) &&
      !path.includes("..") &&
      !/%(?:2f|5c|2e)/i.test(path),
    "INCIDENT_PATH_INVALID",
    "مسیر صفحه معتبر نیست. برای صفحه اصلی از / استفاده کنید؛ پارامترهای محرمانه را وارد نکنید.",
  );
  return path;
}
function privateValues(config: Config): string[] {
  return [config.liaraToken, config.modelKey, config.sessionSecret, config.operatorToken].filter(
    Boolean,
  );
}
function sanitizeDiagnosis(
  diagnosis: Diagnosis,
  evidence: EvidenceBundle,
  secrets: readonly string[],
): Diagnosis {
  return parseDiagnosis(
    {
      summary: redact(diagnosis.summary, secrets),
      hypotheses: diagnosis.hypotheses.map((row) => ({
        ...row,
        explanation: redact(row.explanation, secrets),
        nextCheck: redact(row.nextCheck, secrets),
      })),
    },
    evidence,
  );
}
function sanitizeEvidence(
  evidence: EvidenceBundle,
  config: Config,
  app: string,
  path: string,
): EvidenceBundle {
  const secrets = privateValues(config);
  const clean = parseEvidenceBundle({
    ...evidence,
    entries: evidence.entries.map((row) => ({
      ...row,
      summary: redact(row.summary, secrets),
      details: row.details.map((part) => redact(part, secrets)),
      fact:
        row.fact?.kind === "log"
          ? { ...row.fact, message: redact(row.fact.message, secrets) }
          : row.fact,
    })),
  });
  ensure(
    clean.mode === "provider_contract" &&
      clean.scope.teamId === config.teamId &&
      clean.scope.app === app,
    "EVIDENCE_MISMATCH",
    "گزارش متعلق به برنامه انتخاب‌شده نیست.",
    502,
  );
  ensure(
    clean.entries.every(
      (entry) =>
        entry.fact?.kind !== "http" ||
        (entry.fact.origin === config.probeOrigins[app] && entry.fact.path === path),
    ),
    "EVIDENCE_MISMATCH",
    "پاسخ سایت متعلق به همان نشانی و صفحه انتخاب‌شده نیست.",
    502,
  );
  return clean;
}
export async function createPracticeRun(
  store: Store,
  actorId: string,
  scenario: PracticeScenario,
  signal: AbortSignal,
): Promise<IncidentRun> {
  const result = await runPractice(scenario, signal);
  ensure(!signal.aborted, "CANCELLED", "تمرین متوقف شد. نتیجه قبلی حفظ شده است.", 409);
  return store.saveIncidentRun(actorId, {
    id: randomUUID(),
    kind: "sample",
    appId: null,
    symptom: scenario === "latency" ? "slow" : "errors",
    problem: "",
    path: "/",
    scenario,
    evidence: result.evidence,
    diagnosis: result.diagnosis,
    analysis: "scripted",
    analysisMessage:
      "داده و توضیح این نمونه از پیش تعریف شده‌اند؛ هیچ حساب یا مدل واقعی فراخوانی نشد.",
    after: null,
    updatedAt: Date.now(),
  });
}
export function comparePracticeRun(
  store: Store,
  actorId: string,
  id: string,
  choice: "related" | "unrelated",
): IncidentRun {
  const run = store.getIncidentRun(actorId, id);
  ensure(
    run?.kind === "sample" && run.scenario,
    "NOT_FOUND",
    "این تمرین پیدا نشد. دوباره نمونه را اجرا کنید.",
    404,
  );
  const result = practiceComparison(run.scenario, choice, run.evidence);
  return store.saveIncidentRun(
    actorId,
    { ...run, after: result.after, updatedAt: Date.now() },
    run.updatedAt,
  );
}

type Reader = (
  config: Config,
  input: { app: string; path: string; appId: string; sampleLatency?: boolean },
  budget: RunBudget,
  signal: AbortSignal,
) => Promise<EvidenceBundle>;
const readEvidence: Reader = (config, input, budget, signal) => {
  const now = Date.now();
  return collectEvidence(
    new LiaraReadClient(config),
    new WorkloadProbe(config),
    {
      scope: { teamId: config.teamId, app: input.app },
      expectedAppId: input.appId,
      start: now - 300_000,
      end: budget.deadline,
      since: new Date(now - 300_000).toISOString(),
      path: input.path,
      ...(input.sampleLatency ? { sampleLatency: true } : {}),
    },
    budget,
    signal,
  );
};
export async function createLiveIncidentRun(
  config: Config,
  store: Store,
  actorId: string,
  input: { app: string; symptom: Symptom; problem: string; path: string },
  signal: AbortSignal,
  reader: Reader = readEvidence,
): Promise<IncidentRun> {
  ensure(
    config.enableLiveLiara,
    "LIVE_LIARA_DISABLED",
    "خواندن اطلاعات برنامه در این نصب هنوز فعال نشده است. حساب را می‌توانید متصل کنید یا با نمونه آشنا شوید؛ نتیجه واقعی ساخته نمی‌شود.",
    403,
  );
  ensure(symptoms.includes(input.symptom), "INVALID_INPUT", "نشانه مشکل را انتخاب کنید.");
  const scoped = incidentConfig(config, store, actorId, input.app),
    problem = input.problem === "" ? "" : text(input.problem, 1000);
  ensure(
    !containsCredential(problem, privateValues(scoped)),
    "INCIDENT_SENSITIVE_INPUT",
    "توضیح مشکل شامل اطلاعات محرمانه احتمالی است. کلید، رمز یا نشانی دارای رمز را حذف و دوباره بررسی کنید.",
  );
  ensure(
    input.symptom !== "other" || problem.trim().length > 0,
    "INCIDENT_DESCRIPTION_REQUIRED",
    "برای این گزینه، مشکل را در یک جمله توضیح دهید.",
  );
  const path = incidentPath(input.path, scoped.probeOrigins[input.app]);
  const appId = selectedAppId(store, actorId, input.app);
  ensure(appId, "SCOPE_DENIED", "هویت برنامه انتخاب‌شده مشخص نیست؛ دوباره متصل شوید.", 403);
  const evidence = sanitizeEvidence(
    await reader(scoped, { app: input.app, path, appId, ...(input.symptom === "slow" ? { sampleLatency: true } : {}) }, new RunBudget(scoped), signal),
    scoped,
    input.app,
    path,
  );
  ensure(!signal.aborted, "CANCELLED", "بررسی متوقف شد. نتیجه قبلی حفظ شده است.", 409);
  ensure(
    appId && appId === selectedAppId(store, actorId, input.app),
    "SCOPE_DENIED",
    "برنامه هنگام بررسی تغییر کرده است؛ بررسی تازه‌ای شروع کنید.",
    403,
  );
  const run: IncidentRun = {
    id: randomUUID(),
    kind: "live",
    appId,
    symptom: input.symptom,
    problem,
    path,
    scenario: null,
    evidence,
    diagnosis: null,
    analysis: scoped.enableLiveModel && scoped.modelKey && scoped.modelId ? "ready" : "unavailable",
    analysisMessage:
      scoped.enableLiveModel && scoped.modelKey && scoped.modelId
        ? "توضیح علت آماده آغاز است؛ شواهد این بررسی را مرور کنید."
        : "توضیح خودکار علت در این نصب فعال نیست. شواهد جمع‌آوری‌شده همچنان قابل بررسی‌اند.",
    after: null,
    updatedAt: Date.now(),
  };
  if (evidence.entries.some((entry) => entry.code === "PROVIDER_AUTH")) {
    const saved = store.getConnection(actorId, "liara");
    if (saved) {
      store.saveConnection(actorId, {
        ...saved,
        view: { ...saved.view, status: "reauth_required" },
      });
      store.invalidateProjectApproval(actorId);
    }
  }
  return store.saveIncidentRun(actorId, run);
}
export async function recheckIncidentRun(
  config: Config,
  store: Store,
  actorId: string,
  id: string,
  signal: AbortSignal,
  reader: Reader = readEvidence,
): Promise<IncidentRun> {
  ensure(
    config.enableLiveLiara,
    "LIVE_LIARA_DISABLED",
    "خواندن اطلاعات واقعی هنوز در این نصب فعال نشده است.",
    403,
  );
  const run = store.getIncidentRun(actorId, id);
  ensure(run?.kind === "live", "NOT_FOUND", "این بررسی پیدا نشد.", 404);
  ensure(
    run.analysis !== "pending",
    "INCIDENT_ANALYSIS_CONFLICT",
    "توضیح شواهد در حال انجام است. پس از پایان یا لغو، بررسی تازه را انجام دهید.",
    409,
  );
  const scoped = incidentConfig(config, store, actorId, run.evidence.scope.app);
  ensure(
    scoped.teamId === run.evidence.scope.teamId &&
      run.appId &&
      run.appId === selectedAppId(store, actorId, run.evidence.scope.app),
    "SCOPE_DENIED",
    "حساب یا برنامه تغییر کرده است؛ بررسی تازه‌ای شروع کنید.",
    403,
  );
  const previousRequest = run.evidence.entries.find((entry) => entry.fact?.kind === "http")?.fact;
  ensure(
    previousRequest?.kind !== "http" ||
      previousRequest.origin === scoped.probeOrigins[run.evidence.scope.app],
    "INCIDENT_TARGET_CHANGED",
    "نشانی سایت تغییر کرده است. برای این نشانی بررسی تازه‌ای شروع کنید؛ نتیجه دو سایت با هم مقایسه نمی‌شود.",
    409,
  );
  const after = sanitizeEvidence(
    await reader(
      scoped,
      { app: run.evidence.scope.app, path: run.path, appId: run.appId, ...(run.symptom === "slow" ? { sampleLatency: true } : {}) },
      new RunBudget(scoped),
      signal,
    ),
    scoped,
    run.evidence.scope.app,
    run.path,
  );
  ensure(!signal.aborted, "CANCELLED", "بررسی تازه متوقف شد. نتیجه قبلی حفظ شده است.", 409);
  ensure(
    run.appId === selectedAppId(store, actorId, run.evidence.scope.app),
    "SCOPE_DENIED",
    "برنامه هنگام بررسی تغییر کرده است؛ بررسی تازه‌ای شروع کنید.",
    403,
  );
  return store.saveIncidentRun(actorId, { ...run, after, updatedAt: Date.now() }, run.updatedAt);
}
export async function analyzeIncidentRun(
  config: Config,
  store: Store,
  actorId: string,
  id: string,
  signal: AbortSignal,
  client?: Pick<BoxApiClient, "complete">,
): Promise<IncidentRun> {
  ensure(
    config.enableLiveModel && config.modelKey && config.modelId,
    "ANALYSIS_UNAVAILABLE",
    "توضیح خودکار علت در این نصب فعال نیست. شواهد جمع‌آوری‌شده همچنان قابل بررسی‌اند.",
    403,
  );
  const run = store.getIncidentRun(actorId, id);
  ensure(run?.kind === "live", "NOT_FOUND", "این بررسی پیدا نشد.", 404);
  ensure(
    !run.after,
    "INCIDENT_CHANGED",
    "پس از بررسی دوباره، برای توضیح شواهد تازه یک بررسی جدید شروع کنید.",
    409,
  );
  ensure(
    Date.now() - run.evidence.collectedAt <= 900_000,
    "INCIDENT_EVIDENCE_EXPIRED",
    "اطلاعات این بررسی قدیمی شده‌اند. بررسی تازه‌ای شروع کنید.",
    409,
  );
  const scoped = incidentConfig(config, store, actorId, run.evidence.scope.app);
  ensure(
    scoped.teamId === run.evidence.scope.teamId,
    "SCOPE_DENIED",
    "برنامه یا تیم تغییر کرده است.",
    403,
  );
  ensure(!signal.aborted, "CANCELLED", "توضیح شواهد شروع نشد.", 409);
  const pending = store.claimIncidentAnalysis(actorId, id);
  try {
    const diagnosis = await diagnose(
      pending.evidence,
      client ?? new BoxApiClient(scoped),
      new RunBudget({ ...scoped, maxModelCalls: Math.min(2, scoped.maxModelCalls) }),
      signal,
      pending.problem,
    );
    ensure(!signal.aborted, "CANCELLED", "توضیح شواهد کامل نشد.", 409);
    return store.saveIncidentRun(
      actorId,
      {
        ...pending,
        diagnosis: sanitizeDiagnosis(diagnosis, pending.evidence, privateValues(scoped)),
        analysis: "model",
        analysisMessage: "این توضیح، علت احتمالی را بیان می‌کند؛ اصلاح یا تأیید سلامت سایت نیست.",
        updatedAt: Date.now(),
      },
      pending.updatedAt,
    );
  } catch (error) {
    const failed = store.saveIncidentRun(
      actorId,
      {
        ...pending,
        analysis: "failed",
        analysisMessage: signal.aborted
          ? "توضیح شواهد متوقف شد. برای جلوگیری از مصرف تکراری، همین بررسی خودکار دوباره اجرا نمی‌شود."
          : "توضیح علت کامل نشد؛ شواهد حفظ شده‌اند. همین درخواست خودکار تکرار نمی‌شود.",
        updatedAt: Date.now(),
      },
      pending.updatedAt,
    );
    if (signal.aborted)
      throw new AppError("CANCELLED", failed.analysisMessage || "توضیح شواهد متوقف شد.", 409);
    if (error instanceof AppError && error.code === "INCIDENT_CHANGED") throw error;
    return failed;
  }
}
