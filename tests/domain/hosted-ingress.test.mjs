import assert from "node:assert/strict";
import { once } from "node:events";
import { Writable, Readable } from "node:stream";
import http from "node:http";
import { test } from "node:test";
import { createIngress, ingressConfig } from "../../deploy/liara-ingress/server.mjs";
const config = { host: "launchlane-live-1023.liara.run", upstream: "62.60.194.53", ca: Buffer.from("ca"), cert: Buffer.from("cert"), key: Buffer.from("private-key") };
async function fixture(run) {
  const calls = [];
  const server = createIngress(config, (options, callback) => {
    calls.push(options); let body = "";
    const stream = new Writable({ write(bytes, _encoding, done) { body += bytes; done(); }, final(done) {
      const result = Readable.from([JSON.stringify({ body })]); result.statusCode = 200;
      result.headers = { "content-type": "application/json", "set-cookie": ["session=sample; Secure; HttpOnly; SameSite=Strict"] };
      callback(result); done();
    } }); return stream;
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try { await run(server.address().port, calls); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
function request(port, path, headers, body = "") {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method: body ? "POST" : "GET", headers }, res => {
      let data = ""; res.on("data", bytes => { data += bytes; }); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }); req.on("error", reject); req.end(body);
  });
}
test("ingress binds TLS verification, client credentials and the exact public host without buffering the body", async () => fixture(async (port, calls) => {
  const result = await request(port, "/api/mcp", { host: config.host, "content-length": "4", "x-forwarded-proto": "http" }, "test");
  assert.equal(result.status, 200); assert.deepEqual(JSON.parse(result.body), { body: "test" });
  assert.equal(calls.length, 1); assert.equal(calls[0].rejectUnauthorized, true); assert.equal(calls[0].servername, "launchlane-origin");
  assert.equal(calls[0].headers.host, calls[0].servername); assert.equal(calls[0].headers["x-forwarded-host"], config.host);
  assert.equal(calls[0].headers["x-forwarded-proto"], "https");
  assert.equal(calls[0].key, config.key); assert.deepEqual(result.headers["set-cookie"], ["session=sample; Secure; HttpOnly; SameSite=Strict"]);
  assert.equal(result.headers["x-accel-buffering"], "no"); assert.ok(!result.body.includes("private-key"));
}));
test("unapproved hosts, absolute targets and oversized uploads never reach the origin", async () => fixture(async (port, calls) => {
  assert.equal((await request(port, "/", { host: "another.liara.run" })).status, 421);
  assert.equal((await request(port, "http://127.0.0.1/private", { host: config.host })).status, 400);
  assert.equal((await request(port, "//127.0.0.1/private", { host: config.host })).status, 400);
  assert.equal((await request(port, "/", { host: config.host, "content-length": String(33 * 1024 * 1024) })).status, 413);
  assert.equal(calls.length, 0);
}));
test("hop-by-hop credentials and connection-nominated fields are stripped", async () => fixture(async (port, calls) => {
  await request(port, "/", { host: config.host, connection: "keep-alive, x-private-hop", "x-private-hop": "secret", "proxy-authorization": "secret" });
  for (const name of ["connection", "x-private-hop", "proxy-authorization"]) assert.equal(calls[0].headers[name], undefined);
}));
test("ingress configuration refuses an alternate public origin, missing TLS and non-IP upstream", () => {
  for (const change of [{ PUBLIC_ORIGIN: "http://launchlane-live-1023.liara.run" }, { PUBLIC_ORIGIN: "https://untrusted.test" },
    { PUBLIC_ORIGIN: "https://launchlane-live-1023.liara.run", UPSTREAM_IP: "localhost" }, { PUBLIC_ORIGIN: "https://launchlane-live-1023.liara.run", UPSTREAM_IP: "62.60.194.53" }])
    assert.throws(() => ingressConfig(change));
});
