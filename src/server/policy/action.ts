import { createHash } from "node:crypto";
import type { ActionSpec, Scope } from "../../contracts/domain.ts";
import {
  exactKeys,
  hash,
  identifier,
  integer,
  object,
  string,
} from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { parseWorkloadContract, parseWorkloadExpectation, parseWorkloadTarget } from "../../contracts/deployment.ts";
import { parseNodeVersion } from "../../contracts/node-runtime.ts";
import { parseProvisionSpec } from "../../contracts/provision.ts";

export function canonical(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = object(value);
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function parseActionSpec(value: unknown): ActionSpec {
  const input = object(value);
  if (input.version === 8) return parseProvisionSpec(input);
  exactKeys(input, [
    "version",
    "scope",
    "operation",
    "sourceHash",
    "args",
    ...(input.version === 2 || input.version === 3 || input.version === 4 || input.version === 5 || input.version === 7 ? ["artifactHash"] : []),
    ...(input.version === 3 || input.version === 4 || input.version === 5 || input.version === 7 ? ["projectFlowId", "selectionHash"] : []),
    ...(input.version === 4 || input.version === 5 || input.version === 7 ? ["targetAppId", "workload"] : []),
    ...(input.version === 5 || input.version === 7 ? ["nodeVersion"] : []),
    ...(input.version === 7 ? ["accountId"] : []),
    ...(input.version === 6 ? ["accountId", "targetAppId", "targetPlanId", "targetReleaseId", "incidentRunId", "evidenceHash", "target"] : []),
  ]);
  ensure(
    (input.version === 1 || input.version === 2 || input.version === 3 || input.version === 4 || input.version === 5 || input.version === 6 || input.version === 7) &&
      (input.operation === "deploy" || input.operation === "restart"),
    "INVALID_OPERATION",
    "عملیات پشتیبانی نمی‌شود.",
  );
  const scope = object(input.scope);
  exactKeys(scope, ["teamId", "app"]);
  const teamId = string(scope.teamId, 24);
  ensure(/^[a-f0-9]{24}$/.test(teamId), "INVALID_SCOPE", "تیم معتبر نیست.");
  const app = identifier(scope.app);
  ensure(/^[a-z0-9][a-z0-9-]{0,62}$/.test(app), "INVALID_SCOPE", "نام برنامه معتبر نیست.");
  const args = object(input.args);
  exactKeys(args, ["port", "planId"]);
  const port = args.port === null ? null : integer(args.port, 1, 65535);
  const planId = args.planId === null ? null : identifier(args.planId);
  const sourceHash = input.sourceHash === null ? null : hash(input.sourceHash);
  ensure(
    input.operation !== "deploy" || (sourceHash !== null && port !== null),
    "INVALID_INPUT",
    "انتشار به source و port مشخص نیاز دارد.",
  );
  ensure(
    input.operation !== "restart" || (sourceHash === null && port === null && planId === null),
    "INVALID_INPUT",
    "restart آرگومان انتشار نمی‌پذیرد.",
  );
  const common: Pick<Exclude<ActionSpec, {version: 8}>, "scope" | "operation" | "sourceHash" | "args"> = {
    scope: { teamId, app },
    operation: input.operation,
    sourceHash,
    args: { port, planId },
  };
  if (input.version === 6) {
    ensure(input.operation === "restart", "INVALID_OPERATION", "این پیشنهاد فقط برای راه‌اندازی دوباره است.");
    const incidentRunId = string(input.incidentRunId, 36);
    ensure(/^[a-f0-9-]{36}$/.test(incidentRunId), "INVALID_INPUT", "شناسه بررسی معتبر نیست.");
    return {
      ...common, version: 6, operation: "restart", sourceHash: null, args: { port: null, planId: null },
      accountId: string(input.accountId, 128),
      targetAppId: string(input.targetAppId, 128),
      targetPlanId: string(input.targetPlanId, 128),
      targetReleaseId: string(input.targetReleaseId, 128),
      incidentRunId, evidenceHash: hash(input.evidenceHash), target: parseWorkloadTarget(input.target),
    };
  }
  if (input.version === 1) return { ...common, version: 1 };
  const artifactHash = input.artifactHash === null ? null : hash(input.artifactHash);
  if (input.version === 3 || input.version === 4 || input.version === 5 || input.version === 7) {
    ensure(
      input.operation === "deploy" && artifactHash,
      "INVALID_OPERATION",
      "پیشنهاد پروژه باید به فایل‌های آماده انتشار متصل باشد.",
    );
    const projectFlowId = string(input.projectFlowId, 36);
    ensure(/^[a-f0-9-]{36}$/.test(projectFlowId), "INVALID_INPUT", "شناسه پروژه معتبر نیست.");
    if (input.version === 4 || input.version === 5 || input.version === 7) {
      ensure(planId, "PLAN_REQUIRED", "شناسه پلن فعلی باید از لیارا خوانده شود.", 409);
      const deployment = {
        ...common,
        artifactHash,
        projectFlowId,
        selectionHash: hash(input.selectionHash),
        targetAppId: string(input.targetAppId, 128),
      };
      if (input.version === 7) return { ...deployment, version: 7, accountId: string(input.accountId, 128), nodeVersion: parseNodeVersion(input.nodeVersion), workload: parseWorkloadContract(input.workload) };
      const workload = parseWorkloadExpectation(input.workload);
      return input.version === 5
        ? { ...deployment, workload, version: 5, nodeVersion: parseNodeVersion(input.nodeVersion) }
        : { ...deployment, workload, version: 4 };
    }
    return {
      ...common,
      version: 3,
      artifactHash,
      projectFlowId,
      selectionHash: hash(input.selectionHash),
    };
  }
  ensure(
    input.operation === "deploy" ? artifactHash !== null : artifactHash === null,
    "INVALID_ARTIFACT",
    "پیشنهاد انتشار به هش بسته دقیق source نیاز دارد.",
  );
  return { ...common, version: 2, artifactHash };
}

export function authorizeScope(
  scope: Scope,
  allowed: { teamId: string; apps: readonly string[] },
): void {
  ensure(
    allowed.teamId && scope.teamId === allowed.teamId && allowed.apps.includes(scope.app),
    "SCOPE_DENIED",
    "این تیم یا برنامه در محدوده مجاز نیست.",
    403,
  );
}
