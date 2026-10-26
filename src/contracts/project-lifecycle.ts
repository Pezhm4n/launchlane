import type { Scope } from "./domain.ts";
import { exactKeys, hash, identifier, integer, object, string } from "./validation.ts";
import { providerObjectId, parsePaaSCost, type PaaSCost } from "./provision.ts";
import { ensure } from "../server/errors.ts";

type HistoricalLifecycleSpec = Readonly<{ version: 14; operation: "stop_app" | "delete_app"; scope: Scope; accountId: string;
  targetAppId: string; projectFlowId: string; sourceHash: string; selectionHash: string; args: { port: null; planId: string }; requestKey: string }>;
export type LifecycleSpec = HistoricalLifecycleSpec | (Omit<HistoricalLifecycleSpec, "version" | "operation"> & Readonly<{
  version: 24; operation: "start_app" | "enable_default_subdomain"; bundleId: string;
  expected: { scale: number; defaultSubdomain: boolean }; cost: PaaSCost | null;
  publication?: { actionId: string; releaseId: string; artifactHash: string };
}>);
export function isLifecycleSpec(spec: { version: number }): spec is LifecycleSpec { return spec.version === 14 || spec.version === 24; }
export type LifecycleProgress = { stage: "claimed" | "request_started" | "accepted"; checkedAt: number | null; outcome: "verified" | "inconclusive" | null;
  verification?: "configuration" | "instances_absent" | "destination_absent" };
export function parseLifecycleSpec(value: unknown): LifecycleSpec {
  const input = object(value);
  if (input.version === 24) {
    const { bundleId, expected, cost, publication, ...rest } = input, previous = parseLifecycleSpec({ ...rest, version: 14, operation: "stop_app" }), before = object(expected);
    exactKeys(before, ["scale", "defaultSubdomain"]);
    const scale = integer(before.scale, 0, 1);
    ensure(previous.version === 14 && typeof before.defaultSubdomain === "boolean" && (input.operation === "start_app" && scale === 0 && cost !== null || input.operation === "enable_default_subdomain" && before.defaultSubdomain === false && cost === null),
      "INVALID_INPUT", "اقدام روشن‌کردن یا نشانی عمومی معتبر نیست.");
    let dependency: { actionId: string; releaseId: string; artifactHash: string } | undefined;
    if (publication !== undefined) {
      const row = object(publication), actionId = string(row.actionId, 36);
      exactKeys(row, ["actionId", "releaseId", "artifactHash"]);
      ensure(input.operation === "enable_default_subdomain" && /^[a-f0-9-]{36}$/.test(actionId), "INVALID_INPUT", "وابستگی نشانی عمومی معتبر نیست.");
      dependency = { actionId, releaseId: providerObjectId(row.releaseId), artifactHash: hash(row.artifactHash) };
    }
    return { ...previous, version: 24, operation: input.operation, bundleId: identifier(bundleId),
      expected: { scale, defaultSubdomain: before.defaultSubdomain }, cost: cost === null ? null : parsePaaSCost(cost), ...(dependency ? { publication: dependency } : {}) };
  }
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
