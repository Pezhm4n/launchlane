// Disposable server only. External model/provider sockets are denied; workload sockets
// map one fixed public name to the test-owned Docker target from the actual archive.
import assert from "node:assert/strict";
import { appendFileSync, readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import https from "node:https";
import http from "node:http";
import dns from "node:dns/promises";
import { syncBuiltinESMExports } from "node:module";
const nativeFetch = globalThis.fetch, nativeLookup = dns.lookup;
const publicHost = "sample-node.liara.run", log = value => appendFileSync(process.env.LAUNCHLANE_AGENT_FIXTURE_LOG, `${JSON.stringify(value)}\n`);
const target = () => { const value = JSON.parse(readFileSync(`${process.env.LAUNCHLANE_STATE_DIR}/component-target.json`, "utf8")); assert.match(value.origin, /^http:\/\/127\.0\.0\.1:\d+$/); return value; };
let uploadedHash = null, released = false;
dns.lookup = async (host, options) => { if (host === publicHost) return [{ address: "93.184.216.34", family: 4 }]; if (["127.0.0.1", "localhost"].includes(host)) return nativeLookup(host, options); throw Error("unregistered DNS denied"); };
https.request = (url, options, callback) => {
  const requested = new URL(url); assert.equal(requested.origin, `https://${publicHost}`); log({ probe: requested.pathname });
  const endpoint = target(); assert.equal(uploadedHash, endpoint.archiveHash); assert.equal(released, true);
  return http.request(new URL(requested.pathname + requested.search, endpoint.origin), { ...options, lookup: undefined, family: undefined }, callback);
};
syncBuiltinESMExports();
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url), method = init.method ?? "GET";
  if (["127.0.0.1", "localhost"].includes(url.hostname)) return nativeFetch(input, init);
  if (url.origin === "https://ai.boxapi.ir" && method === "POST") {
    const body = JSON.parse(String(init.body)), prepared = body.messages.some(message => message.role === "user" && message.content.startsWith("Host local preparation receipt"));
    const name = prepared ? "propose_publication" : "propose_project_build", args = { path: "/", status: 200, assertion: { kind: "text", contains: "Component lifecycle" },
      ...(prepared ? {} : { componentRoot: "apps/api", apiChecks: [{ path: "/api/value", status: 200, assertions: [{ pointer: ["total"], equals: 73 }] }] }) };
    assert.ok(body.tools.some(tool => tool.function.name === name)); log({ model: name });
    return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } }] } }], usage: { total_tokens: 10 } });
  }
  if (url.origin === "https://api.liara.ir") {
    log({ provider: method, path: url.pathname });
    if (method === "GET" && url.pathname === "/v1/projects/sample-node") return Response.json({ project: { _id: "c".repeat(24), project_id: "sample-node", type: "docker", status: "running", planID: "starter", envs: [], defaultSubdomain: true } });
    if (method === "GET" && url.pathname.endsWith("/releases")) return Response.json({ total: released ? 1 : 0, currentRelease: released ? "component-release" : null, releases: released ? [{ _id: "component-release", state: "READY", port: 8080 }] : [] });
    if (method === "POST" && url.pathname === "/v2/projects/sample-node/sources") {
      assert.ok(init.body instanceof FormData); const file = init.body.get("file"); assert.ok(file instanceof Blob);
      uploadedHash = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex"); assert.equal(uploadedHash, target().archiveHash); return Response.json({ sourceID: "component-source" });
    }
    if (method === "POST" && url.pathname === "/v2/projects/sample-node/releases") {
      assert.deepEqual(JSON.parse(String(init.body)), { sourceID: "component-source", port: 8080, type: "docker", platformConfig: {}, build: { dockerfile: ".launchlane-component.Dockerfile" } });
      assert.equal(uploadedHash, target().archiveHash); assert.equal(released, false); released = true; return Response.json({ releaseID: "component-release" });
    }
  }
  throw Error(`unregistered external request denied: ${method} ${url.origin}${url.pathname}`);
};
