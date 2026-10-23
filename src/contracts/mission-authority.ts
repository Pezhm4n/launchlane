import { ensure } from "../server/errors.ts";
import { exactKeys, hash, integer, object, string } from "./validation.ts";
import { parseProjectBuildPlan, type ProjectBuildPlan } from "./project-build.ts";
import { parseCodingAgentChoice, type CodingAgentChoice } from "./coding-agent.ts";

// Separate from ActionSpec: old action hashes and single-action decisions retain their meaning.
type MissionPlanBase = {
  revision: number;
  runId: string;
  rootProjectId: string;
  rootSourceHash: string;
  rootArtifactHash: string;
  rootSelectionHash: string;
  initialJobId: string;
  target: { accountId: string; teamId: string; app: string; appId: string; planId: string; bundleId: string; networkId: string; origin: string };
  costEffect: "existing_plan_unchanged";
  cost: { hourlyHundredthsToman: number; currency: "toman"; period: "hour"; catalogFingerprint: string; observedAt: number; extras: "tax_traffic_storage_not_included" };
  build: ProjectBuildPlan;
  allowedPaths: string[];
  maxBuildJobs: number;
  maxRepairs: number;
  maxPublications: number;
  limits: { maxModelCalls: number; maxToolCalls: number; runTimeoutMs: number };
  expiresAt: number;
};
export type MissionPlan = MissionPlanBase & ({ version: 1 } | { version: 2; codingAgent: CodingAgentChoice });
export type MissionAuthority = {
  id: string;
  hash: string;
  state: "proposed" | "approved" | "revoked";
  plan: MissionPlan;
};
export function parseMissionPlan(value: unknown): MissionPlan {
  const row = object(value), target = object(row.target), limits = object(row.limits);
  exactKeys(row, ["version", "revision", "runId", "rootProjectId", "rootSourceHash", "rootArtifactHash", "rootSelectionHash", "initialJobId", "target", "costEffect", "cost", "build", "allowedPaths", "maxBuildJobs", "maxRepairs", "maxPublications", "limits", "expiresAt", ...(row.version === 2 ? ["codingAgent"] : [])]);
  exactKeys(target, ["accountId", "teamId", "app", "appId", "planId", "bundleId", "networkId", "origin"]);
  exactKeys(limits, ["maxModelCalls", "maxToolCalls", "runTimeoutMs"]);
  const cost = object(row.cost);
  exactKeys(cost, ["hourlyHundredthsToman", "currency", "period", "catalogFingerprint", "observedAt", "extras"]);
  ensure((row.version === 1 && row.revision === 1 || row.version === 2) && row.costEffect === "existing_plan_unchanged" && cost.currency === "toman" && cost.period === "hour" && cost.extras === "tax_traffic_storage_not_included", "PLAN_INVALID", "نسخه یا اثر هزینه برنامه معتبر نیست.", 409);
  ensure(Array.isArray(row.allowedPaths) && row.allowedPaths.length > 0 && row.allowedPaths.length <= 1000, "PLAN_INVALID", "محدوده فایل‌های برنامه معتبر نیست.", 409);
  const allowedPaths = row.allowedPaths.map(path => string(path, 512));
  ensure(new Set(allowedPaths).size === allowedPaths.length && allowedPaths.every(path => !path.startsWith("/") && !path.includes("\\") && path.split("/").every(part => part !== ".." && part !== ".")), "PLAN_INVALID", "مسیرهای برنامه معتبر نیستند.", 409);
  const base: MissionPlanBase = { revision: integer(row.revision, 1, 1000), runId: string(row.runId, 36), rootProjectId: string(row.rootProjectId, 36),
    rootSourceHash: hash(row.rootSourceHash), rootArtifactHash: hash(row.rootArtifactHash), rootSelectionHash: hash(row.rootSelectionHash), initialJobId: string(row.initialJobId, 36),
    target: { accountId: string(target.accountId, 100), teamId: string(target.teamId, 63), app: string(target.app, 63), appId: string(target.appId, 100), planId: string(target.planId, 100), bundleId: string(target.bundleId, 100), networkId: string(target.networkId, 24), origin: string(target.origin, 2048) },
    cost: { currency: "toman", period: "hour", hourlyHundredthsToman: integer(cost.hourlyHundredthsToman, 0, Number.MAX_SAFE_INTEGER), catalogFingerprint: hash(cost.catalogFingerprint), observedAt: integer(cost.observedAt, 0, Number.MAX_SAFE_INTEGER), extras: "tax_traffic_storage_not_included" },
    costEffect: "existing_plan_unchanged", build: parseProjectBuildPlan(row.build), allowedPaths,
    maxBuildJobs: integer(row.maxBuildJobs, 1, 6), maxRepairs: integer(row.maxRepairs, 0, 4), maxPublications: integer(row.maxPublications, 1, 4),
    limits: { maxModelCalls: integer(limits.maxModelCalls, 1, 24), maxToolCalls: integer(limits.maxToolCalls, 1, 160), runTimeoutMs: integer(limits.runTimeoutMs, 100, 900000) },
    expiresAt: integer(row.expiresAt, 0, Number.MAX_SAFE_INTEGER) };
  return row.version === 1 ? { version: 1, ...base } : { version: 2, ...base, codingAgent: parseCodingAgentChoice(row.codingAgent) };
}
export function parseMissionAuthority(value: unknown): MissionAuthority {
  const row = object(value);
  ensure(row.state === "proposed" || row.state === "approved" || row.state === "revoked", "PLAN_INVALID", "وضعیت اختیار برنامه معتبر نیست.", 409);
  return { id: string(row.id, 36), hash: hash(row.hash), state: row.state, plan: parseMissionPlan(row.plan) };
}
