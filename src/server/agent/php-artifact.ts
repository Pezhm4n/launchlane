import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BuildOutputReceipt } from "../../contracts/build-output.ts";
import type { PhpBuildPlan } from "../../contracts/php-build.ts";
import { parsePhpVerification } from "../../contracts/php-runtime.ts";
import type { Store } from "../persistence/store.ts";
import { captureProject } from "../workspace/inspect.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import { componentOutputBytes, readComponentOutput } from "./build-output-store.ts";
import { phpSourceFiles } from "./php-program.ts";
import { prepareArchive } from "../application/prepare-source.ts";

export async function assemblePhpArtifact(input: { store: Store; stateDir: string; actorId: string; workspace: string; sourceHash: string; jobId: string; plan: PhpBuildPlan; receipt: BuildOutputReceipt; signal: AbortSignal; secrets: readonly string[] }) {
  const before = await captureProject(input.workspace, ".", { signal: input.signal, secrets: input.secrets }), planHash = fingerprint(input.plan);
  ensure(before.profile.sourceHash === input.sourceHash && input.plan.sourceHash === input.sourceHash, "BUILD_OUTPUT_BINDING_CHANGED", "source پیش از بسته‌بندی PHP تغییر کرد.", 409);
  await readComponentOutput(input.stateDir, input.receipt, { sourceHash: input.sourceHash, planHash }); const wire = await componentOutputBytes(input.stateDir, input.receipt);
  const publication = { version: 1 as const, testedSourceHash: input.sourceHash, planHash, outputArtifactHash: input.receipt.artifactHash }, verification = parsePhpVerification({ ...publication, buildJobId: input.jobId, runtime: input.plan.runtime });
  const generated = phpSourceFiles(before.files, verification), changedPaths: string[] = [];
  if (before.files.some(file => file.path === "liara.json")) await rename(join(input.workspace, "liara.json"), join(input.workspace, "liara.original.json"));
  for (const file of generated) if (!before.files.some(original => original.path === file.path && original.content.equals(file.content))) {
    if (file.path !== "liara.original.json") { const target = join(input.workspace, file.path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, file.content, { flag: "wx", mode: 0o600 }); } changedPaths.push(file.path);
  }
  const after = await captureProject(input.workspace, ".", { signal: input.signal, secrets: input.secrets }); ensure(after.profile.installedPhp && after.profile.dockerRuntime, "PHP_BUILD_REQUIRED", "نسخهٔ installed از مسیر Docker شناسایی نشد.", 409);
  const artifact = await prepareArchive({ store: input.store, stateDir: input.stateDir, workspaceRoot: input.workspace, actorId: input.actorId, directory: ".", sourceHash: after.profile.sourceHash, signal: input.signal, secrets: input.secrets, phpOutput: wire });
  return { artifact, publication, changedPaths };
}
