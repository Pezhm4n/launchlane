import { setTimeout as pause } from "node:timers/promises";
import { exactKeys, object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { abortable } from "../providers/http.ts";
import { docker, resolveCreatedContainer, type CommandResult } from "./container.ts";
import { dockerEndpointHost, operatorDockerEndpoint, type LocalDockerEndpoint } from "./docker-engine.ts";
import { postgresTestImage } from "../../contracts/test-database.ts";
import { blankSandboxProxyArguments, hasBlankSandboxProxies } from "./docker-proxy.ts";

// docker-library/repo-info remote/16-bookworm.md, linux/amd64, observed 2026-10-25.
export const postgresFixtureImage = postgresTestImage;
const imageId = "sha256:392c708576858a9a583a1b937503a99df57ca5dae63890748f4d0f2fc848abc6";
const digest = postgresFixtureImage.split("@")[1], worker = "postgres-fixture-v1";
const data = "/var/lib/postgresql/data", socket = "/var/run/postgresql";
const tmpfs = { [data]: "rw,nosuid,nodev,noexec,size=268435456,uid=999,gid=999,mode=0700",
  [socket]: "rw,nosuid,nodev,noexec,size=16777216,uid=999,gid=999,mode=0700" };
const fixture = { host: "127.0.0.1", port: 5432, database: "launchlane_fixture", user: "launchlane_fixture", authentication: "isolated_trust" } as const;
const inspectFormat = '{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Config.Image}},"actualImage":{{json .Image}},"labels":{{json .Config.Labels}},"env":{{json .Config.Env}},"running":{{json .State.Running}},"oom":{{json .State.OOMKilled}},"user":{{json .Config.User}},"host":{{json .HostConfig}},"mounts":{{json .Mounts}},"networks":{{json .NetworkSettings.Networks}},"ports":{{json .NetworkSettings.Ports}}}';
const imageFormat = '{"id":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}},"digests":{{json .RepoDigests}},"descriptor":{{json (index . "Descriptor")}},"volumes":{{json (index .Config "Volumes")}},"onBuild":{{json (index .Config "OnBuild")}}}';
type Command = typeof docker;
type Owner = { jobId: string; sourceHash: string; name: string };
export type PostgresFixtureTarget = Readonly<{ id: string; database: string; user: string }>;
export type PostgresFixtureBinding = Readonly<Omit<typeof fixture, "user"> & { user: "launchlane_fixture" | "launchlane_migration_app"; jobId: string; sourceHash: string; containerId: string; networkMode: `container:${string}`; targets?: readonly PostgresFixtureTarget[] }>;
export type PostgresFixtureSql = Readonly<{ apply: (sql: string, signal: AbortSignal) => Promise<CommandResult>; read: (sql: string, signal: AbortSignal, target?: string) => Promise<CommandResult> }>;
export type PostgresFixtureOptions = Readonly<{
  jobId: string; sourceHash: string; signal: AbortSignal;
  onCreated: (id: string) => void | Promise<void>;
  command?: Command; endpoint?: LocalDockerEndpoint; migration?: boolean; targets?: readonly string[];
}>;
function stop(signal: AbortSignal): void { ensure(!signal.aborted, "CANCELLED", "اجرای دیتابیس ساختگی متوقف شد.", 409); }
function absent(result: CommandResult, reference: string, kind: "image" | "container"): boolean {
  return result.exitCode === 1 && !result.signal && ["Error:", "Error response from daemon:"].some(prefix =>
    [kind, "object"].some(value => result.output.trim() === `${prefix} No such ${value}: ${reference}`));
}
function ok(result: CommandResult): boolean { return result.exitCode === 0 && !result.signal; }
function empty(value: unknown): boolean { return value === null || value === undefined || Array.isArray(value) && value.length === 0; }
function map(value: unknown): Record<string, unknown> { return value === null ? {} : object(value); }
async function inspect(reference: string, command: Command, signal = AbortSignal.timeout(5000)): Promise<Record<string, unknown> | null> {
  const result = await command(["inspect", "--type", "container", "--format", inspectFormat, reference], signal, 32768);
  if (absent(result, reference, "container")) return null;
  ensure(ok(result), "POSTGRES_FIXTURE_UNCERTAIN", "هویت محیط دیتابیس ساختگی قابل بررسی نیست؛ ایجاد تازه انجام نشد.", 503);
  try { return object(JSON.parse(result.output)); } catch { throw new AppError("POSTGRES_FIXTURE_UNCERTAIN", "رسید محیط دیتابیس ساختگی معتبر نیست.", 503); }
}
function identity(row: Record<string, unknown>, id: string, owner: Owner, verifiedImageId: string): void {
  const labels = row.labels && typeof row.labels === "object" && !Array.isArray(row.labels) ? object(row.labels) : {};
  ensure(/^[a-f0-9]{64}$/.test(id) && row.id === id && row.name === `/${owner.name}` && row.image === postgresFixtureImage && row.actualImage === verifiedImageId &&
    labels["ir.launchlane.worker"] === worker && labels["ir.launchlane.job"] === owner.jobId && labels["ir.launchlane.source"] === owner.sourceHash,
    "POSTGRES_FIXTURE_IDENTITY_MISMATCH", "محیط دیتابیس با هویت همین job و source برابر نیست؛ استفاده یا حذف محیط دیگر مجاز نیست.", 409);
}
function isolation(row: Record<string, unknown>, running: boolean): void {
  const host = object(row.host), mounts = row.mounts, settings = map(row.networks), ports = map(row.ports), actualTmpfs = object(host.Tmpfs);
  ensure(hasBlankSandboxProxies(row.env) && row.user === "999:999" && row.running === running && row.oom === false && host.ReadonlyRootfs === true && host.Privileged === false &&
    host.NetworkMode === "none" && host.PublishAllPorts === false && Object.keys(map(host.PortBindings)).length === 0 && Object.values(ports).every(value => value === null) &&
    Object.keys(settings).every(name => name === "none") && empty(host.Binds) && empty(host.Mounts) && empty(host.Devices) && empty(host.CapAdd) &&
    Array.isArray(host.CapDrop) && host.CapDrop.length === 1 && host.CapDrop[0] === "ALL" &&
    Array.isArray(host.SecurityOpt) && host.SecurityOpt.length === 1 && ["no-new-privileges", "no-new-privileges:true"].includes(String(host.SecurityOpt[0])) &&
    host.Memory === 536870912 && host.MemorySwap === 536870912 && host.NanoCpus === 250000000 && host.PidsLimit === 128 &&
    host.PidMode === "" && host.IpcMode === "private" && object(host.RestartPolicy).Name === "no" && object(host.LogConfig).Type === "none" &&
    Object.keys(actualTmpfs).length === 2 && Object.entries(tmpfs).every(([path, value]) => actualTmpfs[path] === value) && Array.isArray(mounts) &&
    mounts.every(value => { const mount = object(value); return mount.Type === "tmpfs" && Object.hasOwn(tmpfs, String(mount.Destination)) && mount.RW === true && (mount.Source === "" || mount.Source === undefined); }),
    "POSTGRES_FIXTURE_ISOLATION_INVALID", "شبکه، منابع یا دیسک محیط ساختگی با قرارداد ایزوله برابر نیست؛ دسترسی برنامه داده نشد.", 409);
}
async function cachedImage(command: Command, signal: AbortSignal): Promise<string> {
  const result = await command(["image", "inspect", "--format", imageFormat, postgresFixtureImage], signal, 16384);
  ensure(!absent(result, postgresFixtureImage, "image"), "POSTGRES_FIXTURE_IMAGE_UNAVAILABLE", "image ثابت PostgreSQL در cache نیست؛ دانلود خودکار انجام نشد.", 409);
  ensure(ok(result), "POSTGRES_FIXTURE_UNCERTAIN", "هویت image ثابت قابل بررسی نیست؛ دانلود یا ایجاد مجدد انجام نشد.", 503);
  try {
    const row = object(JSON.parse(result.output)), volumes = object(row.volumes);
    const descriptor = row.descriptor === undefined || row.descriptor === null ? null : object(row.descriptor);
    const manifestIdentity = row.id === digest && descriptor !== null && descriptor.digest === digest && ["application/vnd.oci.image.manifest.v1+json", "application/vnd.docker.distribution.manifest.v2+json"].includes(String(descriptor.mediaType)) &&
      typeof descriptor.size === "number" && Number.isSafeInteger(descriptor.size) && descriptor.size > 0 && descriptor.size <= 100000;
    ensure((row.id === imageId || manifestIdentity) && row.os === "linux" && row.architecture === "amd64" && Array.isArray(row.digests) &&
      row.digests.some(value => value === `postgres@${digest}` || value === `docker.io/library/postgres@${digest}`) && empty(row.onBuild) &&
      Object.keys(volumes).length === 1 && Object.hasOwn(volumes, data),
      "POSTGRES_FIXTURE_IMAGE_MISMATCH", "بایت‌ها یا سکوی image با PostgreSQL مصوب برابر نیست.", 409);
    return String(row.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "POSTGRES_FIXTURE_IMAGE_MISMATCH") throw error;
    throw new AppError("POSTGRES_FIXTURE_IMAGE_MISMATCH", "رسید image ثابت PostgreSQL قابل تأیید نیست.", 409);
  }
}
function mountInfo(text: string): void {
  const mounts = text.split("\n").map(line => { const [left, right] = line.split(" - "); return { before: left?.split(" ") ?? [], after: right?.split(" ") ?? [] }; });
  for (const path of Object.keys(tmpfs)) {
    // The pinned Debian image resolves /var/run to /run; the kernel reports that canonical socket path.
    const matches = mounts.filter(row => row.before[4] === path || path === socket && row.before[4] === "/run/postgresql");
    ensure(matches.length === 1 && matches[0]?.after[0] === "tmpfs" && ["rw", "nosuid", "nodev", "noexec"].every(flag => matches[0]?.before[5]?.split(",").includes(flag)),
      "POSTGRES_FIXTURE_ISOLATION_INVALID", "فضای داده یا socket واقعاً tmpfs محدود نیست؛ دسترسی برنامه داده نشد.", 409);
  }
}

/** Creates only an isolated synthetic-data service. No credential import, pull, host port or host volume.
 * SQL requires explicit migration mode and the caller's reviewed local-work contract.
 * Caller owns the persisted job, onCreated receipt, worker lifetime and any separate data-test authorization.
 * Migration mode grants only an ordinary app role; root psql remains host-owned for independent readback.
 */
export async function withPostgresFixture<T>(options: PostgresFixtureOptions,
  use: (binding: PostgresFixtureBinding, signal: AbortSignal, sql: PostgresFixtureSql) => Promise<T>): Promise<T> {
  const input = object(options); exactKeys(input, ["jobId", "sourceHash", "signal", "onCreated", "command", "endpoint", "migration", "targets"]);
  ensure(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(options.jobId) && /^[a-f0-9]{64}$/.test(options.sourceHash) &&
    options.signal instanceof AbortSignal && typeof options.onCreated === "function" && typeof use === "function" &&
    (options.command === undefined || typeof options.command === "function") && (options.migration === undefined || typeof options.migration === "boolean"), "POSTGRES_FIXTURE_INPUT_INVALID", "هویت job و source دیتابیس ساختگی باید از میزبان مشخص باشد.", 409);
  stop(options.signal);
  ensure(options.targets === undefined || options.migration === true && Array.isArray(options.targets) && options.targets.length > 0 && options.targets.length <= 4 &&
    options.targets.every(id => typeof id === "string" && /^[a-z][a-z0-9_]{0,31}$/.test(id)) && new Set(options.targets).size === options.targets.length,
    "POSTGRES_FIXTURE_INPUT_INVALID", "دیتابیس‌های runner باید محدود و متعلق به همین آزمون باشند.", 409);
  const targets = options.targets?.map((id, index) => Object.freeze({ id, database: `launchlane_target_${index}`, user: `launchlane_app_${index}` }));
  const bounded = AbortSignal.any([options.signal, AbortSignal.timeout(360000)]), raw = options.command ?? docker;
  const endpoint = options.endpoint ?? await operatorDockerEndpoint(bounded, raw), host = dockerEndpointHost(endpoint);
  const command: Command = (args, signal, maxBytes, bytes) => abortable(() => raw(["--host", host, ...args], signal, maxBytes, bytes), signal);
  const owner = { jobId: options.jobId, sourceHash: options.sourceHash, name: `launchlane-postgres-${options.jobId}` };
  let ownedId: string | null = null, createStarted = false, contradictoryReadback = false, verifiedImageId = imageId;
  let callbackSettled = true, callbackUncertain = false, callbackSettlement: Promise<void> | null = null;
  let outcome: { ok: true; value: T } | { ok: false; error: AppError } = { ok: false, error: new AppError("POSTGRES_FIXTURE_UNAVAILABLE", "آزمون دیتابیس کامل نشد.", 503) };
  try {
    verifiedImageId = await cachedImage(command, AbortSignal.any([bounded, AbortSignal.timeout(5000)])); stop(bounded);
    ensure(await inspect(owner.name, command, bounded) === null, "POSTGRES_FIXTURE_UNCERTAIN", "محیطی با نام همین job از قبل وجود دارد؛ اجرای قبلی باید بررسی شود.", 409);
    stop(bounded); createStarted = true;
    let created: CommandResult;
    try { created = await command(["create", "--pull=never", "--name", owner.name,
      "--label", `ir.launchlane.worker=${worker}`, "--label", `ir.launchlane.job=${owner.jobId}`, "--label", `ir.launchlane.source=${owner.sourceHash}`,
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "999:999", "--cpus", "0.25",
      "--memory", "512m", "--memory-swap", "512m", "--pids-limit", "128", "--log-driver", "none", "--restart", "no", "--no-healthcheck", "--ipc", "private",
      ...Object.entries(tmpfs).flatMap(([path, value]) => ["--tmpfs", `${path}:${value}`]),
      ...blankSandboxProxyArguments(),
      "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--env", `POSTGRES_USER=${fixture.user}`, "--env", `POSTGRES_DB=${fixture.database}`, "--env", `PGDATA=${data}`,
      postgresFixtureImage, "postgres", "-c", "listen_addresses=127.0.0.1", "-c", "port=5432", "-c", "max_connections=20", "-c", "shared_buffers=32MB",
      "-c", `unix_socket_directories=${socket}`, "-c", "logging_collector=off", "-c", "log_statement=none"], bounded, 8192); }
    catch { created = { output: "", exitCode: null, signal: "LOST_RESPONSE" }; }
    const id = await resolveCreatedContainer(created, { name: owner.name, label: worker, image: postgresFixtureImage }, command);
    ensure(id, "POSTGRES_FIXTURE_UNCERTAIN", "ساخت محیط پاسخ قطعی ندارد؛ درخواست تازه خودکار ارسال نشد.", 503);
    const row = await inspect(id, command); ensure(row, "POSTGRES_FIXTURE_UNCERTAIN", "محیط ساخته‌شده قابل مشاهده نیست.", 503);
    contradictoryReadback = row.id !== id; identity(row, id, owner, verifiedImageId); ownedId = id;
    try { await abortable(() => Promise.resolve(options.onCreated(id)), bounded); } catch { throw new AppError("POSTGRES_FIXTURE_RECEIPT_FAILED", "رسید محیط در job ثبت نشد؛ دیتابیس شروع نشد.", 503); }
    ensure(ok(created) && created.output.trim() === id, "POSTGRES_FIXTURE_UNCERTAIN", "پاسخ ساخت از دست رفته است؛ ایجاد مجدد یا ادامهٔ خودکار مجاز نیست.", 503);
    stop(bounded); isolation(row, false);
    const started = await command(["start", id], bounded, 4096);
    ensure(ok(started) && started.output.trim() === id, "POSTGRES_FIXTURE_UNCERTAIN", "شروع محیط پاسخ قطعی ندارد؛ تکرار نشد.", 503);
    const ready = AbortSignal.any([bounded, AbortSignal.timeout(60000)]); let accepting = false;
    for (let attempt = 0; attempt < 120 && !accepting; attempt++) {
      stop(ready); const state = await inspect(id, command); ensure(state, "POSTGRES_FIXTURE_UNCERTAIN", "محیط دیتابیس هنگام انتظار ناپدید شد.", 503); identity(state, id, owner, verifiedImageId); isolation(state, true);
      const checked = await command(["exec", "--user", "999:999", id, "pg_isready", "-q", "-h", fixture.host, "-p", "5432", "-U", fixture.user, "-d", fixture.database, "-t", "1"],
        AbortSignal.any([ready, AbortSignal.timeout(2500)]), 4096);
      ensure(!checked.signal && checked.exitCode !== null && [0, 1, 2].includes(checked.exitCode), "POSTGRES_FIXTURE_NOT_READY", "بررسی آمادگی دیتابیس به نتیجهٔ معتبر نرسید.", 409);
      accepting = checked.exitCode === 0;
      if (!accepting) await pause(250, undefined, { signal: ready });
    }
    ensure(accepting, "POSTGRES_FIXTURE_NOT_READY", "دیتابیس ساختگی در مهلت محدود آماده نشد.", 409); stop(bounded);
    const mounted = await command(["exec", "--user", "999:999", id, "cat", "/proc/self/mountinfo"], bounded, 32768);
    ensure(ok(mounted), "POSTGRES_FIXTURE_ISOLATION_INVALID", "نوع واقعی فضای داده قابل بررسی نیست.", 409); mountInfo(mounted.output);
    const current = await inspect(id, command); ensure(current, "POSTGRES_FIXTURE_UNCERTAIN", "محیط پیش از دسترسی برنامه قابل مشاهده نیست.", 503); identity(current, id, owner, verifiedImageId); isolation(current, true); stop(bounded);
    const query = async (sql: string, user: string, readOnly: boolean, signal: AbortSignal, database: string = fixture.database, transaction = true): Promise<CommandResult> => {
      ensure(options.migration === true && Buffer.byteLength(sql) <= 1024 * 1024, "POSTGRES_MIGRATION_DENIED", "اجرای SQL فقط در آزمون migration مصوب و محدود مجاز است.", 409);
      const checked = await inspect(id, command, signal); ensure(checked, "POSTGRES_FIXTURE_UNCERTAIN", "هویت دیتابیس پیش از SQL موجود نیست.", 409);
      identity(checked, id, owner, verifiedImageId); isolation(checked, true); stop(signal);
      const local = transaction ? "LOCAL " : "", prefix = transaction ? `BEGIN${readOnly ? " READ ONLY" : ""}; ` : "";
      const input = Buffer.from(`${prefix}SET ${local}standard_conforming_strings=on; SET ${local}statement_timeout='30s'; SET ${local}lock_timeout='2s'; SET ${local}idle_in_transaction_session_timeout='35s'; ${targets ? `SET ${local}search_path=pg_catalog; ` : ""}${sql}\n${transaction ? "COMMIT;" : ""}\n`);
      return command(["exec", "--user", "999:999", "-i", id, "psql", "-X", "-q", "-t", "-A", "--set=ON_ERROR_STOP=1", "-h", user === fixture.user || user === "launchlane_observer" ? socket : fixture.host, "-p", "5432", "-U", user, "-d", database], signal, 32768, input);
    };
    if (options.migration) {
      if (targets) {
        const observer = await query("CREATE ROLE launchlane_observer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS; GRANT pg_read_all_data TO launchlane_observer;", fixture.user, false, bounded);
        ensure(ok(observer), "POSTGRES_MIGRATION_SETUP_FAILED", "خوانندهٔ مستقل داده ساخته نشد؛ source اجرا نشد.", 409);
        for (const target of targets) {
          const created = await query(`CREATE ROLE ${target.user} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; CREATE DATABASE ${target.database};`, fixture.user, false, bounded, fixture.database, false);
          ensure(ok(created), "POSTGRES_MIGRATION_SETUP_FAILED", "دیتابیس مستقل موقت آماده نشد؛ source اجرا نشد.", 409);
          const grants = await query(`REVOKE ALL ON DATABASE ${target.database} FROM PUBLIC; GRANT CONNECT ON DATABASE ${target.database} TO ${target.user},launchlane_observer; REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE,CREATE ON SCHEMA public TO ${target.user};`, fixture.user, false, bounded, target.database);
          ensure(ok(grants), "POSTGRES_MIGRATION_SETUP_FAILED", "دسترسی مستقل هر دیتابیس آماده نشد؛ source اجرا نشد.", 409);
        }
      } else {
        const initialized = await query(`CREATE ROLE launchlane_migration_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CONNECT ON DATABASE launchlane_fixture TO launchlane_migration_app;
GRANT USAGE,CREATE ON SCHEMA public TO launchlane_migration_app;
CREATE TABLE public._launchlane_migrations(path text PRIMARY KEY,sha256 text NOT NULL CHECK(length(sha256)=64));
GRANT SELECT,INSERT ON public._launchlane_migrations TO launchlane_migration_app;`, fixture.user, false, bounded);
      ensure(ok(initialized), "POSTGRES_MIGRATION_SETUP_FAILED", "آماده‌سازی role محدود و دفتر migration موفق نبود؛ source اجرا نشد.", 409);
      }
      // Shared network namespaces must not turn trust authentication into a root bypass.
      // Root is reachable only through the unshared PG-container socket; workers get only the app role over TCP.
      const hba = Buffer.from(`local all launchlane_fixture trust\n${targets ? "local all launchlane_observer trust\n" : ""}local all all reject\n${targets ? targets.map(target => `host ${target.database} ${target.user} 127.0.0.1/32 trust\n`).join("") : "host launchlane_fixture launchlane_migration_app 127.0.0.1/32 trust\n"}host all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n`);
      const policy = await command(["exec", "--user", "999:999", "-i", id, "tee", `${data}/pg_hba.conf`], bounded, 4096, hba);
      ensure(ok(policy), "POSTGRES_MIGRATION_SETUP_FAILED", "محدودکردن دسترسی دیتابیس موقت کامل نشد؛ worker شروع نشد.", 409);
      const reload = await query("SELECT pg_catalog.pg_reload_conf();", fixture.user, false, bounded);
      ensure(ok(reload) && reload.output.trim() === "t", "POSTGRES_MIGRATION_SETUP_FAILED", "بارگذاری policy دیتابیس موقت تأیید نشد؛ worker شروع نشد.", 409);
      const policyDeadline = AbortSignal.any([bounded, AbortSignal.timeout(5000)]); let rootDenied = false;
      while (!rootDenied) {
        stop(policyDeadline);
        const checked = await command(["exec", "--user", "999:999", "-i", id, "psql", "-X", "-q", "-t", "-A", "-h", fixture.host, "-U", fixture.user, "-d", fixture.database], policyDeadline, 4096, Buffer.from("SELECT 1;\n"));
        rootDenied = checked.exitCode === 2 && !checked.signal && checked.output.includes("pg_hba.conf rejects connection");
        ensure(rootDenied || ok(checked), "POSTGRES_MIGRATION_SETUP_FAILED", "رد دسترسی root از namespace برنامه قابل تأیید نیست؛ worker شروع نشد.", 409);
        if (!rootDenied) await pause(100, undefined, { signal: policyDeadline });
      }
    }
    const binding = Object.freeze({ ...fixture, user: options.migration && !targets ? "launchlane_migration_app" as const : fixture.user, jobId: owner.jobId, sourceHash: owner.sourceHash, containerId: id, networkMode: `container:${id}` as const, ...(targets ? { targets: Object.freeze(targets) } : {}) });
    const sql: PostgresFixtureSql = Object.freeze({ apply: (text, signal) => { ensure(!targets, "MIGRATION_RUNNER_SQL_DENIED", "runner اصلی مسئول SQL است؛ میزبان SQL جایگزین تزریق نمی‌کند.", 409); return query(text, "launchlane_migration_app", false, signal); },
      read: (text, signal, targetId) => { if (!targets) { ensure(targetId === undefined, "MIGRATION_TARGET_UNKNOWN", "دیتابیس انتخاب‌شده متعلق به این آزمون نیست.", 409); return query(text, fixture.user, true, signal); }
        const target = targets.find(target => target.id === targetId); ensure(target, "MIGRATION_TARGET_UNKNOWN", "خواندن فقط از دیتابیس همان معیار مصوب مجاز است.", 409); return query(text, "launchlane_observer", true, signal, target.database); } });
    callbackSettled = false;
    const callback = Promise.resolve().then(() => use(binding, bounded, sql));
    callbackSettlement = callback.then(() => { callbackSettled = true; }, error => {
      callbackSettled = true;
      callbackUncertain = error instanceof AppError && /(?:UNCERTAIN|CLEANUP_UNCONFIRMED)/.test(error.code);
    });
    try { outcome = { ok: true, value: await abortable(() => callback, bounded) }; }
    catch (error) { if (bounded.aborted) throw new AppError("CANCELLED", "آزمون دیتابیس متوقف شد؛ نتیجهٔ موفق ثبت نشد.", 409); if (error instanceof AppError && /^(?:MIGRATION_|BUILD_OUTPUT_)/.test(error.code)) throw error; throw new AppError("POSTGRES_FIXTURE_CALLBACK_FAILED", "آزمون برنامه در دیتابیس ساختگی موفق نبود.", 409); }
  } catch (error) {
    outcome = { ok: false, error: error instanceof AppError ? error : new AppError(options.signal.aborted || bounded.aborted ? "CANCELLED" : createStarted ? "POSTGRES_FIXTURE_UNCERTAIN" : "POSTGRES_FIXTURE_UNAVAILABLE",
      "اجرای دیتابیس ساختگی کامل نشد؛ جزئیات خصوصی نمایش داده نشد و ایجاد دوباره انجام نشد.", 503) };
  }
  // Unconfirmed cleanup dominates a successful callback: the caller must retain the receipt and stop.
  if (createStarted) {
      const cleanup = AbortSignal.timeout(5000);
      try {
        ensure(!contradictoryReadback, "POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED", "رسید نام و شناسهٔ محیط متعارض است؛ حذف خودکار انجام نشد.", 503);
        if (!ownedId) {
          const recovered = await inspect(owner.name, command, cleanup);
          if (recovered) {
            const candidate = typeof recovered.id === "string" ? recovered.id : ""; identity(recovered, candidate, owner, verifiedImageId); ownedId = candidate;
            await abortable(() => Promise.resolve(options.onCreated(candidate)), cleanup);
          }
        }
        if (ownedId) {
          const before = await inspect(ownedId, command, cleanup);
          if (before) {
            identity(before, ownedId, owner, verifiedImageId);
            const removed = await command(["rm", "--force", ownedId], cleanup, 4096);
            ensure(ok(removed) && await inspect(ownedId, command, cleanup) === null, "POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED", "پایان محیط همین job تأیید نشد.", 503);
          }
        }
        // A cancelled callback may still be tearing down its own worker. Do not release
        // the caller's capacity/receipt as settled while that work remains in flight.
        if (!callbackSettled && callbackSettlement) await abortable(() => callbackSettlement, cleanup);
        ensure(callbackSettled && !callbackUncertain, "POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED", "پایان worker آزمون تأیید نشد؛ رسید همین job باید برای بررسی باقی بماند.", 503);
      } catch {
        throw new AppError("POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED", "حذف محیط متعلق به همین job تأیید نشد؛ ایجاد دوباره خودکار مجاز نیست.", 503);
      }
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
