import { randomUUID } from "node:crypto";
import type { Session, Action } from "../../contracts/domain.ts";
import type { CodeRepairJob } from "../../contracts/code-repair.ts";
import type { MissionAuthority } from "../../contracts/mission-authority.ts";
import { parseMissionPlan } from "../../contracts/mission-authority.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { AgentRepository, addEvent, type AgentRecord } from "../agent/store.ts";
import { assertAgentContext } from "../agent/tools.ts";
import { CodeRepairAdapter } from "../agent/code-repair.ts";
import { validateBuildRepairPaths } from "../agent/build-policy.ts";
import { fingerprint } from "../policy/action.ts";
import { RunBudget } from "../policy/budget.ts";
import { assertMissionJob, assertMissionPublication, missionAuthority, missionJobScopeHash, reserveMissionStep } from "../policy/mission-authority.ts";
import { LiaraReadClient } from "../liara/client.ts";
import { LiaraAccountClient, quotePaaSOffer } from "../liara/catalog.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { restoreProjectFlow } from "./project-flows.ts";

export async function proposeMissionAuthority(config: Config, store: Store, session: Session, id: string, revision: number,
  signal: AbortSignal, read?: LiaraReadClient, account?: LiaraAccountClient): Promise<AgentRecord> {
  const repo = new AgentRepository(store), run = repo.get(session.actorId, id);
  ensure(run?.mission && run.revision === revision && run.state === "needs_approval" && run.repair?.state === "proposed" &&
    run.repair.validationOnly && run.repair.build && run.repair.parentRunId === run.id && run.context.target && run.projectId,
    "PLAN_NOT_READY", "ابتدا پیشنهاد build، پروژه و مقصد موجود لازم است.", 409);
  ensure(store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
  assertAgentContext(config, store, session.actorId, run.context);
  const existing = missionAuthority(store, session.actorId, id);
  if (existing) { run.authority = existing; return run; }
  const target = run.context.target, started = Date.now(), budget = new RunBudget({ ...run.limits, runTimeoutMs: Math.max(1, run.limits.runTimeoutMs - run.usage.elapsedMs) });
  budget.modelCalls = run.usage.modelCalls; budget.toolCalls = run.usage.toolCalls;
  const take = budget.take.bind(budget);
  budget.take = (kind, parent) => {
    ensure(kind === "tool" && store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
    take(kind, parent); run.usage.toolCalls = budget.toolCalls; repo.save(session.actorId, run);
  };
  try {
    const flow = await restoreProjectFlow(config, store, session.actorId, signal, run.projectId);
    ensure(flow?.artifact && flow.profile.sourceHash === run.context.sourceHash, "PROJECT_CHANGED", "source تغییر کرده است.", 409);
    const project = await (read ?? new LiaraReadClient(connectedLiaraConfig(config, store, session.actorId, target.app))).project({ teamId: target.teamId, app: target.app }, budget, signal);
    const configuredOrigin = config.probeOrigins[target.app] || store.getProbeOrigin(session.actorId, target.teamId, target.app);
    ensure(project.id === target.appId && project.planId && project.platform === (run.repair.build.version === 2 ? "python" : "node"), "PLAN_TARGET_CHANGED", "هویت یا پلن مقصد تأیید نشده است.", 409);
    const catalogClient = account ?? new LiaraAccountClient(connectedLiaraConfig(config, store, session.actorId, target.app), target.accountId),
      metadata = await catalogClient.projectMetadata(target.app, budget, signal), catalog = await catalogClient.catalog(budget, signal);
    ensure(metadata?.id === target.appId && metadata.planId === project.planId, "PLAN_TARGET_CHANGED", "جزئیات مقصد تغییر کرده است.", 409);
    const origin = configuredOrigin || (metadata.defaultSubdomain === true ? `https://${target.app}.liara.run` : null);
    ensure(origin, "PROBE_UNCONFIGURED", "نشانی سایت این برنامه تأیید نشده است؛ نشانی همان مقصد را در حساب‌ها مشخص کنید.", 409);
    const quote = quotePaaSOffer(catalog, metadata.planId, metadata.bundleId);
    const allowedPaths = flow.profile.manifest.map(file => file.path).filter(path => {
      if (!/\.(?:[cm]?[jt]sx?|py|html|css|json)$/.test(path)) return false;
      try { validateBuildRepairPaths([path]); return true; } catch { return false; }
    }).sort();
    const plan = parseMissionPlan({ version: 1, revision: 1, runId: run.id, rootProjectId: run.projectId, rootSourceHash: flow.profile.sourceHash,
      rootArtifactHash: flow.artifact.archiveHash, rootSelectionHash: flow.selectionHash, initialJobId: run.repair.id,
      target: { ...target, planId: project.planId, bundleId: metadata.bundleId, networkId: metadata.networkId, origin }, costEffect: "existing_plan_unchanged",
      cost: { hourlyHundredthsToman: quote.selected.hourlyHundredthsToman, currency: "toman", period: "hour", catalogFingerprint: catalog.fingerprint, observedAt: catalog.observedAt, extras: "tax_traffic_storage_not_included" }, build: run.repair.build,
      allowedPaths, maxBuildJobs: 3, maxRepairs: 2, maxPublications: 2, limits: run.limits,
      expiresAt: Math.min(session.expiresAt, Date.now() + 600000) });
    assertAgentContext(config, store, session.actorId, run.context);
    const authority: MissionAuthority = { id: randomUUID(), hash: fingerprint({ actorId: session.actorId, plan }), state: "proposed", plan };
    store.db.exec("BEGIN IMMEDIATE");
    try {
      if (!configuredOrigin) store.setProbeOrigin(session.actorId, { teamId: target.teamId, app: target.app }, origin);
      store.db.prepare("INSERT INTO mission_authorities VALUES (?,?,?,?,?,?,?,?)").run(authority.id, session.actorId, id, JSON.stringify(plan), authority.hash, "proposed", session.id, Date.now());
      run.authority = authority;
      addEvent(run, "state", "برنامه build، اصلاح محدود و انتشار به همین مقصد آماده بررسی است؛ هنوز چیزی اجرا نشده است.");
      repo.save(session.actorId, run);
      store.db.exec("COMMIT");
    } catch (error) { store.db.exec("ROLLBACK"); throw error; }
    return run;
  } finally {
    const current = repo.get(session.actorId, id);
    if (current?.revision === run.revision) { current.usage.elapsedMs += Date.now() - started; repo.save(session.actorId, current); run.revision = current.revision; run.updatedAt = current.updatedAt; run.usage = current.usage; }
  }
}

export async function checkMissionCost(config: Config, store: Store, session: Session, authority: MissionAuthority, budget: RunBudget, signal: AbortSignal, account?: LiaraAccountClient): Promise<void> {
  const plan = authority.plan, client = account ?? new LiaraAccountClient(connectedLiaraConfig(config, store, session.actorId, plan.target.app), plan.target.accountId);
  const metadata = await client.projectMetadata(plan.target.app, budget, signal), catalog = await client.catalog(budget, signal);
  ensure(metadata?.id === plan.target.appId && metadata.planId === plan.target.planId && metadata.bundleId === plan.target.bundleId && metadata.networkId === plan.target.networkId,
    "PLAN_COST_CHANGED", "هویت یا منابع مقصد تغییر کرده‌اند؛ اختیار قبلی ادامه نمی‌یابد.", 409);
  const quote = quotePaaSOffer(catalog, metadata.planId, metadata.bundleId);
  ensure(quote.selected.hourlyHundredthsToman === plan.cost.hourlyHundredthsToman, "PLAN_COST_CHANGED", "قیمت پلن تغییر کرده است؛ تصمیم تازه لازم است.", 409);
}

export function authorizeMissionJob(store: Store, session: Session, authority: MissionAuthority, run: AgentRecord, job: CodeRepairJob, adapter: CodeRepairAdapter): void {
  assertMissionJob(store, session.actorId, session.id, authority, job);
  reserveMissionStep(store, session.actorId, session, authority, job.validationOnly ? "build" : "repair", job.id, missionJobScopeHash(job));
  run.repair = adapter.approve(session.actorId, job.id);
  run.repairDecision = { sessionId: session.id, expiresAt: authority.plan.expiresAt, consumed: true };
}
export function authorizeMissionPublication(store: Store, session: Session, authority: MissionAuthority, run: AgentRecord, action: Action): void {
  ensure(run.id === authority.plan.runId && run.publication?.id === action.id, "PLAN_OWNER_CHANGED", "این اقدام متعلق به مأموریت مصوب نیست.", 409);
  assertMissionPublication(store, session.actorId, session.id, authority, action);
  // Store.decide owns the transaction, including the reservation and the caller's run CAS.
  reserveMissionStep(store, session.actorId, session, authority, "publication", action.id, action.hash);
}
export async function decideMissionAuthority(config: Config, store: Store, session: Session, id: string, revision: number,
  authorityId: string, expectedHash: string, decision: "approve" | "reject"): Promise<AgentRecord> {
  const repo = new AgentRepository(store), run = repo.get(session.actorId, id), authority = missionAuthority(store, session.actorId, id);
  ensure(run?.mission && run.revision === revision && run.state === "needs_approval" && run.repair?.state === "proposed" &&
    authority?.id === authorityId && authority.hash === expectedHash && authority.state === "proposed", "PLAN_CONFLICT", "وضعیت برنامه تغییر کرده است؛ نتیجه تازه را ببینید.", 409);
  ensure(store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
  if (decision === "approve") {
    ensure(config.enableLocalRepair && config.enableLiveModel && config.enableMutations && config.enableLiveLiara, "PLAN_EXECUTION_DISABLED", "build، اصلاح یا انتشار واقعی در این نصب خاموش است.", 403);
    assertAgentContext(config, store, session.actorId, run.context);
    const flow = await restoreProjectFlow(config, store, session.actorId, AbortSignal.timeout(5000), authority.plan.rootProjectId);
    ensure(flow?.profile.sourceHash === authority.plan.rootSourceHash && flow.artifact?.archiveHash === authority.plan.rootArtifactHash &&
      flow.selectionHash === authority.plan.rootSelectionHash && run.repair.id === authority.plan.initialJobId,
      "PROJECT_CHANGED", "مبنای برنامه تغییر کرده است.", 409);
  }
  store.db.exec("BEGIN IMMEDIATE");
  try {
    const changed = store.db.prepare("UPDATE mission_authorities SET state=? WHERE id=? AND actor_id=? AND state='proposed' AND session_id=?").run(decision === "approve" ? "approved" : "revoked", authorityId, session.actorId, session.id);
    ensure(changed.changes === 1, "PLAN_CONFLICT", "اختیار به نشست دیگری تعلق دارد یا قبلاً تصمیم گرفته شده است.", 409);
    authority.state = decision === "approve" ? "approved" : "revoked";
    if (decision === "approve") authorizeMissionJob(store, session, authority, run, run.repair, new CodeRepairAdapter(config, store));
    else { run.repair = new CodeRepairAdapter(config, store).cancel(session.actorId, run.repair.id); }
    run.authority = authority; run.state = decision === "approve" ? "queued" : "needs_input";
    addEvent(run, "state", decision === "approve" ? "برنامه و حدود آن تأیید شد؛ build، اصلاح مجاز و انتشار همان artifactها خودکار پیگیری می‌شوند." : "برنامه رد شد؛ build، اصلاح و انتشار اجرا نشدند.");
    repo.save(session.actorId, run, revision); store.db.exec("COMMIT"); return run;
  } catch (error) { store.db.exec("ROLLBACK"); throw error; }
}
