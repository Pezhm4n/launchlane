import type { Scope } from "./domain.ts";
import { exactKeys, hash, object, string } from "./validation.ts";
import { providerObjectId } from "./provision.ts";
import { ensure } from "../server/errors.ts";

export type LifecycleSpec = Readonly<{ version: 14; operation: "stop_app" | "delete_app"; scope: Scope; accountId: string;
  targetAppId: string; projectFlowId: string; sourceHash: string; selectionHash: string; args: { port: null; planId: string }; requestKey: string }>;
export type LifecycleProgress = { stage: "claimed" | "request_started" | "accepted"; checkedAt: number | null; outcome: "verified" | "inconclusive" | null;
  verification?: "configuration" | "instances_absent" | "destination_absent" };
export function parseLifecycleSpec(value: unknown): LifecycleSpec {
  const row = object(value), scope = object(row.scope), args = object(row.args);
  exactKeys(row, ["version", "operation", "scope", "accountId", "targetAppId", "projectFlowId", "sourceHash", "selectionHash", "args", "requestKey"]);
  exactKeys(scope, ["teamId", "app"]); exactKeys(args, ["port", "planId"]);
  const uuid = (value: unknown) => { const id = string(value, 36); ensure(/^[a-f0-9-]{36}$/.test(id), "INVALID_INPUT", "شناسه درخواست معتبر نیست."); return id; }, app = string(scope.app, 63);
  ensure(row.version === 14 && (row.operation === "stop_app" || row.operation === "delete_app") && /^[a-z0-9][a-z0-9-]{0,62}$/.test(app) && args.port === null,
    "INVALID_INPUT", "درخواست مدیریت مقصد معتبر نیست.");
  return { version: 14, operation: row.operation, scope: { app, teamId: providerObjectId(scope.teamId) }, accountId: providerObjectId(row.accountId), targetAppId: providerObjectId(row.targetAppId),
    projectFlowId: uuid(row.projectFlowId), sourceHash: hash(row.sourceHash), selectionHash: hash(row.selectionHash), args: { port: null, planId: string(args.planId, 128) }, requestKey: uuid(row.requestKey) };
}
export function parseLifecycleProgress(value: unknown): LifecycleProgress {
  const row = object(value); exactKeys(row, ["stage", "checkedAt", "outcome", "verification"]);
  ensure(row.stage === "claimed" || row.stage === "request_started" || row.stage === "accepted", "INVALID_RESPONSE", "رسید مقصد معتبر نیست.");
  ensure(row.checkedAt === null || typeof row.checkedAt === "number" && Number.isSafeInteger(row.checkedAt) && row.checkedAt > 0, "INVALID_RESPONSE", "زمان رسید معتبر نیست.");
  ensure(row.outcome === null || row.outcome === "verified" || row.outcome === "inconclusive", "INVALID_RESPONSE", "نتیجه رسید معتبر نیست.");
  ensure(row.verification === undefined || row.verification === "configuration" || row.verification === "instances_absent" || row.verification === "destination_absent", "INVALID_RESPONSE", "نوع بررسی معتبر نیست.");
  return { stage: row.stage, checkedAt: row.checkedAt, outcome: row.outcome, ...(row.verification === undefined ? {} : { verification: row.verification }) };
}
