import type { SourceArtifact } from "./domain.ts";
import { parseArtifact } from "./source.ts";
import { hash, integer, object, string, text } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { parseNodePreparation, type NodePreparation } from "./preparation.ts";
export type RepairTestReceipt = {
  command: string;
  exitCode: number | null;
  signal: string | null;
  output: string;
  durationMs: number;
  passed: boolean;
};
export type CodeRepairJob = {
  id: string;
  projectId: string;
  baseRevision: string;
  state: "proposed" | "queued" | "working" | "succeeded" | "failed" | "cancelled" | "interrupted";
  goal: string;
  allowedPaths: string[];
  testFiles: string[];
  changedPaths: string[];
  diff: string | null;
  beforeTest: RepairTestReceipt | null;
  afterTest: RepairTestReceipt | null;
  artifact: SourceArtifact | null;
  errorCode: string | null;
  message: string;
  createdAt: number;
  updatedAt: number;
  preparation?: NodePreparation;
};

function paths(value: unknown): string[] {
  ensure(
    Array.isArray(value) && value.length <= 12,
    "STORAGE_INVALID",
    "فهرست فایل‌های اصلاح معتبر نیست.",
    503,
  );
  return value.map((path) => string(path, 512));
}
function receipt(value: unknown): RepairTestReceipt | null {
  if (value === null) return null;
  const row = object(value);
  ensure(
    typeof row.passed === "boolean" && typeof row.output === "string" && row.output.length <= 32768,
    "STORAGE_INVALID",
    "رسید آزمون معتبر نیست.",
    503,
  );
  return {
    command: string(row.command, 7000),
    exitCode: row.exitCode === null ? null : integer(row.exitCode, -2147483648, 2147483647),
    signal: row.signal === null ? null : string(row.signal, 50),
    output: row.output,
    durationMs: integer(row.durationMs, 0, 120000),
    passed: row.passed,
  };
}
export function parseCodeRepairJob(value: unknown): CodeRepairJob {
  const row = object(value),
    state = row.state;
  ensure(
    state === "proposed" ||
      state === "queued" ||
      state === "working" ||
      state === "succeeded" ||
      state === "failed" ||
      state === "cancelled" ||
      state === "interrupted",
    "STORAGE_INVALID",
    "وضعیت اصلاح معتبر نیست.",
    503,
  );
  return {
    id: string(row.id, 36),
    projectId: string(row.projectId, 36),
    baseRevision: hash(row.baseRevision),
    state,
    goal: text(row.goal, 2000),
    allowedPaths: paths(row.allowedPaths),
    testFiles: paths(row.testFiles),
    changedPaths: paths(row.changedPaths),
    diff: row.diff === null ? null : text(row.diff, 262144),
    beforeTest: receipt(row.beforeTest),
    afterTest: receipt(row.afterTest),
    artifact: row.artifact === null ? null : parseArtifact(row.artifact),
    errorCode: row.errorCode === null ? null : string(row.errorCode, 100),
    message: text(row.message, 2000),
    createdAt: integer(row.createdAt, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: integer(row.updatedAt, 0, Number.MAX_SAFE_INTEGER),
    ...(row.preparation === undefined ? {} : { preparation: parseNodePreparation(row.preparation) }),
  };
}
