import { AppError, ensure } from "../server/errors.ts";
import { exactKeys, integer, object, string } from "./validation.ts";
import type { Action, ActionSpec } from "./domain.ts";

export type DeploymentSpec = Extract<ActionSpec, { version: 4 | 5 | 7 | 10 }>;
export function isDeploymentSpec(spec: ActionSpec): spec is DeploymentSpec {
  return spec.version === 4 || spec.version === 5 || spec.version === 7 || spec.version === 10;
}

// This is a bounded GET oracle, never a model-supplied URL or executable expression.
export type WorkloadTarget = Readonly<{
  origin: string;
  path: string;
}>;
export type WorkloadExpectation = WorkloadTarget & Readonly<{
  status: number;
  revision: string;
}>;
export type WorkloadContract = WorkloadTarget & Readonly<{
  status: number;
  assertion:
    | Readonly<{ kind: "text"; contains: string }>
    | Readonly<{ kind: "json"; field: string; equals: string | number | boolean | null }>;
}>;

export function parseWorkloadContract(value: unknown): WorkloadContract {
  const row = object(value);
  exactKeys(row, ["origin", "path", "status", "assertion"]);
  const item = object(row.assertion);
  let assertion: WorkloadContract["assertion"];
  if (item.kind === "text") {
    exactKeys(item, ["kind", "contains"]);
    const contains = string(item.contains, 256);
    ensure(contains.trim().length >= 3, "INVALID_INPUT", "متن مورد انتظار باید مشخص و قابل بررسی باشد.");
    assertion = { kind: "text", contains };
  } else {
    exactKeys(item, ["kind", "field", "equals"]);
    const field = string(item.field, 80), expected = item.equals;
    ensure(item.kind === "json" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(field) &&
      (expected === null || typeof expected === "boolean" ||
        (typeof expected === "number" && Number.isFinite(expected)) ||
        (typeof expected === "string" && expected.length <= 256)),
      "INVALID_INPUT", "معیار مقدار پاسخ API معتبر نیست.");
    assertion = { kind: "json", field, equals: expected };
  }
  return { ...parseWorkloadTarget({ origin: row.origin, path: row.path }),
    status: integer(row.status, 200, 299), assertion };
}

export function matchesWorkload(contract: WorkloadContract, status: number, body: string): boolean {
  if (status !== contract.status) return false;
  if (contract.assertion.kind === "text") return body.includes(contract.assertion.contains);
  try {
    const value: unknown = JSON.parse(body);
    return typeof value === "object" && value !== null && !Array.isArray(value) &&
      Object.hasOwn(value, contract.assertion.field) &&
      object(value)[contract.assertion.field] === contract.assertion.equals;
  } catch { return false; }
}
export type DeploymentObservation = Readonly<{
  outcome: "verified" | "failed" | "not_started" | "pending" | "inconclusive";
  code: string;
  checkedAt: number;
  releaseId: string | null;
  releaseState: string | null;
  status: number | null;
}>;
export type DeploymentProgress = Readonly<{
  stage: "claimed" | "upload_started" | "uploaded" | "release_started" | "release_accepted";
  sourceId: string | null;
  observation: DeploymentObservation | null;
  // Older journals have no accepted timestamp and keep their historical observation behavior.
  releaseAcceptedAt?: number;
}>;

export function canReadDeploymentResult(action: Action): boolean {
  return (
    isDeploymentSpec(action.spec) &&
    Boolean(action.deployment) &&
    (action.state === "observing" ||
      action.state === "uncertain" ||
      (action.state === "failed" &&
        Boolean(action.remoteId) &&
        action.deployment?.stage === "release_accepted"))
  );
}

export function sourceReceiptId(value: unknown): string {
  const result = string(value, 128);
  // Liara returns an opaque source filename, including the tar.gz suffix.
  ensure(
    /^[a-zA-Z0-9_-]+(?:\.tar\.gz)?$/.test(result),
    "UPSTREAM_INVALID",
    "شناسه بسته دریافتی معتبر نیست.",
    502,
  );
  return result;
}

export function parseWorkloadTarget(value: unknown): WorkloadTarget {
  const row = object(value);
  exactKeys(row, ["origin", "path"]);
  const origin = string(row.origin, 240),
    path = string(row.path, 200);
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new AppError("PROBE_TARGET_DENIED", "نشانی بررسی معتبر نیست.", 403);
  }
  ensure(
    url.protocol === "https:" &&
      url.origin === origin &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hostname.startsWith("[") &&
      /\.[a-z]{2,63}$/i.test(url.hostname),
    "PROBE_TARGET_DENIED",
    "نشانی بررسی باید مبدأ HTTPS مجاز همین برنامه باشد.",
    403,
  );
  ensure(
    /^\/[A-Za-z0-9_./-]*$/.test(path) && !path.startsWith("//") && !path.split("/").includes(".."),
    "PROBE_TARGET_DENIED",
    "مسیر بررسی نسخه باید بدون query یا تغییر مقصد باشد.",
    403,
  );
  return { origin, path };
}

export function parseWorkloadExpectation(value: unknown): WorkloadExpectation {
  const row = object(value);
  exactKeys(row, ["origin", "path", "status", "revision"]);
  return {
    ...parseWorkloadTarget({ origin: row.origin, path: row.path }),
    status: integer(row.status, 200, 299),
    revision: string(row.revision, 128),
  };
}

export function parseDeploymentProgress(value: unknown): DeploymentProgress {
  const row = object(value);
  exactKeys(row, ["stage", "sourceId", "observation", "releaseAcceptedAt"]);
  ensure(
    row.stage === "claimed" ||
      row.stage === "upload_started" ||
      row.stage === "uploaded" ||
      row.stage === "release_started" ||
      row.stage === "release_accepted",
    "INVALID_RESPONSE",
    "مرحله انتشار معتبر نیست.",
  );
  let observation: DeploymentObservation | null = null;
  if (row.observation !== null) {
    const item = object(row.observation);
    exactKeys(item, ["outcome", "code", "checkedAt", "releaseId", "releaseState", "status"]);
    ensure(
      item.outcome === "verified" ||
        item.outcome === "failed" ||
        item.outcome === "not_started" ||
        item.outcome === "pending" ||
        item.outcome === "inconclusive",
      "INVALID_RESPONSE",
      "نتیجه مشاهده معتبر نیست.",
    );
    observation = {
      outcome: item.outcome,
      code: string(item.code, 64),
      checkedAt: integer(item.checkedAt, 0, Number.MAX_SAFE_INTEGER),
      releaseId: item.releaseId === null ? null : string(item.releaseId, 128),
      releaseState: item.releaseState === null ? null : string(item.releaseState, 64),
      status: item.status === null ? null : integer(item.status, 100, 599),
    };
  }
  return {
    stage: row.stage,
    sourceId: row.sourceId === null ? null : sourceReceiptId(row.sourceId),
    observation,
    ...(row.releaseAcceptedAt === undefined ? {} : { releaseAcceptedAt: integer(row.releaseAcceptedAt, 0, Number.MAX_SAFE_INTEGER) }),
  };
}
