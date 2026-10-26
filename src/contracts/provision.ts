import { ensure } from "../server/errors.ts";
import { exactKeys, hash, identifier, integer, object, string } from "./validation.ts";
import { parseNodeVersion, type NodeVersion } from "./node-runtime.ts";
import type { Scope } from "./domain.ts";
import { parsePythonRuntime, type PythonRuntime } from "./python-runtime.ts";
import { parseStaticRuntime, type StaticRuntime } from "./static-runtime.ts";
import { parseNextRuntime, type NextRuntime } from "./next-runtime.ts";
import { parseFrontendRuntime, type FrontendRuntime } from "./frontend-runtime.ts";

type NodeProvisionSpec = Readonly<{
  version: 8;
  operation: "create_app";
  scope: Scope;
  sourceHash: string;
  artifactHash: string;
  projectFlowId: string;
  selectionHash: string;
  accountId: string;
  previousAppId: string | null;
  nodeVersion: NodeVersion;
  networkId: string;
  bundleId: string;
  readOnlyRootFilesystem: true;
  args: Readonly<{ port: null; planId: string }>;
  cost: Readonly<{ catalogFingerprint: string; observedAt: number; expiresAt: number;
    hourlyHundredthsToman: number; region: string; currency: "toman"; period: "hour";
    extras: "tax_traffic_storage_not_included" }>;
}>;
export type ProvisionSpec = NodeProvisionSpec | (Omit<NodeProvisionSpec, "version" | "nodeVersion"> & Readonly<{
  version: 12; nodeVersion: null; runtime: PythonRuntime;
}>) | (Omit<NodeProvisionSpec, "version" | "nodeVersion"> & Readonly<{ version: 16; nodeVersion: null; runtime: StaticRuntime }>)
  | (Omit<NodeProvisionSpec, "version"> & Readonly<{ version: 18; runtime: NextRuntime }>)
  | (Omit<NodeProvisionSpec, "version" | "nodeVersion"> & Readonly<{ version: 20; nodeVersion: "20"; runtime: FrontendRuntime }>);
export type PaaSCost = NodeProvisionSpec["cost"];
export function parsePaaSCost(value: unknown): PaaSCost {
  const cost = object(value);
  exactKeys(cost, ["catalogFingerprint", "observedAt", "expiresAt", "hourlyHundredthsToman", "region", "currency", "period", "extras"]);
  const observedAt = integer(cost.observedAt, 0, Number.MAX_SAFE_INTEGER), expiresAt = integer(cost.expiresAt, 0, Number.MAX_SAFE_INTEGER);
  ensure(cost.currency === "toman" && cost.period === "hour" && cost.extras === "tax_traffic_storage_not_included" && expiresAt > observedAt && expiresAt - observedAt <= 600000,
    "INVALID_INPUT", "شرایط هزینه معتبر نیست.");
  return { catalogFingerprint: hash(cost.catalogFingerprint), observedAt, expiresAt, hourlyHundredthsToman: integer(cost.hourlyHundredthsToman, 0, 1e15),
    region: string(cost.region, 40), currency: "toman", period: "hour", extras: "tax_traffic_storage_not_included" };
}
export type ProvisionObservation = Readonly<{
  outcome: "verified" | "changed" | "inconclusive" | "not_started";
  checkedAt: number;
  code: string;
}>;
export type ProvisionProgress = Readonly<{
  stage: "claimed" | "request_started" | "created";
  appId: string | null;
  observation: ProvisionObservation | null;
}>;
export type ProvisionReadback = Readonly<{
  scope: Scope; id: string; platform: string; planId: string; bundleId: string;
  networkId: string; readOnlyRootFilesystem: boolean; observedAt: number;
  defaultSubdomain?: boolean;
}>;
export function canReadDestinationResult(action: import("./domain.ts").Action): boolean {
  return (action.spec.version === 8 || action.spec.version === 12 || action.spec.version === 16 || action.spec.version === 18 || action.spec.version === 20) && !!action.provision &&
    (action.state === "observing" || action.state === "uncertain");
}
export function providerObjectId(value: unknown): string {
  const id = string(value, 24);
  ensure(/^[a-f0-9]{24}$/.test(id), "INVALID_INPUT", "شناسه داخلی سرویس معتبر نیست.");
  return id;
}
export function parseProvisionSpec(value: unknown): ProvisionSpec {
  const row = object(value);
  if (row.version === 20) {
    const { runtime, ...rest } = row, parsed = parseFrontendRuntime(runtime), base = parseProvisionSpec({ ...rest, version: 8 });
    ensure(base.version === 8 && base.nodeVersion === parsed.nodeVersion, "INVALID_INPUT", "محیط مقصد رابط با پروژه برابر نیست.");
    return { ...base, version: 20, nodeVersion: "20", runtime: parsed };
  }
  if (row.version === 18) {
    const { runtime, ...rest } = row, parsed = parseNextRuntime(runtime), base = parseProvisionSpec({ ...rest, version: 8 });
    ensure(base.version === 8 && base.nodeVersion === parsed.version, "INVALID_INPUT", "نسخهٔ محیط مقصد Next با پروژه برابر نیست.");
    return { ...base, version: 18, runtime: parsed };
  }
  if (row.version === 16) {
    ensure(row.nodeVersion === null, "INVALID_INPUT", "سایت ایستا نسخه Node نمی‌پذیرد.");
    const { runtime, ...rest } = row, base = parseProvisionSpec({ ...rest, version: 8, nodeVersion: "22" });
    return { ...base, version: 16, nodeVersion: null, runtime: parseStaticRuntime(runtime) };
  }
  if (row.version === 12) {
    ensure(row.nodeVersion === null, "INVALID_INPUT", "مقصد Python نسخه Node نمی‌پذیرد.");
    const { runtime, ...rest } = row, base = parseProvisionSpec({ ...rest, version: 8, nodeVersion: "22" });
    return { ...base, version: 12, nodeVersion: null, runtime: parsePythonRuntime(runtime) };
  }
  exactKeys(row, ["version", "operation", "scope", "sourceHash", "artifactHash", "projectFlowId", "selectionHash", "accountId", "previousAppId", "nodeVersion", "networkId", "bundleId", "readOnlyRootFilesystem", "args", "cost"]);
  ensure(row.version === 8 && row.operation === "create_app" && row.readOnlyRootFilesystem === true,
    "INVALID_OPERATION", "قرارداد ساخت برنامه معتبر نیست.");
  const scope = object(row.scope), args = object(row.args), cost = object(row.cost);
  exactKeys(scope, ["teamId", "app"]); exactKeys(args, ["port", "planId"]);
  exactKeys(cost, ["catalogFingerprint", "observedAt", "expiresAt", "hourlyHundredthsToman", "region", "currency", "period", "extras"]);
  const app = identifier(scope.app), projectFlowId = string(row.projectFlowId, 36),
    observedAt = integer(cost.observedAt, 0, Number.MAX_SAFE_INTEGER), expiresAt = integer(cost.expiresAt, 0, Number.MAX_SAFE_INTEGER);
  ensure(/^[a-z0-9][a-z0-9-]{0,62}$/.test(app) && /^[a-f0-9-]{36}$/.test(projectFlowId) && args.port === null &&
    cost.currency === "toman" && cost.period === "hour" && cost.extras === "tax_traffic_storage_not_included" &&
    expiresAt > observedAt && expiresAt - observedAt <= 600000,
    "INVALID_INPUT", "مقصد یا شرایط هزینه معتبر نیست.");
  return { version: 8, operation: "create_app", scope: { teamId: providerObjectId(scope.teamId), app },
    sourceHash: hash(row.sourceHash), artifactHash: hash(row.artifactHash), projectFlowId, selectionHash: hash(row.selectionHash),
    accountId: providerObjectId(row.accountId), previousAppId: row.previousAppId === null ? null : providerObjectId(row.previousAppId),
    nodeVersion: parseNodeVersion(row.nodeVersion), networkId: providerObjectId(row.networkId), bundleId: identifier(row.bundleId), readOnlyRootFilesystem: true,
    args: { port: null, planId: identifier(args.planId) }, cost: { catalogFingerprint: hash(cost.catalogFingerprint), observedAt, expiresAt,
      hourlyHundredthsToman: integer(cost.hourlyHundredthsToman, 0, 1e15), region: string(cost.region, 40),
      currency: "toman", period: "hour", extras: "tax_traffic_storage_not_included" } };
}
export function parseProvisionProgress(value: unknown): ProvisionProgress {
  const row = object(value);
  exactKeys(row, ["stage", "appId", "observation"]);
  ensure(row.stage === "claimed" || row.stage === "request_started" || row.stage === "created", "INVALID_RESPONSE", "مرحله ساخت مقصد معتبر نیست.");
  const appId = row.appId === null ? null : providerObjectId(row.appId);
  ensure((row.stage === "created") === (appId !== null), "INVALID_RESPONSE", "رسید ساخت مقصد با مرحله برابر نیست.");
  let observation: ProvisionObservation | null = null;
  if (row.observation !== null) {
    const item = object(row.observation);
    exactKeys(item, ["outcome", "checkedAt", "code"]);
    ensure(item.outcome === "verified" || item.outcome === "changed" || item.outcome === "inconclusive" || item.outcome === "not_started",
      "INVALID_RESPONSE", "نتیجه ساخت مقصد معتبر نیست.");
    observation = { outcome: item.outcome, checkedAt: integer(item.checkedAt, 0, Number.MAX_SAFE_INTEGER), code: string(item.code, 80) };
  }
  return { stage: row.stage, appId, observation };
}
