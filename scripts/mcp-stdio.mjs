import { readFileSync } from "node:fs";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Server } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

// This process deliberately imports no Store, runtime, worker or provider credential.
const upstream = new Client({ name: "launchlane-stdio-bridge", version: "0.1.0" });
let server;
async function close() { await Promise.allSettled([upstream.close(), server?.close()]); }
try {
  const path = process.env.LAUNCHLANE_MCP_ACCESS_FILE;
  if (!path) throw Error("access");
  const access = JSON.parse(readFileSync(path, "utf8"));
  const url = new URL(access.url);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/api/mcp" || url.username || url.password || url.search || url.hash || typeof access.accessToken !== "string" || access.accessToken.length > 2048 || !Number.isSafeInteger(access.expiresAt) || access.expiresAt <= Date.now()) throw Error("access");
  await upstream.connect(new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { authorization: `Bearer ${access.accessToken}` } },
    fetch: (input, init) => fetch(input, { ...init, redirect: "error" }),
  }));
  server = new Server({ name: "launchlane", version: "0.1.0" }, { capabilities: { tools: {} }, instructions: "This bridge uses the running Launchlane web application's state and policy. Required approvals are reviewed in Launchlane. Reconnect only replays stored missions; it never resumes a model or write by itself." });
  server.setRequestHandler("tools/list", request => upstream.listTools(request.params));
  server.setRequestHandler("tools/call", (request, context) => upstream.callTool(request.params, { signal: context.mcpReq.signal }));
  await server.connect(new StdioServerTransport());
  process.stdin.on("end", () => { void close(); });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void close().finally(() => process.exit(0)); });
} catch {
  // Provider/SDK errors may contain headers. Never copy their arbitrary message to a host transcript.
  process.stderr.write("Launchlane MCP connection failed. Start the local web server and renew the scoped access file with scripts/setup-mcp.mjs. Check the configured loopback origin and SDK version.\n");
  await close();
  process.exitCode = 1;
}
