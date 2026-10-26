import { request } from "node:http";
import { posix } from "node:path";
import { environmentVariables, isApplicationEnvironmentKey, type EnvironmentVariable } from "../../contracts/environment.ts";
import { hash, hasControl, object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { docker } from "./container.ts";

export type LocalDockerEndpoint = Readonly<{ socketPath: string }>;
export type DockerEngineTransport = (endpoint: LocalDockerEndpoint, input: Readonly<{
  method: "GET" | "POST";
  path: string;
  body: Buffer | null;
}>, signal: AbortSignal) => Promise<{ status: number; body: Buffer }>;

/** The argument comes from operator process/context metadata, never project environment or a model tool. */
export function localDockerEndpoint(value: unknown): LocalDockerEndpoint {
  ensure(typeof value === "string" && value.length <= 512 && !hasControl(value), "SANDBOX_ENGINE_UNSUPPORTED", "آدرس محلی Docker معتبر نیست.", 503);
  if (value.startsWith("unix:///")) {
    const path = value.slice("unix://".length);
    ensure(path.startsWith("/") && !/[\\%?#]/.test(path) && posix.normalize(path) === path && !path.includes("//"),
      "SANDBOX_ENGINE_UNSUPPORTED", "مسیر socket محلی Docker معتبر نیست.", 503);
    return { socketPath: path };
  }
  const pipe = /^npipe:\/\/\/\/\.\/pipe\/([A-Za-z0-9_.-]{1,100})$/.exec(value);
  ensure(pipe?.[1] && pipe[1] !== "." && pipe[1] !== "..", "SANDBOX_ENGINE_UNSUPPORTED",
    "این مسیر فقط Docker محلی با Unix socket یا Windows named pipe را می‌پذیرد؛ اتصال SSH/TCP خودکار انجام نمی‌شود.", 503);
  return { socketPath: `\\\\.\\pipe\\${pipe[1]}` };
}

export function dockerEndpointHost(endpoint: LocalDockerEndpoint): string {
  const pipePrefix = "\\\\.\\pipe\\", host = endpoint.socketPath.startsWith(pipePrefix)
    ? `npipe:////./pipe/${endpoint.socketPath.slice(pipePrefix.length)}` : `unix://${endpoint.socketPath}`;
  ensure(localDockerEndpoint(host).socketPath === endpoint.socketPath, "SANDBOX_ENGINE_UNSUPPORTED", "آدرس محلی Docker یکتا و معتبر نیست.", 503);
  return host;
}

export async function operatorDockerEndpoint(signal: AbortSignal, command: typeof docker = docker,
  operator: Readonly<{ DOCKER_HOST?: string | undefined; DOCKER_CONTEXT?: string | undefined }> = { DOCKER_HOST: process.env.DOCKER_HOST, DOCKER_CONTEXT: process.env.DOCKER_CONTEXT }): Promise<LocalDockerEndpoint> {
  if (!operator.DOCKER_CONTEXT && operator.DOCKER_HOST) return localDockerEndpoint(operator.DOCKER_HOST);
  const context = operator.DOCKER_CONTEXT;
  ensure(context === undefined || context.length > 0 && context.length <= 100 && !hasControl(context) && !context.startsWith("-"),
    "SANDBOX_ENGINE_UNSUPPORTED", "نام context محلی Docker معتبر نیست.", 503);
  const result = await command(["context", "inspect", "--format", "{{json .Endpoints.docker.Host}}", ...(context ? [context] : [])], signal, 4096);
  ensure(result.exitCode === 0 && !result.signal, "SANDBOX_ENGINE_UNSUPPORTED", "تنظیم اتصال محلی Docker قابل بررسی نیست.", 503);
  let host: unknown; try { host = JSON.parse(result.output); } catch { throw new AppError("SANDBOX_ENGINE_UNSUPPORTED", "رسید context محلی Docker معتبر نیست.", 503); }
  return localDockerEndpoint(host);
}

export const localDockerRequest: DockerEngineTransport = (endpoint, input, signal) => {
  ensure(!signal.aborted && endpoint.socketPath.length > 0 && !hasControl(endpoint.socketPath) &&
    (input.path === "/version" || /^\/v1\.45\/containers\/create\?name=launchlane-docker-runtime-v1-[a-f0-9-]{36}$/.test(input.path)) &&
    (input.body?.length ?? 0) <= 640 * 1024, "SANDBOX_ENGINE_UNSUPPORTED", "درخواست محلی Docker از قرارداد مجاز خارج است.", 503);
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = () => {
      if (settled) return; settled = true;
      reject(new AppError("SANDBOX_RUNTIME_UNCERTAIN", "ارتباط محلی Docker پایان قطعی ندارد؛ مقدار تنظیمات نمایش داده نشد و ایجاد دوباره انجام نمی‌شود.", 503));
    };
    const child = request({ socketPath: endpoint.socketPath, method: input.method, path: input.path, agent: false,
      headers: { Host: "localhost", Accept: "application/json", ...(input.body ? { "Content-Type": "application/json", "Content-Length": input.body.length } : {}) } }, response => {
      const chunks: Buffer[] = []; let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 32768) { response.destroy(); child.destroy(); fail(); } else chunks.push(chunk);
      });
      response.once("error", fail);
      response.once("aborted", fail);
      response.once("end", () => {
        if (settled) return; settled = true;
        signal.removeEventListener("abort", stop);
        resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks, bytes) });
      });
    });
    const stop = () => { child.destroy(); fail(); };
    signal.addEventListener("abort", stop, { once: true });
    child.once("error", fail); child.once("close", () => signal.removeEventListener("abort", stop));
    if (signal.aborted) stop(); else child.end(input.body);
  });
};

export type DockerRuntimeInput = Readonly<{
  name: string;
  image: string;
  jobId: string;
  sourceHash: string;
  dockerfileHash: string;
  environment: readonly EnvironmentVariable[];
}>;
export type DockerEngineDependencies = { command?: typeof docker; send?: DockerEngineTransport; endpoint?: LocalDockerEndpoint };

/** Env travels in a bounded Engine API body on the local socket, never argv, an env-file, source or image build. */
export async function createDockerRuntime(input: DockerRuntimeInput, signal: AbortSignal, dependencies: DockerEngineDependencies = {}): Promise<{ id: string; warningCount: number }> {
  ensure(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.jobId) &&
    input.name === `launchlane-docker-runtime-v1-${input.jobId}` && /^sha256:[a-f0-9]{64}$/.test(input.image),
    "SANDBOX_ENGINE_UNSUPPORTED", "هویت job و image برای ایجاد runtime معتبر نیست.", 503);
  const sourceHash = hash(input.sourceHash), dockerfileHash = hash(input.dockerfileHash), values = environmentVariables(input.environment);
  ensure(values.every(row => isApplicationEnvironmentKey(row.key)), "ENV_SCOPE_DENIED", "تنظیمات پروژه نمی‌توانند تنظیمات runner را جایگزین کنند.", 409);
  const endpoint = dependencies.endpoint ?? await operatorDockerEndpoint(signal, dependencies.command), send = dependencies.send ?? localDockerRequest;
  let version: Awaited<ReturnType<DockerEngineTransport>>;
  try { version = await send(endpoint, { method: "GET", path: "/version", body: null }, signal); }
  catch { throw new AppError("SANDBOX_ENGINE_UNSUPPORTED", "نسخهٔ Docker Engine محلی قابل بررسی نیست؛ ایجاد runtime انجام نشد.", 503); }
  ensure(version.status === 200, "SANDBOX_ENGINE_UNSUPPORTED", "نسخهٔ Docker Engine محلی قابل بررسی نیست؛ runtime ساخته نشد.", 503);
  let api: Record<string, unknown>; try { api = object(JSON.parse(version.body.toString("utf8"))); }
  catch { throw new AppError("SANDBOX_ENGINE_UNSUPPORTED", "رسید نسخهٔ Docker Engine معتبر نیست.", 503); }
  const apiNumber = (value: unknown) => typeof value === "string" && /^1\.[0-9]{2,3}$/.test(value) ? Number(value.slice(2)) : null;
  const maximum = apiNumber(api.ApiVersion), minimum = apiNumber(api.MinAPIVersion);
  ensure(api.Os === "linux" && maximum !== null && maximum >= 45 && minimum !== null && minimum <= 45,
    "SANDBOX_ENGINE_UNSUPPORTED", "Docker Engine محلی باید Linux و سازگار با API 1.45 باشد؛ ایجاد ناسازگار انجام نشد.", 503);
  const body = Buffer.from(JSON.stringify({ Image: input.image, User: "1000:1000", Env: values.map(row => `${row.key}=${row.value}`),
    Labels: { "ir.launchlane.worker": "docker-runtime-v1", "ir.launchlane.job": input.jobId, "ir.launchlane.source": sourceHash, "ir.launchlane.dockerfile": dockerfileHash },
    AttachStdin: false, AttachStdout: false, AttachStderr: false, OpenStdin: false, Tty: false,
    Healthcheck: { Test: ["NONE"] }, HostConfig: { NetworkMode: "none", ReadonlyRootfs: true, Privileged: false,
      CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"], Memory: 536870912, MemorySwap: 536870912, NanoCpus: 1000000000, PidsLimit: 128,
      LogConfig: { Type: "none", Config: {} }, Tmpfs: { "/tmp": "rw,nosuid,nodev,size=67108864,mode=1777" },
      Binds: [], Mounts: [], Devices: [], PortBindings: {}, PublishAllPorts: false, AutoRemove: false, IpcMode: "private", RestartPolicy: { Name: "no", MaximumRetryCount: 0 } } }));
  try {
    ensure(body.length <= 640 * 1024, "INVALID_ENV_INPUT", "حجم تنظیمات runtime بیش از سقف مجاز است.", 413);
    let response: Awaited<ReturnType<DockerEngineTransport>>;
    try { response = await send(endpoint, { method: "POST", path: `/v1.45/containers/create?name=${input.name}`, body }, signal); }
    catch { throw new AppError("SANDBOX_RUNTIME_UNCERTAIN", "پاسخ ایجاد runtime دریافت نشد؛ همان نام و مالکیت باید بررسی شوند و درخواست تکرار نمی‌شود.", 503); }
    ensure(response.status === 201, "SANDBOX_RUNTIME_UNCERTAIN", "ایجاد runtime رسید تأییدشده ندارد؛ تنظیمات محرمانه نمایش داده نشد و درخواست تکرار نمی‌شود.", 503);
    try {
      const row = object(JSON.parse(response.body.toString("utf8")));
      ensure(typeof row.Id === "string" && /^[a-f0-9]{64}$/.test(row.Id) && (row.Warnings === null || Array.isArray(row.Warnings) && row.Warnings.length <= 128 && row.Warnings.every(item => typeof item === "string")),
        "SANDBOX_RUNTIME_UNCERTAIN", "رسید ایجاد runtime معتبر نیست؛ ایجاد دوباره انجام نمی‌شود.", 503);
      return { id: row.Id, warningCount: row.Warnings?.length ?? 0 };
    } catch { throw new AppError("SANDBOX_RUNTIME_UNCERTAIN", "رسید ایجاد runtime قابل تأیید نیست؛ ایجاد دوباره انجام نمی‌شود.", 503); }
  } finally { body.fill(0); }
}
