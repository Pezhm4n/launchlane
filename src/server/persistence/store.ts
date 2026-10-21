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
import { migrations } from "./migrations.ts";

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

  rateLimitLogin(now = Date.now()): void {
    this.transaction(() => {
      const row = this.db
        .prepare("SELECT attempts,reset_at FROM login_limits WHERE bucket='operator'")
        .get();
      if (!row || Number(row.reset_at) <= now) {
        this.db
          .prepare("INSERT OR REPLACE INTO login_limits VALUES ('operator',1,?)")
          .run(now + 60_000);
      } else {
        ensure(
          Number(row.attempts) < 5,
          "RATE_LIMITED",
          "تلاش ورود زیاد است؛ یک دقیقه بعد دوباره تلاش کنید.",
          429,
        );
        this.db
          .prepare("UPDATE login_limits SET attempts=attempts+1 WHERE bucket='operator'")
          .run();
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

  createAction(actorId: string, input: ActionSpec, now = Date.now(), ttlMs = 10 * 60_000): Action {
    const spec = parseActionSpec(input);
    ensure(ttlMs > 0 && ttlMs <= 10 * 60_000, "INVALID_INPUT", "مهلت تأیید معتبر نیست.");
    return this.transaction(() => {
      this.ensureNoConflict(spec);
      if (spec.version === 2 && spec.operation === "deploy") {
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
      return action;
    });
  }

  getAction(id: string, actorId: string): Action {
    const row = this.db.prepare("SELECT * FROM actions WHERE id=? AND actor_id=?").get(id, actorId);
    ensure(row, "NOT_FOUND", "این اقدام پیدا نشد.", 404);
    return actionRow(row);
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
      .map(actionRow);
  }

  decide(
    id: string,
    actorId: string,
    sessionId: string,
    expectedHash: string,
    decision: "approve" | "reject",
    now = Date.now(),
  ): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(
        action.hash === expectedHash,
        "STALE_ACTION",
        "پیشنهاد تغییر کرده است؛ دوباره بررسی کنید.",
        409,
      );
      ensure(
        action.expiresAt > now,
        "APPROVAL_EXPIRED",
        "مهلت تأیید گذشته است؛ پیشنهاد تازه بسازید.",
        409,
      );
      ensure(
        action.state === "awaiting_approval",
        "ACTION_CONFLICT",
        "این پیشنهاد قبلاً پاسخ گرفته است.",
        409,
      );
      this.db
        .prepare("UPDATE actions SET state=?,approval_session_id=? WHERE id=?")
        .run(decision === "approve" ? "approved" : "cancelled", sessionId, id);
      this.audit(action, decision === "approve" ? "approved" : "rejected", now);
      return this.getAction(id, actorId);
    });
  }

  private ensureNoConflict(spec: ActionSpec, except = ""): void {
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
      this.audit(action, "claimed", now);
      return this.getAction(id, actorId);
    });
  }

  receipt(id: string, actorId: string, remoteId: string, now = Date.now()): Action {
    return this.transaction(() => {
      const action = this.getAction(id, actorId);
      ensure(
        action.state === "executing",
        "ACTION_CONFLICT",
        "این اقدام منتظر پاسخ اجرا نیست.",
        409,
      );
      const safeId = string(remoteId, 128);
      ensure(
        /^[a-zA-Z0-9_-]+$/.test(safeId),
        "UPSTREAM_INVALID",
        "شناسه نتیجه سرویس معتبر نیست.",
        502,
      );
      this.db
        .prepare("UPDATE actions SET state='observing',remote_id=? WHERE id=?")
        .run(safeId, id);
      this.db.prepare("UPDATE attempts SET remote_id=? WHERE action_id=?").run(safeId, id);
      this.audit(action, "accepted", now);
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
