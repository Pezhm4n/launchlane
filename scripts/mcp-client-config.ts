import { isAbsolute, resolve } from "node:path";
import { mcpOrigin } from "../src/contracts/mcp-access-file.ts";

// Mergeable snippets only: never overwrite a user's host configuration.
export function mcpClientConfigurations(accessFile: string, origin: string, node = process.execPath, bridge = resolve("scripts/mcp-stdio.mjs")) {
  if (![accessFile, node, bridge].every(isAbsolute)) throw Error("MCP configuration requires absolute local paths");
  const env = { LAUNCHLANE_MCP_ACCESS_FILE: accessFile, LAUNCHLANE_MCP_ORIGIN: mcpOrigin(origin) };
  return {
    codex: `[mcp_servers.launchlane]\ncommand = ${JSON.stringify(node)}\nargs = [${JSON.stringify(bridge)}]\nstartup_timeout_sec = 30\ntool_timeout_sec = 150\n\n[mcp_servers.launchlane.env]\nLAUNCHLANE_MCP_ACCESS_FILE = ${JSON.stringify(accessFile)}\nLAUNCHLANE_MCP_ORIGIN = ${JSON.stringify(env.LAUNCHLANE_MCP_ORIGIN)}\n`,
    claude: JSON.stringify({ mcpServers: { launchlane: { type: "stdio", command: node, args: [bridge], env } } }, null, 2),
    opencode: JSON.stringify({ mcp: { launchlane: { type: "local", command: [node, bridge], environment: env, enabled: true, timeout: 150000 } } }, null, 2),
  };
}
