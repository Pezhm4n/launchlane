import type { Scope } from "./domain.ts";
import { ensure } from "../server/errors.ts";
import { exactKeys, hash, identifier, integer, object, string } from "./validation.ts";
import { providerObjectId } from "./provision.ts";

export type NetworkSpec = Readonly<{
  version: 13;
  operation: "create_network";
  scope: Scope;
  sourceHash: string;
  artifactHash: string;
  projectFlowId: string;
  selectionHash: string;
  accountId: string;
  previousAppId: string | null;
  agentRunId: string | null;
  networkName: string;
  args: Readonly<{ port: null; planId: null }>;
  cost: Readonly<{ state: "unknown"; amount: null; currency: null; period: null }>;
}>;
export type NetworkProgress = Readonly<{
  stage: "claimed" | "request_started" | "accepted" | "created";
  acceptedAt: number | null;
  networkId: string | null;
  observation: Readonly<{ outcome: "verified" | "inconclusive" | "not_started" | "changed"; code: string; checkedAt: number }> | null;
}>;
export function parseNetworkSpec(value: unknown): NetworkSpec {
  const row = object(value), scope = object(row.scope), args = object(row.args), cost = object(row.cost);
  exactKeys(row, ["version", "operation", "scope", "sourceHash", "artifactHash", "projectFlowId", "selectionHash", "accountId", "previousAppId", "agentRunId", "networkName", "args", "cost"]);
  exactKeys(scope, ["teamId", "app"]); exactKeys(args, ["port", "planId"]); exactKeys(cost, ["state", "amount", "currency", "period"]);
  const app = identifier(scope.app), networkName = string(row.networkName, 63);
  ensure(row.version === 13 && row.operation === "create_network" && /^[a-z0-9][a-z0-9-]{0,62}$/.test(app) &&
    /^ll-[a-f0-9]{8}-[a-f0-9]{16}$/.test(networkName) && args.port === null && args.planId === null &&
    cost.state === "unknown" && cost.amount === null && cost.currency === null && cost.period === null,
    "INVALID_NETWORK_PROPOSAL", "قرارداد ساخت شبکه معتبر نیست؛ تعرفه نامعلوم با صفر جایگزین نمی‌شود.", 409);
  return { version: 13, operation: "create_network", scope: { teamId: providerObjectId(scope.teamId), app },
    sourceHash: hash(row.sourceHash), artifactHash: hash(row.artifactHash), projectFlowId: string(row.projectFlowId, 36), selectionHash: hash(row.selectionHash),
    accountId: string(row.accountId, 100), previousAppId: row.previousAppId === null ? null : string(row.previousAppId, 100),
    agentRunId: row.agentRunId === null ? null : string(row.agentRunId, 36), networkName, args: { port: null, planId: null },
    cost: { state: "unknown", amount: null, currency: null, period: null } };
}
export function parseNetworkProgress(value: unknown): NetworkProgress {
  const row = object(value), stage = row.stage;
  exactKeys(row, ["stage", "acceptedAt", "networkId", "observation"]);
  ensure(stage === "claimed" || stage === "request_started" || stage === "accepted" || stage === "created", "STORAGE_INVALID", "مرحله ساخت شبکه معتبر نیست.", 503);
  const acceptedAt = row.acceptedAt === null ? null : integer(row.acceptedAt, 0, Number.MAX_SAFE_INTEGER), networkId = row.networkId === null ? null : providerObjectId(row.networkId);
  ensure((stage !== "created" || networkId !== null && acceptedAt !== null) && (stage !== "accepted" || acceptedAt !== null), "STORAGE_INVALID", "رسید شبکه کامل نیست.", 503);
  let observation: NetworkProgress["observation"] = null;
  if (row.observation !== null) {
    const raw = object(row.observation), outcome = raw.outcome;
    exactKeys(raw, ["outcome", "code", "checkedAt"]);
    ensure(outcome === "verified" || outcome === "inconclusive" || outcome === "not_started" || outcome === "changed", "STORAGE_INVALID", "نتیجه بررسی شبکه معتبر نیست.", 503);
    observation = { outcome, code: string(raw.code, 100), checkedAt: integer(raw.checkedAt, 0, Number.MAX_SAFE_INTEGER) };
  }
  return { stage, acceptedAt, networkId, observation };
}
export function canReadNetworkResult(action: import("./domain.ts").Action): boolean {
  return action.spec.version === 13 && !!action.network && (action.state === "observing" || action.state === "uncertain");
}
