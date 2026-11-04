import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { assertTestedPostgresVersion, completedBuildJob, testedResourceTarget, verifiedFullstackRecord } from "../policy/prepared-data.ts";
import { parseFullstackVerification, type FullstackVerification } from "../../contracts/fullstack.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import type { Store } from "../persistence/store.ts";
import { readBuildOutput } from "../agent/build-output-store.ts";
import { readArtifact } from "../workspace/archive.ts";
import { matchesPublishedBuildEnvironment } from "../environment/build.ts";
import { assertPreparedDatabaseBindings } from "../environment/prepared-database.ts";

/** Release/HTTP/API evidence cannot turn a disposable data receipt into destination data proof. */
export function requiresProductionDataVerification(store: Store, actor: string, verification: FullstackVerification): boolean {
  const job = completedBuildJob(store, actor, verification.buildJobId), binding = job.publication;
  ensure(job.build?.version === 7 && binding && job.afterTest?.passed && binding.planHash === fingerprint(job.build) &&
    binding.planHash === verification.planHash && binding.testedSourceHash === verification.testedSourceHash && binding.outputArtifactHash === verification.outputArtifactHash &&
    job.build.fullstack.outputDirectory === verification.outputDirectory && fingerprint(job.build.apiChecks) === fingerprint(verification.apiChecks),
    "FULLSTACK_BUILD_REQUIRED", "نتیجهٔ انتشار باید به رسید ساخت و معیارهای همین نسخه تعلق داشته باشد.", 409);
  if (job.build.testDatabase?.version !== 4) return false;
  ensure(job.afterTest.databaseRunner?.planHash === fingerprint(job.build.testDatabase), "MIGRATION_RUNNER_RECEIPT_INVALID", "رسید داده به طرح همین بسته تعلق ندارد.", 409);
  return true;
}

async function verifyStoredBytes(store: Store, stateDir: string, actor: string, record: ReturnType<typeof verifiedFullstackRecord>) {
  await readBuildOutput(stateDir, record.receipt, { sourceHash: record.binding.testedSourceHash, planHash: record.binding.planHash });
  await readArtifact(stateDir, store.getArtifact(actor, record.artifact.archiveHash));
}

/** Local immutable build evidence is separate from a cloud environment decision. */
export async function localFullstackVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow) {
  ensure(flow.selection.kind === "repair", "FULLSTACK_BUILD_REQUIRED", "رسید ساخت همین بسته لازم است.", 409);
  const job = completedBuildJob(store, actor, flow.selection.jobId);
  const record = verifiedFullstackRecord(flow, job), { binding, build } = record;
  await verifyStoredBytes(store, stateDir, actor, record);
  return { verification: parseFullstackVerification({ ...binding, buildJobId: job.id, outputDirectory: build.fullstack.outputDirectory, apiChecks: build.apiChecks }),
    build, testedAt: job.updatedAt };
}

export async function fullstackVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow, secret: string): Promise<FullstackVerification> {
  const evidence = await localFullstackVerification(store, stateDir, actor, flow);
  if (evidence.build.testDatabase?.version === 4) {
    const plan = evidence.build.testDatabase;
    const bindings = assertPreparedDatabaseBindings(store, secret, actor, flow, plan);
    for (const target of bindings.targets) assertTestedPostgresVersion(target.spec.database.version, plan.image);
  }
  else ensure(matchesPublishedBuildEnvironment({ sessionSecret: secret }, store, actor, flow.id, evidence.build),
    "FULLSTACK_BUILD_REQUIRED", "بستهٔ نهایی باید به همان فرانت ساخته‌شده، API، نسخه Node و معیارهای مصوب متصل باشد.", 409);
  return evidence.verification;
}

/** Reject incompatible purchases/attachments before asking for a resource decision. */
export async function assertPreparedResourceIntent(store: Store, stateDir: string, actor: string, flow: ProjectFlow,
  consumerRoot: string, type: string, version: string, keys: readonly string[]) {
  const record = testedResourceTarget(store, actor, flow, consumerRoot, type, version, keys);
  if (!record) return false;
  await verifyStoredBytes(store, stateDir, actor, record);
  return true;
}
