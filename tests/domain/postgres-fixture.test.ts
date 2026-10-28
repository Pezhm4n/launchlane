import assert from "node:assert/strict";
import { test } from "node:test";
import type { docker, CommandResult } from "../../src/server/agent/container.ts";
import { localDockerEndpoint } from "../../src/server/agent/docker-engine.ts";
import { postgresFixtureImage, withPostgresFixture } from "../../src/server/agent/postgres-fixture.ts";
import { AppError } from "../../src/server/errors.ts";
import { sandboxProxyKeys } from "../../src/server/agent/docker-proxy.ts";
import { object } from "../../src/contracts/validation.ts";

const jobId = "11111111-1111-4111-8111-111111111111", sourceHash = "2".repeat(64), id = "3".repeat(64);
const actualImage = "sha256:392c708576858a9a583a1b937503a99df57ca5dae63890748f4d0f2fc848abc6";
const data = "/var/lib/postgresql/data", socket = "/var/run/postgresql", name = `launchlane-postgres-${jobId}`;
const endpoint = localDockerEndpoint("unix:///fixture/docker.sock"), host = "unix:///fixture/docker.sock";
const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
const result = (output: string, exitCode: number | null = 0, signal: string | null = null): CommandResult => ({ output, exitCode, signal });
type Options = {
  image?: (row: Record<string, unknown>) => void;
  row?: (row: Record<string, unknown>, used: boolean) => void;
  create?: "lost" | "throw" | "absent" | "wrong-id";
  preexisting?: boolean; ready?: number[]; startFail?: boolean; cleanup?: "fail" | "remain"; badMount?: boolean;
};
function harness(options: Options = {}) {
  const events: string[] = [], calls: string[][] = [];
  let created = Boolean(options.preexisting), running = false, removed = false, used = false, readiness = 0;
  const row = (): Record<string, unknown> => {
    const value = { id, name: `/${name}`, image: postgresFixtureImage, actualImage,
      labels: { "ir.launchlane.worker": "postgres-fixture-v1", "ir.launchlane.job": jobId, "ir.launchlane.source": sourceHash }, env:sandboxProxyKeys.map(key=>`${key}=`), running, oom: false, user: "999:999",
      host: { ReadonlyRootfs: true, Privileged: false, NetworkMode: "none", PublishAllPorts: false, PortBindings: null,
        Binds: null, Mounts: [], Devices: [], CapAdd: null, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"], Memory: 536870912, MemorySwap: 536870912,
        NanoCpus: 250000000, PidsLimit: 128, PidMode: "", IpcMode: "private", RestartPolicy: { Name: "no" }, LogConfig: { Type: "none" },
        Tmpfs: { [data]: "rw,nosuid,nodev,noexec,size=268435456,uid=999,gid=999,mode=0700", [socket]: "rw,nosuid,nodev,noexec,size=16777216,uid=999,gid=999,mode=0700" } },
      mounts: [], networks: running ? { none: {} } : {}, ports: { "5432/tcp": null } };
    options.row?.(value, used); return value;
  };
  const command: typeof docker = async (args, commandSignal) => {
    assert.deepEqual(args.slice(0, 2), ["--host", host], "every operation stays bound to the operator-local engine");
    const fields = args.slice(2); calls.push(fields);
    if (fields[0] === "image") {
      const value = { id: actualImage, os: "linux", architecture: "amd64", digests: [`postgres@${postgresFixtureImage.split("@")[1]}`], volumes: { [data]: {} }, onBuild: null };
      options.image?.(value); return result(JSON.stringify(value));
    }
    if (fields[0] === "inspect") {
      const reference = fields.at(-1);
      if (!created || removed || ![id, name].includes(reference ?? "")) return result(`Error: No such container: ${reference}`, 1);
      const value = row(), format = fields[fields.indexOf("--format") + 1] ?? "";
      return result(JSON.stringify(format.includes("actualImage") ? value : { id: value.id, name: value.name, image: value.image, labels: value.labels }));
    }
    if (fields[0] === "create") {
      events.push("create"); assert.equal(fields.includes("--pull=never"), true);
      for (const denied of ["--publish", "-p", "--volume", "-v", "--mount", "--env-file", "--privileged"]) assert.equal(fields.includes(denied), false);
      assert.equal(fields[fields.indexOf("--network") + 1], "none"); assert.equal(fields[fields.indexOf("--user") + 1], "999:999");
      assert.equal(fields.filter(value => value === "--tmpfs").length, 2);
      for(const key of sandboxProxyKeys)assert.ok(fields.some((value,index)=>value==="--env"&&fields[index+1]===`${key}=`));
      created = options.create !== "absent";
      if (options.create === "throw") throw Error("synthetic private transport detail");
      if (options.create === "lost" || options.create === "absent") return result("", null, "TIMEOUT");
      return result(options.create === "wrong-id" ? "4".repeat(64) : id);
    }
    if (fields[0] === "start") {
      events.push("start"); assert.equal(events.includes("receipt"), true, "the receipt is durable before start");
      if (options.startFail) return result("", null, "TIMEOUT");
      running = true; return result(id);
    }
    if (fields[0] === "exec" && fields.includes("pg_isready")) {
      events.push("ready"); assert.equal(fields[3], id); readiness++;
      return result("not exposed", options.ready?.[readiness - 1] ?? options.ready?.at(-1) ?? 0);
    }
    if (fields[0] === "exec" && fields.includes("cat")) {
      events.push("mount-readback");
      return result([data, socket].map((path, index) => `${index + 10} 1 0:2 / ${path} rw,nosuid,nodev,noexec,relatime - ${options.badMount ? "ext4" : "tmpfs"} tmpfs rw,size=16384k,uid=999,gid=999`).join("\n"));
    }
    if (fields[0] === "rm") {
      events.push("remove"); assert.deepEqual(fields, ["rm", "--force", id]); assert.equal(commandSignal.aborted, false, "cleanup has an independent deadline");
      if (options.cleanup === "fail") return result("private cleanup detail", 1);
      if (options.cleanup !== "remain") removed = true;
      return result(id);
    }
    throw Error("unexpected fixture command");
  };
  return { command, calls, events, markUsed: () => { used = true; events.push("use"); }, receipt: async () => { events.push("receipt"); },
    removed: () => removed, created: () => created, uses: () => used };
}
const setup = (h: ReturnType<typeof harness>, signal = AbortSignal.timeout(3000)) => ({ jobId, sourceHash, signal, endpoint, command: h.command, onCreated: h.receipt });

test("synthetic fixture awaits receipt, verifies readiness and mounts, exposes only the exact loopback namespace, and removes its owned ID", async () => {
  const h = harness(), value = await withPostgresFixture(setup(h), async binding => {
    h.markUsed(); assert.equal(Object.isFrozen(binding), true);
    assert.deepEqual(binding, { jobId, sourceHash, containerId: id, networkMode: `container:${id}`, host: "127.0.0.1", port: 5432,
      user: "launchlane_fixture", database: "launchlane_fixture", authentication: "isolated_trust" }); return 42;
  });
  assert.equal(value, 42); assert.equal(h.removed(), true);
  assert.deepEqual(h.events, ["create", "receipt", "start", "ready", "mount-readback", "use", "remove"]);
  assert.equal(h.calls.some(args => ["pull", "run", "network", "volume", "prune"].includes(args[0] ?? "")), false);
});

test("containerd manifest identity requires the pinned descriptor and remains frozen for every container readback", async () => {
  const digest = postgresFixtureImage.split("@")[1]; assert.ok(digest);
  const h = harness({ image: row => { row.id = digest; row.descriptor = { digest, mediaType: "application/vnd.oci.image.manifest.v1+json", size: 3641 }; }, row: row => { row.actualImage = digest; } });
  await withPostgresFixture(setup(h), async () => { h.markUsed(); }); assert.equal(h.removed(), true);
  for (const descriptor of [null, { digest: "sha256:" + "f".repeat(64), mediaType: "application/vnd.oci.image.manifest.v1+json", size: 3641 },
    { digest, mediaType: "application/vnd.oci.image.index.v1+json", size: 3641 }]) {
    const denied = harness({ image: row => { row.id = digest; row.descriptor = descriptor; } });
    await assert.rejects(withPostgresFixture(setup(denied), async () => denied.markUsed()), code("POSTGRES_FIXTURE_IMAGE_MISMATCH")); assert.equal(denied.created(), false);
  }
});
test("canonical Debian socket mount is still tmpfs with all required flags and a second ambiguous mount is denied", async () => {
  for (const duplicate of [false, true]) {
    const h = harness(), original = h.command;
    const command: typeof docker = async (args, signal, max, input) => { const response = await original(args, signal, max, input);
      if (args.includes("/proc/self/mountinfo")) return { ...response, output: response.output.replaceAll("/var/run/postgresql", "/run/postgresql") + (duplicate ? `\n44 1 0:3 / /var/run/postgresql rw,nosuid,nodev,noexec - tmpfs tmpfs rw` : "") }; return response; };
    if (duplicate) await assert.rejects(withPostgresFixture({ ...setup(h), command }, async () => h.markUsed()), code("POSTGRES_FIXTURE_ISOLATION_INVALID"));
    else await withPostgresFixture({ ...setup(h), command }, async () => h.markUsed());
    assert.equal(h.removed(), true); assert.equal(h.uses(), !duplicate);
  }
});
test("migration SQL uses an ordinary role, host reads are read-only, and every SQL call revalidates the fixture", async () => {
  const h = harness(), inputs: { args: string[]; text: string }[] = [], original = h.command; let rootDenied = false;
  const command: typeof docker = async (args, signal, max, input) => {
    if (args.includes("tee")) { assert.ok(input); assert.match(input.toString(), /local all launchlane_fixture trust/); assert.match(input.toString(), /host all all 0.0.0.0\/0 reject/); return result(""); }
    if (args.includes("psql")) { assert.ok(input);
      if (args[args.indexOf("-U") + 1] === "launchlane_fixture" && args[args.indexOf("-h") + 1] === "127.0.0.1") { rootDenied = true; return result("pg_hba.conf rejects connection", 2); }
      inputs.push({ args, text: input.toString() }); return result(input.includes(Buffer.from("pg_reload_conf")) ? "t\n" : ""); }
    return original(args, signal, max, input);
  };
  await withPostgresFixture({ ...setup(h), command, migration: true }, async (binding, signal, sql) => {
    h.markUsed(); assert.equal(rootDenied, true); assert.equal(binding.user, "launchlane_migration_app"); await sql.apply("CREATE TABLE public.example(id integer);", signal); await sql.read("SELECT 1;", signal);
  });
  assert.equal(inputs.length, 4); assert.match(inputs[0]?.text ?? "", /NOSUPERUSER NOCREATEDB NOCREATEROLE/);
  assert.ok(inputs[2]?.args.includes("launchlane_migration_app")); assert.ok(inputs[3]?.args.includes("launchlane_fixture")); assert.match(inputs[3]?.text ?? "", /^BEGIN READ ONLY;/);
  assert.ok(inputs[3]?.args.includes(socket)); assert.ok(inputs[2]?.args.includes("127.0.0.1"));
  assert.ok(inputs.every(row => row.args.includes("--set=ON_ERROR_STOP=1") && row.text.includes("lock_timeout='2s'"))); assert.equal(h.removed(), true);
});
test("migration never exposes the namespace if policy installation or actual root rejection cannot be verified", async () => {
  for (const kind of ["policy", "connection", "accepted"] as const) {
    const h = harness(), original = h.command;
    const command: typeof docker = async (args, signal, max, input) => {
      if (args.includes("tee")) return result("", kind === "policy" ? 1 : 0);
      if (args.includes("psql")) {
        if (args[args.indexOf("-h") + 1] === "127.0.0.1") return kind === "accepted" ? result("1") : result("connection refused", 2);
        return result(input?.includes(Buffer.from("pg_reload_conf")) ? "t\n" : "");
      }
      return original(args, signal, max, input);
    };
    await assert.rejects(withPostgresFixture({ ...setup(h, AbortSignal.timeout(250)), command, migration: true }, async () => h.markUsed()));
    assert.equal(h.uses(), false); assert.equal(h.removed(), true);
  }
});

test("runner setup separates database roles and observer, denies source SQL, and fails closed on partial setup or unknown targets", async () => {
  for (const fail of [false, true]) {
    const h = harness(), original = h.command, inputs: { args: string[]; text: string }[] = []; let callback = false;
    const command: typeof docker = async (args, signal, max, input) => {
      if (args.includes("tee")) { assert.ok(input); const policy = input.toString(); assert.match(policy, /local all launchlane_observer trust/); assert.match(policy, /host launchlane_target_0 launchlane_app_0 127.0.0.1\/32 trust/); assert.match(policy, /host launchlane_target_1 launchlane_app_1 127.0.0.1\/32 trust/); assert.equal(policy.includes("host all launchlane_observer"), false); return result(""); }
      if (args.includes("psql")) { assert.ok(input);
        if (args[args.indexOf("-U") + 1] === "launchlane_fixture" && args[args.indexOf("-h") + 1] === "127.0.0.1") return result("pg_hba.conf rejects connection", 2);
        inputs.push({ args, text: input.toString() }); return result(input.includes(Buffer.from("pg_reload_conf")) ? "t\n" : "", fail && input.includes(Buffer.from("CREATE DATABASE launchlane_target_1")) ? 1 : 0);
      }
      return original(args, signal, max, input);
    };
    const task = () => withPostgresFixture({ ...setup(h), command, migration: true, targets: ["auth", "profile"] }, async (binding, signal, sql) => {
      callback = true; h.markUsed(); assert.deepEqual(binding.targets?.map(target => target.user), ["launchlane_app_0", "launchlane_app_1"]);
      await assert.rejects(async () => sql.apply("INSERT INTO public.x VALUES(1);", signal), code("MIGRATION_RUNNER_SQL_DENIED"));
      await assert.rejects(async () => sql.read("SELECT 1;", signal, "missing"), code("MIGRATION_TARGET_UNKNOWN"));
      await sql.read("SELECT 1;", signal, "profile");
    });
    if (fail) await assert.rejects(task(), code("POSTGRES_MIGRATION_SETUP_FAILED")); else await task();
    assert.equal(callback, !fail); assert.equal(h.removed(), true); assert.ok(inputs.some(input => input.text.includes("NOSUPERUSER") && input.text.includes("pg_read_all_data")));
    if (!fail) { const read = inputs.at(-1); assert.ok(read); assert.equal(read.args[read.args.indexOf("-U") + 1], "launchlane_observer"); assert.equal(read.args[read.args.indexOf("-d") + 1], "launchlane_target_1"); assert.match(read.text, /^BEGIN READ ONLY;/); assert.match(read.text, /search_path=pg_catalog/); assert.ok(read.args.includes(socket)); }
  }
  const h = harness();
  for (const targets of [["auth", "auth"], ["../../other"], []]) await assert.rejects(withPostgresFixture({ ...setup(h), migration: true, targets }, async () => h.markUsed()), code("POSTGRES_FIXTURE_INPUT_INVALID"));
  assert.deepEqual(h.calls, []);
});
test("an absent image fails before creation and never invokes pull or a callback", async () => {
  const h = harness(), absent: typeof docker = async (args, signal) => args.includes("image") ? result(`Error: No such image: ${postgresFixtureImage}`, 1) : h.command(args, signal);
  await assert.rejects(withPostgresFixture({ ...setup(h), command: absent }, async () => h.markUsed()), code("POSTGRES_FIXTURE_IMAGE_UNAVAILABLE"));
  assert.deepEqual(h.events, []);
});
test("image ID, repo digest, OS, architecture, OnBuild and inherited volume declarations are verified before create", async () => {
  for (const alter of [(row: Record<string, unknown>) => { row.id = `sha256:${"0".repeat(64)}`; }, (row: Record<string, unknown>) => { row.os = "windows"; },
    (row: Record<string, unknown>) => { row.architecture = "arm64"; }, (row: Record<string, unknown>) => { row.digests = []; },
    (row: Record<string, unknown>) => { row.onBuild = ["RUN unexpected"]; }, (row: Record<string, unknown>) => { row.volumes = { "/unexpected": {} }; }]) {
    const h = harness({ image: alter }); await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_IMAGE_MISMATCH")); assert.deepEqual(h.events, []);
  }
});
test("a preexisting same-name job is never started, claimed or deleted as a fresh fixture", async () => {
  const h = harness({ preexisting: true });
  await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_UNCERTAIN")); assert.deepEqual(h.events, []);
});
test("lost create replies are reconciled by exact ownership but never replayed or used", async () => {
  for (const create of ["lost", "throw"] as const) {
    const h = harness({ create }); await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_UNCERTAIN"));
    assert.equal(h.calls.filter(args => args[0] === "create").length, 1); assert.equal(h.events.includes("receipt"), true); assert.equal(h.removed(), true); assert.equal(h.uses(), false); assert.equal(h.events.includes("start"), false);
  }
});
test("an absent lost-create readback stays uncertain and never deletes a name or starts another create", async () => {
  const h = harness({ create: "absent" }); await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_UNCERTAIN"));
  assert.deepEqual(h.events, ["create"]); assert.equal(h.calls.filter(args => args[0] === "create").length, 1);
});
test("a wrong returned ID is not trusted; exact name/source/image recovery only records and cleans the actual owned fixture", async () => {
  const h = harness({ create: "wrong-id" }); await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_UNCERTAIN"));
  assert.equal(h.events.includes("receipt"), true); assert.equal(h.removed(), true); assert.equal(h.uses(), false);
});
test("a lost initial readback is reconciled for cleanup without replaying create or invoking the application", async () => {
  const h = harness(); let lost = false;
  const command: typeof docker = async (args, signal, maxBytes, bytes) => {
    if (!lost && args.includes("inspect") && args.at(-1) === id) { lost = true; throw Error("synthetic lost readback"); }
    return h.command(args, signal, maxBytes, bytes);
  };
  await assert.rejects(withPostgresFixture({ ...setup(h), command }, async () => h.markUsed()), code("POSTGRES_FIXTURE_UNCERTAIN"));
  assert.equal(h.removed(), true); assert.equal(h.uses(), false); assert.equal(h.events.filter(event => event === "create").length, 1);
});
test("the selected local endpoint remains frozen if caller configuration changes between commands", async () => {
  const h = harness(), selected = { socketPath: "/fixture/docker.sock" };
  const command: typeof docker = async (args, signal, maxBytes, bytes) => {
    selected.socketPath = "/changed/daemon.sock";
    return h.command(args, signal, maxBytes, bytes);
  };
  await withPostgresFixture({ ...setup(h), command, endpoint: selected }, async () => h.markUsed());
  assert.equal(h.removed(), true);
});
test("foreign source, job, image and internal identity are never removed even after an apparent create", async () => {
  for (const alter of [(row: Record<string, unknown>) => { object(row.labels)["ir.launchlane.source"] = "0".repeat(64); },
    (row: Record<string, unknown>) => { object(row.labels)["ir.launchlane.job"] = "foreign-job"; },
    (row: Record<string, unknown>) => { row.actualImage = `sha256:${"0".repeat(64)}`; }, (row: Record<string, unknown>) => { row.id = "0".repeat(64); }]) {
    const h = harness({ row: alter }); await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED"));
    assert.equal(h.events.includes("remove"), false); assert.equal(h.uses(), false);
  }
});
test("binds, persistent/anonymous volumes, public ports, wrong namespace, user or resource limits deny callback", async () => {
  for (const alter of [(row: Record<string, unknown>) => { object(row.host).Binds = ["/host:/data"]; },
    (row: Record<string, unknown>) => { row.mounts = [{ Type: "volume", Destination: data, Source: "/daemon/volume", RW: true }]; },
    (row: Record<string, unknown>) => { object(row.host).PortBindings = { "5432/tcp": [{ HostPort: "5432" }] }; },
    (row: Record<string, unknown>) => { row.ports = { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "5432" }] }; },
    (row: Record<string, unknown>) => { object(row.host).NetworkMode = "bridge"; }, (row: Record<string, unknown>) => { row.user = "0:0"; },
    (row: Record<string, unknown>) => { object(row.host).NanoCpus = 0; }, (row: Record<string, unknown>) => { object(row.host).Memory = 0; },
    (row: Record<string, unknown>) => { object(row.host).Tmpfs = { [socket]: "" }; }]) {
    const h = harness({ row: alter }); await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_ISOLATION_INVALID"));
    assert.equal(h.uses(), false); assert.equal(h.removed(), true); assert.equal(h.events.includes("start"), false);
  }
});
test("the actual mount type is checked after startup instead of trusting only requested tmpfs options", async () => {
  const h = harness({ badMount: true }); await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_ISOLATION_INVALID"));
  assert.equal(h.uses(), false); assert.equal(h.removed(), true);
});
test("readiness polls are bounded reads and the callback waits for an actual successful pg_isready", async () => {
  const h = harness({ ready: [1, 0] }); await withPostgresFixture(setup(h), async () => h.markUsed());
  assert.equal(h.events.filter(event => event === "ready").length, 2); assert.equal(h.removed(), true);
  const failed = harness({ ready: [3] }); await assert.rejects(withPostgresFixture(setup(failed), async () => failed.markUsed()), code("POSTGRES_FIXTURE_NOT_READY"));
  assert.equal(failed.uses(), false); assert.equal(failed.removed(), true);
});
test("failure to persist a creation receipt stops before start and still cleans the verified resource", async () => {
  const h = harness(); await assert.rejects(withPostgresFixture({ ...setup(h), onCreated: () => { throw Error("private receipt detail"); } }, async () => h.markUsed()), code("POSTGRES_FIXTURE_RECEIPT_FAILED"));
  assert.equal(h.events.includes("start"), false); assert.equal(h.uses(), false); assert.equal(h.removed(), true);
});
test("callback errors are sanitized and cannot bypass teardown", async () => {
  const h = harness(); await assert.rejects(withPostgresFixture(setup(h), async () => { h.markUsed(); throw Error("private callback detail"); }),
    error => code("POSTGRES_FIXTURE_CALLBACK_FAILED")(error) && !String(error).includes("private callback detail")); assert.equal(h.removed(), true);
});
test("an uncertain start is not retried and the service cannot be used", async () => {
  const h = harness({ startFail: true }); await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_UNCERTAIN"));
  assert.equal(h.events.filter(event => event === "start").length, 1); assert.equal(h.removed(), true); assert.equal(h.uses(), false);
});
test("cleanup failure or unchanged post-removal readback overrides callback success", async () => {
  for (const cleanup of ["fail", "remain"] as const) {
    const h = harness({ cleanup }); await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED")); assert.equal(h.uses(), true);
  }
});
test("ownership is revalidated before removal, including when it changes during a callback", async () => {
  const h = harness({ row: (row, used) => { if (used) object(row.labels)["ir.launchlane.source"] = "0".repeat(64); } });
  await assert.rejects(withPostgresFixture(setup(h), async () => h.markUsed()), code("POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED")); assert.equal(h.events.includes("remove"), false);
});
test("cancellation before create makes no command; cancellation and timeout during callback still clean with their own signal", async () => {
  const stopped = new AbortController(); stopped.abort(); const before = harness();
  await assert.rejects(withPostgresFixture(setup(before, stopped.signal), async () => before.markUsed()), code("CANCELLED")); assert.deepEqual(before.calls, []);
  const active = new AbortController(), h = harness();
  await assert.rejects(withPostgresFixture(setup(h, active.signal), async () => { h.markUsed(); setTimeout(() => active.abort(), 5); return new Promise<never>(() => undefined); }), code("POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED"));
  assert.equal(h.removed(), true);
});
test("invalid job/source/extra environment and non-local daemon endpoints are rejected before Docker operations", async () => {
  const h = harness();
  for (const values of [{ ...setup(h), jobId: "new-job" }, { ...setup(h), sourceHash: "bad-hash" }])
    await assert.rejects(withPostgresFixture(values, async () => h.markUsed()), code("POSTGRES_FIXTURE_INPUT_INVALID"));
  const extra = { ...setup(h), environment: [{ key: "DATABASE_URL", value: "synthetic-input-denied" }] };
  await assert.rejects(withPostgresFixture(extra, async () => h.markUsed()), code("INVALID_INPUT"));
  await assert.rejects(withPostgresFixture({ ...setup(h), endpoint: { socketPath: "tcp://example.invalid:2375" } }, async () => h.markUsed()), code("SANDBOX_ENGINE_UNSUPPORTED"));
  assert.deepEqual(h.calls, []);
});
test("an actual parent deadline cannot be renewed by the fixture and any created resource is settled independently", async () => {
  const h = harness(), deadline = AbortSignal.timeout(40);
  await assert.rejects(withPostgresFixture(setup(h, deadline), async () => { h.markUsed(); return new Promise<never>(() => undefined); }), code("POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED"));
  assert.equal(deadline.aborted, true); assert.ok(!h.created() || h.removed());
});

test("cancellation waits for the callback's worker settlement before returning an ordinary cancelled outcome", async () => {
  const active = new AbortController(), h = harness(); let settled = false;
  await assert.rejects(withPostgresFixture(setup(h, active.signal), async (_binding, signal) => {
    h.markUsed();
    setTimeout(() => active.abort(),5);
    await new Promise<void>(resolve => signal.addEventListener("abort", () => setTimeout(() => {settled = true;resolve();},20),{once:true}));
  }).finally(() => assert.equal(settled,true)),code("CANCELLED"));
});

test("uncertain callback worker cleanup cannot be hidden behind a successful database teardown", async () => {
  const h = harness();
  await assert.rejects(withPostgresFixture(setup(h), async () => {h.markUsed();throw new AppError("SANDBOX_CLEANUP_UNCONFIRMED","private worker detail",503);}),code("POSTGRES_FIXTURE_CLEANUP_UNCONFIRMED"));
  assert.equal(h.removed(),true);
});

test("operator proxy credentials injected by Docker CLI are denied before starting the fixture", async()=>{
  const h=harness({row:row=>{row.env=sandboxProxyKeys.map(key=>`${key}=${key==='HTTP_PROXY'?'http://user:private-value@example.invalid':''}`);}});
  await assert.rejects(withPostgresFixture(setup(h),async()=>h.markUsed()),code("POSTGRES_FIXTURE_ISOLATION_INVALID"));
  assert.equal(h.events.includes("start"),false);assert.equal(h.uses(),false);assert.equal(h.removed(),true);
});
