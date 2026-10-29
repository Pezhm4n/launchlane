import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CodeRepairJob } from "../../contracts/code-repair.ts";
import type { FullstackBuildPlan } from "../../contracts/project-build.ts";
import type { BuildOutputReceipt } from "../../contracts/build-output.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import type { Store } from "../persistence/store.ts";
import { captureProject } from "../workspace/inspect.ts";
import { prepareArchive } from "../application/prepare-source.ts";
import { readBuildOutput } from "./build-output-store.ts";
import { validateBuildOutput } from "./build-output.ts";
import { assertCompiledLifecycle } from "./fullstack-preparation.ts";
import { preparesDatabaseArtifact } from "../../contracts/test-database.ts";
import { parsePostgresRunnerTestReceipt, type PostgresRunnerTestReceipt } from "../../contracts/postgres-runner-test.ts";

export const compiledProofPath = "/launchlane-build-proof.json";
export function compiledProof(binding: Readonly<{ testedSourceHash: string; planHash: string; outputArtifactHash: string }>): string {
  return `${JSON.stringify({ version: 1, testedSourceHash: binding.testedSourceHash, planHash: binding.planHash, outputArtifactHash: binding.outputArtifactHash })}\n`;
}

// Fixed verifier, shipped as part of the exact approved archive. No network, install or rebuild.
export const compiledBuildVerifier = `const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'.launchlane-build.json'),'utf8'));
if(manifest.version!==1||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>512)throw Error('invalid compiled manifest');
const base=fs.realpathSync(__dirname),root=path.resolve(base,manifest.outputDirectory);
if(!root.startsWith(base+path.sep)||fs.lstatSync(root).isSymbolicLink()||fs.realpathSync(root)!==root)throw Error('invalid compiled root');
const expected=new Set(manifest.files.map(file=>file.path));let count=0;
function visit(folder,depth){if(depth>16)throw Error('compiled depth limit');for(const name of fs.readdirSync(folder)){if(++count>2048)throw Error('compiled entry limit');const file=path.join(folder,name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('compiled link denied');if(stat.isDirectory())visit(file,depth+1);else if(!stat.isFile()||!expected.has(path.relative(root,file).split(path.sep).join('/')))throw Error('unexpected compiled file')}}visit(root,0);
for(const file of manifest.files){if(typeof file.path!=='string'||file.path.split('/').some(p=>!p||p==='.'||p==='..'||p.includes('\\\\')||p.includes(':')))throw Error('invalid compiled path');
let target=root;for(const part of file.path.split('/')){target=path.join(target,part);if(fs.lstatSync(target).isSymbolicLink())throw Error('compiled link denied')}
const stat=fs.lstatSync(target);if(!stat.isFile()||stat.nlink!==1||stat.size!==file.bytes||fs.realpathSync(target)!==target||crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==file.sha256)throw Error('compiled bytes changed')}
console.log('Launchlane: exact compiled frontend verified');\n`;

export async function assembleFullstackArtifact(input: Readonly<{
  stateDir: string; store: Store; actorId: string; workspace: string; sourceHash: string;
  plan: FullstackBuildPlan; receipt: BuildOutputReceipt; signal: AbortSignal; secrets: readonly string[]; databaseRunner?: PostgresRunnerTestReceipt;
}>): Promise<{ artifact: NonNullable<CodeRepairJob["artifact"]>; publication: NonNullable<CodeRepairJob["publication"]>; changedPaths: string[] }> {
  ensure(!input.plan.testDatabase || preparesDatabaseArtifact(input.plan.testDatabase),"COMPATIBILITY_ARTIFACT_NOT_PUBLISHABLE","خروجی آزمون با دادهٔ ساختگی مجوز انتشار ندارد.",409);
  if (input.plan.testDatabase?.version === 4) {
    ensure(input.databaseRunner, "MIGRATION_RUNNER_RECEIPT_INVALID", "ساخت بسته به رسید مستقل runner و تمام اهداف داده نیاز دارد.", 409);
    const proof = parsePostgresRunnerTestReceipt(input.databaseRunner), plan = input.plan.testDatabase;
    ensure(proof.sourceHash === input.sourceHash && proof.planHash === fingerprint(plan) && proof.runnerHash === plan.runner.sha256 &&
      fingerprint(proof.targets) === fingerprint(plan.targets.map(target => ({ id: target.id, columnChecks: target.oracle.columns.length, rowChecks: target.oracle.rows.length, persistenceChecks: target.oracle.persistence.length }))),
      "MIGRATION_RUNNER_RECEIPT_INVALID", "رسید داده باید به source، برنامه و تمام معیارهای همین بسته تعلق داشته باشد.", 409);
  }
  const planHash = fingerprint(input.plan), exported = await readBuildOutput(input.stateDir, input.receipt, { sourceHash: input.sourceHash, planHash });
  const publication = { version: 1 as const, testedSourceHash: input.sourceHash, planHash, outputArtifactHash: input.receipt.artifactHash };
  const proofName = compiledProofPath.slice(1), proofBytes = Buffer.from(compiledProof(publication));
  ensure(!exported.files.some(file => file.path === proofName), "BUILD_OUTPUT_BINDING_CHANGED", "فایل گواه نسخه نباید خروجی موجود را جایگزین کند.", 409);
  const output = validateBuildOutput({ version: 1, files: [...exported.manifest, { path: proofName, type: "file", bytes: proofBytes.length, sha256: createHash("sha256").update(proofBytes).digest("hex") }] },
    new Map([...exported.files.map(file => [file.path, file.content] as const), [proofName, proofBytes]]));
  const before = await captureProject(input.workspace, ".", { signal: input.signal, secrets: input.secrets });
  ensure(before.profile.sourceHash === input.sourceHash && before.profile.fullstack?.outputDirectory === input.plan.fullstack.outputDirectory,
    "BUILD_OUTPUT_BINDING_CHANGED", "نسخهٔ آماده‌شده با خروجی همان ساخت برابر نیست.", 409);
  ensure(!before.files.some(file => [".launchlane-build.cjs", ".launchlane-build.json"].includes(file.path)), "BUILD_OUTPUT_BINDING_CHANGED", "فایل بررسی خروجی نباید فایل موجود پروژه را جایگزین کند.", 409);
  const pkgFile = before.files.find(file => file.path === "package.json"); ensure(pkgFile, "FULLSTACK_PACKAGE_REQUIRED", "بستهٔ اصلی موجود نیست.", 409);
  const pkg = object(JSON.parse(pkgFile.content.toString("utf8")));
  assertCompiledLifecycle(pkg);
  const manifest = { version: 1, sourceHash: input.sourceHash, planHash, outputArtifactHash: input.receipt.artifactHash,
    outputDirectory: input.plan.fullstack.outputDirectory, files: output.manifest };
  await writeFile(join(input.workspace, ".launchlane-build.cjs"), compiledBuildVerifier, { flag: "wx", mode: 0o600 });
  await writeFile(join(input.workspace, ".launchlane-build.json"), `${JSON.stringify(manifest)}\n`, { flag: "wx", mode: 0o600 });
  await writeFile(join(input.workspace, "package.json"), `${JSON.stringify({ ...pkg, scripts: { ...object(pkg.scripts), build: "node .launchlane-build.cjs" } }, null, 2)}\n`, { mode: 0o600 });
  const after = await captureProject(input.workspace, ".", { signal: input.signal, secrets: input.secrets });
  const artifact = await prepareArchive({ store: input.store, stateDir: input.stateDir, workspaceRoot: input.workspace, actorId: input.actorId,
    directory: ".", sourceHash: after.profile.sourceHash, signal: input.signal, secrets: input.secrets, compiledOutput: output });
  return { artifact, publication,
    changedPaths: ["package.json", ".launchlane-build.cjs", ".launchlane-build.json"] };
}
