import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GoBuildPlan } from "../../contracts/go-build.ts";
import { parseExecutableVerification } from "../../contracts/go-runtime.ts";
import type { BuildOutputReceipt } from "../../contracts/build-output.ts";
import type { Store } from "../persistence/store.ts";
import { captureProject } from "../workspace/inspect.ts";
import { fingerprint } from "../policy/action.ts";
import { ensure } from "../errors.ts";
import { executableSourceFiles } from "./executable-program.ts";
import { executableOutputBytes } from "./build-output-store.ts";
import { prepareArchive } from "../application/prepare-source.ts";

export async function assembleExecutableArtifact(input: { store: Store; stateDir: string; actorId: string; workspace: string; sourceHash: string; jobId: string; plan: GoBuildPlan; receipt: BuildOutputReceipt; signal: AbortSignal; secrets: readonly string[] }) {
  const captured = await captureProject(input.workspace, ".", { signal: input.signal, secrets: input.secrets });
  ensure(captured.profile.sourceHash === input.sourceHash && input.plan.sourceHash === input.sourceHash, "BUILD_OUTPUT_BINDING_CHANGED", "source پیش از بسته‌بندی executable تغییر کرده است.", 409);
  const planHash = fingerprint(input.plan), wire = await executableOutputBytes(input.stateDir, input.receipt, { ...input.receipt, sourceHash: input.sourceHash, planHash });
  const publication = { version: 1 as const, testedSourceHash: input.sourceHash, planHash, outputArtifactHash: input.receipt.artifactHash }, verification = parseExecutableVerification({ ...publication, buildJobId: input.jobId, runtime: input.plan.runtime });
  const generated = executableSourceFiles(captured.files, verification);
  if (captured.files.some(file => file.path === "liara.json")) await rename(join(input.workspace, "liara.json"), join(input.workspace, "liara.original.json"));
  const changedPaths = [];
  for (const file of generated) if (!captured.files.some(original => original.path === file.path && original.content.equals(file.content))) {
    if (file.path === "liara.original.json") { changedPaths.push(file.path); continue; }
    const target = join(input.workspace, file.path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, file.content, { flag: "wx", mode: 0o600 }); changedPaths.push(file.path);
  }
  const after = await captureProject(input.workspace, ".", { signal: input.signal, secrets: input.secrets });
  ensure(after.profile.compiledExecutable && after.profile.dockerRuntime, "EXECUTABLE_BUILD_REQUIRED", "بستهٔ generated از مسیر Docker شناسایی نشد.", 409);
  const artifact = await prepareArchive({ store: input.store, stateDir: input.stateDir, workspaceRoot: input.workspace, actorId: input.actorId, directory: ".", sourceHash: after.profile.sourceHash, signal: input.signal, secrets: input.secrets, executableOutput: wire });
  return { artifact, publication, changedPaths };
}
