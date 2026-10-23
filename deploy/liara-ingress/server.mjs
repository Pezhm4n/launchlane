import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";

export function ingressConfig(env) {
  const origin = new URL(env.PUBLIC_ORIGIN ?? "");
  if (origin.protocol !== "https:" || origin.origin !== env.PUBLIC_ORIGIN || origin.username || origin.password ||
    !/^[a-z0-9][a-z0-9-]*\.liara\.run$/.test(origin.hostname) || isIP(env.UPSTREAM_IP ?? "") !== 4)
    throw Error("Ingress requires its exact approved Liara origin and IPv4");
  const pem = key => {
    const value = env[key] ?? "", bytes = Buffer.from(value, "base64");
    if (!value || bytes.length > 8192 || bytes.toString("base64") !== value) throw Error("Ingress TLS configuration is incomplete");
    return bytes;
  };
  return { host: origin.host, upstream: env.UPSTREAM_IP, ca: pem("UPSTREAM_CA_BASE64"),
    cert: pem("UPSTREAM_CLIENT_CERT_BASE64"), key: pem("UPSTREAM_CLIENT_KEY_BASE64") };
}
const hopHeaders = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
function forwardHeaders(headers) {
  const removed = new Set([...hopHeaders, ...String(headers.connection ?? "").split(",").map(value => value.trim().toLowerCase())]);
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !removed.has(key)));
}
export function createIngress(config, send = https.request) {
  return http.createServer((request, response) => {
    if (request.headers.host !== config.host) { response.writeHead(421); response.end("Invalid host"); return; }
    if (!request.url?.startsWith("/") || request.url.startsWith("//") || request.method === "CONNECT") {
      response.writeHead(400); response.end("Invalid request target"); return;
    }
    const limit = 32 * 1024 * 1024, length = Number(request.headers["content-length"] ?? 0);
    if (!Number.isSafeInteger(length) || length < 0 || length > limit) { response.writeHead(413); response.end("Request too large"); return; }
    // The private TLS peer has its own identity; Caddy restores the fixed public Host.
    const headers = { ...forwardHeaders(request.headers), host: "launchlane-origin", "x-forwarded-host": config.host, "x-forwarded-proto": "https" };
    const upstream = send({ hostname: config.upstream, port: 8443, servername: "launchlane-origin", ca: config.ca, cert: config.cert, key: config.key,
      rejectUnauthorized: true, method: request.method, path: request.url, headers, timeout: 900000 }, result => {
      response.writeHead(result.statusCode ?? 502, { ...forwardHeaders(result.headers), "x-accel-buffering": "no" });
      result.pipe(response);
    });
    let bytes = 0;
    request.on("data", chunk => { bytes += chunk.length; if (bytes > limit) { upstream.destroy(); if (!response.headersSent) response.writeHead(413); response.end("Request too large"); } });
    request.on("aborted", () => upstream.destroy());
    response.on("close", () => { if (!response.writableEnded) upstream.destroy(); });
    upstream.on("timeout", () => upstream.destroy());
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502, { "content-type": "application/json", "cache-control": "no-store" }); response.end('{"code":"ORIGIN_UNAVAILABLE"}'); });
    request.pipe(upstream);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createIngress(ingressConfig(process.env));
  server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
  process.on("SIGTERM", () => server.close()); process.on("SIGINT", () => server.close());
}
