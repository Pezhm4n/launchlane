import { writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { CodeRepairJob } from "../../contracts/code-repair.ts";
import type { BuildOutputReceipt } from "../../contracts/build-output.ts";
import type { PnpmComponentBuildPlan } from "../../contracts/project-build.ts";
import { parseComponentVerification } from "../../contracts/pnpm-component.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import type { Store } from "../persistence/store.ts";
import { captureProject } from "../workspace/inspect.ts";
import { prepareArchive } from "../application/prepare-source.ts";
import { componentOutputBytes, readComponentOutput } from "./build-output-store.ts";
import { componentHostProgram, componentDockerfile } from "./component-program.ts";

export async function assembleComponentArtifact(input: Readonly<{
  stateDir: string; store: Store; actorId: string; workspace: string; sourceHash: string; jobId: string;
  plan: PnpmComponentBuildPlan; receipt: BuildOutputReceipt; signal: AbortSignal; secrets: readonly string[];
}>): Promise<{ artifact: NonNullable<CodeRepairJob["artifact"]>; publication: NonNullable<CodeRepairJob["publication"]>; changedPaths: string[] }> {
  const before = await captureProject(input.workspace, ".", { signal: input.signal, secrets: input.secrets }), planHash = fingerprint(input.plan);
  ensure(before.profile.sourceHash === input.sourceHash && input.plan.sourceHash === input.sourceHash, "BUILD_OUTPUT_BINDING_CHANGED", "source پیش از بسته‌بندی component تغییر کرد.", 409);
  await readComponentOutput(input.stateDir, input.receipt, { sourceHash: input.sourceHash, planHash });
  const wire = await componentOutputBytes(input.stateDir, input.receipt), publication = { version: 1 as const, testedSourceHash: input.sourceHash, planHash, outputArtifactHash: input.receipt.artifactHash };
  const verification = parseComponentVerification({ ...publication, buildJobId: input.jobId, component: input.plan.component, apiChecks: input.plan.apiChecks });
  const changedPaths = [".launchlane-component.cjs", ".launchlane-component.json", ".launchlane-component.Dockerfile", "liara.json"];
  ensure(!before.files.some(file => file.path.startsWith(".launchlane-component") || file.path === "liara.original.json"), "COMPONENT_ARTIFACT_COLLISION", "فایل generated نباید فایل موجود source را جایگزین کند.", 409);
  if (before.files.some(file => file.path === "liara.json")) { await rename(join(input.workspace, "liara.json"), join(input.workspace, "liara.original.json")); changedPaths.push("liara.original.json"); }
  await writeFile(join(input.workspace, ".launchlane-component.json"), `${JSON.stringify({ version: 1, verification, port: input.plan.port })}\n`, { flag: "wx", mode: 0o600 });
  await writeFile(join(input.workspace, ".launchlane-component.cjs"), componentHostProgram, { flag: "wx", mode: 0o600 });
  await writeFile(join(input.workspace, ".launchlane-component.Dockerfile"), componentDockerfile(input.plan.image, input.plan.port), { flag: "wx", mode: 0o600 });
  await writeFile(join(input.workspace, "liara.json"), `${JSON.stringify({ platform: "docker", port: input.plan.port, build: { dockerfile: ".launchlane-component.Dockerfile" } })}\n`, { flag: "wx", mode: 0o600 });
  const after = await captureProject(input.workspace, ".", { signal: input.signal, secrets: input.secrets });
  ensure(after.profile.dockerRuntime && after.profile.pnpmComponent, "COMPONENT_ARTIFACT_INVALID", "نسخهٔ generated باید از همان مسیر Docker شناسایی شود.", 409);
  const artifact = await prepareArchive({ store: input.store, stateDir: input.stateDir, workspaceRoot: input.workspace, actorId: input.actorId, directory: ".", sourceHash: after.profile.sourceHash,
    signal: input.signal, secrets: input.secrets, componentOutput: wire });
  return { artifact, publication, changedPaths };
}
