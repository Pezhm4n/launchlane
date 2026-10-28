import type { Action, Scope } from "./domain.ts";
import { exactKeys, hash, identifier, integer, object, string } from "./validation.ts";
import { providerObjectId } from "./provision.ts";
import { ensure } from "../server/errors.ts";
import { applicationSourcePath } from "./application-requirements.ts";

export type DatabaseProvisionSpec = Readonly<{
  version: 27;
  operation: "create_database";
  scope: Scope;
  sourceHash: string;
  artifactHash: string;
  projectFlowId: string;
  selectionHash: string;
  accountId: string;
  targetAppId: string;
  consumerRoot: string;
  requestKey: string;
  agentRunId: string | null;
  database: Readonly<{ hostname: string; type: string; version: string; planId: string; bundleId: string; networkId: string; publicNetwork: false }>;
  args: Readonly<{ port: null; planId: string }>;
  cost: Readonly<{ planHourlyToman: number; bundleHourlyToman: number; combinedTotal: "not_computed"; extras: "unknown"; expiresAt: number }>;
}>;
export type DatabaseProvisionProgress = Readonly<{
  stage: "claimed" | "request_started" | "accepted" | "created";
  acceptedAt: number | null;
  databaseId: string | null;
  observation: Readonly<{ outcome: "identity_verified" | "inconclusive" | "not_started" | "changed"; code: string; checkedAt: number }> | null;
}>;
export function databaseHostname(value: unknown): string {
  const hostname = string(value, 63);
  ensure(/^[a-z][a-z0-9-]{2,62}$/.test(hostname) && !hostname.endsWith("-"), "INVALID_INPUT", "نام دیتابیس معتبر نیست.");
  return hostname;
}
function uuid(value: unknown): string {
  const id = string(value, 36); ensure(/^[a-f0-9-]{36}$/.test(id), "INVALID_INPUT", "شناسه درخواست دیتابیس معتبر نیست."); return id;
}
function amount(value: unknown): number {
  ensure(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000,
    "DATABASE_PRICE_REQUIRED", "قیمت معتبر هر دو بخش دیتابیس لازم است؛ مبلغ نامعلوم صفر نیست.", 409);
  return value;
}
export function parseDatabaseProvisionSpec(value: unknown): DatabaseProvisionSpec {
  const row = object(value), scope = object(row.scope), args = object(row.args), database = object(row.database), cost = object(row.cost);
  exactKeys(row, ["version", "operation", "scope", "sourceHash", "artifactHash", "projectFlowId", "selectionHash", "accountId", "targetAppId", "consumerRoot", "requestKey", "agentRunId", "database", "args", "cost"]);
  exactKeys(scope, ["teamId", "app"]); exactKeys(args, ["port", "planId"]);
  exactKeys(database, ["hostname", "type", "version", "planId", "bundleId", "networkId", "publicNetwork"]);
  exactKeys(cost, ["planHourlyToman", "bundleHourlyToman", "combinedTotal", "extras", "expiresAt"]);
  const version = string(database.version, 64), planId = identifier(database.planId);
  ensure(row.version === 27 && row.operation === "create_database" && args.port === null && args.planId === planId &&
    database.publicNetwork === false && /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(version) && cost.combinedTotal === "not_computed" && cost.extras === "unknown",
    "INVALID_DATABASE_PROPOSAL", "قرارداد ساخت دیتابیس خصوصی معتبر نیست.", 409);
  return { version: 27, operation: "create_database", scope: { teamId: providerObjectId(scope.teamId), app: identifier(scope.app) },
    sourceHash: hash(row.sourceHash), artifactHash: hash(row.artifactHash), projectFlowId: uuid(row.projectFlowId), selectionHash: hash(row.selectionHash),
    accountId: providerObjectId(row.accountId), targetAppId: string(row.targetAppId, 100), consumerRoot: applicationSourcePath(row.consumerRoot, true), requestKey: uuid(row.requestKey), agentRunId: row.agentRunId === null ? null : uuid(row.agentRunId),
    database: { hostname: databaseHostname(database.hostname), type: identifier(database.type), version, planId, bundleId: identifier(database.bundleId),
      networkId: providerObjectId(database.networkId), publicNetwork: false }, args: { port: null, planId },
    cost: { planHourlyToman: amount(cost.planHourlyToman), bundleHourlyToman: amount(cost.bundleHourlyToman), combinedTotal: "not_computed", extras: "unknown",
      expiresAt: integer(cost.expiresAt, 0, Number.MAX_SAFE_INTEGER) } };
}
export function parseDatabaseProvisionProgress(value: unknown): DatabaseProvisionProgress {
  const row = object(value), stage = row.stage;
  exactKeys(row, ["stage", "acceptedAt", "databaseId", "observation"]);
  ensure(stage === "claimed" || stage === "request_started" || stage === "accepted" || stage === "created", "STORAGE_INVALID", "مرحله دیتابیس معتبر نیست.", 503);
  const acceptedAt = row.acceptedAt === null ? null : integer(row.acceptedAt, 0, Number.MAX_SAFE_INTEGER),
    databaseId = row.databaseId === null ? null : providerObjectId(row.databaseId);
  ensure((stage !== "created" || databaseId !== null && acceptedAt !== null) && (stage !== "accepted" || acceptedAt !== null), "STORAGE_INVALID", "رسید دیتابیس کامل نیست.", 503);
  let observation: DatabaseProvisionProgress["observation"] = null;
  if (row.observation !== null) {
    const raw = object(row.observation), outcome = raw.outcome;
    exactKeys(raw, ["outcome", "code", "checkedAt"]);
    ensure(outcome === "identity_verified" || outcome === "inconclusive" || outcome === "not_started" || outcome === "changed", "STORAGE_INVALID", "نتیجه دیتابیس معتبر نیست.", 503);
    observation = { outcome, code: string(raw.code, 100), checkedAt: integer(raw.checkedAt, 0, Number.MAX_SAFE_INTEGER) };
  }
  return { stage, acceptedAt, databaseId, observation };
}
export function canReadDatabaseResult(action: Action): boolean {
  return action.spec.version === 27 && !!action.database && (action.state === "observing" || action.state === "uncertain");
}
