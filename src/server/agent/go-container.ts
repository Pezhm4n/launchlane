import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GoBuildPlan } from "../../contracts/go-build.ts";
import { parseExecutableVerification } from "../../contracts/go-runtime.ts";
import { parseProjectBuildPlan } from "../../contracts/project-build.ts";
import { environmentVariables, isApplicationEnvironmentKey, type EnvironmentVariable } from "../../contracts/environment.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import { docker, resolveCreatedContainer, type ContainerBuildResult } from "./container.ts";
import { blankSandboxProxyArguments } from "./docker-proxy.ts";
import { goBuildProgram, goRuntimeCheckProgram } from "./go-program.ts";
import { executableSourceFiles } from "./executable-program.ts";
import { parseExecutableOutput, encodeExecutableOutput } from "./executable-output.ts";

export function assertGoEnvironment(values: readonly EnvironmentVariable[]) {
  const controlled = /^(?:GO(?:ROOT|PATH|PROXY|SUMDB|PRIVATE|NOSUMDB|NOPROXY|TOOLCHAIN|WORK|FLAGS|ENV|CACHE|MODCACHE|TMPDIR|MAXPROCS|DEBUG|OS|ARCH|AMD64|386|ARM.*|EXPERIMENT|FIPS140|TELEMETRY)|CGO_.*|CC|CXX|AR|PKG_CONFIG.*)$/;
  ensure(values.every(row => isApplicationEnvironmentKey(row.key) && !controlled.test(row.key)), "GO_ENVIRONMENT_UNSUPPORTED", "تنظیمات compiler و ابزارهای Go از environment برنامه جدا هستند.", 409);
}

export async function runGoBuild(workspace: string, input: string, tool: string, files: readonly SourceFile[], jobId: string, value: GoBuildPlan,
  signal: AbortSignal, onCreated: (id: string) => void, environment: readonly EnvironmentVariable[]): Promise<ContainerBuildResult> {
  const plan = parseProjectBuildPlan(value); ensure(plan.version === 11, "GO_BUILD_CHANGED", "برنامهٔ Go معتبر نیست.", 409);
  const values = environmentVariables(environment); assertGoEnvironment(values);
  ensure(values.map(row => row.key).sort().join("\0") === [...(plan.sourceEnvironment?.keys ?? plan.environment?.keys ?? [])].sort().join("\0"), "ENV_REFERENCE_CHANGED", "ورودی خصوصی Go با تصمیم برابر نیست.", 409);
  ensure([workspace, input, tool].every(path => !path.includes(",")), "SANDBOX_PATH_DENIED", "مسیر worker معتبر نیست.", 403);
  await writeFile(join(input, "go-build.cjs"), goBuildProgram, { flag: "wx", mode: 0o600 });
  let compiler: string | null = null, runtime: string | null = null;
  const start = async (phase: string, mounts: string[]) => {
    const name = `launchlane-go-${phase}-${randomUUID()}`, label = "go-build-v1";
    const created = await docker(["create", "--pull=never", "--log-driver", "none", "--name", name, "--label", `ir.launchlane.worker=${label}`,
      ...blankSandboxProxyArguments(), "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "1000:1000",
      "--cpus", "1", "--memory", "2g", "--memory-swap", "2g", "--pids-limit", "128", "--tmpfs", "/work:rw,exec,nosuid,nodev,size=1073741824,uid=1000,gid=1000,mode=0700",
      ...mounts, plan.image, "node", "-e", "setTimeout(()=>process.exit(124),330000)"], signal, 4096);
    const id = await resolveCreatedContainer(created, { name, label, image: plan.image });
    if (phase === "compiler") compiler = id; else runtime = id;
    if (id) onCreated(id);
    ensure(created.exitCode === 0 && !created.signal && id && id === created.output.trim(), "SANDBOX_UNAVAILABLE", "worker محدود Go ایجاد نشد؛ کد روی میزبان اجرا نمی‌شود.", 503);
    const started = await docker(["start", id], signal, 4096); ensure(started.exitCode === 0 && !started.signal, "SANDBOX_UNAVAILABLE", "worker Go شروع نشد.", 503); return id;
  };
  const execute = async (id: string, script: string) => {
    const bytes = Buffer.from(JSON.stringify(values));
    try { return await docker(["exec", "--interactive", id, "node", script, JSON.stringify(plan)], signal, 32768, bytes); }
    finally { bytes.fill(0); }
  };
  try {
    const id = await start("compiler", ["--mount", `type=bind,source=${workspace},target=/source,readonly`, "--mount", `type=bind,source=${input},target=/input,readonly`, "--mount", `type=bind,source=${tool},target=/go-toolchain.tar.gz,readonly`]);
    const compiled = await execute(id, "/input/go-build.cjs");
    if (compiled.exitCode !== 0 || compiled.signal) return { ...compiled, containerId: id, image: plan.image };
    const exported = await docker(["exec", id, "node", "-e", "const fs=require('node:fs'),c=require('node:crypto'),p='/work/output/server',s=fs.lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>8388608)process.exit(73);const b=fs.readFileSync(p);process.stdout.write(JSON.stringify({bytes:b.length,sha256:c.createHash('sha256').update(b).digest('hex'),base64:b.toString('base64')}));"], signal, 12 * 1024 * 1024);
    ensure(exported.exitCode === 0 && !exported.signal, "EXECUTABLE_OUTPUT_INVALID", "باینری همان worker کامل دریافت نشد.", 409);
    const output = parseExecutableOutput({ ...JSON.parse(exported.output), version: 1, sourceHash: plan.sourceHash, planHash: fingerprint(plan) }, values.map(row => row.value));
    const wire = encodeExecutableOutput(output), verification = parseExecutableVerification({ version: 1, buildJobId: jobId, testedSourceHash: plan.sourceHash, planHash: output.planHash,
      outputArtifactHash: createHash("sha256").update(wire).digest("hex"), runtime: plan.runtime });
    const fresh = join(input, "fresh-runtime"); await mkdir(fresh);
    for (const file of executableSourceFiles(files, verification)) { const target = join(fresh, file.path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, file.content, { flag: "wx", mode: 0o600 }); }
    await writeFile(join(fresh, ".launchlane-executable.gz"), wire, { flag: "wx", mode: 0o600 });
    const checker = join(input, "go-check.cjs"); await writeFile(checker, goRuntimeCheckProgram, { flag: "wx", mode: 0o600 });
    const removed = await docker(["rm", "--force", id], AbortSignal.timeout(5000), 4096); ensure(removed.exitCode === 0, "SANDBOX_CLEANUP_UNCONFIRMED", "پایان compiler همین job تأیید نشد.", 503); compiler = null;
    const target = await start("runtime", ["--mount", `type=bind,source=${fresh},target=/input,readonly`, "--mount", `type=bind,source=${checker},target=/go-check.cjs,readonly`]);
    const checked = await execute(target, "/go-check.cjs");
    return { ...checked, output: `${compiled.output}\n${checked.output}`, containerId: target, image: plan.image,
      ...(checked.exitCode === 0 && !checked.signal ? { executableOutput: output } : {}) };
  } finally {
    for (const id of [runtime, compiler]) if (id) {
      const removed = await docker(["rm", "--force", id], AbortSignal.timeout(5000), 4096);
      ensure(removed.exitCode === 0 && !removed.signal, "SANDBOX_CLEANUP_UNCONFIRMED", "پایان worker همین Go job تأیید نشد.", 503);
    }
  }
}
