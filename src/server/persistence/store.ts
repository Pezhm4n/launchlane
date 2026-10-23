import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  Action,
  ActionSpec,
  ActionState,
  Session,
  SourceArtifact,
} from "../../contracts/domain.ts";
import { parseArtifact } from "../../contracts/source.ts";
import { object, string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { fingerprint, parseActionSpec } from "../policy/action.ts";
import { assertMissionActionClaim } from "../policy/mission-authority.ts";
import { parseProvisionProgress, providerObjectId, type ProvisionProgress, type ProvisionReadback, type ProvisionObservation } from "../../contracts/provision.ts";
import { migrations } from "./migrations.ts";
import { parseNetworkProgress, type NetworkProgress } from "../../contracts/network.ts";
import { parseEnvironmentProgress, type EnvironmentProgress } from "../../contracts/environment.ts";
import { parseLifecycleProgress, type LifecycleProgress } from "../../contracts/project-lifecycle.ts";
import { environmentProjectIds } from "../environment/secrets.ts";
import { actionPlatform } from "../../contracts/platform.ts";
import { parseProjectFlow, type ProjectFlow } from "../../contracts/project-flow.ts";
import { parseIncidentRun, type IncidentRun } from "../../contracts/incident-run.ts";
import { inWindow } from "../../contracts/incident.ts";
import { parseProbeOrigins } from "../policy/probe-target.ts";
import { restartEvidenceHash } from "../policy/restart.ts";
import {
  canReadRestartResult, parseRestartProgress, parseRestartObservation,
  type RestartSpec, type RestartProgress, type RestartObservation,
} from "../../contracts/restart.ts";
import {
  parseDeploymentProgress,
  canReadDeploymentResult,
  isDeploymentSpec,
  sourceReceiptId,
  type DeploymentProgress,
  type DeploymentObservation,
} from "../../contracts/deployment.ts";
import {
  parseConnection,
  type ConnectionProvider,
  type ConnectionView,
} from "../../contracts/connections.ts";

export type StoredConnection = {
  view: ConnectionView;
  ciphertext: string | null;
  source: "token" | "cli_private" | "cli_system";
};

const states: readonly ActionState[] = [
  "awaiting_approval",
  "approved",
  "cancelled",
  "expired",
  "executing",
  "observing",
  "uncertain",
  "succeeded",
  "failed",
];

function actionRow(raw: unknown): Action {
  const row = object(raw);
  const state = states.find((value) => value === row.state);
  ensure(
    state && typeof row.created_at === "number" && typeof row.expires_at === "number",
    "STORAGE_INVALID",
    "state ذخیره‌شده معتبر نیست.",
    503,
  );
  const spec: unknown = JSON.parse(string(row.spec, 16_384));
  const result = {
    id: string(row.id),
    actorId: string(row.actor_id),
    spec: parseActionSpec(spec),
    hash: string(row.hash),
    state,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    attemptId: row.attempt_id === null ? null : string(row.attempt_id),
    remoteId: row.remote_id === null ? null : string(row.remote_id),
    errorCode: row.error_code === null ? null : string(row.error_code),
  };
  ensure(
    result.hash === fingerprint({ actorId: result.actorId, spec: result.spec }),
    "STORAGE_INVALID",
    "اثر انگشت action ذخیره‌شده تغییر کرده است.",
    503,
  );
  return result;
}

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path, { timeout: 2000, allowExtension: false });
    try {
      this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;");
      this.db.exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT;",
      );
      this.transaction(() => {
        for (const migration of migrations) {
          const checksum = createHash("sha256").update(migration.sql).digest("hex");
          const applied = this.db
            .prepare("SELECT checksum FROM schema_migrations WHERE version=?")
            .get(migration.version);
          if (applied) {
            ensure(
              applied.checksum === checksum,
              "MIGRATION_MISMATCH",
              "تاریخچه migration با نسخه اجرا تطبیق ندارد.",
              503,
            );
          } else {
            this.db.exec(migration.sql);
            this.db
              .prepare("INSERT INTO schema_migrations VALUES (?,?)")
              .run(migration.version, checksum);
          }
        }
        const unknown = this.db
          .prepare("SELECT version FROM schema_migrations WHERE version>?")
          .get(migrations.at(-1)?.version ?? 0);
        ensure(!unknown, "MIGRATION_MISMATCH", "state متعلق به نسخه جدیدتر است.", 503);
      });
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  saveConnection(actorId: string, input: StoredConnection): ConnectionView {
    const view = parseConnection(input.view);
    ensure(
      (view.provider === "liara" &&
        input.source === "token" &&
        input.ciphertext?.startsWith("v1.") &&
        input.ciphertext.length <= 12000) ||
        (view.provider === "github" && input.source !== "token" && input.ciphertext === null),
      "CONNECTION_INVALID",
      "روش نگهداری اتصال معتبر نیست.",
    );
    this.db
      .prepare(
        "INSERT INTO account_connections(actor_id,provider,public_json,credential_ciphertext,credential_source) VALUES (?,?,?,?,?) ON CONFLICT(actor_id,provider) DO UPDATE SET public_json=excluded.public_json,credential_ciphertext=excluded.credential_ciphertext,credential_source=excluded.credential_source",
      )
      .run(actorId, view.provider, JSON.stringify(view), input.ciphertext, input.source);
    return view;
  }
  getConnection(actorId: string, provider: ConnectionProvider): StoredConnection | null {
    const row = this.db
      .prepare("SELECT * FROM account_connections WHERE actor_id=? AND provider=?")
      .get(actorId, provider);
    if (!row) return null;
    const view = parseConnection(JSON.parse(string(row.public_json, 100_000)));
    ensure(
      view.provider === provider &&
        (row.credential_source === "token" ||
          row.credential_source === "cli_private" ||
          row.credential_source === "cli_system"),
      "STORAGE_INVALID",
      "اتصال ذخیره‌شده معتبر نیست.",
      503,
    );
    return {
      view,
      source: row.credential_source,
      ciphertext:
        row.credential_ciphertext === null ? null : string(row.credential_ciphertext, 12000),
    };
  }
  disconnectConnection(actorId: string, provider: ConnectionProvider): void {
    this.db
      .prepare("DELETE FROM account_connections WHERE actor_id=? AND provider=?")
      .run(actorId, provider);
  }

  getProjectFlow(actorId: string, id?: string): ProjectFlow | null {
    const row = id
      ? this.db.prepare("SELECT * FROM project_flows WHERE actor_id=? AND id=?").get(actorId, id)
      : this.db
          .prepare(
            "SELECT f.* FROM project_flows f JOIN operator_progress p ON p.project_flow_id=f.id WHERE p.actor_id=? AND f.actor_id=?",
          )
          .get(actorId, actorId);
    if (!row) return null;
    const flow = parseProjectFlow({
      id: row.id,
      selection: JSON.parse(string(row.selection_json, 4096)),
      selectionHash: row.selection_hash,
      profile: JSON.parse(string(row.profile_json, 1_048_576)),
      artifact: row.artifact_json === null ? null : JSON.parse(string(row.artifact_json, 2048)),
      status: row.status,
      message: row.message,
      updatedAt: row.updated_at,
      actionId: row.action_id,
    });
    ensure(
      flow.selectionHash === fingerprint(flow.selection),
      "STORAGE_INVALID",
      "انتخاب ذخیره‌شده پروژه تغییر کرده است.",
      503,
    );
    return flow;
  }
  private invalidateProjectAction(flow: ProjectFlow, actorId: string): void {
    if (!flow.actionId) return;
    const action = this.getAction(flow.actionId, actorId);
    if (action.state === "awaiting_approval" || action.state === "approved") {
      this.db
        .prepare("UPDATE actions SET state='cancelled',error_code='PROJECT_CHANGED' WHERE id=?")
        .run(action.id);
      this.audit(action, "project_invalidated", Date.now());
    }
  }
  invalidateProjectApproval(actorId: string): void {
    this.transaction(() => {
      const flow = this.getProjectFlow(actorId);
      if (flow) this.invalidateProjectAction(flow, actorId);
      this.invalidatePendingAgentDecisions(actorId);
    });
  }
  saveProjectFlow(actorId: string, input: ProjectFlow, onCreated?: (flow: ProjectFlow) => void): ProjectFlow {
    const flow = parseProjectFlow(input);
    ensure(
      flow.selectionHash === fingerprint(flow.selection) && !flow.actionId,
      "INVALID_INPUT",
      "انتخاب پروژه معتبر نیست.",
    );
    return this.transaction(() => {
      const previous = this.getProjectFlow(actorId);
      if (previous) this.invalidateProjectAction(previous, actorId);
      this.invalidatePendingAgentDecisions(actorId);
      this.db
        .prepare("INSERT INTO project_flows VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(
          flow.id,
          actorId,
          JSON.stringify(flow.selection),
          flow.selectionHash,
          JSON.stringify(flow.profile),
          flow.artifact ? JSON.stringify(flow.artifact) : null,
          flow.status,
          flow.message,
          flow.updatedAt,
          null,
        );
      this.db
        .prepare(
          "INSERT INTO operator_progress VALUES (?,?) ON CONFLICT(actor_id) DO UPDATE SET project_flow_id=excluded.project_flow_id",
        )
        .run(actorId, flow.id);
      onCreated?.(flow);
      return flow;
    });
  }
  activateProjectFlow(actorId: string, id: string, target: { accountId: string; teamId: string; appId: string; app: string } | null): void {
    this.transaction(() => {
      const flow = this.getProjectFlow(actorId, id);
      ensure(flow, "NOT_FOUND", "این پروژه پیدا نشد.", 404);
      ensure(!this.db.prepare("SELECT project_id FROM project_archives WHERE project_id=? AND actor_id=?").get(id, actorId), "PROJECT_ARCHIVED", "این پروژه از فهرست حذف شده است؛ پوشه را دوباره انتخاب کنید.", 409);
      if (this.getProjectFlow(actorId)?.id === id) return;
      this.assertAgentIdle(actorId, null, true);
      ensure(!this.db.prepare("SELECT job_id FROM coding_agent_executions WHERE actor_id=? AND state IN ('dispatched','uncertain') LIMIT 1").get(actorId),
        "UNRESOLVED_EFFECT", "نتیجهٔ اصلاح بیرونی هنوز مشخص نیست؛ ابتدا همان اجرا را بررسی کنید.", 409);
      ensure(!this.db.prepare("SELECT id FROM actions WHERE actor_id=? AND state IN ('executing','observing','uncertain') LIMIT 1").get(actorId),
        "UNRESOLVED_EFFECT", "ابتدا نتیجهٔ عملیات قبلی را مشخص کنید؛ پروژه عوض نشد.", 409);
      const connection = this.getConnection(actorId, "liara");
      if (target) ensure(connection?.view.identityId === target.accountId && connection.view.teamId === target.teamId &&
        connection.view.apps.some(app => app.id === target.appId && app.name === target.app),
        "PROJECT_ACCESS_CHANGED", "حساب یا مقصد این پروژه در اتصال فعلی در دسترس نیست؛ حساب‌ها را بررسی کنید.", 409);
      this.invalidatePendingAgentDecisions(actorId);
      for (const row of this.db.prepare("SELECT id FROM actions WHERE actor_id=? AND state IN ('awaiting_approval','approved') AND attempt_id IS NULL").all(actorId)) {
        const action = this.getAction(string(row.id, 36), actorId);
        this.db.prepare("UPDATE actions SET state='cancelled',error_code='PROJECT_CHANGED' WHERE id=? AND actor_id=?").run(action.id, actorId);
        this.audit(action, "project_invalidated", Date.now());
      }
      this.db.prepare("UPDATE mission_authorities SET state='revoked' WHERE actor_id=? AND state IN ('proposed','approved')").run(actorId);
      if (connection) this.saveConnection(actorId, { ...connection, view: { ...connection.view, selectedApp: target?.app ?? null } });
      this.db.prepare("INSERT INTO operator_progress VALUES (?,?) ON CONFLICT(actor_id) DO UPDATE SET project_flow_id=excluded.project_flow_id").run(actorId, id);
    });
  }
  staleProjectFlow(
    actorId: string,
    id: string,
    message: string,
    status: "stale" | "unavailable" = "stale",
  ): ProjectFlow {
    return this.transaction(() => {
      const flow = this.getProjectFlow(actorId, id);
      ensure(flow, "NOT_FOUND", "این پروژه پیدا نشد.", 404);
      this.invalidateProjectAction(flow, actorId);
      this.db
        .prepare("UPDATE project_flows SET status=?,message=? WHERE id=? AND actor_id=?")
        .run(status, string(message, 1000), id, actorId);
      return { ...flow, status, message };
    });
  }
  assertProjectAction(actorId: string, spec: ActionSpec, existingId?: string): void {
    if (spec.version !== 3 && spec.version !== 4 && spec.version !== 5 && (spec.version !== 7 && spec.version !== 10 && spec.version !== 11 && spec.version !== 15 && spec.version !== 17) && (spec.version !== 8 && spec.version !== 12 && spec.version !== 16 && spec.version !== 18) && spec.version !== 9 && spec.version !== 13) return;
    const flow = this.getProjectFlow(actorId);
    ensure(
      flow &&
        flow.id === spec.projectFlowId &&
        flow.selectionHash === spec.selectionHash &&
        flow.profile.sourceHash === spec.sourceHash &&
        flow.artifact?.archiveHash === spec.artifactHash &&
        flow.status === "ready" &&
        (!existingId || flow.actionId === existingId),
      "PROJECT_CHANGED",
      "پروژه یا فایل‌های آن تغییر کرده‌اند. پروژه را دوباره بررسی و پیشنهاد تازه دریافت کنید.",
      409,
    );
    if (spec.version === 17 || spec.version === 18) ensure(fingerprint(flow.profile.nextRuntime) === fingerprint(spec.runtime), "NEXT_RUNTIME_CHANGED", "نسخه یا مسیر انتشار Next تغییر کرده است؛ پیشنهاد تازه لازم است.", 409);
    else if (spec.version === 15 || spec.version === 16) ensure(fingerprint(flow.profile.staticRuntime) === fingerprint(spec.runtime), "STATIC_RUNTIME_CHANGED", "روش انتشار سایت ایستا تغییر کرده است؛ پیشنهاد تازه لازم است.", 409);
    else if (spec.version === 11 || spec.version === 12) ensure(fingerprint(flow.profile.pythonRuntime) === fingerprint(spec.runtime), "PYTHON_RUNTIME_CHANGED", "تنظیمات اجرای Python تغییر کرده است؛ پیشنهاد تازه لازم است.", 409);
    else ensure((spec.version !== 5 && (spec.version !== 7 && spec.version !== 10) && spec.version !== 8) || flow.profile.nodeRuntime?.version === spec.nodeVersion, "NODE_VERSION_CHANGED", "نسخه Node پیشنهاد با بررسی پروژه برابر نیست؛ پیشنهاد تازه دریافت کنید.", 409);
    const connection = this.getConnection(actorId, "liara")?.view;
    if (spec.version === 10 || (spec.version === 11 || spec.version === 17) && spec.environment !== null) {
      const reference = spec.environment;
      ensure(reference, "ENV_REFERENCE_CHANGED", "مرجع اطلاعات انتشار مشخص نیست.", 409);
      const environment = this.getAction(reference.actionId, actorId), input = environment.spec;
      ensure(input.version === 9 && environment.state === "succeeded" && input.effectiveFingerprint === reference.fingerprint &&
        input.accountId === spec.accountId && input.scope.teamId === spec.scope.teamId && input.scope.app === spec.scope.app && input.targetAppId === spec.targetAppId &&
        environmentProjectIds(this, actorId, flow.id).has(input.projectFlowId) && reference.keys.every(key => flow.profile.envNames.includes(key)),
        "ENV_REFERENCE_CHANGED", "مرجع اطلاعات برنامه به همین پروژه، حساب و مقصد تعلق ندارد.", 409);
    }
    if (spec.version === 8 || spec.version === 12 || spec.version === 16 || spec.version === 18 || spec.version === 13) {
      const previous = connection?.apps.find((app) => app.name === connection.selectedApp)?.id ?? null;
      ensure(connection?.status === "connected" && connection.identityId === spec.accountId &&
        connection.teamId === spec.scope.teamId && previous === spec.previousAppId,
        "PROJECT_ACCESS_CHANGED", "حساب یا انتخاب مقصد تغییر کرده است؛ پیشنهاد تازه لازم است.", 409);
      return;
    }
    ensure(
      connection?.status === "connected" &&
        connection.teamId === spec.scope.teamId &&
        (((spec.version !== 7 && spec.version !== 10 && spec.version !== 11 && spec.version !== 15 && spec.version !== 17) && spec.version !== 9) || connection.identityId === spec.accountId) &&
        connection.selectedApp === spec.scope.app &&
        connection.apps.some(
          (app) =>
            app.name === spec.scope.app && (!(isDeploymentSpec(spec) || spec.version === 9) || app.id === spec.targetAppId),
        ),
      "PROJECT_ACCESS_CHANGED",
      "حساب یا برنامه مقصد تغییر کرده است. اتصال را بررسی و پیشنهاد تازه دریافت کنید.",
      409,
    );
  }

  assertRestartAction(actorId: string, spec: RestartSpec, requireEvidence = true): void {
    const connection = this.getConnection(actorId, "liara")?.view;
    ensure(
      connection?.status === "connected" && connection.identityId === spec.accountId &&
        connection.teamId === spec.scope.teamId && connection.selectedApp === spec.scope.app &&
        connection.apps.some((app) => app.name === spec.scope.app && app.id === spec.targetAppId),
      "RESTART_TARGET_CHANGED", "حساب یا برنامه تغییر کرده است؛ همان مقصد را انتخاب و پیشنهاد تازه دریافت کنید.", 409,
    );
    if (requireEvidence) {
      const run = this.getIncidentRun(actorId, spec.incidentRunId);
      ensure(run?.kind === "live" && run.appId === spec.targetAppId &&
        run.evidence.scope.teamId === spec.scope.teamId && run.evidence.scope.app === spec.scope.app &&
        run.path === spec.target.path && restartEvidenceHash(run) === spec.evidenceHash,
      "INCIDENT_CHANGED", "نتیجه بررسی مشکل تغییر کرده است؛ پیشنهاد تازه دریافت کنید.", 409);
      const evidence = run.after ?? run.evidence;
      ensure(Date.now() - evidence.collectedAt <= 900_000 && evidence.collectedAt <= Date.now() &&
        evidence.entries.some((entry) => entry.state === "observed" && inWindow(entry, evidence) &&
          entry.fact?.kind === "http" && entry.fact.origin === spec.target.origin &&
          entry.fact.path === spec.target.path && entry.fact.status >= 400),
      "RESTART_EVIDENCE_REQUIRED", "ابتدا خطای همین صفحه را دوباره بررسی کنید؛ شاهد تازه و مربوط لازم است.", 409);
    }
  }

  private assertActionContext(actorId: string, spec: ActionSpec, existingId?: string): void {
    if (spec.version === 14) {
      const flow = this.getProjectFlow(actorId), connection = this.getConnection(actorId, "liara")?.view;
      ensure(flow?.id === spec.projectFlowId && flow.profile.sourceHash === spec.sourceHash && flow.selectionHash === spec.selectionHash &&
        !this.db.prepare("SELECT project_id FROM project_archives WHERE actor_id=? AND project_id=?").get(actorId, flow.id), "PROJECT_CHANGED", "پروژه تغییر کرده است؛ تصمیم تازه لازم است.", 409);
      ensure(connection?.status === "connected" && connection.identityId === spec.accountId && connection.teamId === spec.scope.teamId &&
        connection.selectedApp === spec.scope.app && connection.apps.some(app => app.id === spec.targetAppId && app.name === spec.scope.app),
        "PROJECT_ACCESS_CHANGED", "حساب یا مقصد تغییر کرده است؛ همان پروژه و حساب را باز کنید.", 409);
    }
    else if (spec.version === 6) this.assertRestartAction(actorId, spec);
    else this.assertProjectAction(actorId, spec, existingId);
  }

  saveIncidentRun(actorId: string, input: IncidentRun, expectedUpdatedAt?: number): IncidentRun {
    const run = parseIncidentRun(input);
    return this.transaction(() => {
      const existing = this.db
        .prepare("SELECT actor_id,updated_at FROM incident_runs WHERE id=?")
        .get(run.id);
      ensure(!existing || existing.actor_id === actorId, "NOT_FOUND", "این بررسی پیدا نشد.", 404);
      ensure(
        expectedUpdatedAt === undefined || existing?.updated_at === expectedUpdatedAt,
        "INCIDENT_CHANGED",
        "وضعیت این بررسی تغییر کرده است. نتیجه ثبت‌شده را دوباره بخوانید.",
        409,
      );
      if (existing) run.updatedAt = Math.max(run.updatedAt, Number(existing.updated_at) + 1);
      const data = JSON.stringify(run);
      ensure(
        Buffer.byteLength(data) <= 262_144,
        "INCIDENT_LIMIT",
        "گزارش بررسی بیش از سقف نگهداری است.",
        413,
      );
      this.db
        .prepare(
          "INSERT INTO incident_runs VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at",
        )
        .run(run.id, actorId, data, run.updatedAt);
      this.db
        .prepare(
          "DELETE FROM incident_runs WHERE actor_id=? AND id NOT IN (SELECT id FROM incident_runs WHERE actor_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 20)",
        )
        .run(actorId, actorId);
      return run;
    });
  }
  getIncidentRun(actorId: string, id?: string, kind?: "live" | "sample"): IncidentRun | null {
    const row = id
      ? this.db
          .prepare("SELECT data_json FROM incident_runs WHERE actor_id=? AND id=?")
          .get(actorId, id)
      : kind
        ? this.db
            .prepare(
              "SELECT data_json FROM incident_runs WHERE actor_id=? AND json_extract(data_json,'$.kind')=? ORDER BY updated_at DESC,rowid DESC LIMIT 1",
            )
            .get(actorId, kind)
        : this.db
            .prepare(
              "SELECT data_json FROM incident_runs WHERE actor_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 1",
            )
            .get(actorId);
    return row ? parseIncidentRun(JSON.parse(string(row.data_json, 262_144))) : null;
  }
  claimIncidentAnalysis(actorId: string, id: string): IncidentRun {
    return this.transaction(() => {
      const run = this.getIncidentRun(actorId, id);
      ensure(run?.kind === "live", "NOT_FOUND", "این بررسی پیدا نشد.", 404);
      ensure(
        run.analysis === "ready" || run.analysis === "unavailable",
        "INCIDENT_ANALYSIS_CONFLICT",
        "توضیح علت این بررسی قبلاً شروع شده است. برای جلوگیری از مصرف تکراری، خودکار دوباره اجرا نمی‌شود.",
        409,
      );
      const connection = this.getConnection(actorId, "liara")?.view;
      ensure(
        connection?.status === "connected" &&
          connection.teamId === run.evidence.scope.teamId &&
          connection.selectedApp === run.evidence.scope.app &&
          run.appId &&
          connection.apps.some(
            (app) => app.name === run.evidence.scope.app && app.id === run.appId,
          ),
        "SCOPE_DENIED",
        "برنامه یا حساب انتخاب‌شده تغییر کرده است. بررسی تازه‌ای روی همان مقصد شروع کنید.",
        403,
      );
      const pending: IncidentRun = {
        ...run,
        analysis: "pending",
        analysisMessage: "در حال توضیح شواهد…",
        updatedAt: Math.max(Date.now(), run.updatedAt + 1),
      };
      this.db
        .prepare("UPDATE incident_runs SET data_json=?,updated_at=? WHERE id=? AND actor_id=?")
        .run(JSON.stringify(pending), pending.updatedAt, id, actorId);
      return pending;
    });
  }
  setProbeOrigin(actorId: string, scope: { teamId: string; app: string }, origin: string): void {
    const parsed = parseProbeOrigins(JSON.stringify({ [scope.app]: origin }), [scope.app]);
    const connection = this.getConnection(actorId, "liara")?.view;
    ensure(
      connection?.status === "connected" &&
        connection.teamId === scope.teamId &&
        connection.selectedApp === scope.app &&
        connection.apps.some((app) => app.name === scope.app),
      "SCOPE_DENIED",
      "نشانی سایت باید به برنامه انتخاب‌شده حساب شما مربوط باشد.",
      403,
    );
    this.db
      .prepare(
        "INSERT INTO probe_targets VALUES (?,?,?,?) ON CONFLICT(actor_id,team_id,app) DO UPDATE SET origin=excluded.origin",
      )
      .run(actorId, scope.teamId, scope.app, parsed[scope.app] || "");
  }
  getProbeOrigin(actorId: string, teamId: string, app: string): string | null {
    const row = this.db
      .prepare("SELECT origin FROM probe_targets WHERE actor_id=? AND team_id=? AND app=?")
      .get(actorId, teamId, app);
    if (!row) return null;
    return (
      parseProbeOrigins(JSON.stringify({ [app]: string(row.origin, 512) }), [app])[app] || null
    );
  }

  removeProbeOrigin(actorId: string, teamId: string, app: string): void {
    this.db
      .prepare("DELETE FROM probe_targets WHERE actor_id=? AND team_id=? AND app=?")
      .run(actorId, teamId, app);
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private audit(action: Action, event: string, now: number): void {
    this.db
      .prepare("INSERT INTO audit_events(action_id,actor_id,event,at) VALUES (?,?,?,?)")
      .run(action.id, action.actorId, event, now);
  }

  rateLimitLogin(now = Date.now(), bucket = "operator", maxAttempts = 5): void {
    this.transaction(() => {
      this.db.prepare("DELETE FROM login_limits WHERE reset_at<=?").run(now);
      const row = this.db
        .prepare("SELECT attempts,reset_at FROM login_limits WHERE bucket=?")
        .get(bucket);
      if (!row || Number(row.reset_at) <= now) {
        this.db
          .prepare("INSERT OR REPLACE INTO login_limits VALUES (?,1,?)")
          .run(bucket, now + 60_000);
      } else {
        ensure(
          Number(row.attempts) < maxAttempts,
          "RATE_LIMITED",
          "تلاش ورود زیاد است؛ یک دقیقه بعد دوباره تلاش کنید.",
          429,
        );
        this.db
          .prepare("UPDATE login_limits SET attempts=attempts+1 WHERE bucket=?")
          .run(bucket);
      }
    });
  }

  saveSession(session: Session): void {
    this.db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(session.id, session.actorId, session.expiresAt);
  }

  sessionExists(id: string, actorId: string, now: number): boolean {
    return Boolean(
      this.db
        .prepare("SELECT id FROM sessions WHERE id=? AND actor_id=? AND expires_at>?")
        .get(id, actorId, now),
    );
  }

  revokeSession(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id=?").run(id);
  }

  recordArtifact(actorId: string, input: SourceArtifact): SourceArtifact {
    const artifact = parseArtifact(input);
    return this.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO source_artifacts VALUES (?,?,?,?,?,?) ON CONFLICT(actor_id,archive_hash) DO NOTHING",
        )
        .run(
          actorId,
          artifact.archiveHash,
          artifact.sourceHash,
          artifact.bytes,
          artifact.fileCount,
          artifact.createdAt,
        );
      const stored = this.getArtifact(actorId, artifact.archiveHash);
      ensure(
        stored.sourceHash === artifact.sourceHash &&
          stored.bytes === artifact.bytes &&
          stored.fileCount === artifact.fileCount,
        "ARTIFACT_MISMATCH",
        "مشخصات بسته source با state ذخیره‌شده برابر نیست.",
        409,
      );
      return stored;
    });
  }

  getArtifact(actorId: string, archiveHash: string): SourceArtifact {
    const row = this.db
      .prepare("SELECT * FROM source_artifacts WHERE actor_id=? AND archive_hash=?")
      .get(actorId, archiveHash);
    ensure(row, "ARTIFACT_NOT_FOUND", "بسته source پیدا نشد؛ ابتدا آن را محلی آماده کنید.", 409);
    return parseArtifact({
      format: "tar.gz",
      archiveHash: row.archive_hash,
      sourceHash: row.source_hash,
      bytes: row.bytes,
      fileCount: row.file_count,
      createdAt: row.created_at,
    });
  }

  createAction(actorId: string, input: ActionSpec, now = Date.now(), ttlMs = 10 * 60_000, onCreated?: (action: Action) => void): Action {
    const spec = parseActionSpec(input);
    ensure(ttlMs > 0 && ttlMs <= 10 * 60_000, "INVALID_INPUT", "مهلت تأیید معتبر نیست.");
    return this.transaction(() => {
      this.ensureNoConflict(spec);
      this.assertActionContext(actorId, spec);
      if (
        ((spec.version === 2 || spec.version === 3 || spec.version === 4 || spec.version === 5 || (spec.version === 7 || spec.version === 10 || spec.version === 11 || spec.version === 15 || spec.version === 17)) &&
        spec.operation === "deploy") || (spec.version === 8 || spec.version === 12 || spec.version === 16 || spec.version === 18) || spec.version === 9 || spec.version === 13
      ) {
        const artifact = this.getArtifact(actorId, spec.artifactHash ?? "");
        ensure(
          artifact.sourceHash === spec.sourceHash,
          "ARTIFACT_MISMATCH",
          "بسته به همین محتوای source تعلق ندارد.",
          409,
        );
      }
      const action: Action = {
        id: randomUUID(),
        actorId,
        spec,
        hash: fingerprint({ actorId, spec }),
        state: "awaiting_approval",
        createdAt: now,
        expiresAt: now + ttlMs,
        attemptId: null,
        remoteId: null,
        errorCode: null,
      };
      if (spec.version === 6)
        this.db.prepare("UPDATE actions SET state='cancelled' WHERE actor_id=? AND team_id=? AND app=? AND state IN ('awaiting_approval','approved') AND json_extract(spec,'$.version')=6")
          .run(actorId, spec.scope.teamId, spec.scope.app);
      this.db
        .prepare(
          "INSERT INTO actions(id,actor_id,spec,hash,state,team_id,app,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .run(
          action.id,
          actorId,
          JSON.stringify(spec),
          action.hash,
          action.state,
          spec.scope.teamId,
          spec.scope.app,
          now,
          action.expiresAt,
        );
      this.audit(action, "proposed", now);
      if (spec.version === 9) {
        const linked = this.db.prepare("UPDATE environment_inputs SET action_id=? WHERE id=? AND actor_id=? AND action_id IS NULL AND expires_at>?")
          .run(action.id, spec.secretRef, actorId, now);
        ensure(linked.changes === 1, "ENV_INPUT_EXPIRED", "اطلاعات امن مصرف شده یا منقضی است.", 409);
      }
      if (spec.version === 3 || spec.version === 4 || spec.version === 5 || (spec.version === 7 || spec.version === 10 || spec.version === 11 || spec.version === 15 || spec.version === 17) || (spec.version === 8 || spec.version === 12 || spec.version === 16 || spec.version === 18) || spec.version === 9 || spec.version === 13) {
        const flow = this.getProjectFlow(actorId);
        if (flow) this.invalidateProjectAction(flow, actorId);
        this.db
          .prepare("UPDATE project_flows SET action_id=? WHERE id=? AND actor_id=?")
          .run(action.id, spec.projectFlowId, actorId);
      }
      onCreated?.(action);
      return action;
    });
  }

  getAction(id: string, actorId: string): Action {
    const row = this.db.prepare("SELECT * FROM actions WHERE id=? AND actor_id=?").get(id, actorId);
    ensure(row, "NOT_FOUND", "این اقدام پیدا نشد.", 404);
    const action = actionRow(row);
    const progress = this.db
      .prepare("SELECT data_json FROM deployment_progress WHERE action_id=?")
      .get(id);
    const restart = this.db.prepare("SELECT data_json FROM restart_progress WHERE action_id=?").get(id);
    const provision = this.db.prepare("SELECT data_json FROM provision_progress WHERE action_id=?").get(id);
    const environment = this.db.prepare("SELECT data_json FROM environment_progress WHERE action_id=?").get(id);
    const network = this.db.prepare("SELECT data_json FROM network_progress WHERE action_id=?").get(id);
    const lifecycle = this.db.prepare("SELECT data_json FROM lifecycle_progress WHERE action_id=?").get(id);
    return {
      ...action,
      ...(progress ? { deployment: parseDeploymentProgress(JSON.parse(string(progress.data_json, 4096))) } : {}),
      ...(restart ? { restart: parseRestartProgress(JSON.parse(string(restart.data_json, 4096))) } : {}),
      ...(provision ? { provision: parseProvisionProgress(JSON.parse(string(provision.data_json, 4096))) } : {}),
      ...(environment ? { environment: parseEnvironmentProgress(JSON.parse(string(environment.data_json, 4096))) } : {}),
      ...(network ? { network: parseNetworkProgress(JSON.parse(string(network.data_json, 4096))) } : {}),
      ...(lifecycle ? { lifecycle: parseLifecycleProgress(JSON.parse(string(lifecycle.data_json, 4096))) } : {}),
    };
  }

  listActions(actorId: string, now = Date.now()): Action[] {
    this.db
      .prepare(
        "UPDATE actions SET state='expired' WHERE actor_id=? AND expires_at<=? AND state IN ('awaiting_approval','approved')",
      )
      .run(actorId, now);
    return this.db
      .prepare(
        "SELECT * FROM actions WHERE actor_id=? ORDER BY created_at DESC, rowid DESC LIMIT 20",
      )
      .all(actorId)
      .map((row) => this.getAction(string(row.id), actorId));
  }

  incidentActions(actorId: string, runId: string): Action[] {
    // A historical export must not expire approvals or depend on the workspace's last twenty actions.
    return this.db.prepare(
      "SELECT a.id FROM actions a JOIN restart_progress p ON p.action_id=a.id WHERE a.actor_id=? AND json_extract(a.spec,'$.version')=6 AND json_extract(a.spec,'$.incidentRunId')=? AND (a.state IN ('executing','observing','uncertain') OR json_extract(p.data_json,'$.observation.checkedAt') IS NOT NULL) ORDER BY a.state IN ('executing','observing','uncertain') DESC,json_extract(p.data_json,'$.observation.checkedAt') DESC,a.rowid DESC LIMIT 20",
    ).all(actorId, runId).map((row) => this.getAction(string(row.id), actorId));
  }

  decide(
    id: string,
    actorId: string,
    sessionId: string,
    expectedHash: string,
    decision: "approve" | "reject",
    now = Date.now(),
    afterDecision?: (action: Action) => void,
    options: { acknowledgeUnknownCost?: boolean } = {},
  ): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(
        action.hash === expectedHash,
        "STALE_ACTION",
        "پیشنهاد تغییر کرده است؛ دوباره بررسی کنید.",
        409,
      );
      // Dismissing obsolete consent removes authority; stale context or expiry must not trap the conversation.
      if (decision === "approve") {
        this.assertActionContext(actorId, action.spec, id);
        ensure(action.expiresAt > now, "APPROVAL_EXPIRED", "مهلت تأیید گذشته است؛ پیشنهاد تازه بسازید.", 409);
        if (action.spec.version === 13) ensure(options.acknowledgeUnknownCost === true,
          "UNKNOWN_COST_ACK_REQUIRED", "تعرفه مستقل شبکه مشخص نیست؛ پذیرش صریح این هزینه نامعلوم لازم است.", 409);
      }
      ensure(
        action.state === "awaiting_approval" || (decision === "reject" && action.state === "expired"),
        "ACTION_CONFLICT",
        "این پیشنهاد قبلاً پاسخ گرفته است.",
        409,
      );
      this.db
        .prepare("UPDATE actions SET state=?,approval_session_id=? WHERE id=?")
        .run(decision === "approve" ? "approved" : "cancelled", sessionId, id);
      this.audit(action, decision === "approve" ? "approved" : "rejected", now);
      if (decision === "approve" && action.spec.version === 13) this.audit(action, "unknown_network_cost_acknowledged", now);
      const decided = this.getAction(id, actorId);
      // The run transition and approval must commit together; a crash cannot leave a hidden approved write.
      afterDecision?.(decided);
      return decided;
    });
  }

  private ensureNoConflict(spec: ActionSpec, except = ""): void {
    if (spec.version === 13) ensure(!this.db.prepare("SELECT id FROM actions WHERE team_id=? AND id<>? AND json_extract(spec,'$.version')=13 AND state IN ('executing','observing','uncertain') LIMIT 1")
      .get(spec.scope.teamId, except), "UNRESOLVED_EFFECT", "نتیجه ساخت شبکه قبلی همین تیم روشن نیست؛ ساخت دیگری مجاز نیست.", 409);
    const conflict = this.db
      .prepare(
        "SELECT id FROM actions WHERE team_id=? AND app=? AND id<>? AND state IN ('executing','observing','uncertain')",
      )
      .get(spec.scope.teamId, spec.scope.app, except);
    ensure(
      !conflict,
      "UNRESOLVED_EFFECT",
      "نتیجه اقدام قبلی این برنامه روشن نیست؛ ابتدا همان نتیجه را بررسی کنید.",
      409,
    );
  }

  private invalidatePendingAgentDecisions(actorId: string, projectId: string | null = null): void {
    for (const row of this.db.prepare("SELECT id,revision,data_json FROM agent_runs WHERE actor_id=? AND state='needs_approval' AND (? IS NULL OR json_extract(data_json,'$.projectId')=?)").all(actorId, projectId, projectId)) {
      this.db.prepare("UPDATE mission_authorities SET state='revoked' WHERE actor_id=? AND run_id=? AND state IN ('proposed','approved')").run(actorId, string(row.id, 36));
      const data = object(JSON.parse(string(row.data_json, 512 * 1024)));
      for (const value of [data.publication, data.destination, data.network]) {
        if (!value) continue;
        const action = this.getAction(string(object(value).id, 36), actorId);
        if (action.state === "awaiting_approval" || action.state === "approved") {
          this.db.prepare("UPDATE actions SET state='cancelled',error_code='AGENT_CONTEXT_CHANGED' WHERE id=? AND actor_id=? AND attempt_id IS NULL").run(action.id, actorId);
        }
      }
      if (data.repair) this.db.prepare("UPDATE code_repair_jobs SET state='cancelled' WHERE id=? AND actor_id=? AND state='proposed'").run(string(object(data.repair).id, 36), actorId);
      const now = Date.now(), events = Array.isArray(data.events) ? data.events : [];
      const next = { ...data, state: "cancelled", revision: Number(row.revision) + 1, updatedAt: now,
        errorCode: "AGENT_CONTEXT_CHANGED", nextAction: "reply", question: null,
        events: events.length >= 160 ? events : [...events, { sequence: events.length + 1, kind: "state", at: now,
          message: "پروژه یا مقصد تغییر کرد؛ تصمیم قبلی اجرا نمی‌شود. اثرها و رسیدهای ثبت‌شده حفظ شدند." }] };
      this.db.prepare("UPDATE agent_runs SET state='cancelled',revision=?,updated_at=?,data_json=? WHERE actor_id=? AND id=? AND revision=?")
        .run(next.revision, now, JSON.stringify(next), actorId, string(row.id, 36), Number(row.revision));
    }
  }

  assertAgentIdle(actorId: string, actionId: string | null = null, allowPendingDecision = false, resumingRunId: string | null = null): void {
    if (actionId === null) ensure(!this.db.prepare("SELECT id FROM actions WHERE actor_id=? AND json_extract(spec,'$.version') IN (9,13,14) AND state IN ('awaiting_approval','approved','executing','observing','uncertain') AND (expires_at>? OR state IN ('executing','observing','uncertain')) LIMIT 1").get(actorId, Date.now()),
      "UNRESOLVED_EFFECT", "ابتدا نتیجه تغییر اطلاعات برنامه را بررسی کنید.", 409);
    const active = this.db.prepare(
      "SELECT id FROM agent_runs WHERE actor_id=? AND (? IS NULL OR id<>?) AND (state IN ('queued','working') OR (state='needs_approval' AND ?=0)) AND (? IS NULL OR (COALESCE(json_extract(data_json,'$.publication.id'),'')<>? AND COALESCE(json_extract(data_json,'$.destination.id'),'')<>? AND COALESCE(json_extract(data_json,'$.network.id'),'')<>?)) LIMIT 1",
    ).get(actorId, resumingRunId, resumingRunId, allowPendingDecision ? 1 : 0, actionId, actionId, actionId, actionId);
    ensure(!active, "AGENT_BUSY", "یک مأموریت یا تصمیم در جریان است؛ ابتدا آن را تمام یا متوقف کنید. تغییر تب، مجوز عملیات موازی نمی‌دهد.", 409);
    if (actionId === null) ensure(!this.db.prepare("SELECT a.id FROM actions a JOIN agent_runs r ON r.actor_id=a.actor_id AND (json_extract(r.data_json,'$.publication.id')=a.id OR json_extract(r.data_json,'$.destination.id')=a.id OR json_extract(r.data_json,'$.network.id')=a.id) WHERE a.actor_id=? AND json_extract(r.data_json,'$.mission.kind')='publication' AND a.state IN ('executing','observing','uncertain') LIMIT 1").get(actorId),
      "UNRESOLVED_EFFECT", "نتیجه عملیات قبلی هنوز قطعی نیست؛ ابتدا همان رسید را بررسی کنید.", 409);
  }

  claim(
    id: string,
    actorId: string,
    sessionId: string,
    current: ActionSpec,
    now = Date.now(),
  ): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      const row = this.db.prepare("SELECT approval_session_id FROM actions WHERE id=?").get(id);
      this.assertAgentIdle(actorId, id);
      this.assertActionContext(actorId, action.spec, id);
      assertMissionActionClaim(this, actorId, sessionId, action, now);
      ensure(
        action.state === "approved" && !action.attemptId,
        "ACTION_CONFLICT",
        "این اقدام مجوز قابل مصرف ندارد یا قبلاً اجرا شده است.",
        409,
      );
      ensure(
        row?.approval_session_id === sessionId,
        "APPROVAL_SESSION",
        "تأیید به نشست دیگری تعلق دارد.",
        403,
      );
      ensure(action.expiresAt > now, "APPROVAL_EXPIRED", "مهلت تأیید گذشته است.", 409);
      if (action.spec.version === 13) ensure(this.db.prepare("SELECT action_id FROM audit_events WHERE action_id=? AND event='unknown_network_cost_acknowledged'").get(id),
        "UNKNOWN_COST_ACK_REQUIRED", "پذیرش هزینه نامعلوم شبکه ثبت نشده است.", 409);
      ensure(
        action.hash === fingerprint({ actorId, spec: parseActionSpec(current) }),
        "STALE_ACTION",
        "مقصد، آرگومان یا source تغییر کرده است؛ تأیید تازه لازم است.",
        409,
      );
      this.ensureNoConflict(action.spec, id);
      const attemptId = randomUUID();
      this.db
        .prepare("INSERT INTO attempts(id,action_id,started_at) VALUES (?,?,?)")
        .run(attemptId, id, now);
      const changed = this.db
        .prepare(
          "UPDATE actions SET state='executing',consumed_at=?,attempt_id=? WHERE id=? AND state='approved' AND consumed_at IS NULL",
        )
        .run(now, attemptId, id);
      ensure(changed.changes === 1, "ACTION_CONFLICT", "تأیید قبلاً مصرف شده است.", 409);
      if (isDeploymentSpec(action.spec))
        this.writeDeploymentProgress(id, {
          stage: "claimed",
          sourceId: null,
          observation: null,
        });
      if (action.spec.version === 6)
        this.writeRestartProgress(id, { stage: "claimed", acceptedAt: null, observation: null });
      if ((action.spec.version === 8 || action.spec.version === 12 || action.spec.version === 16 || action.spec.version === 18))
        this.writeProvisionProgress(id, { stage: "claimed", appId: null, observation: null });
      if (action.spec.version === 9) this.writeEnvironmentProgress(id, { stage: "claimed", checkedAt: null, outcome: null });
      if (action.spec.version === 13) this.writeNetworkProgress(id, { stage: "claimed", acceptedAt: null, networkId: null, observation: null });
      if (action.spec.version === 14) {
        this.db.prepare("INSERT INTO lifecycle_progress VALUES (?,?)").run(id, JSON.stringify({ stage: "claimed", checkedAt: null, outcome: null }));
        this.db.prepare("UPDATE mission_authorities SET state='revoked' WHERE actor_id=? AND state IN ('proposed','approved') AND run_id IN (SELECT id FROM agent_runs WHERE actor_id=? AND json_extract(data_json,'$.context.target.appId')=?)").run(actorId, actorId, action.spec.targetAppId);
      }
      this.audit(action, "claimed", now);
      return this.getAction(id, actorId);
    });
  }

  receipt(id: string, actorId: string, remoteId: string, now = Date.now()): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version !== 14, "LIFECYCLE_RECEIPT_REQUIRED", "این اقدام رسید مدیریت مقصد لازم دارد.", 409);
      ensure(action.spec.version !== 6, "RESTART_RECEIPT_REQUIRED", "راه‌اندازی دوباره رسید انتشار ندارد.", 409);
      ensure(action.spec.version !== 9, "ENV_RECEIPT_REQUIRED", "تغییر اطلاعات برنامه رسید انتشار ندارد.", 409);
      ensure(
        action.state === "executing",
        "ACTION_CONFLICT",
        "این اقدام منتظر پاسخ اجرا نیست.",
        409,
      );
      const safeId = string(remoteId, 128);
      if ((action.spec.version === 8 || action.spec.version === 12 || action.spec.version === 16 || action.spec.version === 18))
        ensure(action.provision?.stage === "created" && action.provision.appId === safeId,
          "PROVISION_RECEIPT_REQUIRED", "رسید داخلی ساخت مقصد هنوز ثبت نشده است.", 409);
      if (action.spec.version === 13) ensure(action.network?.stage === "created" && action.network.networkId === safeId,
        "NETWORK_RECEIPT_REQUIRED", "هویت شبکه هنوز از سرویس خوانده و ثبت نشده است.", 409);
      ensure(
        /^[a-zA-Z0-9_-]+$/.test(safeId),
        "UPSTREAM_INVALID",
        "شناسه نتیجه سرویس معتبر نیست.",
        502,
      );
      if (isDeploymentSpec(action.spec)) {
        ensure(
          action.deployment?.stage === "release_started",
          "ACTION_CONFLICT",
          "رسید انتشار بدون مرحله ثبت‌شده پذیرفته نمی‌شود.",
          409,
        );
        this.writeDeploymentProgress(id, {
          ...action.deployment,
          stage: "release_accepted",
          ...((action.spec.version === 7 || action.spec.version === 10 || action.spec.version === 11 || action.spec.version === 15 || action.spec.version === 17) ? { releaseAcceptedAt: now } : {}),
        });
      }
      this.db
        .prepare("UPDATE actions SET state='observing',remote_id=? WHERE id=?")
        .run(safeId, id);
      this.db.prepare("UPDATE attempts SET remote_id=? WHERE action_id=?").run(safeId, id);
      this.audit(action, "accepted", now);
      return this.getAction(id, actorId);
    });
  }

  private writeEnvironmentProgress(id: string, progress: EnvironmentProgress): void {
    this.db.prepare("INSERT INTO environment_progress VALUES (?,?) ON CONFLICT(action_id) DO UPDATE SET data_json=excluded.data_json")
      .run(id, JSON.stringify(parseEnvironmentProgress(progress)));
  }
  invalidateEnvironmentPublication(id: string, actorId: string): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure((action.spec.version === 10 || (action.spec.version === 11 || action.spec.version === 17) && action.spec.environment !== null) && action.state === "approved" && !action.attemptId, "ACTION_CONFLICT", "این تصمیم دیگر قابل ابطال پیش از اجرا نیست.", 409);
      this.db.prepare("UPDATE actions SET state='failed',error_code='ENV_REFERENCE_CHANGED' WHERE id=?").run(id);
      this.audit(action, "environment_approval_invalidated", Date.now()); return this.getAction(id, actorId);
    });
  }
  lifecycleStep(id: string, actorId: string, stage: "request_started" | "accepted"): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version === 14 && action.state === "executing" && action.attemptId && action.lifecycle?.stage === (stage === "request_started" ? "claimed" : "request_started"),
        "ACTION_CONFLICT", "این مرحله قبلاً اجرا شده است.", 409);
      this.db.prepare("UPDATE lifecycle_progress SET data_json=? WHERE action_id=?").run(JSON.stringify({ stage, checkedAt: null, outcome: null }), id);
      if (stage === "accepted") this.db.prepare("UPDATE actions SET state='observing' WHERE id=?").run(id);
      this.audit(action, `lifecycle_${stage}`, Date.now()); return this.getAction(id, actorId);
    });
  }
  observeLifecycle(id: string, actorId: string, verification: LifecycleProgress["verification"], expected: number | null): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version === 14 && action.lifecycle && ["observing", "uncertain"].includes(action.state) && action.lifecycle.checkedAt === expected,
        "ACTION_CONFLICT", "رسید تغییر کرده است؛ وضعیت تازه را دریافت کنید.", 409);
      this.assertActionContext(actorId, action.spec);
      const verified = verification !== undefined;
      ensure(!verification || (action.spec.operation === "delete_app" ? verification === "destination_absent" : verification !== "destination_absent"), "EVIDENCE_MISMATCH", "نوع رسید با عملیات تطبیق ندارد.", 409);
      const progress: LifecycleProgress = { stage: action.lifecycle.stage, checkedAt: Math.max(Date.now(), (expected ?? 0) + 1), outcome: verified ? "verified" : "inconclusive", ...(verification ? { verification } : {}) };
      this.db.prepare("UPDATE lifecycle_progress SET data_json=? WHERE action_id=?").run(JSON.stringify(progress), id);
      this.db.prepare("UPDATE actions SET state=?,error_code=? WHERE id=?").run(verified ? "succeeded" : "uncertain", verified ? null : "LIFECYCLE_READBACK_UNCONFIRMED", id);
      if (verified && action.spec.operation === "delete_app") {
        const connection = this.getConnection(actorId, "liara");
        const removedId = action.spec.targetAppId;
        if (connection) this.saveConnection(actorId, { ...connection, view: { ...connection.view, selectedApp: null, apps: connection.view.apps.filter(app => app.id !== removedId) } });
        this.db.prepare("UPDATE actions SET state='cancelled',error_code='DESTINATION_REMOVED' WHERE actor_id=? AND team_id=? AND app=? AND id<>? AND state IN ('awaiting_approval','approved') AND attempt_id IS NULL")
          .run(actorId, action.spec.scope.teamId, action.spec.scope.app, id);
      }
      this.audit(action, verified ? "lifecycle_verified" : "lifecycle_inconclusive", progress.checkedAt ?? Date.now()); return this.getAction(id, actorId);
    });
  }
  projectRemoval(actorId: string, projectId: string): "local" | "destination" | "blocked" {
    const family = new Set<string>([...environmentProjectIds(this, actorId, projectId)]);
    for (const row of this.db.prepare("SELECT id FROM project_flows WHERE actor_id=?").all(actorId)) {
      const id = string(row.id, 36);
      if ([...environmentProjectIds(this, actorId, id)].some(parent => family.has(parent))) family.add(id);
    }
    const effects = this.db.prepare("SELECT id FROM actions WHERE actor_id=? AND attempt_id IS NOT NULL AND json_extract(spec,'$.operation') IN ('deploy','create_app','update_env')").all(actorId);
    for (const row of effects) {
      const action = this.getAction(string(row.id, 36), actorId), spec = action.spec;
      if (!("projectFlowId" in spec) || !family.has(spec.projectFlowId)) continue;
      const target = "targetAppId" in spec ? spec.targetAppId : action.provision?.appId;
      if (!target) return "blocked";
      const removed = this.db.prepare("SELECT id FROM actions WHERE actor_id=? AND state='succeeded' AND json_extract(spec,'$.version')=14 AND json_extract(spec,'$.operation')='delete_app' AND json_extract(spec,'$.targetAppId')=? AND team_id=? LIMIT 1")
        .get(actorId, target, spec.scope.teamId);
      if (!removed) return "destination";
    }
    return "local";
  }
  archiveProject(actorId: string, sessionId: string, id: string, sourceHash: string): void {
    this.transaction(() => {
      const flow = this.getProjectFlow(actorId, id);
      ensure(flow && flow.profile.sourceHash === sourceHash, "PROJECT_CHANGED", "این نسخهٔ پروژه پیدا نشد یا تغییر کرده است.", 409);
      if (this.db.prepare("SELECT project_id FROM project_archives WHERE project_id=? AND actor_id=?").get(id, actorId)) return;
      this.assertAgentIdle(actorId, null, true);
      ensure(!this.db.prepare("SELECT id FROM actions WHERE actor_id=? AND state IN ('executing','observing','uncertain') LIMIT 1").get(actorId) &&
        !this.db.prepare("SELECT job_id FROM coding_agent_executions WHERE actor_id=? AND state IN ('dispatched','uncertain') LIMIT 1").get(actorId), "UNRESOLVED_EFFECT", "ابتدا نتیجهٔ عملیات قبلی را بررسی کنید.", 409);
      ensure(this.projectRemoval(actorId, id) === "local", "DESTINATION_REMOVAL_REQUIRED", "ابتدا پروژه را باز کنید و مقصد لیارا را از پنل متوقف و حذف کنید.", 409);
      this.invalidateProjectAction(flow, actorId); this.invalidatePendingAgentDecisions(actorId, id);
      this.db.prepare("UPDATE mission_authorities SET state='revoked' WHERE actor_id=? AND state IN ('proposed','approved') AND run_id IN (SELECT id FROM agent_runs WHERE actor_id=? AND json_extract(data_json,'$.projectId')=?)").run(actorId, actorId, id);
      this.db.prepare("INSERT INTO project_archives VALUES (?,?,?,?,?)").run(id, actorId, sourceHash, Date.now(), sessionId);
      this.db.prepare("DELETE FROM operator_progress WHERE actor_id=? AND project_flow_id=?").run(actorId, id);
    });
  }
  revokeEnvironmentApproval(id: string, actorId: string, expectedHash: string): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      // A new authenticated session may remove unused authority; it cannot inherit or replay that grant.
      ensure(action.spec.version === 9 && action.hash === expectedHash && action.state === "approved" && !action.attemptId,
        "ACTION_CONFLICT", "این تصمیم وارد اجرا شده یا تغییر کرده است؛ نتیجه همان تغییر را بخوانید.", 409);
      this.db.prepare("UPDATE actions SET state='cancelled' WHERE id=?").run(id);
      this.audit(action, "environment_approval_revoked", Date.now()); return this.getAction(id, actorId);
    });
  }
  environmentStep(id: string, actorId: string, stage: "request_started" | "accepted"): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version === 9 && action.state === "executing" && action.attemptId && action.environment &&
        action.environment.stage === (stage === "request_started" ? "claimed" : "request_started"), "ACTION_CONFLICT", "ترتیب تغییر اطلاعات برنامه معتبر نیست.", 409);
      this.writeEnvironmentProgress(id, { stage, checkedAt: null, outcome: null });
      if (stage === "accepted") this.db.prepare("UPDATE actions SET state='observing' WHERE id=?").run(id);
      this.audit(action, `environment_${stage}`, Date.now()); return this.getAction(id, actorId);
    });
  }
  observeEnvironment(id: string, actorId: string, outcome: "verified" | "inconclusive" | "not_started", expectedCheckedAt: number | null): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version === 9 && action.environment && ["observing", "uncertain"].includes(action.state) && action.environment.checkedAt === expectedCheckedAt &&
        (outcome !== "not_started" || action.environment.stage === "claimed"), "ACTION_CONFLICT", "وضعیت بررسی اطلاعات برنامه تغییر کرده است.", 409);
      const checkedAt = Math.max(Date.now(), (expectedCheckedAt ?? 0) + 1);
      this.writeEnvironmentProgress(id, { ...action.environment, checkedAt, outcome });
      this.db.prepare("UPDATE actions SET state=?,error_code=? WHERE id=?")
        .run(outcome === "verified" ? "succeeded" : outcome === "not_started" ? "failed" : "uncertain", outcome === "inconclusive" ? "ENV_READBACK_UNCONFIRMED" : null, id);
      this.audit(action, `environment_${outcome}`, checkedAt); return this.getAction(id, actorId);
    });
  }

  private writeNetworkProgress(id: string, progress: NetworkProgress): void {
    this.db.prepare("INSERT INTO network_progress VALUES (?,?) ON CONFLICT(action_id) DO UPDATE SET data_json=excluded.data_json")
      .run(id, JSON.stringify(parseNetworkProgress(progress)));
  }
  startNetworkRequest(id: string, actorId: string): void {
    this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version === 13 && action.state === "executing" && action.attemptId && action.network?.stage === "claimed",
        "ACTION_CONFLICT", "درخواست ساخت شبکه قبلاً شروع شده یا مجوز ندارد.", 409);
      this.assertProjectAction(actorId, action.spec, id);
      this.writeNetworkProgress(id, { ...action.network, stage: "request_started" });
      this.audit(action, "network_request_started", Date.now());
    });
  }
  acceptNetwork(id: string, actorId: string): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version === 13 && action.state === "executing" && action.network?.stage === "request_started",
        "ACTION_CONFLICT", "این شبکه منتظر رسید پذیرش نیست.", 409);
      this.writeNetworkProgress(id, { ...action.network, stage: "accepted", acceptedAt: Date.now() });
      this.db.prepare("UPDATE actions SET state='observing' WHERE id=?").run(id);
      this.audit(action, "network_accepted", Date.now());
      return this.getAction(id, actorId);
    });
  }
  recordNetworkObservation(id: string, actorId: string, expectedCheckedAt: number | null,
    proof: { accountId: string; teamId: string; id: string; name: string; observedAt: number } | null): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId), progress = action.network;
      ensure(action.spec.version === 13 && progress && (action.state === "observing" || action.state === "uncertain") &&
        (progress.observation?.checkedAt ?? null) === expectedCheckedAt, "ACTION_CONFLICT", "وضعیت بررسی شبکه تغییر کرده است.", 409);
      const spec = action.spec, connection = this.getConnection(actorId, "liara")?.view;
      ensure(connection?.status === "connected" && connection.identityId === spec.accountId && connection.teamId === spec.scope.teamId,
        "SCOPE_DENIED", "حساب بررسی شبکه تغییر کرده است.", 403);
      const checkedAt = Math.max(Date.now(), (expectedCheckedAt ?? 0) + 1),
        verified = proof !== null && progress.acceptedAt !== null && (progress.stage === "accepted" || progress.stage === "created");
      if (proof) ensure(proof.accountId === spec.accountId && proof.teamId === spec.scope.teamId && proof.name === spec.networkName &&
        proof.observedAt >= (progress.acceptedAt ?? checkedAt) && proof.observedAt <= checkedAt && (!progress.networkId || proof.id === progress.networkId),
        "EVIDENCE_MISMATCH", "هویت شبکه به همین درخواست پذیرفته‌شده تعلق ندارد.", 409);
      const notStarted = action.state === "uncertain" && progress.stage === "claimed";
      const observation: NonNullable<NetworkProgress["observation"]> = {
        outcome: verified ? "verified" : notStarted ? "not_started" : "inconclusive",
        code: verified ? "NETWORK_VERIFIED" : notStarted ? "NETWORK_NOT_STARTED" : "NETWORK_RECEIPT_UNKNOWN", checkedAt,
      };
      const networkId = verified && proof ? providerObjectId(proof.id) : progress.networkId;
      this.writeNetworkProgress(id, { ...progress, stage: verified ? "created" : progress.stage, networkId, observation });
      this.db.prepare("UPDATE actions SET state=?,remote_id=?,error_code=? WHERE id=?")
        .run(verified ? "succeeded" : notStarted ? "failed" : "uncertain", networkId, verified ? null : observation.code, id);
      if (networkId) this.db.prepare("UPDATE attempts SET remote_id=? WHERE action_id=?").run(networkId, id);
      this.audit(action, `network_${observation.outcome}`, checkedAt);
      return this.getAction(id, actorId);
    });
  }

  private writeProvisionProgress(id: string, progress: ProvisionProgress): void {
    this.db.prepare("INSERT INTO provision_progress VALUES (?,?) ON CONFLICT(action_id) DO UPDATE SET data_json=excluded.data_json")
      .run(id, JSON.stringify(parseProvisionProgress(progress)));
  }

  provisionStep(id: string, actorId: string, stage: "request_started" | "created", appId: string | null = null): void {
    this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure((action.spec.version === 8 || action.spec.version === 12 || action.spec.version === 16 || action.spec.version === 18) && action.state === "executing" && action.attemptId &&
        ((stage === "request_started" && action.provision?.stage === "claimed" && appId === null) ||
          (stage === "created" && action.provision?.stage === "request_started" && appId !== null)),
        "ACTION_CONFLICT", "مرحله ساخت مقصد تکراری یا خارج از ترتیب است.", 409);
      if (stage === "request_started") this.assertProjectAction(actorId, action.spec, id);
      if (appId !== null) providerObjectId(appId);
      this.writeProvisionProgress(id, { stage, appId, observation: null });
      this.audit(action, `provision_${stage}`, Date.now());
    });
  }

  recordProvisionObservation(id: string, actorId: string, observation: ProvisionObservation, proof: ProvisionReadback | null): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId), progress = action.provision;
      ensure((action.spec.version === 8 || action.spec.version === 12 || action.spec.version === 16 || action.spec.version === 18) && progress && (action.state === "observing" || action.state === "uncertain"),
        "ACTION_CONFLICT", "ساخت مقصد نتیجه‌ای منتظر بررسی ندارد.", 409);
      const spec = action.spec, connection = this.getConnection(actorId, "liara"),
        started = this.db.prepare("SELECT started_at FROM attempts WHERE action_id=?").get(id);
      ensure(connection?.view.status === "connected" && connection.view.identityId === spec.accountId && connection.view.teamId === spec.scope.teamId,
        "SCOPE_DENIED", "حساب ساخت مقصد تغییر کرده است.", 403);
      ensure(started && observation.checkedAt >= Number(started.started_at) && observation.checkedAt > (progress.observation?.checkedAt ?? 0),
        "EVIDENCE_MISMATCH", "زمان بررسی ساخت مقصد معتبر نیست.", 409);
      if (proof) ensure(proof.scope.app === spec.scope.app && proof.scope.teamId === spec.scope.teamId &&
        proof.observedAt >= Number(started.started_at) && proof.observedAt <= observation.checkedAt,
        "EVIDENCE_MISMATCH", "پاسخ خوانده‌شده متعلق به همین مقصد و زمان نیست.", 409);
      const matches = proof && progress.stage === "created" && progress.appId === proof.id && proof.platform === actionPlatform(spec) &&
        proof.planId === spec.args.planId && proof.bundleId === spec.bundleId && proof.networkId === spec.networkId && proof.readOnlyRootFilesystem === true;
      ensure(observation.outcome !== "verified" || matches, "EVIDENCE_MISMATCH", "هویت یا تنظیمات برنامه ساخته‌شده با پیشنهاد برابر نیست.", 409);
      ensure(observation.outcome !== "changed" || (proof && !matches), "EVIDENCE_MISMATCH", "تغییر مقصد شاهد معتبر ندارد.", 409);
      ensure(observation.outcome !== "not_started" || (action.state === "uncertain" && progress.stage === "claimed" && observation.code === "CREATE_NOT_STARTED"),
        "EVIDENCE_MISMATCH", "درخواست شروع‌شده، اجرا‌نشده فرض نمی‌شود.", 409);
      this.writeProvisionProgress(id, { ...progress, observation });
      const state = observation.outcome === "verified" ? "succeeded"
        : observation.outcome === "changed" || observation.outcome === "not_started" ? "failed" : action.state;
      this.db.prepare("UPDATE actions SET state=?,error_code=?,remote_id=COALESCE(remote_id,?) WHERE id=?")
        .run(state, state === "succeeded" ? null : observation.code, progress.appId, id);
      if (progress.appId) this.db.prepare("UPDATE attempts SET remote_id=? WHERE action_id=?").run(progress.appId, id);
      if (state === "succeeded" && proof) {
        const flow = this.getProjectFlow(actorId), previous = connection.view.apps.find((app) => app.name === connection.view.selectedApp)?.id ?? null;
        const select = flow?.id === spec.projectFlowId && flow.status === "ready" && flow.actionId === id &&
          flow.profile.sourceHash === spec.sourceHash && previous === spec.previousAppId;
        this.saveConnection(actorId, { ...connection, view: { ...connection.view, checkedAt: Date.now(),
          apps: [...connection.view.apps.filter((app) => app.name !== spec.scope.app), { name: spec.scope.app, id: proof.id, platform: proof.platform }],
          selectedApp: select ? spec.scope.app : connection.view.selectedApp } });
        if (select && proof.defaultSubdomain === true && !this.getProbeOrigin(actorId, spec.scope.teamId, spec.scope.app)) {
          // Only an enabled provider-owned subdomain on the exact returned app may supply the first probe target.
          this.setProbeOrigin(actorId, spec.scope, `https://${spec.scope.app}.liara.run`);
        }
      }
      this.audit(action, `provision_${observation.outcome}`, observation.checkedAt);
      return this.getAction(id, actorId);
    });
  }

  private writeRestartProgress(id: string, progress: RestartProgress): void {
    this.db.prepare("INSERT INTO restart_progress VALUES (?,?) ON CONFLICT(action_id) DO UPDATE SET data_json=excluded.data_json")
      .run(id, JSON.stringify(parseRestartProgress(progress)));
  }

  startRestartRequest(id: string, actorId: string): void {
    this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version === 6 && action.state === "executing" && action.attemptId &&
        action.restart?.stage === "claimed", "ACTION_CONFLICT", "اجرای معتبر راه‌اندازی دوباره آغاز نشده است.", 409);
      this.assertRestartAction(actorId, action.spec);
      this.writeRestartProgress(id, { stage: "request_started", acceptedAt: null, observation: null });
      this.audit(action, "restart_request_started", Date.now());
    });
  }

  acceptRestart(id: string, actorId: string, now = Date.now()): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version === 6 && action.state === "executing" && action.restart?.stage === "request_started",
        "ACTION_CONFLICT", "این اقدام منتظر پذیرش درخواست نیست.", 409);
      this.writeRestartProgress(id, { stage: "accepted", acceptedAt: now, observation: null });
      this.db.prepare("UPDATE actions SET state='observing' WHERE id=?").run(id);
      this.audit(action, "restart_accepted", now);
      return this.getAction(id, actorId);
    });
  }

  recordRestartObservation(id: string, actorId: string, input: RestartObservation, expectedCheckedAt: number | null): Action {
    const observation = parseRestartObservation(input);
    return this.transaction(() => {
      const action = this.getAction(id, actorId), progress = action.restart;
      ensure(action.spec.version === 6 && progress && canReadRestartResult(action),
        "ACTION_CONFLICT", "این اقدام نتیجه قابل بررسی ندارد.", 409);
      this.assertRestartAction(actorId, action.spec, false);
      const attempt = this.db.prepare("SELECT started_at FROM attempts WHERE action_id=?").get(id);
      ensure((progress.observation?.checkedAt ?? null) === expectedCheckedAt &&
        observation.checkedAt >= Number(attempt?.started_at) &&
        observation.checkedAt > (progress.observation?.checkedAt ?? 0),
      "EVIDENCE_MISMATCH", "بررسی تازه‌تری ثبت شده است؛ نتیجه ذخیره‌شده را دوباره بخوانید.", 409);
      if (observation.outcome === "responding" || observation.outcome === "unhealthy")
        ensure(observation.releaseId === action.spec.targetReleaseId && observation.status !== null &&
          observation.observedAt !== null && observation.observedAt >= Number(attempt?.started_at) &&
          observation.observedAt <= observation.checkedAt && observation.checkedAt - observation.observedAt <= 900_000 &&
          (observation.outcome === "responding" ? observation.status >= 200 && observation.status < 300 : observation.status >= 300),
        "EVIDENCE_MISMATCH", "پاسخ باید متعلق به همان صفحه و نسخه باشد.", 409);
      if (observation.outcome === "not_started")
        ensure(action.state === "uncertain" && progress.stage === "claimed" && progress.acceptedAt === null,
          "EVIDENCE_MISMATCH", "درخواست شروع‌شده را نمی‌توان اجرا‌نشده فرض کرد.", 409);
      this.writeRestartProgress(id, { ...progress, observation });
      // Success here means accepted + same-page response, never proof of a container restart.
      const state = observation.outcome === "not_started" ? "failed"
        : progress.stage !== "accepted" ? action.state
        : observation.outcome === "responding" ? "succeeded"
        : observation.outcome === "unhealthy" || observation.outcome === "changed" ? "failed" : "observing";
      this.db.prepare("UPDATE actions SET state=?,error_code=? WHERE id=?")
        .run(state, state === "succeeded" ? null : observation.code, id);
      this.audit(action, `restart_${observation.outcome}`, observation.checkedAt);
      return this.getAction(id, actorId);
    });
  }

  private writeDeploymentProgress(id: string, progress: DeploymentProgress): void {
    this.db
      .prepare(
        "INSERT INTO deployment_progress VALUES (?,?) ON CONFLICT(action_id) DO UPDATE SET data_json=excluded.data_json",
      )
      .run(id, JSON.stringify(parseDeploymentProgress(progress)));
  }

  deploymentStep(
    id: string,
    actorId: string,
    stage: "upload_started" | "uploaded" | "release_started",
    sourceId: string | null = null,
  ): void {
    this.transaction(() => {
      const action = this.getAction(id, actorId),
        previous = action.deployment;
      ensure(
        isDeploymentSpec(action.spec) && action.state === "executing" && action.attemptId,
        "ACTION_CONFLICT",
        "اجرای انتشار claim نشده است.",
        409,
      );
      if (stage !== "uploaded") this.assertProjectAction(actorId, action.spec, id);
      ensure(
        (stage === "upload_started" && previous?.stage === "claimed" && sourceId === null) ||
          (stage === "uploaded" && previous?.stage === "upload_started" && sourceId !== null) ||
          (stage === "release_started" &&
            previous?.stage === "uploaded" &&
            previous.sourceId === sourceId),
        "ACTION_CONFLICT",
        "مرحله انتشار تکراری یا خارج از ترتیب است.",
        409,
      );
      if (sourceId !== null) sourceReceiptId(sourceId);
      this.writeDeploymentProgress(id, { stage, sourceId, observation: null });
      this.audit(action, stage, Date.now());
    });
  }

  recordDeploymentObservation(
    id: string,
    actorId: string,
    observation: DeploymentObservation,
  ): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(
        isDeploymentSpec(action.spec) &&
          action.deployment &&
          canReadDeploymentResult(action),
        "ACTION_CONFLICT",
        "این انتشار منتظر مشاهده نیست.",
        409,
      );
      const connection = this.getConnection(actorId, "liara")?.view;
      ensure(
        connection?.status === "connected" &&
          connection.teamId === action.spec.scope.teamId &&
        ((action.spec.version !== 7 && action.spec.version !== 10 && action.spec.version !== 11 && action.spec.version !== 15 && action.spec.version !== 17) || connection.identityId === action.spec.accountId) &&
          connection.selectedApp === action.spec.scope.app &&
          connection.apps.some(
            (app) =>
              app.name === action.spec.scope.app &&
              isDeploymentSpec(action.spec) &&
              app.id === action.spec.targetAppId,
          ),
        "SCOPE_DENIED",
        "برای مشاهده، همان برنامه و حساب را انتخاب کنید.",
        403,
      );
      ensure(
        observation.releaseId === action.remoteId &&
          (!action.deployment.observation ||
            observation.checkedAt > action.deployment.observation.checkedAt),
        "EVIDENCE_MISMATCH",
        "رسید یا زمان مشاهده تغییر کرده است.",
        409,
      );
      ensure(
        (observation.outcome !== "verified" && observation.outcome !== "failed") ||
          (action.remoteId && action.deployment.stage === "release_accepted"),
        "EVIDENCE_MISMATCH",
        "نتیجه موفق به رسید قطعی release نیاز دارد.",
        409,
      );
      ensure(
        observation.outcome !== "not_started" ||
          (action.state === "uncertain" &&
            action.remoteId === null &&
            ["claimed", "upload_started", "uploaded"].includes(action.deployment.stage) &&
            observation.code === "RELEASE_NOT_STARTED"),
        "EVIDENCE_MISMATCH",
        "درخواست انتشار شروع‌شده با نبود رسید، اجرا‌نشده فرض نمی‌شود.",
        409,
      );
      this.writeDeploymentProgress(id, { ...action.deployment, observation });
      const state =
        observation.outcome === "verified"
          ? "succeeded"
          : observation.outcome === "failed" || observation.outcome === "not_started"
            ? "failed"
            : action.state;
      this.db
        .prepare("UPDATE actions SET state=?,error_code=? WHERE id=?")
        .run(state, observation.outcome === "verified" ? null : observation.code, id);
      this.audit(action, `deployment_${observation.outcome}`, observation.checkedAt);
      return this.getAction(id, actorId);
    });
  }

  uncertain(id: string, actorId: string, now = Date.now()): void {
    this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(
        action.state === "executing" ||
          action.state === "observing" ||
          action.state === "uncertain",
        "ACTION_CONFLICT",
        "اقدام در مرحله مشاهده اثر نیست.",
        409,
      );
      this.db
        .prepare("UPDATE actions SET state='uncertain',error_code='UPSTREAM_UNCERTAIN' WHERE id=?")
        .run(id);
      this.audit(action, "uncertain", now);
    });
  }

  recoverInterrupted(now = Date.now()): number {
    return this.transaction(() => {
      this.db.prepare("UPDATE coding_agent_executions SET state='uncertain',data_json=json_set(data_json,'$.state','uncertain','$.completedAt',?,'$.code','PROCESS_INTERRUPTED') WHERE state='dispatched'").run(now);
      const rows = this.db
        .prepare("SELECT * FROM actions WHERE state='executing'")
        .all()
        .map(actionRow);
      for (const action of rows) {
        this.db
          .prepare(
            "UPDATE actions SET state='uncertain',error_code='PROCESS_INTERRUPTED' WHERE id=?",
          )
          .run(action.id);
        this.audit(action, "recovered_uncertain", now);
      }
      for (const raw of this.db
        .prepare(
          "SELECT id,actor_id,data_json FROM incident_runs WHERE json_extract(data_json,'$.analysis')='pending'",
        )
        .all()) {
        const run = parseIncidentRun(JSON.parse(string(raw.data_json, 262_144)));
        const recovered: IncidentRun = {
          ...run,
          analysis: "failed",
          analysisMessage:
            "پاسخ کامل بررسی قبلی در دسترس نیست. شواهد حفظ شده‌اند؛ توضیح خودکار تکرار نشد.",
          updatedAt: now,
        };
        this.db
          .prepare("UPDATE incident_runs SET data_json=?,updated_at=? WHERE id=? AND actor_id=?")
          .run(JSON.stringify(recovered), now, string(raw.id, 36), string(raw.actor_id, 128));
      }
      return rows.length;
    });
  }

  finishObservation(
    id: string,
    actorId: string,
    outcome: "healthy" | "failed" | "not_applied" | "unknown",
    now = Date.now(),
  ): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(action.spec.version !== 6, "RESTART_OBSERVATION_REQUIRED", "این اقدام باید با بازخوانی مخصوص راه‌اندازی دوباره بررسی شود.", 409);
      ensure(action.spec.version !== 13, "NETWORK_OBSERVATION_REQUIRED", "هویت شبکه باید از بازخوانی همان حساب و درخواست تأیید شود.", 409);
      ensure(action.spec.version !== 14, "LIFECYCLE_OBSERVATION_REQUIRED", "توقف و حذف باید از وضعیت واقعی همان مقصد تأیید شوند.", 409);
      ensure((action.spec.version !== 8 && action.spec.version !== 12 && action.spec.version !== 16 && action.spec.version !== 18), "PROVISION_OBSERVATION_REQUIRED", "ساخت مقصد باید با هویت و تنظیمات همان برنامه بررسی شود.", 409);
      ensure(
        !isDeploymentSpec(action.spec),
        "DEPLOYMENT_OBSERVATION_REQUIRED",
        "این انتشار باید با معیار پاسخ و نسخه خودش بررسی شود.",
        409,
      );
      ensure(
        action.state === "observing" || action.state === "uncertain",
        "ACTION_CONFLICT",
        "این اقدام نتیجه قابل بررسی ندارد.",
        409,
      );
      const state =
        outcome === "healthy" ? "succeeded" : outcome === "unknown" ? action.state : "failed";
      this.db
        .prepare("UPDATE actions SET state=?,error_code=? WHERE id=?")
        .run(
          state,
          outcome === "healthy"
            ? null
            : outcome === "unknown"
              ? action.errorCode
              : "VERIFICATION_FAILED",
          id,
        );
      this.audit(action, `observed_${outcome}`, now);
      return this.getAction(id, actorId);
    });
  }
}

export function storageError(error: unknown): AppError {
  return error instanceof AppError
    ? error
    : new AppError("STORAGE_UNAVAILABLE", "state پایدار در دسترس نیست؛ عملیات متوقف شد.", 503);
}
