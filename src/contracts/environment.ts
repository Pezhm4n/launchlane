import type { Scope } from "./domain.ts";
import { ensure } from "../server/errors.ts";
import { exactKeys, hash, object, string } from "./validation.ts";
import { providerObjectId } from "./provision.ts";

export type EnvironmentVariable = { key: string; value: string };
export type EnvironmentSpec = Readonly<{
  version: 9; operation: "update_env"; scope: Scope; sourceHash: string; artifactHash: string;
  projectFlowId: string; selectionHash: string; accountId: string; targetAppId: string;
  agentRunId: string; secretRef: string; baseFingerprint: string; effectiveFingerprint: string;
  keys: readonly string[]; secretKeys: readonly string[]; args: Readonly<{ port: null; planId: string }>;
}>;
export type EnvironmentProgress = { stage: "claimed" | "request_started" | "accepted";
  checkedAt: number | null; outcome: "verified" | "inconclusive" | "not_started" | null };
export function environmentKey(value: unknown): string {
  const key = string(value, 128);
  ensure(/^[A-Za-z_][A-Za-z0-9_]*$/.test(key), "INVALID_ENV_KEY", "نام متغیر معتبر نیست.");
  return key;
}
export function environmentVariables(value: unknown, max = 128): EnvironmentVariable[] {
  ensure(Array.isArray(value) && value.length <= max, "INVALID_ENV_INPUT", "تعداد متغیرها بیشتر از سقف مجاز است.");
  const seen = new Set<string>();
  return value.map(input => {
    const row = object(input); exactKeys(row, ["key", "value"]);
    const key = environmentKey(row.key);
    ensure(!seen.has(key) && typeof row.value === "string" && Buffer.byteLength(row.value) <= 4096 && !row.value.includes("\0"),
      "INVALID_ENV_INPUT", "متغیر تکراری یا مقدار نامعتبر است.");
    seen.add(key); return { key, value: row.value };
  }).sort((a, b) => a.key.localeCompare(b.key, "en"));
}
export function parseEnvironmentSpec(value: unknown): EnvironmentSpec {
  const row = object(value), scope = object(row.scope), args = object(row.args);
  exactKeys(row, ["version", "operation", "scope", "sourceHash", "artifactHash", "projectFlowId", "selectionHash", "accountId", "targetAppId", "agentRunId", "secretRef", "baseFingerprint", "effectiveFingerprint", "keys", "secretKeys", "args"]);
  exactKeys(scope, ["teamId", "app"]); exactKeys(args, ["port", "planId"]);
  const uuid = (value: unknown) => { const id = string(value, 36); ensure(/^[a-f0-9-]{36}$/.test(id), "INVALID_INPUT", "شناسه اطلاعات برنامه معتبر نیست."); return id; };
  const app = string(scope.app, 63);
  ensure(row.version === 9 && row.operation === "update_env" && /^[a-z0-9][a-z0-9-]{0,62}$/.test(app) && args.port === null &&
    Array.isArray(row.keys) && row.keys.length > 0 && row.keys.length <= 32,
    "INVALID_INPUT", "پیشنهاد اطلاعات برنامه معتبر نیست.");
  const keys = row.keys.map(environmentKey);
  ensure(Array.isArray(row.secretKeys) && row.secretKeys.length <= keys.length && new Set(keys).size === keys.length, "INVALID_INPUT", "نام متغیر تکراری است.");
  const secretKeys = row.secretKeys.map(environmentKey);
  ensure(new Set(secretKeys).size === secretKeys.length && secretKeys.every(key => keys.includes(key)), "INVALID_INPUT", "محدوده مقدار محرمانه معتبر نیست.");
  return { version: 9, operation: "update_env", scope: { teamId: providerObjectId(scope.teamId), app }, sourceHash: hash(row.sourceHash),
    artifactHash: hash(row.artifactHash), projectFlowId: uuid(row.projectFlowId), selectionHash: hash(row.selectionHash),
    accountId: providerObjectId(row.accountId), targetAppId: providerObjectId(row.targetAppId), agentRunId: uuid(row.agentRunId),
    secretRef: uuid(row.secretRef), baseFingerprint: hash(row.baseFingerprint), effectiveFingerprint: hash(row.effectiveFingerprint), keys, secretKeys,
    args: { port: null, planId: string(args.planId, 128) } };
}
export function parseEnvironmentProgress(value: unknown): EnvironmentProgress {
  const row = object(value); exactKeys(row, ["stage", "checkedAt", "outcome"]);
  ensure(["claimed", "request_started", "accepted"].includes(String(row.stage)) &&
    (row.checkedAt === null || (typeof row.checkedAt === "number" && Number.isSafeInteger(row.checkedAt) && row.checkedAt > 0)) &&
    (row.outcome === null || ["verified", "inconclusive", "not_started"].includes(String(row.outcome))), "INVALID_RESPONSE", "رسید اطلاعات برنامه معتبر نیست.");
  return { stage: row.stage as EnvironmentProgress["stage"], checkedAt: row.checkedAt as number | null, outcome: row.outcome as EnvironmentProgress["outcome"] };
}
