import type { SourceArtifact } from "./domain.ts";
import { parseArtifact } from "./source.ts";
import { hash, integer, object, string, text } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { parseNodePreparation, type NodePreparation } from "./preparation.ts";
import { parseProjectBuildPlan, type ProjectBuildPlan } from "./project-build.ts";
import { parseBuildOutputReceipt, type BuildOutputReceipt } from "./build-output.ts";
import { parsePostgresMigrationTestReceipt, type PostgresMigrationTestReceipt } from "./postgres-migration-test.ts";
export type RepairTestReceipt = {
  command: string;
  exitCode: number | null;
  signal: string | null;
  output: string;
  durationMs: number;
  passed: boolean;
  buildOutput?: BuildOutputReceipt;
  databaseMigration?: PostgresMigrationTestReceipt;
};
export type CodeRepairJob = {
  id: string;
  parentRunId?: string | null;
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
  execution?: "container";
  containerIds?: string[];
  containerImage?: string;
  builtImage?: string;
  dockerExecutionStarted?: true;
  postgresExecutionStarted?: true;
  postgresFixtureSourceHash?: string;
  postgresFixtureId?: string;
  build?: ProjectBuildPlan;
  validationOnly?: true;
  publication?: Readonly<{ version: 1; testedSourceHash: string; planHash: string; outputArtifactHash: string }>;
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
    durationMs: integer(row.durationMs, 0, 360000),
    passed: row.passed,
    ...(row.buildOutput === undefined ? {} : { buildOutput: parseBuildOutputReceipt(row.buildOutput) }),
    ...(row.databaseMigration === undefined ? {} : { databaseMigration: parsePostgresMigrationTestReceipt(row.databaseMigration) }),
  };
}
export function parseCodeRepairJob(value: unknown): CodeRepairJob {
  const row = object(value),
    state = row.state;
  const parentRunId = row.parentRunId === undefined || row.parentRunId === null ? null : string(row.parentRunId, 36);
  ensure(parentRunId === null || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(parentRunId),
    "STORAGE_INVALID", "شناسه مأموریت والد اصلاح معتبر نیست.", 503);
  ensure(row.validationOnly === undefined || (row.validationOnly === true && row.build !== undefined), "STORAGE_INVALID", "نوع آماده‌سازی معتبر نیست.", 503);
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
  const job: CodeRepairJob = {
    id: string(row.id, 36),
    parentRunId,
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
    ...(row.build === undefined ? {} : { build: parseProjectBuildPlan(row.build) }),
    ...(row.validationOnly === true ? { validationOnly: true as const } : {}),
    ...(row.builtImage === undefined ? {} : (() => {
      const image = string(row.builtImage, 71);
      ensure(/^sha256:[a-f0-9]{64}$/.test(image) && object(row.build).version === 6, "STORAGE_INVALID", "رسید image ساخته‌شده معتبر نیست.", 503);
      return { builtImage: image };
    })()),
    ...(row.dockerExecutionStarted === undefined ? {} : (() => {
      ensure(row.dockerExecutionStarted === true && object(row.build).version === 6, "STORAGE_INVALID", "مرز اجرای Docker معتبر نیست.", 503);
      return { dockerExecutionStarted: true as const };
    })()),
    ...(row.postgresExecutionStarted === undefined ? {} : (() => {
      ensure(row.postgresExecutionStarted === true && object(row.build).version === 7 && object(row.build).testDatabase !== undefined,"STORAGE_INVALID","مرز دیتابیس آزمون معتبر نیست.",503);
      return {postgresExecutionStarted:true as const};
    })()),
    ...(row.postgresFixtureSourceHash === undefined ? {} : {postgresFixtureSourceHash:hash(row.postgresFixtureSourceHash)}),
    ...(row.postgresFixtureId === undefined ? {} : (() => {
      ensure(typeof row.postgresFixtureId === "string" && /^[a-f0-9]{64}$/.test(row.postgresFixtureId),"STORAGE_INVALID","شناسه دیتابیس آزمون معتبر نیست.",503);
      return {postgresFixtureId:row.postgresFixtureId};
    })()),
    ...(row.publication === undefined ? {} : (() => {
      const publication = object(row.publication);
      ensure(publication.version === 1 && object(row.build).version === 7 && row.state === "succeeded" && row.artifact !== null,
        "STORAGE_INVALID", "تبار بستهٔ کامل معتبر نیست.", 503);
      return { publication: { version: 1 as const, testedSourceHash: hash(publication.testedSourceHash), planHash: hash(publication.planHash), outputArtifactHash: hash(publication.outputArtifactHash) } };
    })()),
    ...(row.execution === undefined ? {} : (() => {
      ensure(row.execution === "container", "STORAGE_INVALID", "روش اجرای اصلاح معتبر نیست.");
      return { execution: "container" as const, containerIds: paths(row.containerIds ?? []),
        ...(row.containerImage === undefined ? {} : { containerImage: string(row.containerImage, 240) }) };
    })()),
  };
  if (job.build?.version === 7 && job.build.testDatabase?.version === 2 && (job.state === "succeeded" || job.afterTest?.passed)) {
    const migration = job.build.testDatabase.migration, proof = job.afterTest?.databaseMigration;
    ensure(job.afterTest?.passed && proof && proof.sourceHash === job.postgresFixtureSourceHash &&
      JSON.stringify(proof.files) === JSON.stringify(migration.files) && proof.columnChecks === migration.columns.length && proof.rowChecks === migration.rows.length && proof.persistenceChecks === migration.persistence.length &&
      job.artifact === null && job.publication === undefined && job.afterTest.buildOutput === undefined,
      "MIGRATION_RECEIPT_INVALID", "موفقیت آزمون migration به رسید مستقل همان source، فایل‌ها و معیارها نیاز دارد؛ خروجی قابل انتشار نمی‌سازد.", 409);
  }
  return job;
}
