import { createHash, randomUUID } from "node:crypto";
import { pack } from "tar-stream";
import { parseDockerBuildPlan, pinnedDockerImage, type DockerBuildPlan } from "../../contracts/docker-build.ts";
import { environmentVariables, isApplicationEnvironmentKey, type EnvironmentVariable } from "../../contracts/environment.ts";
import { SOURCE_MAX_BYTES, SOURCE_MAX_FILES, sourceFileByteLimit } from "../../contracts/source-limits.ts";
import { exactKeys, hasControl, object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import { captureProject, type SourceFile } from "../workspace/inspect.ts";
import { docker, resolveCreatedContainer, type CommandResult } from "./container.ts";
import { createDockerRuntime, dockerEndpointHost, operatorDockerEndpoint, type DockerEngineDependencies } from "./docker-engine.ts";

type DockerCommand = typeof docker;
export type DockerBuildResult = CommandResult & Readonly<{
  containerId: string;
  image: string;
  sourceHash: string;
  dockerfileHash: string;
  workloadVerified: boolean;
}>;
const imageIdPattern = /^sha256:[a-f0-9]{64}$/;
const containerIdPattern = /^[a-f0-9]{64}$/;
const labelKey = "ir.launchlane.worker";
const imageFormat = '{"id":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}},"digests":{{json .RepoDigests}},"labels":{{json (index .Config "Labels")}},"onBuild":{{json (index .Config "OnBuild")}},"volumes":{{json (index .Config "Volumes")}}}';
const containerFormat = '{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Config.Image}},"actualImage":{{json .Image}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}},"oom":{{json .State.OOMKilled}}}';
const sum = (content: Buffer) => createHash("sha256").update(content).digest("hex");

/** Inspect declarations only; untrusted Dockerfile instructions never execute on the host. */
export function dockerBuildSource(files: readonly SourceFile[], input: DockerBuildPlan): readonly string[] {
  const plan = parseDockerBuildPlan(input), names = new Set<string>(); let bytes = 0;
  ensure(files.length > 0 && files.length <= SOURCE_MAX_FILES, "DOCKER_CONTEXT_LIMIT", "تعداد فایل‌های context معتبر نیست.", 413);
  for (const file of files) {
    ensure(typeof file.path === "string" && !/[\\:]/.test(file.path) && !hasControl(file.path) && file.path.split("/").every(part => part && part !== "." && part !== "..") &&
      !names.has(file.path) && Buffer.isBuffer(file.content), "DOCKER_CONTEXT_INVALID", "context فقط شامل فایل‌های عادی و یکتای همین source است.", 409);
    names.add(file.path); bytes += file.content.length;
    ensure(file.content.length <= sourceFileByteLimit(file.path) && bytes <= SOURCE_MAX_BYTES, "DOCKER_CONTEXT_LIMIT", "context از سقف source بیشتر است.", 413);
  }
  const manifest = files.map(file => ({ path: file.path, bytes: file.content.length, sha256: sum(file.content) })).sort((a, b) => a.path.localeCompare(b.path, "en"));
  const file = files.find(item => item.path === plan.runtime.dockerfile);
  ensure(fingerprint(manifest) === plan.sourceHash && file && sum(file.content) === plan.runtime.dockerfileHash,
    "DOCKER_SOURCE_CHANGED", "بایت‌های context یا Dockerfile با برنامهٔ مصوب برابر نیستند.", 409);
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(file.content); }
  catch { throw new AppError("DOCKERFILE_UNSUPPORTED", "Dockerfile باید متن UTF8 معتبر باشد.", 409); }
  ensure(!hasControl(source.replace(/[\t\r\n]/g, "")) && !/^\s*#\s*(?:syntax|escape)\s*=/im.test(source),
    "DOCKERFILE_UNSUPPORTED", "frontend بیرونی یا parser اختصاصی Dockerfile در این برنامه اجرا نمی‌شود.", 409);
  const lines = source.replace(/\r\n/g, "\n").replace(/\\\n/g, " ").split("\n");
  const bases = new Set<string>(), stages = new Set<string>(); let stageCount = 0;
  for (const raw of lines) {
    const line = raw.trim(); if (!line || line.startsWith("#")) continue;
    const instruction = /^([A-Za-z]+)\s+(.+)$/.exec(line);
    ensure(instruction, "DOCKERFILE_UNSUPPORTED", "یکی از دستورهای Dockerfile قابل بررسی نیست.", 409);
    const verb = instruction[1]?.toUpperCase(), argument = instruction[2] ?? "";
    ensure(verb && ["FROM", "RUN", "COPY", "ADD", "WORKDIR", "ENV", "USER", "EXPOSE", "CMD", "ENTRYPOINT", "LABEL", "SHELL", "STOPSIGNAL", "HEALTHCHECK", "MAINTAINER"].includes(verb) && !argument.includes("<<"),
      "DOCKERFILE_UNSUPPORTED", "دستور نیازمند اختیار جداگانه یا قالب پیچیده در Dockerfile وجود دارد؛ ساخت خودکار متوقف شد.", 409);
    if (verb === "FROM") {
      const match = /^(?:--platform=linux\/amd64\s+)?(\S+)(?:\s+AS\s+([a-z][a-z0-9_.-]*))?$/i.exec(argument);
      ensure(match, "DOCKERFILE_UNSUPPORTED", "stage و معماری Dockerfile باید صریح و محدود باشند.", 409);
      const reference = match[1] ?? "", name = match[2]?.toLowerCase();
      if (reference !== "scratch" && !stages.has(reference.toLowerCase())) bases.add(pinnedDockerImage(reference));
      ensure(!name || !stages.has(name), "DOCKERFILE_UNSUPPORTED", "نام stage تکراری است.", 409);
      stages.add(String(stageCount++)); if (name) stages.add(name);
      continue;
    }
    ensure(stageCount > 0, "DOCKERFILE_UNSUPPORTED", "Dockerfile باید با stage صریح آغاز شود.", 409);
    ensure(verb !== "RUN" || !argument.startsWith("--"), "DOCKERFILE_AUTHORITY_DENIED", "mount، شبکه یا اختیار اختصاصی RUN در این برنامه مجاز نیست.", 403);
    if (verb === "COPY" || verb === "ADD") {
      let body = argument, from: string | null = null;
      while (body.startsWith("--")) {
        const flag = /^--(from|chown|chmod)=([^\s]+)\s+(.+)$/i.exec(body);
        ensure(flag, "DOCKERFILE_AUTHORITY_DENIED", "گزینهٔ COPY/ADD نیازمند قرارداد جداگانه است.", 403);
        if (flag[1]?.toLowerCase() === "from") { ensure(from === null && verb === "COPY", "DOCKERFILE_AUTHORITY_DENIED", "مرجع کپی stage معتبر نیست.", 403); from = flag[2] ?? ""; }
        body = flag[3] ?? "";
      }
      ensure(from === null || stages.has(from.toLowerCase()), "DOCKERFILE_AUTHORITY_DENIED", "COPY از image یا context خارجی مجاز نیست.", 403);
      let paths: unknown;
      if (body.startsWith("[")) {
        try { paths = JSON.parse(body); } catch { throw new AppError("DOCKERFILE_UNSUPPORTED", "فهرست مسیر COPY/ADD معتبر نیست.", 409); }
      } else paths = body.split(/\s+/);
      ensure(Array.isArray(paths) && paths.length >= 2 && paths.every(path => typeof path === "string" && path.length > 0),
        "DOCKERFILE_UNSUPPORTED", "مبدأ و مقصد COPY/ADD باید قابل بررسی باشند.", 409);
      if (from === null) for (const path of paths.slice(0, -1)) ensure(typeof path === "string" && !/[\\:$]/.test(path) && !path.startsWith("/") &&
        path.split("/").every(part => part !== "..") && !path.startsWith("--"), "DOCKERFILE_AUTHORITY_DENIED", "کپی بیرون context یا دریافت فایل شبکه‌ای مجاز نیست.", 403);
    }
  }
  ensure(stageCount > 0 && fingerprint([...bases].sort()) === fingerprint([...plan.baseImages].sort()),
    "DOCKER_BASE_CHANGED", "فهرست imageهای پایه با stageهای همین Dockerfile برابر نیست.", 409);
  return [...bases].sort();
}

async function contextArchive(files: readonly SourceFile[], signal: AbortSignal): Promise<Buffer> {
  const archive = pack(), chunks: Buffer[] = []; let size = 0;
  const collected = (async () => {
    for await (const data of archive) {
      ensure(!signal.aborted && Buffer.isBuffer(data), "CANCELLED", "آماده‌سازی context متوقف شد.", 409);
      size += data.length; ensure(size <= SOURCE_MAX_BYTES + SOURCE_MAX_FILES * 2048, "DOCKER_CONTEXT_LIMIT", "بسته context بیش از حد بزرگ است.", 413);
      chunks.push(data);
    }
    return Buffer.concat(chunks, size);
  })();
  void collected.catch(() => undefined);
  try {
    for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path, "en"))) {
      ensure(!signal.aborted, "CANCELLED", "آماده‌سازی context متوقف شد.", 409);
      await new Promise<void>((resolve, reject) => archive.entry({ name: file.path, type: "file", size: file.content.length,
        mode: 0o644, uid: 0, gid: 0, mtime: new Date(0), uname: "", gname: "" }, file.content, error => error ? reject(error) : resolve()));
    }
    archive.finalize(); return await collected;
  } finally { archive.destroy(); }
}

function absent(result: CommandResult, reference: string, kind: "image" | "container"): boolean {
  return result.exitCode === 1 && !result.signal && ["Error:", "Error response from daemon:"].some(prefix =>
    [kind, "object"].some(name => result.output.trim() === `${prefix} No such ${name}: ${reference}`));
}
function recordOrEmpty(value: unknown) { return value === null ? {} : object(value); }
type Image = { id: string; digests: readonly string[]; labels: Record<string, unknown> };
async function inspectImage(reference: string, command: DockerCommand): Promise<Image | null> {
  const result = await command(["image", "inspect", "--format", imageFormat, reference], AbortSignal.timeout(5000), 16384);
  if (absent(result, reference, "image")) return null;
  ensure(result.exitCode === 0 && !result.signal, "SANDBOX_IMAGE_UNCERTAIN", "هویت image محلی قابل بررسی نیست؛ pull یا ساخت دوباره انجام نمی‌شود.", 503);
  try {
    const row = object(JSON.parse(result.output)); exactKeys(row, ["id", "os", "architecture", "digests", "labels", "onBuild", "volumes"]);
    ensure(typeof row.id === "string" && imageIdPattern.test(row.id) && row.os === "linux" && row.architecture === "amd64" &&
      (row.onBuild === null || Array.isArray(row.onBuild) && row.onBuild.length === 0) && Object.keys(recordOrEmpty(row.volumes)).length === 0 &&
      (row.digests === null || Array.isArray(row.digests) && row.digests.every(item => typeof item === "string")),
      "SANDBOX_IMAGE_DENIED", "image باید Linux/amd64 و بدون ONBUILD یا volume ضمنی باشد.", 409);
    return { id: row.id, digests: row.digests ?? [], labels: recordOrEmpty(row.labels) };
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError("SANDBOX_IMAGE_UNCERTAIN", "رسید image محلی معتبر نیست.", 503); }
}
function repository(reference: string): string {
  const name = reference.split("@")[0] ?? "", slash = name.lastIndexOf("/"), colon = name.lastIndexOf(":");
  let result = colon > slash ? name.slice(0, colon) : name;
  result = result.replace(/^docker\.io\//, "").replace(/^library\//, ""); return result;
}
async function cachedImage(reference: string, command: DockerCommand): Promise<Image> {
  const image = await inspectImage(reference, command), digest = reference.slice(reference.lastIndexOf("@"));
  ensure(image && image.digests.some(item => item.endsWith(digest) && repository(item) === repository(reference)),
    "DOCKER_BASE_NOT_CACHED", "image پایه با digest مصوب در این نصب موجود نیست؛ دریافت خودکار انجام نشد.", 409);
  return image;
}
type Ownership = { job: string; sourceHash: string; dockerfileHash: string };
function labels(owner: Ownership, kind: string): string[] {
  return ["--label", `${labelKey}=${kind}`, "--label", `ir.launchlane.job=${owner.job}`, "--label", `ir.launchlane.source=${owner.sourceHash}`, "--label", `ir.launchlane.dockerfile=${owner.dockerfileHash}`];
}
function assertLabels(value: Record<string, unknown>, owner: Ownership, kind: string) {
  ensure(value[labelKey] === kind && value["ir.launchlane.job"] === owner.job && value["ir.launchlane.source"] === owner.sourceHash && value["ir.launchlane.dockerfile"] === owner.dockerfileHash,
    "SANDBOX_CLEANUP_UNCONFIRMED", "مالکیت محیط با همین job و source برابر نیست؛ محیط دیگری حذف یا استفاده نمی‌شود.", 503);
}
async function ownedImage(tag: string, owner: Ownership, command: DockerCommand): Promise<Image | null> {
  const image = await inspectImage(tag, command); if (image) assertLabels(image.labels, owner, "docker-build-v1"); return image;
}
type OwnedContainer = { id: string; name: string; reference: string; actualImage: string; kind: string };
async function inspectContainer(container: OwnedContainer, owner: Ownership, command: DockerCommand): Promise<{ running: boolean; oom: boolean } | null> {
  const result = await command(["inspect", "--type", "container", "--format", containerFormat, container.id], AbortSignal.timeout(5000), 8192);
  if (absent(result, container.id, "container")) return null;
  ensure(result.exitCode === 0 && !result.signal, "SANDBOX_CLEANUP_UNCONFIRMED", "هویت محیط همین job قابل بررسی نیست.", 503);
  try {
    const row = object(JSON.parse(result.output)); exactKeys(row, ["id", "name", "image", "actualImage", "labels", "running", "oom"]);
    ensure(row.id === container.id && containerIdPattern.test(container.id) && row.name === `/${container.name}` && row.image === container.reference &&
      row.actualImage === container.actualImage && typeof row.running === "boolean" && typeof row.oom === "boolean",
      "SANDBOX_CLEANUP_UNCONFIRMED", "هویت یا image محیط با همین job برابر نیست؛ استفاده یا حذف نمی‌شود.", 503);
    assertLabels(object(row.labels), owner, container.kind); return { running: row.running, oom: row.oom };
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError("SANDBOX_CLEANUP_UNCONFIRMED", "رسید هویت محیط معتبر نیست.", 503); }
}

// Only this trusted process writes the receipt. Application stdout and Docker HEALTHCHECK are not oracles.
export const dockerWorkloadProgram = `const plan=JSON.parse(process.argv[1]);
let lastStatus=null;const watchdog=setTimeout(()=>process.exit(124),22000);
(async()=>{let matched=false;const deadline=Date.now()+15000;while(Date.now()<deadline){
try{const response=await fetch('http://127.0.0.1:'+plan.port+plan.workload.path,{redirect:'manual',signal:AbortSignal.timeout(1000)});
lastStatus=response.status;const chunks=[];let size=0;for await(const bytes of response.body){size+=bytes.length;if(size>65536)throw Error('response limit');chunks.push(Buffer.from(bytes))}
const body=Buffer.concat(chunks).toString('utf8'),a=plan.workload.assertion;let content=false;
if(a.kind==='text')content=body.includes(a.contains);else{try{const json=JSON.parse(body);content=json!==null&&typeof json==='object'&&!Array.isArray(json)&&Object.hasOwn(json,a.field)&&json[a.field]===a.equals}catch{}}
if(response.status===plan.workload.status&&content){matched=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,250))}
clearTimeout(watchdog);process.stdout.write(JSON.stringify({version:1,matched,status:lastStatus}));process.exit(matched?0:73)
})().catch(()=>{clearTimeout(watchdog);process.exit(74)});`;

/** Root dispatch owns the shared sandbox-capacity reservation and durable execution allowance. */
export async function runDockerBuild(workspace: string, value: DockerBuildPlan, signal: AbortSignal,
  onCreated?: (id: string) => void, environment: readonly EnvironmentVariable[] = [], command: DockerCommand = docker,
  engine: DockerEngineDependencies = {}, executionId: string = randomUUID()): Promise<DockerBuildResult> {
  ensure(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(executionId), "DOCKER_EXECUTION_ID_INVALID", "هویت اجرای Docker معتبر نیست.", 409);
  const plan = parseDockerBuildPlan(value), values = environmentVariables(environment);
  ensure(values.every(row => isApplicationEnvironmentKey(row.key)) && fingerprint(values.map(row => row.key).sort()) === fingerprint([...(plan.environment?.keys ?? [])].sort()),
    "ENV_REFERENCE_CHANGED", "تنظیمات runtime با مرجع مصوب برابر نیست؛ مقدار به دستور یا context ارسال نشد.", 409);
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(180000)]);
  ensure(!bounded.aborted, "CANCELLED", "ساخت Docker متوقف شد.", 409);
  const captured = await captureProject(workspace, ".", { signal: bounded, secrets: values.map(row => row.value) });
  dockerBuildSource(captured.files, plan);
  const endpoint = engine.endpoint ?? await operatorDockerEndpoint(bounded, command), host = dockerEndpointHost(endpoint);
  // Freeze the operator-selected local engine for every read/write and reconciliation of this job.
  const scopedCommand: DockerCommand = (args, requestSignal, maxBytes, input) => command(["--host", host, ...args], requestSignal, maxBytes, input);
  for (const reference of plan.baseImages) await cachedImage(reference, scopedCommand);
  const verifier = await cachedImage(plan.verifierImage, scopedCommand), context = await contextArchive(captured.files, bounded);
  const owner = { job: executionId, sourceHash: plan.sourceHash, dockerfileHash: plan.runtime.dockerfileHash }, tag = `launchlane-docker-${owner.job}:local`;
  let image: Image | null = null, buildStarted = false, buildFinished = false, uncertainBuild = false, cleanupFailed = false;
  let outcome: DockerBuildResult | null = null, failure: unknown = null;
  const containers: OwnedContainer[] = [];
  async function create(kind: string, reference: string, actualImage: string, args: string[]): Promise<OwnedContainer> {
    const name = `launchlane-${kind}-${owner.job}`;
    let result: CommandResult;
    if (kind === "docker-runtime-v1") {
      try {
        const created = await createDockerRuntime({ name, image: reference, jobId: owner.job, sourceHash: owner.sourceHash, dockerfileHash: owner.dockerfileHash, environment: values }, bounded, { ...engine, endpoint, command: scopedCommand });
        result = { output: created.id, exitCode: 0, signal: null };
      } catch (error) {
        if (error instanceof AppError && error.code === "SANDBOX_RUNTIME_UNCERTAIN") {
          const id = await resolveCreatedContainer({ output: "", exitCode: null, signal: "LOST_RESPONSE" }, { name, label: kind, image: reference }, scopedCommand);
          if (id) { containers.push({ id, name, reference, actualImage, kind }); onCreated?.(id); }
        }
        throw error;
      }
    } else result = await scopedCommand(["create", "--pull=never", "--name", name, ...labels(owner, kind),
      "--log-driver", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "1000:1000", "--cpus", "1", "--memory", "512m", "--memory-swap", "512m", "--pids-limit", "128",
      "--tmpfs", "/tmp:rw,nosuid,nodev,size=67108864,mode=1777", "--no-healthcheck", ...args, reference,
      ...(kind === "docker-verifier-v1" ? ["-e", dockerWorkloadProgram, "--", JSON.stringify({ port: plan.port, workload: plan.workload })] : [])], bounded, 8192);
    const id = await resolveCreatedContainer(result, { name, label: kind, image: reference }, scopedCommand);
    if (id) { const container = { id, name, reference, actualImage, kind }; containers.push(container); onCreated?.(id); }
    ensure(result.exitCode === 0 && !result.signal && id && result.output.trim() === id, "SANDBOX_RUNTIME_UNCERTAIN", "ساخت محیط پاسخ قطعی ندارد؛ ایجاد دوباره انجام نمی‌شود.", 503);
    const container = containers.at(-1); ensure(container && (await inspectContainer(container, owner, scopedCommand)), "SANDBOX_RUNTIME_UNCERTAIN", "محیط ساخته‌شده قابل تأیید نیست.", 503);
    return container;
  }
  try {
    buildStarted = true;
    let built: CommandResult;
    // Clear Docker client's built-in proxy defaults; no operator proxy secret enters image layers or logs.
    const proxyArguments = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "FTP_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "ftp_proxy"].flatMap(key => ["--build-arg", `${key}=`]);
    try { built = await scopedCommand(["build", "--pull=false", "--network=none", "--no-cache", "--force-rm=true", "--rm=true", "--platform", "linux/amd64", "--memory", "2g", "--memory-swap", "2g", "--cpu-period", "100000", "--cpu-quota", "100000", ...proxyArguments,
      "--quiet", "--tag", tag, ...labels(owner, "docker-build-v1"), "--file", plan.runtime.dockerfile, "-"], bounded, 32768, context); }
    catch { uncertainBuild = true; throw new AppError("SANDBOX_BUILD_UNCERTAIN", "پاسخ ساخت دریافت نشد؛ پایان اجرای daemon نامعلوم است و ساخت دوباره خودکار مجاز نیست.", 503); }
    buildFinished = built.exitCode !== null && !built.signal;
    uncertainBuild = !buildFinished;
    image = await ownedImage(tag, owner, scopedCommand);
    ensure(buildFinished, "SANDBOX_BUILD_UNCERTAIN", "ساخت قطع شده است؛ پایان اجرای daemon و خروجی آن باید پیش از تلاش تازه روشن شوند.", 503);
    ensure(built.exitCode === 0, "DOCKER_BUILD_FAILED", "ساخت همان Dockerfile در محیط بدون شبکه شکست خورد؛ dependency و دستورهای پروژه را بررسی کنید.", 409);
    ensure(image, "SANDBOX_BUILD_UNCERTAIN", "رسید موفق ساخت به image متعلق به همین job متصل نیست؛ انتشار مجاز نیست.", 503);
    const after = await captureProject(workspace, ".", { signal: bounded, secrets: values.map(row => row.value) }); dockerBuildSource(after.files, plan);
    const runtime = await create("docker-runtime-v1", image.id, image.id, ["--network", "none"]);
    const started = await scopedCommand(["start", runtime.id], bounded, 4096);
    ensure(started.exitCode === 0 && !started.signal, "SANDBOX_RUNTIME_UNCERTAIN", "شروع اجرای image پاسخ قطعی ندارد؛ تکرار نمی‌شود.", 503);
    const state = await inspectContainer(runtime, owner, scopedCommand);
    ensure(state?.running && !state.oom, "DOCKER_START_FAILED", "برنامه با محدودیت‌های مصوب اجرا نماند؛ پورت و نیازهای فایل/حافظه را بررسی کنید.", 409);
    const probe = await create("docker-verifier-v1", plan.verifierImage, verifier.id, ["--network", `container:${runtime.id}`, "--entrypoint", "/usr/local/bin/node"]);
    const checked = await scopedCommand(["start", "--attach", probe.id], bounded, 4096);
    ensure(checked.exitCode !== null && !checked.signal, "SANDBOX_RUNTIME_UNCERTAIN", "بررسی پاسخ image پایان قطعی ندارد؛ موفقیت ثبت نشد.", 503);
    let matched = false;
    try {
      const result = object(JSON.parse(checked.output)); exactKeys(result, ["version", "matched", "status"]);
      ensure(result.version === 1 && typeof result.matched === "boolean" && (result.status === null || typeof result.status === "number" && Number.isInteger(result.status) && result.status >= 100 && result.status <= 599),
        "DOCKER_PROBE_INVALID", "رسید بررسی پاسخ معتبر نیست.", 503);
      matched = checked.exitCode === 0 && result.matched && result.status === plan.workload.status;
    } catch (error) { if (error instanceof AppError) throw error; throw new AppError("DOCKER_PROBE_INVALID", "رسید بررسی پاسخ معتبر نیست.", 503); }
    const final = await inspectContainer(runtime, owner, scopedCommand), checkedSource = await captureProject(workspace, ".", { signal: bounded, secrets: values.map(row => row.value) }); dockerBuildSource(checkedSource.files, plan);
    matched &&= !!final?.running && !final.oom && !bounded.aborted;
    outcome = { output: matched ? "Launchlane: exact Docker source built; approved workload content and status verified in an isolated runtime." : "Launchlane: Docker image built; approved workload content and status were not verified.",
      exitCode: matched ? 0 : 73, signal: final?.oom ? "OOM" : null, containerId: runtime.id, image: image.id, sourceHash: plan.sourceHash, dockerfileHash: plan.runtime.dockerfileHash, workloadVerified: matched };
  } catch (error) { failure = error;
  } finally {
    context.fill(0);
    for (const container of [...containers].reverse()) {
      try {
        if (!await inspectContainer(container, owner, scopedCommand)) continue;
        const removed = await scopedCommand(["rm", "--force", container.id], AbortSignal.timeout(5000), 4096);
        ensure(removed.exitCode === 0 && !removed.signal && await inspectContainer(container, owner, scopedCommand) === null,
          "SANDBOX_CLEANUP_UNCONFIRMED", "حذف محیط همین job تأیید نشد.", 503);
      } catch { cleanupFailed = true; }
    }
    if (buildStarted) {
      try {
        const remaining = await ownedImage(tag, owner, scopedCommand);
        if (remaining) {
          ensure(!image || remaining.id === image.id, "SANDBOX_CLEANUP_UNCONFIRMED", "image این job تغییر کرده است؛ حذف نمی‌شود.", 503);
          const removed = await scopedCommand(["image", "rm", tag], AbortSignal.timeout(5000), 4096);
          ensure(removed.exitCode === 0 && !removed.signal && await ownedImage(tag, owner, scopedCommand) === null, "SANDBOX_CLEANUP_UNCONFIRMED", "حذف image متعلق به همین job تأیید نشد.", 503);
        }
      } catch { cleanupFailed = true; }
    }
  }
  if (uncertainBuild || buildStarted && !buildFinished) throw new AppError("SANDBOX_BUILD_UNCERTAIN", "پایان ساخت daemon تأیید نشده است؛ اجرای تازه تا بررسی همان job متوقف می‌ماند.", 503);
  if (cleanupFailed) throw new AppError("SANDBOX_CLEANUP_UNCONFIRMED", "پایان محیط یا image همین job تأیید نشده است؛ بررسی مالکیت و پایان اجرا لازم است.", 503);
  if (failure) throw failure;
  ensure(outcome, "SANDBOX_RUNTIME_UNCERTAIN", "اجرای Docker رسید کامل ندارد.", 503); return outcome;
}
