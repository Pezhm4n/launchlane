import { randomUUID } from "node:crypto";
import type { AgentEvent, AgentView } from "../../contracts/agent.ts";
import { parseAgentView } from "../../contracts/agent.ts";
import { integer, object, string, text } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import type { ModelMessage } from "./model.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { fingerprint } from "../policy/action.ts";

export type AgentContext = {
  projectId: string | null;
  sourceHash: string | null;
  selectionHash: string | null;
  account: { accountId: string; teamId: string } | null;
  target: { accountId: string; teamId: string; app: string; appId: string } | null;
};
export type AgentUsage = {
  modelCalls: number;
  toolCalls: number;
  observedTokens: number;
  unknownModelCalls: number;
  elapsedMs: number;
};
export type AgentRecord = AgentView & {
  requestKey: string;
  context: AgentContext;
  messages: ModelMessage[];
  usage: AgentUsage;
  createdAt: number;
  limits: { maxModelCalls: number; maxToolCalls: number; runTimeoutMs: number };
  errorCode: string | null;
  lastInputKey: string;
  lastInput: string;
  repairDecision: { sessionId: string; expiresAt: number; consumed: boolean } | null;
};

function parseRecord(value: unknown): AgentRecord {
  const row = object(value),
    view = parseAgentView(row),
    context = object(row.context),
    usage = object(row.usage),
    limits = object(row.limits);
  const target = context.target === null ? null : object(context.target);
  const account = context.account === undefined || context.account === null ? target : object(context.account);
  ensure(
    Array.isArray(row.messages) && row.messages.length <= 80,
    "STORAGE_INVALID",
    "مکالمه ذخیره‌شده معتبر نیست.",
    503,
  );
  const messages = row.messages.map((value): ModelMessage => {
    const message = object(value),
      role = message.role;
    if (role === "user" || role === "system")
      return { role, content: text(message.content, 100000) };
    if (role === "tool")
      return {
        role,
        tool_call_id: string(message.tool_call_id, 80),
        content: string(message.content, 100000),
      };
    ensure(role === "assistant", "STORAGE_INVALID", "نقش پیام معتبر نیست.", 503);
    const calls = message.tool_calls;
    ensure(
      calls === undefined || (Array.isArray(calls) && calls.length === 1),
      "STORAGE_INVALID",
      "درخواست ابزار ذخیره‌شده معتبر نیست.",
      503,
    );
    return {
      role,
      content: message.content === null ? null : string(message.content, 12000),
      ...(calls === undefined
        ? {}
        : {
            tool_calls: calls.map((value) => {
              const call = object(value),
                fn = object(call.function);
              ensure(call.type === "function", "STORAGE_INVALID", "نوع ابزار معتبر نیست.", 503);
              return {
                id: string(call.id, 80),
                type: "function" as const,
                function: { name: string(fn.name, 80), arguments: string(fn.arguments, 32768) },
              };
            }),
          }),
    };
  });
  return {
    ...view,
    requestKey: string(row.requestKey, 80),
    lastInputKey: string(row.lastInputKey, 80),
    lastInput: text(row.lastInput, 2000),
    repairDecision:
      row.repairDecision === undefined || row.repairDecision === null
        ? null
        : (() => {
            const decision = object(row.repairDecision);
            ensure(
              typeof decision.consumed === "boolean",
              "STORAGE_INVALID",
              "تصمیم اصلاح معتبر نیست.",
              503,
            );
            return {
              sessionId: string(decision.sessionId, 100),
              expiresAt: integer(decision.expiresAt, 0, Number.MAX_SAFE_INTEGER),
              consumed: decision.consumed,
            };
          })(),
    context: {
      projectId: context.projectId === null ? null : string(context.projectId, 36),
      sourceHash: context.sourceHash === null ? null : string(context.sourceHash, 64),
      selectionHash: context.selectionHash === null ? null : string(context.selectionHash, 64),
      account: account ? { accountId: string(account.accountId, 100), teamId: string(account.teamId, 63) } : null,
      target: target
        ? {
            accountId: string(target.accountId, 100),
            teamId: string(target.teamId, 63),
            app: string(target.app, 63),
            appId: string(target.appId, 100),
          }
        : null,
    },
    messages,
    usage: {
      modelCalls: integer(usage.modelCalls, 0, 100),
      toolCalls: integer(usage.toolCalls, 0, 160),
      observedTokens: integer(usage.observedTokens, 0, 10000000),
      unknownModelCalls: integer(usage.unknownModelCalls, 0, 100),
      elapsedMs: integer(usage.elapsedMs, 0, 10000000),
    },
    createdAt: integer(row.createdAt, 0, Number.MAX_SAFE_INTEGER),
    limits: {
      maxModelCalls: integer(limits.maxModelCalls, 1, 24),
      maxToolCalls: integer(limits.maxToolCalls, 1, 160),
      runTimeoutMs: integer(limits.runTimeoutMs, 100, 900000),
    },
    errorCode: row.errorCode === null ? null : string(row.errorCode, 100),
  };
}

export function addEvent(
  run: AgentRecord,
  kind: AgentEvent["kind"],
  message: string,
  extra: Pick<AgentEvent, "tool" | "callId"> = {},
): void {
  ensure(run.events.length < 160, "AGENT_EVENT_LIMIT", "مکالمه به سقف ثبت مراحل رسیده است.", 409);
  run.events.push({
    sequence: (run.events.at(-1)?.sequence ?? 0) + 1,
    kind,
    message,
    at: Date.now(),
    ...extra,
  });
}
export function agentView(run: AgentRecord): AgentView {
  return {
    id: run.id,
    revision: run.revision,
    projectId: run.projectId,
    state: run.state,
    events: run.events,
    nextAction: run.nextAction,
    question: run.question,
    updatedAt: run.updatedAt,
    effect: run.effect,
    repair: run.repair,
    publication: run.publication,
    destination: run.destination,
    destinationContinued: run.destinationContinued,
  };
}

export class AgentRepository {
  readonly store: Store;
  constructor(store: Store) {
    this.store = store;
  }
  get(actorId: string, id?: string): AgentRecord | null {
    const row = id
      ? this.store.db
          .prepare("SELECT data_json FROM agent_runs WHERE actor_id=? AND id=?")
          .get(actorId, id)
      : this.store.db
          .prepare(
            "SELECT data_json FROM agent_runs WHERE actor_id=? ORDER BY updated_at DESC,id DESC LIMIT 1",
          )
          .get(actorId);
    if (!row) return null;
    const run = parseRecord(JSON.parse(string(row.data_json, 512 * 1024)));
    if (run.publication) {
      run.publication = this.store.getAction(run.publication.id, actorId);
      if (run.publication.state === "succeeded") run.effect = "remote_changes_verified";
      else if (run.publication.attemptId) run.effect = "remote_changes_unverified";
    }
    if (run.destination) {
      run.destination = this.store.getAction(run.destination.id, actorId);
      if (!run.publication?.attemptId) {
        if (run.destination.state === "succeeded") run.effect = "destination_created";
        else if (run.destination.attemptId) run.effect = "remote_changes_unverified";
      }
    }
    if (run.repair) {
      const job = this.store.db
        .prepare("SELECT data_json,state FROM code_repair_jobs WHERE actor_id=? AND id=?")
        .get(actorId, run.repair.id);
      ensure(job, "STORAGE_INVALID", "رسید اصلاح در دسترس نیست.", 503);
      run.repair = parseCodeRepairJob({
        ...object(object(JSON.parse(string(job.data_json, 512 * 1024))).job),
        state: job.state,
      });
    }
    return run;
  }
  create(
    actorId: string,
    requestKey: string,
    context: AgentContext,
    goal: string,
    limits: AgentRecord["limits"],
  ): { run: AgentRecord; created: boolean } {
    this.store.db.exec("BEGIN IMMEDIATE");
    try {
      const old = this.store.db
        .prepare("SELECT data_json FROM agent_runs WHERE actor_id=? AND request_key=?")
        .get(actorId, requestKey);
      if (old) {
        const run = parseRecord(JSON.parse(string(old.data_json, 512 * 1024)));
        ensure(
          run.messages[0]?.content === goal &&
            fingerprint(run.context) === fingerprint(context),
          "IDEMPOTENCY_CONFLICT",
          "این درخواست قبلاً با هدف یا پروژه دیگری ثبت شده است.",
          409,
        );
        this.store.db.exec("COMMIT");
        return { run, created: false };
      }
      ensure(
        !this.store.db
          .prepare("SELECT id FROM agent_runs WHERE actor_id=? AND state IN ('queued','working')")
          .get(actorId),
        "AGENT_BUSY",
        "یک بررسی در حال انجام است. ابتدا نتیجه آن را ببینید یا متوقف کنید.",
        409,
      );
      const now = Date.now();
      const run: AgentRecord = {
        id: randomUUID(),
        requestKey,
        lastInputKey: requestKey,
        lastInput: goal,
        revision: 1,
        projectId: context.projectId,
        context,
        state: "queued",
        events: [],
        nextAction: null,
        question: null,
        updatedAt: now,
        createdAt: now,
        effect: "no_remote_changes",
        repair: null,
        publication: null,
        destination: null,
        destinationContinued: false,
        repairDecision: null,
        messages: [{ role: "user", content: goal }],
        usage: {
          modelCalls: 0,
          toolCalls: 0,
          observedTokens: 0,
          unknownModelCalls: 0,
          elapsedMs: 0,
        },
        limits,
        errorCode: null,
      };
      addEvent(run, "user", goal);
      addEvent(run, "state", "درخواست ثبت شد؛ در انتظار شروع بررسی است.");
      this.store.db
        .prepare("INSERT INTO agent_runs VALUES (?,?,?,?,?,?,?)")
        .run(
          run.id,
          actorId,
          requestKey,
          run.revision,
          run.state,
          run.updatedAt,
          JSON.stringify(run),
        );
      this.store.db.exec("COMMIT");
      return { run, created: true };
    } catch (error) {
      this.store.db.exec("ROLLBACK");
      throw error;
    }
  }
  save(actorId: string, run: AgentRecord, expected = run.revision): void {
    const next = {
      ...run,
      revision: expected + 1,
      updatedAt: Math.max(Date.now(), run.updatedAt + 1),
    };
    const data = JSON.stringify(next);
    ensure(
      Buffer.byteLength(data) <= 512 * 1024,
      "AGENT_HISTORY_LIMIT",
      "مکالمه به سقف نگهداری رسیده است.",
      409,
    );
    const updated = this.store.db
      .prepare(
        "UPDATE agent_runs SET revision=?,state=?,updated_at=?,data_json=? WHERE id=? AND actor_id=? AND revision=?",
      )
      .run(next.revision, next.state, next.updatedAt, data, run.id, actorId, expected);
    ensure(
      updated.changes === 1,
      "AGENT_CONFLICT",
      "وضعیت بررسی تغییر کرده است. نتیجه تازه را بازیابی کنید.",
      409,
    );
    run.revision = next.revision;
    run.updatedAt = next.updatedAt;
  }
  claim(actorId: string, id: string): AgentRecord | null {
    const run = this.get(actorId, id);
    if (run?.state !== "queued") return null;
    run.state = "working";
    addEvent(run, "activity", "در حال بررسی هدف و اطلاعات پروژه…");
    this.save(actorId, run);
    return run;
  }
  recover(): void {
    for (const row of this.store.db
      .prepare("SELECT actor_id,id FROM agent_runs WHERE state IN ('queued','working')")
      .all()) {
      const actor = string(row.actor_id),
        run = this.get(actor, string(row.id));
      if (!run) continue;
      for (const action of [run.publication, run.destination]) {
        if (action?.state === "approved" && !action.attemptId) {
          // A queued approval must not become an unattended write after a process restart.
          this.store.db.prepare("UPDATE actions SET state='cancelled' WHERE id=? AND actor_id=? AND state='approved' AND attempt_id IS NULL")
            .run(action.id, actor);
          this.store.db.prepare("INSERT INTO audit_events(action_id,actor_id,event,at) VALUES (?,?,?,?)")
            .run(action.id, actor, "agent_process_interrupted", Date.now());
        }
      }
      if (run.publication) run.publication = this.store.getAction(run.publication.id, actor);
      if (run.destination) run.destination = this.store.getAction(run.destination.id, actor);
      run.state = "interrupted";
      run.errorCode = "PROCESS_INTERRUPTED";
      run.nextAction = "reply";
      addEvent(
        run,
        "error",
        "بررسی قبلی با توقف سرور قطع شد. مراحل ثبت‌شده حفظ شدند و درخواست هزینه‌دار تکرار نشد.",
      );
      this.save(actor, run);
    }
    // A local test process may have outlived the host; its result must never become publishable on restart.
    this.store.db
      .prepare(
        "UPDATE code_repair_jobs SET state='interrupted' WHERE state IN ('queued','working')",
      )
      .run();
  }
}
