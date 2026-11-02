import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseProjectBuildPlan } from "../../contracts/project-build.ts";
import type { PhpBuildPlan } from "../../contracts/php-build.ts";
import { parsePhpVerification } from "../../contracts/php-runtime.ts";
import { environmentVariables, isApplicationEnvironmentKey, type EnvironmentVariable } from "../../contracts/environment.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import { docker, resolveCreatedContainer, type ContainerBuildResult } from "./container.ts";
import { blankSandboxProxyArguments } from "./docker-proxy.ts";
import { operatorDockerEndpoint, dockerEndpointHost, type LocalDockerEndpoint } from "./docker-engine.ts";
import { decodeComponentOutput, encodeComponentOutput } from "./component-output.ts";
import { phpApacheConfiguration, phpBuildProgram, phpEnvelopeFiles, phpRuntimeCheckProgram } from "./php-program.ts";

export function assertPhpEnvironment(values: readonly EnvironmentVariable[]) {
  ensure(values.every(row => isApplicationEnvironmentKey(row.key) && !/^(?:COMPOSER(?:_.*)?|PHP(?:RC|_.*)|APACHE_.*|LD_.*)$/.test(row.key)), "PHP_ENVIRONMENT_UNSUPPORTED", "تنظیمات ابزار و سرور PHP از ورودی خصوصی برنامه جدا هستند.", 409);
}
export async function runPhpBuild(workspace: string, input: string, jobId: string, value: PhpBuildPlan, signal: AbortSignal, onCreated: (id: string) => void,
  environment: readonly EnvironmentVariable[], options: { command?: typeof docker; endpoint?: LocalDockerEndpoint } = {}): Promise<ContainerBuildResult> {
  const plan = parseProjectBuildPlan(value); ensure(plan.version === 12, "PHP_BUILD_CHANGED", "برنامهٔ PHP برابر نیست.", 409);
  const values = environmentVariables(environment); assertPhpEnvironment(values);
  ensure(values.map(row => row.key).sort().join("\0") === [...(plan.sourceEnvironment?.keys ?? plan.environment?.keys ?? [])].sort().join("\0"), "ENV_REFERENCE_CHANGED", "ورودی خصوصی PHP با تصمیم برابر نیست.", 409);
  ensure(!workspace.includes(",") && !input.includes(","), "SANDBOX_PATH_DENIED", "مسیر worker معتبر نیست.", 403);
  const raw = options.command ?? docker, endpoint = options.endpoint ?? await operatorDockerEndpoint(signal, raw), host = dockerEndpointHost(endpoint);
  const command: typeof docker = (args, parent, maxBytes, bytes) => raw(["--host", host, ...args], parent, maxBytes, bytes);
  await writeFile(join(input, "php-build.php"), phpBuildProgram, { flag: "wx", mode: 0o600 }); let installer: string | null = null, runtime: string | null = null;
  const start = async (phase: string, mounts: string[]) => {
    const name = `launchlane-php-${phase}-${randomUUID()}`, label = "php-build-v1";
    const created = await command(["create", "--pull=never", "--log-driver", "none", "--name", name, "--label", `ir.launchlane.worker=${label}`, ...blankSandboxProxyArguments(),
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "1000:1000", "--cpus", "1", "--memory", "1g", "--memory-swap", "1g", "--pids-limit", "128",
      "--tmpfs", "/work:rw,exec,nosuid,nodev,size=1073741824,uid=1000,gid=1000,mode=0700", "--tmpfs", "/tmp:rw,nosuid,nodev,size=67108864,uid=1000,gid=1000,mode=0700", ...mounts,
      "--entrypoint", "php", plan.image, "-r", "sleep(330);"], signal, 4096);
    const id = await resolveCreatedContainer(created, { name, label, image: plan.image }, command); if (phase === "installer") installer = id; else runtime = id; if (id) onCreated(id);
    ensure(created.exitCode === 0 && !created.signal && id && id === created.output.trim(), "SANDBOX_UNAVAILABLE", "worker PHP ایجاد نشد؛ کد روی میزبان اجرا نمی‌شود.", 503);
    const started = await command(["start", id], signal, 4096); ensure(started.exitCode === 0 && !started.signal, "SANDBOX_UNAVAILABLE", "worker PHP شروع نشد.", 503); return id;
  };
  const execute = async (id: string, script: string) => { const bytes = Buffer.from(JSON.stringify(values)); try { return await command(["exec", "--interactive", id, "php", script, JSON.stringify(plan), fingerprint(plan)], signal, 32768, bytes); } finally { bytes.fill(0); } };
  try {
    const id = await start("installer", ["--mount", `type=bind,source=${workspace},target=/source,readonly`, "--mount", `type=bind,source=${input},target=/input,readonly`]), installed = await execute(id, "/input/php-build.php");
    if (installed.exitCode !== 0 || installed.signal) return { ...installed, containerId: id, image: plan.image };
    const exported = await command(["exec", id, "php", "-r", "echo base64_encode(file_get_contents('/work/php-output.gz'));"], signal, 24 * 1024 * 1024);
    ensure(exported.exitCode === 0 && !exported.signal, "PHP_OUTPUT_INVALID", "خروجی نصب کامل دریافت نشد.", 409);
    const output = decodeComponentOutput(Buffer.from(exported.output, "base64"), values.map(row => row.value)), wire = encodeComponentOutput(output);
    ensure(output.sourceHash === plan.sourceHash && output.planHash === fingerprint(plan), "PHP_OUTPUT_INVALID", "تبار نصب برابر نیست.", 409);
    const verification = parsePhpVerification({ version: 1, buildJobId: jobId, testedSourceHash: plan.sourceHash, planHash: output.planHash, outputArtifactHash: createHash("sha256").update(wire).digest("hex"), runtime: plan.runtime });
    const fresh = join(input, "fresh-php"); await mkdir(fresh);
    for (const file of phpEnvelopeFiles(verification)) await writeFile(join(fresh, file.path), file.content, { flag: "wx", mode: 0o600 });
    await writeFile(join(fresh, ".launchlane-php.gz"), wire, { flag: "wx", mode: 0o600 });
    await writeFile(join(fresh, "check-apache.conf"), phpApacheConfiguration(plan.runtime, "/work/runtime", "/work/.launchlane-php-proof.json"), { flag: "wx", mode: 0o600 });
    await writeFile(join(fresh, "php-check.php"), phpRuntimeCheckProgram, { flag: "wx", mode: 0o600 });
    const removed = await command(["rm", "--force", id], AbortSignal.timeout(5000), 4096); ensure(removed.exitCode === 0 && !removed.signal, "SANDBOX_CLEANUP_UNCONFIRMED", "پایان installer همین job روشن نیست.", 503); installer = null;
    const target = await start("runtime", ["--mount", `type=bind,source=${fresh},target=/input,readonly`]), checked = await execute(target, "/input/php-check.php");
    return { ...checked, output: `${installed.output}\n${checked.output}`, containerId: target, image: plan.image, ...(checked.exitCode === 0 && !checked.signal ? { componentOutput: output } : {}) };
  } finally { for (const id of [runtime, installer]) if (id) { const removed = await command(["rm", "--force", id], AbortSignal.timeout(5000), 4096); ensure(removed.exitCode === 0 && !removed.signal, "SANDBOX_CLEANUP_UNCONFIRMED", "پایان worker همین PHP job تأیید نشد.", 503); } }
}
