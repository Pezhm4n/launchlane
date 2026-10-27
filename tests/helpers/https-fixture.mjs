import { execFile } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Agent } from "undici";

// Test-local CA only. TLS verification stays enabled in SDK/CLI processes.
export async function httpsFixture() {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-mcp-tls-"));
  const certPath = join(directory, "cert.pem"), keyPath = join(directory, "key.pem"), configPath = join(directory, "openssl.cnf");
  let proxy, agent;
  try {
    await writeFile(configPath, "[req]\ndistinguished_name=dn\n[dn]\nCN=localhost\n");
    await promisify(execFile)(process.env.LAUNCHLANE_TEST_OPENSSL || "openssl", ["req", "-config", configPath, "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost", "-keyout", keyPath, "-out", certPath], { windowsHide: true, timeout: 15000 });
    const cert = await readFile(certPath), key = await readFile(keyPath);
    let backend = "";
    proxy = createServer({ cert, key }, (incoming, outgoing) => {
      const upstream = request(new URL(incoming.url, backend), { method: incoming.method, headers: incoming.headers }, response => {
        outgoing.writeHead(response.statusCode, response.headers); response.pipe(outgoing);
      });
      upstream.on("error", () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
      outgoing.on("close", () => upstream.destroy()); incoming.pipe(upstream);
    });
    await new Promise((done, reject) => { proxy.once("error", reject); proxy.listen(0, "127.0.0.1", done); });
    const origin = `https://127.0.0.1:${proxy.address().port}`;
    agent = new Agent({ connect: { ca: cert } });
    const fingerprint = createHash("sha256").update(new X509Certificate(cert).publicKey.export({ format: "der", type: "spki" })).digest("base64");
    return {
      origin, certPath, fingerprint,
      setBackend(value) { backend = value; },
      fetch(input, init) { return fetch(input, { ...init, dispatcher: agent, redirect: "error" }); },
      async close() {
        await agent.close(); proxy.closeAllConnections(); await new Promise(done => proxy.close(done));
        await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      },
    };
  } catch (error) {
    await agent?.close(); proxy?.closeAllConnections(); proxy?.close();
    await rm(directory, { recursive: true, force: true }); throw error;
  }
}
