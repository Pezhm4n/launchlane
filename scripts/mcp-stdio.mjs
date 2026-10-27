import { lstatSync, readFileSync } from "node:fs";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Server } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { parseMcpAccessFile } from "../src/contracts/mcp-access-file.ts";

// This process deliberately imports no Store, runtime, worker or provider credential.
const upstream = new Client({ name: "launchlane-stdio-bridge", version: "0.2.0" });
let server, closing;
const shutdown = new AbortController();
function close() {
  closing ??= Promise.resolve().then(async () => {
    shutdown.abort();
    await server?.close().catch(() => undefined);
    await upstream.close().catch(() => undefined);
    process.stdin.pause();
  });
  return closing;
}
function failure(code) {
  return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: { code,
    message: code === "AUTH_REQUIRED" ? "Access expired or was revoked. Sign in and import a fresh scoped access file."
      : "Launchlane did not complete the request. Read the saved mission before retrying a write; preserve requestKey.", retryable: false } }) }] };
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void close(); });
try {
  const path = process.env.LAUNCHLANE_MCP_ACCESS_FILE;
  if (!path) throw Error("access");
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw Error("access");
  const input = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")), url = new URL(input.url);
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  const expected = process.env.LAUNCHLANE_MCP_ORIGIN || (loopback ? url.origin : "");
  const access = parseMcpAccessFile(input, expected);
  await upstream.connect(new StreamableHTTPClientTransport(new URL(access.url), {
    requestInit: { headers: { authorization: `Bearer ${access.accessToken}` } },
    fetch: (input, init) => fetch(input, { ...init, redirect: "error", signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), shutdown.signal]) }),
  }));
  server = new Server({ name: "launchlane", version: "0.1.0" }, { capabilities: { tools: {} }, instructions: "This bridge uses the running Launchlane web application's state and policy. Required approvals are reviewed in Launchlane. Reconnect only replays stored missions; it never resumes a model or write by itself." });
  server.onerror = () => { /* SDK errors can contain request headers. */ };
  server.onclose = () => { void close(); };
  server.setRequestHandler("tools/list", async request => {
    try {
      if (access.expiresAt <= Date.now()) throw Error("expired");
      return await upstream.listTools(request.params);
    } catch { throw Error("Launchlane discovery failed. Check the server and renew expired or revoked access."); }
  });
  server.setRequestHandler("tools/call", async (request, context) => {
    if (access.expiresAt <= Date.now()) return failure("AUTH_REQUIRED");
    try { return await upstream.callTool(request.params, { signal: context.mcpReq.signal, timeout: 130000 }); }
    catch (error) { return failure(error?.code === 401 || error?.status === 401 ? "AUTH_REQUIRED" : "MCP_UPSTREAM_UNAVAILABLE"); }
  });
  await server.connect(new StdioServerTransport());
} catch {
  // Provider/SDK errors may contain headers. Never copy their arbitrary message to a host transcript.
  process.stderr.write("Launchlane MCP connection failed. Verify the server, scoped file and expiry. HTTPS requires LAUNCHLANE_MCP_ORIGIN matching the trusted origin. Import using setup:mcp -- --from-file <file> --origin <origin>.\n");
  await close();
  process.exitCode = 1;
}
