import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { postgresTestImage } from "../../src/contracts/test-database.ts";
import { resolveCreatedContainer, type CommandResult } from "../../src/server/agent/container.ts";

export type PostgresObserverFixture = Readonly<{
  address: string; port: number;
  sql(query: string): Promise<string>;
  close(): Promise<void>;
}>;

/** Local Docker test setup only. The optional password stays in child env, never command arguments/output. */
export async function createPostgresObserverFixture(password = randomBytes(24).toString("hex")): Promise<PostgresObserverFixture> {
  assert.ok(password.length >= 8 && password.length <= 4096 && !password.includes("\0"), "Disposable observer fixture password is invalid.");
  const addresses = Object.values(networkInterfaces()).flatMap(rows => rows ?? []).filter(row => row.family === "IPv4" && !row.internal &&
    (/^10\./.test(row.address) || /^192\.168\./.test(row.address) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(row.address)))
    .sort((a, b) => Number(b.address.startsWith("192.168.")) - Number(a.address.startsWith("192.168.")) || a.address.localeCompare(b.address));
  const address = addresses[0]?.address;
  assert.ok(address, "Actual observer test requires a host RFC1918 IPv4 interface; loopback/public fallback is forbidden.");
  const name = `launchlane-observer-${randomUUID()}`, label = randomUUID(), expected = { name, label, image: postgresTestImage };
  async function command(args: string[], signal: AbortSignal, maxBytes = 8192, input?: Buffer): Promise<CommandResult> {
    if (signal.aborted) throw new Error("Disposable observer Docker command was cancelled before starting.");
    return new Promise((resolve, reject) => {
      const child = spawn("docker", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, POSTGRES_PASSWORD: password } });
      const chunks: Buffer[] = []; let bytes = 0, limited = false;
      const stop = () => child.kill(); signal.addEventListener("abort", stop, { once: true });
      child.stdin.on("error", () => undefined); child.stdin.end(input);
      for (const pipe of [child.stdout, child.stderr]) pipe.on("data", (chunk: Buffer) => {
        bytes += chunk.byteLength; if (bytes > maxBytes) { limited = true; child.kill(); } else chunks.push(chunk);
      });
      child.once("error", () => { signal.removeEventListener("abort", stop); reject(new Error("Disposable observer Docker command was unavailable.")); });
      child.once("close", (exitCode, killed) => { signal.removeEventListener("abort", stop); resolve({ output: Buffer.concat(chunks).toString("utf8"), exitCode: limited || signal.aborted ? null : exitCode, signal: limited ? "OUTPUT_LIMIT" : killed }); });
    });
  }
  const cached = await command(["image", "inspect", postgresTestImage, "--format", "{{.Id}}"], AbortSignal.timeout(10000));
  assert.equal(cached.exitCode, 0, "The pinned PostgreSQL image must already be cached; this test never silently pulls.");
  let id: string | null = null, closed = false;
  const close = async () => {
    if (!id || closed) return;
    const removed = await command(["rm", "--force", "--volumes", id], AbortSignal.timeout(10000));
    assert.equal(removed.exitCode, 0, "Only the exact correlated disposable observer container may be removed; cleanup is unconfirmed.");
    closed = true;
  };
  try {
    const created = await command(["run", "--pull=never", "--rm", "--detach", "--name", name, "--label", `ir.launchlane.worker=${label}`,
      "--restart=no", "--memory=256m", "--cpus=1", "--pids-limit=128", "--publish", `${address}:0:5432`,
      "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_DB=postgres", postgresTestImage], AbortSignal.timeout(20000));
    id = await resolveCreatedContainer(created, expected, command); assert.ok(id, "Disposable PostgreSQL creation did not return a correlated container.");
    const ownedId = id;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      // The image briefly starts a Unix-only bootstrap server. Wait for the final TCP server,
      // otherwise seeding can race bootstrap shutdown despite pg_isready's earlier success.
      const probe = await command(["exec", ownedId, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", "postgres"], AbortSignal.timeout(2000));
      if (probe.exitCode === 0) { ready = true; break; } await delay(300);
    }
    assert.ok(ready, "Disposable PostgreSQL did not become ready in its bounded startup window.");
    const published = await command(["inspect", "--format", "{{json .NetworkSettings.Ports}}", ownedId], AbortSignal.timeout(5000));
    assert.equal(published.exitCode, 0); const ports: unknown = JSON.parse(published.output);
    assert.ok(typeof ports === "object" && ports !== null && "5432/tcp" in ports);
    const mappings = ports["5432/tcp"]; assert.ok(Array.isArray(mappings) && mappings.length === 1);
    const mapping: unknown = mappings[0]; assert.ok(typeof mapping === "object" && mapping !== null && "HostIp" in mapping && "HostPort" in mapping);
    assert.equal(mapping.HostIp, address); assert.ok(typeof mapping.HostPort === "string" && /^\d{1,5}$/.test(mapping.HostPort));
    const port = Number(mapping.HostPort); assert.ok(port > 0 && port <= 65535);
    const sql = async (query: string) => {
      assert.ok(!closed, "Disposable observer fixture is already closed.");
      const result = await command(["exec", "--interactive", ownedId, "psql", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], AbortSignal.timeout(10000), 4096, Buffer.from(query));
      assert.equal(result.exitCode, 0, "Disposable fixture SQL failed; private stderr is withheld."); return result.output.trim();
    };
    return { address, port, sql, close };
  } catch (error) { await close(); throw error; }
}
