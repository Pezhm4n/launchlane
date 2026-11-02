import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { docker } from "../../src/server/agent/container.ts";

/** Local target from the actual approved archive; no provider or source checkout is executed. */
export async function componentTarget(bytes: Buffer, port = 8080, dockerfile = ".launchlane-component.Dockerfile") {
  assert.ok([".launchlane-component.Dockerfile", ".launchlane-executable.Dockerfile"].includes(dockerfile));
  const name = `launchlane-component-${randomUUID()}`, label = `ir.launchlane.component-test=${name}`;
  let id: string | undefined, imageBuilt = false;
  const cleanup = async () => {
    if (id) {
      const owner = await docker(["inspect", "--format", '{{index .Config.Labels "ir.launchlane.component-test"}}', id], AbortSignal.timeout(10000));
      assert.equal(owner.output.trim(), name); assert.equal((await docker(["rm", "--force", id], AbortSignal.timeout(10000))).exitCode, 0); id = undefined;
    }
    if (imageBuilt) {
      const owner = await docker(["image", "inspect", "--format", '{{index .Config.Labels "ir.launchlane.component-test"}}', name], AbortSignal.timeout(10000));
      assert.equal(owner.output.trim(), name); assert.equal((await docker(["image", "rm", name], AbortSignal.timeout(10000))).exitCode, 0); imageBuilt = false;
    }
  };
  try {
    const built = await docker(["build", "--pull=false", "--network=none", "--label", label, "-f", dockerfile, "-t", name, "-"], AbortSignal.timeout(90000), 65536, bytes);
    assert.equal(built.exitCode, 0, built.output); imageBuilt = true;
    const created = await docker(["create", "--pull=never", "--name", name, "--label", label, "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--memory=256m", "--pids-limit=64", "--cpus=1", "--tmpfs", "/tmp:rw,nosuid,nodev,size=16777216", "--publish", `127.0.0.1::${port}`, name], AbortSignal.timeout(10000));
    assert.equal(created.exitCode, 0, created.output); id = created.output.trim(); assert.match(id, /^[a-f0-9]{64}$/);
    assert.equal((await docker(["start", id], AbortSignal.timeout(10000))).exitCode, 0);
    const published = await docker(["port", id, String(port)], AbortSignal.timeout(10000)); assert.equal(published.exitCode, 0); assert.match(published.output.trim(), /^127\.0\.0\.1:\d+$/);
    const origin = `http://${published.output.trim()}`;
    for (let poll = 0; poll < 60; poll++) { try { const response = await fetch(`${origin}/launchlane-build-proof.json`); if (response.status === 200) return { origin, close: cleanup }; } catch { /* bounded startup */ } await new Promise(resolve => setTimeout(resolve, 100)); }
    const logs = await docker(["logs", id], AbortSignal.timeout(10000)); throw Error(`compiled target failed: ${logs.output}`);
  } catch (error) { await cleanup(); throw error; }
}
